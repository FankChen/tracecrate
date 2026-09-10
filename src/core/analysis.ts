import type { Finding, Trace, TraceStats, Usage } from './types';

export interface ToolBreakdown {
  name: string;
  calls: number;
  errors: number;
  /** Sum of observed tool durations, NOT elapsed wall time (calls may overlap). */
  durationMs: number;
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export function getStats(trace: Trace): TraceStats {
  const stats: TraceStats = {
    events: trace.events.length,
    tools: trace.events.filter((event) => event.kind === 'tool').length,
    errors: trace.events.filter((event) => event.status === 'error').length,
    models: [...new Set(trace.events.map((event) => event.model).filter(
      (model): model is string => typeof model === 'string' && model.length > 0,
    ))].sort(),
  };

  // Trace-level usage is authoritative, including an explicitly all-zero total.
  // input already includes cacheRead/cacheWrite; those are subsets, not additions.
  const usages = trace.events.flatMap((event) => event.usage ? [event.usage] : []);
  if (trace.usage) stats.usage = { ...trace.usage };
  else if (usages.length) {
    stats.usage = usages.reduce<Usage>((sum, usage) => ({
      input: sum.input + usage.input,
      output: sum.output + usage.output,
      cacheRead: sum.cacheRead + usage.cacheRead,
      cacheWrite: sum.cacheWrite + usage.cacheWrite,
    }), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  }

  // Only real timestamps establish a timeline. A duration can supply an end
  // for a timestamped event, but unanchored durations are never summed.
  const timed = trace.events.filter((event) => isNumber(event.timestamp));
  if (timed.length > 1 || timed.some((event) =>
    isNumber(event.durationMs) && event.durationMs >= 0)) {
    let first = Infinity;
    let last = -Infinity;
    for (const event of timed) {
      const start = event.timestamp!;
      const duration = isNumber(event.durationMs) && event.durationMs >= 0
        ? event.durationMs : 0;
      first = Math.min(first, start);
      last = Math.max(last, start + duration);
    }
    stats.durationMs = last - first;
  }
  return stats;
}

export function getToolBreakdown(trace: Trace): ToolBreakdown[] {
  const groups = new Map<string, ToolBreakdown>();
  for (const event of trace.events) {
    if (event.kind !== 'tool') continue;
    const group = groups.get(event.name) ?? {
      name: event.name, calls: 0, errors: 0, durationMs: 0,
    };
    group.calls += 1;
    group.errors += Number(event.status === 'error');
    if (isNumber(event.durationMs) && event.durationMs >= 0) {
      group.durationMs += event.durationMs;
    }
    groups.set(event.name, group);
  }
  return [...groups.values()].sort((a, b) =>
    b.calls - a.calls || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function getFindings(trace: Trace): Finding[] {
  const findings: Finding[] = [];
  const identical = new Map<string, string[]>();
  for (const [index, event] of trace.events.entries()) {
    if (event.kind === 'tool') {
      // Missing input is not evidence that the inputs were identical.
      if (typeof event.input === 'string') {
        const key = JSON.stringify([event.name, event.input]);
        const ids = identical.get(key) ?? [];
        ids.push(event.id);
        identical.set(key, ids);
      }
      if (event.status === 'error') findings.push({
        id: `tool-error-${index + 1}`, severity: 'warning',
        title: 'Tool reported an error',
        description: `${event.name} has an error status. This observation does not identify a cause.`,
        eventIds: [event.id],
      });
      if (isNumber(event.durationMs) && event.durationMs >= 10_000) findings.push({
        id: `tool-duration-${index + 1}`, severity: 'warning',
        title: 'Long tool duration',
        description: `${event.name} has a recorded duration of ${event.durationMs} ms (at least 10,000 ms).`,
        eventIds: [event.id],
      });
    }
    const output = event.output ?? (
      event.kind === 'tool' || event.kind === 'assistant' ? event.content : ''
    );
    if (output.length >= 12_000) findings.push({
      id: `large-output-${index + 1}`, severity: 'warning',
      title: 'Large recorded output',
      description: `Recorded output contains ${output.length} characters (at least 12,000).`,
      eventIds: [event.id],
    });
  }
  for (const ids of identical.values()) {
    if (ids.length < 3) continue;
    findings.push({
      id: `identical-input-${findings.length + 1}`, severity: 'warning',
      title: 'Identical tool calls observed',
      description: `${ids.length} calls have exactly the same tool name and input text. This does not establish retries, intent, or a root cause.`,
      eventIds: [...ids],
    });
  }
  return findings;
}