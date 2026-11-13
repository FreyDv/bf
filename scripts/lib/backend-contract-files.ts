// Which backend files are the frontend's types (ADR-035, ADR-057), in one place (R4): image-check.ts, the contract
// typecheck step (contracts-typecheck.ts) and .dependency-cruiser.mjs read it. The generated
// packages/contracts/src/generated/server.ts imports the DTO files by relative path, and `turbo --affected` does not
// see them: backend is not a dependency of frontend in the Turborepo graph.

// What the generated file may import directly: the files of a procedure's input, output and client enums.
const DTO_SUFFIXES = ['request.dto', 'response.dto', 'enum'];

// What a DTO imports in turn and so decides the type the frontend sees: the filter spec of a list query (ADR-024).
const CONTRACT_SUFFIXES = [...DTO_SUFFIXES, 'filter-spec'];

const alternation = (suffixes: string[]) => suffixes.map((s) => s.replaceAll('.', '\\.')).join('|');

// For dependency-cruiser `pathNot`: the direct imports of the generated file (rule contracts-only-dtos-from-backend).
export const GENERATED_FILE_IMPORTS = new RegExp(`\\.(${alternation(DTO_SUFFIXES)})\\.ts$`);

// A change to one of these can break the frontend type check and the frontend image.
export const BACKEND_CONTRACT_FILES = new RegExp(
  `^apps/backend/src/.*\\.(${alternation(CONTRACT_SUFFIXES)})\\.ts$`,
);

export const touchesBackendContract = (changed: string[]): boolean =>
  changed.some((file) => BACKEND_CONTRACT_FILES.test(file));
