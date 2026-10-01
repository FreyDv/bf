import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bf/ui/components/card';

import { AppShell } from '@/components/app-shell';

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>Back-office skeleton. Nothing is wired up yet.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Pages will call the services through the edge (<code>api</code>) over tRPC, typed by{' '}
          <code>@bf/contracts</code>.
        </CardContent>
      </Card>
    </AppShell>
  );
}
