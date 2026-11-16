// A tree in one table, for the relations that need an alias (ADR-069): `categories(id, parent_id -> categories.id)`.
// `parent` and `children` are relations to the table of the node itself, `parent.parent` is the same table on a
// second level of one path. Each level has an alias of its own. The foreign key is indexed (QRY-11).
import { eq } from 'drizzle-orm';
import { alias, integer, pgSchema, text } from 'drizzle-orm/pg-core';
import { Op, defineFilter, relation, str } from '../src/core/index.js';
import { defineBinding, related } from '../src/drizzle/index.js';
import { newSchemaName } from './schema-name.js';

export const TREE_SCHEMA = newSchemaName();
const schema = pgSchema(TREE_SCHEMA);

export const categories = schema.table('categories', {
  id: integer('id').primaryKey(),
  name: text('name'),
  parentId: integer('parent_id'),
});

export const parentOf = alias(categories, 'parent');
export const grandparentOf = alias(categories, 'grandparent');
export const childOf = alias(categories, 'child');

export const treeDdl: readonly string[] = [
  `create table ${TREE_SCHEMA}.categories (
     id integer primary key, name text, parent_id integer references ${TREE_SCHEMA}.categories (id))`,
  `create index on ${TREE_SCHEMA}.categories (parent_id)`,
];

export const grandparentFilter = defineFilter({ name: str(Op.String) });
export const parentFilter = defineFilter({
  name: str(Op.String),
  parent: relation.one(grandparentFilter),
});
export const childFilter = defineFilter({ name: str(Op.String) });
export const categoryFilter = defineFilter({
  name: str(Op.String),
  parent: relation.one(parentFilter),
  children: relation.many(childFilter),
});

const grandparentBinding = defineBinding(grandparentFilter, { name: grandparentOf.name });
const parentBinding = defineBinding(parentFilter, {
  name: parentOf.name,
  parent: related(grandparentOf, eq(grandparentOf.id, parentOf.parentId), grandparentBinding),
});
const childBinding = defineBinding(childFilter, { name: childOf.name });

export const categoryBinding = defineBinding(categoryFilter, {
  name: categories.name,
  parent: related(parentOf, eq(parentOf.id, categories.parentId), parentBinding),
  children: related(childOf, eq(childOf.parentId, categories.id), childBinding),
});
