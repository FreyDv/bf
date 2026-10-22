import { Inject } from '@nestjs/common';
import { Query, Router, UseMiddlewares } from 'nestjs-trpc';

import { databasesListOutputSchema } from '@bf/contracts/api';
import { AdminMiddleware } from '@bf/trpc';

import { DB_API } from './db-api';

import type { DbApi } from './db-api';
import type { DatabaseView } from '@bf/contracts/api';

/** The account's Aurora clusters with status and current ACU (role `admin`). `/_services/trpc/databases.list`. */
@Router({ alias: 'databases' })
@UseMiddlewares(AdminMiddleware)
export class DatabasesRouter {
  constructor(@Inject(DB_API) private readonly db: DbApi | null) {}

  /** Empty when the orchestrator is off (local): there is no AWS to ask. */
  @Query({ output: databasesListOutputSchema })
  list(): Promise<DatabaseView[]> {
    return this.db ? this.db.list() : Promise.resolve([]);
  }
}
