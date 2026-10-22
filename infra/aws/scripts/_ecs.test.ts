import assert from 'node:assert/strict';
import { test } from 'node:test';

import { asMigrateTask, MIGRATE_COMMAND, withImage } from './_ecs.ts';

import type { TaskDefinition } from '@aws-sdk/client-ecs';

const def: TaskDefinition = {
  taskDefinitionArn: 'arn:aws:ecs:us-east-1:1:task-definition/bf-prod-order:3',
  family: 'bf-prod-order',
  revision: 3,
  status: 'ACTIVE',
  cpu: '512',
  memory: '1024',
  requiresCompatibilities: ['FARGATE'],
  requiresAttributes: [{ name: 'x' }],
  compatibilities: ['FARGATE'],
  registeredAt: new Date(),
  taskRoleArn: 'arn:task',
  executionRoleArn: 'arn:exec',
  containerDefinitions: [
    {
      name: 'order',
      image: 'r/bf-prod/order:old',
      healthCheck: { command: ['CMD', 'true'] },
      environment: [{ name: 'A', value: '1' }],
    },
  ],
};

void test('withImage strips read-only fields and swaps only the image', () => {
  const input = withImage(def, 'r/bf-prod/order:new') as unknown as Record<string, unknown>;
  for (const key of [
    'taskDefinitionArn',
    'revision',
    'status',
    'requiresAttributes',
    'compatibilities',
    'registeredAt',
  ])
    assert.equal(key in input, false, key);
  assert.equal(input.family, 'bf-prod-order');
  assert.equal(input.cpu, '512');
  const containers = input.containerDefinitions as { image: string; healthCheck?: unknown }[];
  assert.equal(containers[0]!.image, 'r/bf-prod/order:new');
  assert.ok(containers[0]!.healthCheck);
});

void test('asMigrateTask uses its own family, drops the health check and sets the command', () => {
  const input = asMigrateTask(def, 'r/bf-prod/order:new', 'order');
  assert.equal(input.family, 'bf-prod-order-migrate');
  const c = input.containerDefinitions![0]!;
  assert.equal(c.healthCheck, undefined);
  assert.deepEqual(c.command, MIGRATE_COMMAND);
  assert.equal(c.image, 'r/bf-prod/order:new');
  assert.deepEqual(c.environment, [{ name: 'A', value: '1' }]);
  assert.equal(input.taskRoleArn, 'arn:task');
});
