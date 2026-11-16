import { base } from './index.js';

// For a package that keeps no tool config of its own: packages/kernel, where the boundary rules judge every file under
// the package, a config file included (ADR-070). Run from the package directory:
// `eslint --config ../config/eslint/package-root.js .`
export default base({ tsconfigRootDir: process.cwd() });
