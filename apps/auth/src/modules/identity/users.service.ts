import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DRIZZLE } from '@bf/db';

import { users } from './identity.schema';

import type { AuthDatabase } from '../../db/database.type';
import type { User } from '@bf/contracts/auth';

type UserRow = typeof users.$inferSelect;

export const toUser = (u: UserRow): User => ({
  id: u.id,
  email: u.email,
  roles: u.roles as User['roles'],
  createdAt: u.createdAt.toISOString(),
  updatedAt: u.updatedAt.toISOString(),
});

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: AuthDatabase) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    return row ? toUser(row) : null;
  }

  /** Dev-only helper behind `POST /auth/dev-token`: a user per synthetic email. */
  async upsertDevUser(sub: string, roles: string[]): Promise<User> {
    const email = sub.includes('@') ? sub : `${sub}@dev.local`;
    const found = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (found) return toUser(found);
    const [created] = await this.db.insert(users).values({ email, roles }).returning();
    return toUser(created!);
  }
}
