/**
 * Static dependency graph between services (`admin=auth|order|course|billing|ai,billing=order,order=auth`):
 * waking a service wakes everything it calls, and a service may only sleep when no awake service depends on it.
 * Pure functions, no I/O.
 */
export type ServiceGraph = Record<string, string[]>;

/** Parses `a=b|c,d=e`; an empty string is an empty graph. */
export function parseGraph(spec: string): ServiceGraph {
  const graph: ServiceGraph = {};
  for (const entry of spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const [name, deps = ''] = entry.split('=');
    if (!name || !deps) throw new Error(`SERVICE_GRAPH: expected name=dep|dep, got "${entry}"`);
    graph[name.trim()] = deps
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return graph;
}

/** The service and everything it (transitively) calls — dependencies first, the service itself last. Cycle-safe. */
export function closure(graph: ServiceGraph, name: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (n: string) => {
    if (seen.has(n)) return;
    seen.add(n);
    for (const dep of graph[n] ?? []) visit(dep);
    out.push(n);
  };
  visit(name);
  return out;
}

/** Awake services that (transitively) depend on `name` — if any, `name` must stay awake. */
export function awakeDependents(
  graph: ServiceGraph,
  name: string,
  isAwake: (service: string) => boolean,
): string[] {
  return Object.keys(graph).filter(
    (other) => other !== name && isAwake(other) && closure(graph, other).includes(name),
  );
}
