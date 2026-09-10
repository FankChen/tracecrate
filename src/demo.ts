import type { EventKind, Trace, TraceEvent } from './core/types';

type Step = [EventKind, string, string, number, string?, string?, boolean?];
const readInput = '{"path":"src/pagination.ts"}';
const source = 'export function page(items, index, size) {\n  return items.slice(index * size, (index + 1) * size - 1);\n}';
const baseline: Step[] = [
  ['user', 'Fix the pagination bug', 'The last item disappears on every page. Add a regression test and fix the boundary.', 1200],
  ['assistant', 'Plan the investigation', 'Inspect the page helper, reproduce the missing item, then verify the boundary cases.', 4800],
  ['tool', 'Read', 'Inspect the pagination helper', 620, readInput, source],
  ['tool', 'Glob', 'Find related tests', 410, '{"pattern":"**/*pagination*"}', 'src/pagination.ts\ntests/pagination.test.ts'],
  ['tool', 'Read', 'Read the existing boundary tests', 750, '{"path":"tests/pagination.test.ts"}', 'test("first page", () => expect(page([1,2,3], 0, 2)).toEqual([1]));'],
  ['tool', 'Read', 'Revisit the pagination helper', 580, readInput, source],
  ['assistant', 'Check slice boundaries', 'The exclusive end index is reduced by one. The existing test encodes that behavior.', 6400],
  ['tool', 'Edit', 'Add a regression case for a full page', 1100, '{"path":"tests/pagination.test.ts","change":"expect first page to contain [1, 2]"}', 'Regression assertion updated.'],
  ['tool', 'Bash', 'Run pagination tests', 12500, '{"command":"npm test -- pagination"}', 'FAIL tests/pagination.test.ts\nExpected: [1, 2]\nReceived: [1]\n1 failed, 2 passed.', true],
  ['tool', 'Read', 'Inspect the helper after the failed test', 680, readInput, source],
  ['tool', 'Edit', 'Correct the exclusive end index', 1350, '{"path":"src/pagination.ts","change":"remove the trailing - 1"}', 'return items.slice(index * size, (index + 1) * size);'],
  ['tool', 'Bash', 'Verify pagination regression tests', 10800, '{"command":"npm test -- pagination"}', 'PASS tests/pagination.test.ts\n3 tests passed.'],
  ['tool', 'Bash', 'Review the final diff', 890, '{"command":"git diff --check"}', 'No whitespace errors.'],
  ['assistant', 'Pagination boundary repaired', 'Removed the off-by-one end boundary. The synthetic test run now includes every item on a full page.', 3600],
];
const optimized: Step[] = [
  ['user', 'Fix the pagination bug', 'The last item disappears on every page. Add a regression test and fix the boundary.', 1200],
  ['assistant', 'Inspect implementation and tests together', 'Read the helper and tests, then update the exclusive end boundary and its regression assertion.', 4200],
  ['tool', 'Read', 'Read pagination implementation and tests', 940, '{"paths":["src/pagination.ts","tests/pagination.test.ts"]}', `${source}\n\nExisting test expects an incomplete first page.`],
  ['tool', 'Edit', 'Repair the boundary and regression assertion', 1650, '{"change":"use (index + 1) * size; expect [1, 2]"}', 'Updated src/pagination.ts and tests/pagination.test.ts.'],
  ['tool', 'Bash', 'Verify pagination regression tests', 10600, '{"command":"npm test -- pagination"}', 'PASS tests/pagination.test.ts\n3 tests passed.'],
  ['tool', 'Edit', 'Cover a partial final page', 850, '{"path":"tests/pagination.test.ts","change":"add final-page coverage"}', 'Added a partial-page assertion.'],
  ['tool', 'Bash', 'Run the expanded test suite', 11700, '{"command":"npm test"}', 'PASS\n8 tests passed.'],
  ['tool', 'Bash', 'Review the final diff', 790, '{"command":"git diff --check"}', 'No whitespace errors.'],
  ['assistant', 'Fix and boundary coverage complete', 'Full and partial pages are covered. This manufactured run illustrates a different sequence, not a measured optimization.', 3100],
];

function makeDemo(id: string, name: string, steps: Step[], input: number, output: number): Trace {
  let time = Date.UTC(2026, 8, 10, 10, 0, 0);
  const events: TraceEvent[] = steps.map(([kind, title, content, durationMs, toolInput, toolOutput, error], index) => {
    const event: TraceEvent = {
      id: `${id}-${index + 1}`, kind, name: title, content, durationMs,
      timestamp: time, status: error ? 'error' : 'ok',
      ...(toolInput !== undefined ? { input: toolInput } : {}),
      ...(toolOutput !== undefined ? { output: toolOutput } : {}),
      ...(kind === 'assistant' ? { model: 'synthetic-agent' } : {}),
    };
    time += durationMs + 450;
    return event;
  });
  return {
    schemaVersion: 1, id, name, source: 'Synthetic fixture', events, demo: true,
    usage: { input, output, cacheRead: 0, cacheWrite: 0 },
    warnings: ['Manufactured example. All tokens and timings are synthetic; this pair is not evidence of a speed or efficiency improvement.'],
  };
}

export function createDemoSessions(): Trace[] {
  return [
    makeDemo('demo-baseline', 'Pagination fix · baseline', baseline, 12480, 1860),
    makeDemo('demo-optimized', 'Pagination fix · optimized', optimized, 8240, 1240),
  ];
}