import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bf/ui/components/card';

import { Shell } from '@/components/shell';

export default function HomePage() {
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>Public site skeleton. Nothing is wired up yet.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Pages will call the services through the edge (<code>api</code>) over tRPC, typed by{' '}
          <code>@bf/contracts</code>.
        </CardContent>
      </Card>
    </Shell>
  );
}
