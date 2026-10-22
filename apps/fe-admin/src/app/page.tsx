import { Server } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@bf/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@bf/ui/components/card';

import { AppShell } from '@/components/app-shell';

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <div className="grid gap-4 md:grid-cols-2">
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
        <Card>
          <CardHeader>
            <CardTitle>Infrastructure</CardTitle>
            <CardDescription>
              Which services are running on AWS, their tasks and vCPU, the database status, and
              buttons to wake them up.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button render={<Link href="/infra" />}>
              <Server /> Open infra dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AppShell>
  );
}
