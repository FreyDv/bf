import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { DescribeDBClustersCommand, RDSClient } from '@aws-sdk/client-rds';

import type { DBCluster } from '@aws-sdk/client-rds';

/**
 * What the dashboard shows about one Aurora cluster. Capacity is in ACU (1 ACU ≈ 2 GiB RAM plus the matching
 * CPU; AWS publishes no fixed vCPU per ACU): 0 ACU means a Serverless v2 cluster is paused and costs nothing.
 */
export interface DatabaseView {
  clusterId: string;
  /** RDS cluster status (`available`, `stopped`, `backing-up`, …). */
  status: string;
  engine?: string;
  engineVersion?: string;
  /** Current capacity (ACU) from CloudWatch `ServerlessDatabaseCapacity`; undefined when no datapoint exists. */
  acu?: number;
  /** True when the current capacity is 0 (Serverless v2 auto-pause). */
  paused: boolean;
  minAcu?: number;
  maxAcu?: number;
  /** Epoch seconds of the capacity datapoint. */
  measuredAt?: number;
}

/** Every cluster the account has in this region: nothing to configure, the SDK discovers them. */
export interface DbApi {
  list(): Promise<DatabaseView[]>;
}

export const DB_API = Symbol.for('bf.orchestrator.dbApi');

/** CloudWatch publishes `ServerlessDatabaseCapacity` once a minute; look back a little further for a datapoint. */
const CAPACITY_LOOKBACK_MS = 5 * 60_000;

export class SdkRdsApi implements DbApi {
  private readonly rds: RDSClient;
  private readonly cloudwatch: CloudWatchClient;

  constructor(
    region?: string,
    private readonly now: () => number = Date.now,
  ) {
    this.rds = new RDSClient(region ? { region } : {});
    this.cloudwatch = new CloudWatchClient(region ? { region } : {});
  }

  async list(): Promise<DatabaseView[]> {
    const clusters: DBCluster[] = [];
    let marker: string | undefined;
    do {
      const page = await this.rds.send(new DescribeDBClustersCommand({ Marker: marker }));
      clusters.push(...(page.DBClusters ?? []));
      marker = page.Marker;
    } while (marker);
    return Promise.all(clusters.map((c) => this.view(c)));
  }

  private async view(cluster: DBCluster): Promise<DatabaseView> {
    const clusterId = cluster.DBClusterIdentifier ?? '';
    const capacity = await this.capacity(clusterId);
    return {
      clusterId,
      status: cluster.Status ?? 'unknown',
      engine: cluster.Engine,
      engineVersion: cluster.EngineVersion,
      acu: capacity?.acu,
      paused: capacity?.acu === 0,
      minAcu: cluster.ServerlessV2ScalingConfiguration?.MinCapacity,
      maxAcu: cluster.ServerlessV2ScalingConfiguration?.MaxCapacity,
      measuredAt: capacity?.at,
    };
  }

  private async capacity(clusterId: string): Promise<{ acu: number; at: number } | undefined> {
    const end = new Date(this.now());
    const { Datapoints = [] } = await this.cloudwatch.send(
      new GetMetricStatisticsCommand({
        Namespace: 'AWS/RDS',
        MetricName: 'ServerlessDatabaseCapacity',
        Dimensions: [{ Name: 'DBClusterIdentifier', Value: clusterId }],
        StartTime: new Date(end.getTime() - CAPACITY_LOOKBACK_MS),
        EndTime: end,
        Period: 60,
        Statistics: ['Average'],
      }),
    );
    const latest = Datapoints.filter((d) => d.Timestamp && d.Average !== undefined).sort(
      (a, b) => b.Timestamp!.getTime() - a.Timestamp!.getTime(),
    )[0];
    if (!latest) return undefined;
    return { acu: latest.Average!, at: Math.floor(latest.Timestamp!.getTime() / 1000) };
  }
}
