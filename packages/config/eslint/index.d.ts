import type { Linter } from 'eslint';

interface Options {
  tsconfigRootDir: string;
}

export function base(options: Options): Linter.Config[];
export function nest(options: Options): Linter.Config[];
export function next(options: Options): Promise<Linter.Config[]>;
