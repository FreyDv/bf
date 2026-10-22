import {
  ApplicationAutoScalingClient,
  DescribeScalableTargetsCommand,
  RegisterScalableTargetCommand,
} from '@aws-sdk/client-application-auto-scaling';
import {
  DescribeServicesCommand,
  ECSClient,
  TagResourceCommand,
  UpdateServiceCommand,
} from '@aws-sdk/client-ecs';

/** What the orchestrator knows about one ECS service; everything comes from DescribeServices. */
export interface ServiceState {
  /** App name (`order`), i.e. the ECS service name without the prefix. */
  name: string;
  arn: string;
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
  rolloutState?: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
  /** Epoch seconds of the PRIMARY deployment's last update (fallback for "last activity"). */
  deploymentUpdatedAt: number;
  taskDefinition?: string;
  tags: Record<string, string>;
}

export interface Bounds {
  min: number;
  max: number;
}

/** The handful of AWS calls the orchestrator needs; `SdkEcsApi` is the only code touching the SDK. */
export interface EcsApi {
  describeServices(names: string[]): Promise<ServiceState[]>;
  updateDesiredCount(name: string, desired: number): Promise<void>;
  forceNewDeployment(name: string): Promise<void>;
  /** Application Auto Scaling bounds of the service (`min 0/0` = asleep, `min 1/N` = awake). */
  setBounds(name: string, min: number, max: number): Promise<void>;
  getBounds(names: string[]): Promise<Record<string, Bounds>>;
  tag(arn: string, tags: Record<string, string>): Promise<void>;
}

export const ECS_API = Symbol.for('bf.orchestrator.ecsApi');

export class SdkEcsApi implements EcsApi {
  private readonly ecs: ECSClient;
  private readonly scaling: ApplicationAutoScalingClient;

  constructor(
    private readonly cluster: string,
    private readonly servicePrefix: string,
    region?: string,
  ) {
    this.ecs = new ECSClient(region ? { region } : {});
    this.scaling = new ApplicationAutoScalingClient(region ? { region } : {});
  }

  private serviceName(name: string) {
    return `${this.servicePrefix}${name}`;
  }

  private appName(serviceName: string) {
    return serviceName.startsWith(this.servicePrefix)
      ? serviceName.slice(this.servicePrefix.length)
      : serviceName;
  }

  async describeServices(names: string[]): Promise<ServiceState[]> {
    const out: ServiceState[] = [];
    for (let i = 0; i < names.length; i += 10) {
      const { services = [] } = await this.ecs.send(
        new DescribeServicesCommand({
          cluster: this.cluster,
          services: names.slice(i, i + 10).map((n) => this.serviceName(n)),
          include: ['TAGS'],
        }),
      );
      for (const s of services) {
        const primary = s.deployments?.find((d) => d.status === 'PRIMARY');
        out.push({
          name: this.appName(s.serviceName ?? ''),
          arn: s.serviceArn ?? '',
          desiredCount: s.desiredCount ?? 0,
          runningCount: s.runningCount ?? 0,
          pendingCount: s.pendingCount ?? 0,
          rolloutState: primary?.rolloutState,
          deploymentUpdatedAt: Math.floor((primary?.updatedAt?.getTime() ?? 0) / 1000),
          taskDefinition: s.taskDefinition,
          tags: Object.fromEntries((s.tags ?? []).map((t) => [t.key ?? '', t.value ?? ''])),
        });
      }
    }
    return out;
  }

  async updateDesiredCount(name: string, desired: number): Promise<void> {
    await this.ecs.send(
      new UpdateServiceCommand({
        cluster: this.cluster,
        service: this.serviceName(name),
        desiredCount: desired,
      }),
    );
  }

  async forceNewDeployment(name: string): Promise<void> {
    await this.ecs.send(
      new UpdateServiceCommand({
        cluster: this.cluster,
        service: this.serviceName(name),
        forceNewDeployment: true,
      }),
    );
  }

  private resourceId(name: string) {
    return `service/${this.cluster}/${this.serviceName(name)}`;
  }

  async setBounds(name: string, min: number, max: number): Promise<void> {
    await this.scaling.send(
      new RegisterScalableTargetCommand({
        ServiceNamespace: 'ecs',
        ResourceId: this.resourceId(name),
        ScalableDimension: 'ecs:service:DesiredCount',
        MinCapacity: min,
        MaxCapacity: max,
      }),
    );
  }

  async getBounds(names: string[]): Promise<Record<string, Bounds>> {
    const out: Record<string, Bounds> = {};
    for (let i = 0; i < names.length; i += 50) {
      const { ScalableTargets = [] } = await this.scaling.send(
        new DescribeScalableTargetsCommand({
          ServiceNamespace: 'ecs',
          ScalableDimension: 'ecs:service:DesiredCount',
          ResourceIds: names.slice(i, i + 50).map((n) => this.resourceId(n)),
        }),
      );
      for (const t of ScalableTargets) {
        const serviceName = t.ResourceId?.split('/').pop() ?? '';
        out[this.appName(serviceName)] = { min: t.MinCapacity ?? 0, max: t.MaxCapacity ?? 0 };
      }
    }
    return out;
  }

  async tag(arn: string, tags: Record<string, string>): Promise<void> {
    await this.ecs.send(
      new TagResourceCommand({
        resourceArn: arn,
        tags: Object.entries(tags).map(([key, value]) => ({ key, value })),
      }),
    );
  }
}
