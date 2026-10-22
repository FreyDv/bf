import { Aws, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

import { viewerRequestCode } from './cloudfront/viewer-request.ts';
import { config, names } from './config.ts';

import type { App } from './apps.ts';
import type { PlatformParameter } from './config.ts';
import type { Network } from './network.ts';

export interface IngressProps {
  network: Network;
  /** Apps deployed as static sites (one private bucket each). */
  staticApps: App[];
  /**
   * Scope for the apex/api/admin alias records. Their construct ids are kept at `<stack>/Host/<Key>Record` — the
   * path the EC2-era A records had — so CloudFormation updates them in place (Route 53 rejects creating a second
   * record with the same name and type) and a `git revert` flips them back the same way.
   */
  recordScope: Construct;
}

const API_PREFIX = '/api';

/**
 * Public entry: one CloudFront distribution in front of two S3 buckets (the static frontends) and the ALB
 * (`/api/*` → the edge service). The ALB is reachable only by CloudFront: security group (prefix list) plus a
 * shared secret header checked by the listener rule. One ACM certificate (apex + wildcard) serves both.
 */
export class Ingress extends Construct {
  readonly certificate: acm.Certificate;
  readonly alb: elbv2.ApplicationLoadBalancer;
  readonly apiTargetGroup: elbv2.ApplicationTargetGroup;
  readonly distribution: cloudfront.Distribution;
  readonly staticBuckets: Record<string, s3.Bucket> = {};

  constructor(scope: Construct, id: string, { network, staticApps, recordScope }: IngressProps) {
    super(scope, id);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: config.hostedZoneId,
      zoneName: config.domains.main,
    });

    // CloudFront needs its certificate in us-east-1, which is also our region: one certificate for both.
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: config.domains.main,
      subjectAlternativeNames: [`*.${config.domains.main}`],
      validation: acm.CertificateValidation.fromDns(zone),
    });

    // ---------------------------------------------------------------- ALB (only CloudFront may call it)
    const originVerify = new secretsmanager.Secret(this, 'OriginVerify', {
      secretName: names.originVerifySecret,
      description: 'Header value CloudFront sends to the ALB; the listener rejects everything else',
      generateSecretString: { passwordLength: 32, excludePunctuation: true },
    });
    // a dynamic reference ({{resolve:secretsmanager:…}}), resolved by CloudFormation, never in the template
    const originVerifyValue = originVerify.secretValue.unsafeUnwrap();

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      loadBalancerName: names.alb,
      vpc: network.vpc,
      internetFacing: true,
      securityGroup: network.albSg,
      idleTimeout: Duration.seconds(config.cloudfront.originReadTimeoutS),
      dropInvalidHeaderFields: true,
    });
    this.apiTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      targetGroupName: names.apiTargetGroup,
      vpc: network.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      deregistrationDelay: Duration.seconds(15),
      // liveness only (no DB): the readiness probe would keep Aurora awake
      healthCheck: {
        path: '/health/live',
        interval: Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });
    const listener = this.alb.addListener('Https', {
      port: 443,
      certificates: [this.certificate],
      sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
      defaultAction: elbv2.ListenerAction.fixedResponse(403, {
        contentType: 'application/json', // an ALB fixed response accepts only html, json, javascript, css and plain
        messageBody: '{"status":403,"title":"Forbidden","detail":"direct access to the origin"}',
      }),
    });
    listener.addAction('FromCloudFront', {
      priority: 10,
      conditions: [elbv2.ListenerCondition.httpHeader('X-Origin-Verify', [originVerifyValue])],
      action: elbv2.ListenerAction.forward([this.apiTargetGroup]),
    });
    new route53.ARecord(this, 'OriginRecord', {
      zone,
      recordName: config.domains.origin,
      target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(this.alb)),
    });

    // ---------------------------------------------------------------- static frontends
    for (const app of staticApps) {
      this.staticBuckets[app.name] = new s3.Bucket(this, `Static-${app.name}`, {
        bucketName: names.staticBucket(Aws.ACCOUNT_ID, app.name),
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        removalPolicy: RemovalPolicy.DESTROY,
      });
    }
    const bucketOf = (name: string) => {
      const bucket = this.staticBuckets[name];
      if (!bucket) throw new Error(`no static app "${name}" under apps/`);
      return bucket;
    };

    // ---------------------------------------------------------------- CloudFront
    const viewerRequest = new cloudfront.Function(this, 'ViewerRequest', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: 'bf: host redirects, strip /api, directory index',
      code: cloudfront.FunctionCode.fromInline(
        viewerRequestCode({
          main: config.domains.main,
          redirects: {
            [config.domains.admin]: '/admin',
            [config.domains.api]: API_PREFIX,
            [config.domains.www]: '',
          },
          apiPrefix: API_PREFIX,
        }),
      ),
    });
    const functionAssociations = [
      { function: viewerRequest, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
    ];

    // the headers `next.config.ts` used to set; the api keeps its own (helmet)
    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      comment: 'bf static frontends',
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
            override: true,
          },
        ],
      },
    });

    const staticBehavior = (bucket: s3.Bucket): cloudfront.BehaviorOptions => ({
      origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      compress: true,
      responseHeadersPolicy: securityHeaders,
      functionAssociations,
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `bf ${config.env}`,
      domainNames: [
        config.domains.main,
        config.domains.www,
        config.domains.admin,
        config.domains.api,
      ],
      certificate: this.certificate,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultRootObject: 'index.html',
      defaultBehavior: staticBehavior(bucketOf('fe-main')),
      additionalBehaviors: {
        '/admin/*': staticBehavior(bucketOf('fe-admin')),
        [`${API_PREFIX}/*`]: {
          origin: new origins.HttpOrigin(config.domains.origin, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            readTimeout: Duration.seconds(config.cloudfront.originReadTimeoutS),
            customHeaders: { 'X-Origin-Verify': originVerifyValue },
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          functionAssociations,
        },
      },
    });

    // ---------------------------------------------------------------- DNS
    const alias = {
      dnsName: this.distribution.distributionDomainName,
      hostedZoneId: targets.CloudFrontTarget.CLOUDFRONT_ZONE_ID,
      evaluateTargetHealth: false,
    };
    const legacy = {
      Main: config.domains.main,
      Api: config.domains.api,
      Admin: config.domains.admin,
    };
    for (const [key, domain] of Object.entries(legacy)) {
      // same scope + id as the EC2-era records → updated in place (see IngressProps.recordScope)
      new route53.CfnRecordSet(recordScope, `${key}Record`, {
        hostedZoneId: config.hostedZoneId,
        name: `${domain}.`,
        type: 'A',
        aliasTarget: alias,
      });
    }
    new route53.CfnRecordSet(this, 'WwwRecord', {
      hostedZoneId: config.hostedZoneId,
      name: `${config.domains.www}.`,
      type: 'A',
      aliasTarget: alias,
    });
    for (const [key, domain] of Object.entries({ ...legacy, Www: config.domains.www })) {
      new route53.CfnRecordSet(this, `${key}RecordV6`, {
        hostedZoneId: config.hostedZoneId,
        name: `${domain}.`,
        type: 'AAAA',
        aliasTarget: alias,
      });
    }
  }

  /** Publishes the ids the operational scripts need (scripts/_ecs.ts, static-deploy.ts). */
  publishParameters(values: Record<PlatformParameter, string>) {
    for (const [key, value] of Object.entries(values)) {
      new ssm.StringParameter(this, `Param-${key}`, {
        parameterName: names.platformParameter(key as PlatformParameter),
        stringValue: value,
      });
    }
  }
}
