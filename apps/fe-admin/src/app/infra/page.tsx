import { AppShell } from '@/components/app-shell';
import { InfraDashboard } from '@/components/infra-dashboard';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Infra' };

/** `/admin/infra`: who is running on AWS, how big, and a way to wake services by hand. */
export default function InfraPage() {
  return (
    <AppShell title="Infra">
      <InfraDashboard />
    </AppShell>
  );
}
