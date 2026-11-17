import { Controller, Get } from '@nestjs/common';

// A plain HTTP route, not tRPC: a Kubernetes probe cannot send a tRPC call (ADR-080). The global prefix makes it
// GET /api/health. Liveness only and no data: the body is the same for every caller, so it can say nothing about the
// build or the host. There is no query or handler behind it, because nothing is asked of the application.
@Controller('health')
export class CheckLivenessController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
