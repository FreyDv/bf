// Type-only entry: the frontend imports types from here and never runs this package (ADR-035).
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from './generated/server';

export type { AppRouter };
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
