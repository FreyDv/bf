import { awakeDependents, closure, parseGraph } from './service-graph';

describe('service graph', () => {
  const graph = parseGraph('admin=auth|order|course|billing|ai,billing=order,order=auth');

  it('parses name=dep|dep lists and an empty spec', () => {
    expect(graph.admin).toEqual(['auth', 'order', 'course', 'billing', 'ai']);
    expect(graph.order).toEqual(['auth']);
    expect(parseGraph('')).toEqual({});
    expect(() => parseGraph('admin')).toThrow(/SERVICE_GRAPH/);
  });

  it('closure lists dependencies first and the service last, each once', () => {
    expect(closure(graph, 'billing')).toEqual(['auth', 'order', 'billing']);
    expect(closure(graph, 'admin')).toEqual(['auth', 'order', 'course', 'billing', 'ai', 'admin']);
    expect(closure(graph, 'course')).toEqual(['course']);
    expect(closure(graph, 'unknown')).toEqual(['unknown']);
  });

  it('closure survives cycles', () => {
    expect(closure(parseGraph('a=b,b=a'), 'a')).toEqual(['b', 'a']);
  });

  it('awakeDependents finds awake services that transitively need the given one', () => {
    const awake = new Set(['admin', 'order']);
    expect(awakeDependents(graph, 'auth', (n) => awake.has(n)).sort()).toEqual(['admin', 'order']);
    expect(awakeDependents(graph, 'order', (n) => awake.has(n))).toEqual(['admin']);
    expect(awakeDependents(graph, 'ai', (n) => n === 'order')).toEqual([]);
  });
});
