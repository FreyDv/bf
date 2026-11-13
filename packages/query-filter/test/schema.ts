// The tables of the toolkit tests, in a schema of their own (ADR-050 item 12), and the bindings of the shared
// specs. The foreign keys a relation filter uses are indexed (QRY-11).
import { eq } from 'drizzle-orm';
import {
  boolean,
  date,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { groupFilter, orderFilter, userFilter } from '../src/core/fixtures.js';
import { defineBinding, related } from '../src/drizzle/index.js';
import { newSchemaName } from './db.js';

export const SCHEMA = newSchemaName();
const schema = pgSchema(SCHEMA);

export const groups = schema.table('groups', {
  id: integer('id').primaryKey(),
  title: text('title'),
  legalEntityId: integer('legal_entity_id'),
});

export const users = schema.table('users', {
  id: integer('id').primaryKey(),
  name: text('name'),
  sname: text('sname'),
  middleName: text('middle_name'),
  age: integer('age'),
  birthday: date('birthday'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  ref: uuid('ref'),
  active: boolean('active'),
  status: text('status'),
  groupId: integer('group_id').references(() => groups.id),
});

export const orders = schema.table('orders', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  paid: boolean('paid'),
  total: numeric('total'),
  status: text('status'),
});

export const ddl: readonly string[] = [
  `create table ${SCHEMA}.groups (id integer primary key, title text, legal_entity_id integer)`,
  `create table ${SCHEMA}.users (
     id integer primary key, name text, sname text, middle_name text, age integer, birthday date,
     created_at timestamptz, ref uuid, active boolean, status text,
     group_id integer references ${SCHEMA}.groups (id))`,
  `create index on ${SCHEMA}.users (group_id)`,
  `create table ${SCHEMA}.orders (
     id integer primary key, user_id integer not null references ${SCHEMA}.users (id),
     paid boolean, total numeric, status text)`,
  `create index on ${SCHEMA}.orders (user_id)`,
];

export const groupBinding = defineBinding(groupFilter, {
  legalEntityId: groups.legalEntityId,
  title: groups.title,
});

export const orderBinding = defineBinding(orderFilter, {
  paid: orders.paid,
  total: orders.total,
  status: orders.status,
});

export const userBinding = defineBinding(userFilter, {
  name: users.name,
  sname: users.sname,
  middleName: users.middleName,
  age: users.age,
  birthday: users.birthday,
  createdAt: users.createdAt,
  ref: users.ref,
  active: users.active,
  status: users.status,
  group: related(groups, eq(groups.id, users.groupId), groupBinding),
  orders: related(orders, eq(orders.userId, users.id), orderBinding),
});
