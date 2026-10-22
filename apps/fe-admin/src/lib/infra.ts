import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { trpc } from './trpc';

export type { DatabaseView, ServiceStatus, ServiceView } from '@bf/contracts/api';

export const infraKeys = {
  services: ['infra', 'services'] as const,
  databases: ['infra', 'databases'] as const,
};

const REFRESH_MS = 10_000;

export function useServices() {
  return useQuery({
    queryKey: infraKeys.services,
    queryFn: () => trpc.services.list.query(),
    refetchInterval: REFRESH_MS,
    staleTime: 0,
  });
}

export function useDatabases() {
  return useQuery({
    queryKey: infraKeys.databases,
    queryFn: () => trpc.databases.list.query(),
    refetchInterval: 30_000,
    staleTime: 0,
  });
}

export function useWake() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => trpc.services.wake.mutate({ name }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: infraKeys.services }),
  });
}

export function useWakeAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => trpc.services.wakeAll.mutate(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: infraKeys.services }),
  });
}

export const vcpu = (cpuUnits: number) => cpuUnits / 1024;

export function formatAgo(epochS: number | undefined, nowMs = Date.now()): string {
  if (!epochS) return '–';
  const s = Math.max(0, Math.round(nowMs / 1000 - epochS));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
