'use client';

import { Cpu, Database, Power, RefreshCw } from 'lucide-react';

import { Badge } from '@bf/ui/components/badge';
import { Button } from '@bf/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bf/ui/components/card';
import { Skeleton } from '@bf/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@bf/ui/components/table';

import {
  formatAgo,
  useDatabases,
  useServices,
  useWake,
  useWakeAll,
  vcpu,
  type DatabaseView,
  type ServiceStatus,
  type ServiceView,
} from '@/lib/infra';

const STATUS: Record<
  ServiceStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  awake: { label: 'Working', variant: 'default' },
  starting: { label: 'Starting', variant: 'secondary' },
  asleep: { label: 'Stopped', variant: 'outline' },
  failed: { label: 'Failed', variant: 'destructive' },
};

function StatusBadge({ status }: Readonly<{ status: ServiceStatus }>) {
  const { label, variant } = STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function Stat({
  title,
  value,
  hint,
  icon: Icon,
}: Readonly<{ title: string; value: React.ReactNode; hint?: string; icon: typeof Cpu }>) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" /> {title}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

function DatabaseCard({ db }: Readonly<{ db: DatabaseView }>) {
  const state = db.paused ? 'Paused' : db.status === 'available' ? 'Working' : db.status;
  const variant = db.paused ? 'outline' : db.status === 'available' ? 'default' : 'secondary';
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Database className="size-4" /> {db.clusterId}
        </CardDescription>
        <CardTitle className="flex items-center gap-2">
          <Badge variant={variant}>{state}</Badge>
          <span className="text-2xl tabular-nums">
            {db.acu === undefined ? '–' : db.acu} <span className="text-base font-normal">ACU</span>
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {db.engine ?? 'aurora'} {db.engineVersion ?? ''} · range {db.minAcu ?? '?'}–
          {db.maxAcu ?? '?'} ACU · 1 ACU ≈ 2 GiB RAM + CPU · measured {formatAgo(db.measuredAt)}
        </p>
      </CardHeader>
    </Card>
  );
}

function ServiceRow({
  service,
  onWake,
  waking,
}: Readonly<{ service: ServiceView; onWake: () => void; waking: boolean }>) {
  const perTask = service.task ? vcpu(service.task.cpu) : undefined;
  const canWake = service.status === 'asleep' || service.status === 'failed';
  return (
    <TableRow>
      <TableCell className="font-medium">
        {service.name}
        {service.alwaysOn ? (
          <span className="ml-2 text-xs text-muted-foreground">always on</span>
        ) : null}
      </TableCell>
      <TableCell>
        <StatusBadge status={service.status} />
      </TableCell>
      <TableCell className="tabular-nums">
        {service.running} / {service.desired}
        {service.bounds ? (
          <span className="ml-1 text-xs text-muted-foreground">(max {service.bounds.max})</span>
        ) : null}
      </TableCell>
      <TableCell className="tabular-nums">
        {perTask === undefined
          ? '–'
          : `${perTask} × ${service.running} = ${perTask * service.running}`}
      </TableCell>
      <TableCell className="tabular-nums">
        {service.task ? `${service.task.memory} MiB` : '–'}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatAgo(service.lastActivity)}</TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" disabled={!canWake || waking} onClick={onWake}>
          <Power /> Wake up
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function InfraDashboard() {
  const services = useServices();
  const databases = useDatabases();
  const wake = useWake();
  const wakeAll = useWakeAll();

  const list = services.data ?? [];
  const runningTasks = list.reduce((n, s) => n + s.running, 0);
  const totalVcpu = list.reduce((n, s) => n + (s.task ? vcpu(s.task.cpu) * s.running : 0), 0);
  const asleep = list.filter((s) => s.status === 'asleep' || s.status === 'failed').length;
  const error = services.error ?? databases.error ?? wake.error ?? wakeAll.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          ECS services behind the edge and the Aurora clusters. Refreshes every 10 s.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void Promise.all([services.refetch(), databases.refetch()])}
            disabled={services.isFetching}
          >
            <RefreshCw className={services.isFetching ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => wakeAll.mutate()}
            disabled={wakeAll.isPending || asleep === 0}
          >
            <Power /> Wake up all{asleep ? ` (${asleep})` : ''}
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="text-sm text-destructive">{errorMessage(error)}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          title="Running tasks"
          icon={Cpu}
          value={services.isPending ? <Skeleton className="h-8 w-16" /> : runningTasks}
          hint={`${list.length - asleep} of ${list.length} services working`}
        />
        <Stat
          title="vCPU in use"
          icon={Cpu}
          value={services.isPending ? <Skeleton className="h-8 w-16" /> : totalVcpu}
          hint="sum of running tasks × task vCPU"
        />
        {databases.isPending ? (
          <Card className="sm:col-span-2">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Database className="size-4" /> Database
              </CardDescription>
              <Skeleton className="h-8 w-40" />
            </CardHeader>
          </Card>
        ) : databases.data?.length ? (
          databases.data.map((db) => <DatabaseCard key={db.clusterId} db={db} />)
        ) : (
          <Stat
            title="Database"
            icon={Database}
            value="–"
            hint="no Aurora cluster visible (orchestrator off locally)"
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
          <CardDescription>
            Stopped services wake on the first request; the button starts them now without waiting
            for one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tasks (running / desired)</TableHead>
                <TableHead>vCPU (per task × tasks)</TableHead>
                <TableHead>Memory / task</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.isPending ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No orchestrated services. Locally the orchestrator is off (ORCHESTRATOR=none);
                    on AWS this lists every ECS service behind the edge.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((s) => (
                  <ServiceRow
                    key={s.name}
                    service={s}
                    waking={wake.isPending && wake.variables === s.name}
                    onWake={() => wake.mutate(s.name)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
