import { getStats, getToolBreakdown } from './analysis';
import { checkDepth } from './helpers';
import type { EventKind, Trace, TraceEvent, Usage } from './types';

export type RedactionMode = 'patterns' | 'structure';

const REMOVED = '[Removed for sharing]';
const REDACTED = '[REDACTED]';
const MAX_SCRUB_DEPTH = 60;
const PATTERN_WARNING = 'BEST-EFFORT REDACTION ONLY: Code and text are preserved and may contain sensitive information. Review every field before sharing. Pattern matching is not a security guarantee.';
const STRUCTURE_WARNING = 'Content removed. Metrics and event structure retained.';
const BEST_EFFORT = 'Sharing exports are best effort, not a security guarantee. Review before sharing.';
const SECRET_KEY = /^(?:(?:[\w.-]+[_.-])?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|password|passwd|pwd|secret|client[_-]?secret|private[_-]?key|authorization|credentials?))$/i;
const ASSIGNMENT = /((?:["']?)(?:(?:[\w.-]+[_.-])?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|password|passwd|pwd|secret|client[_-]?secret|private[_-]?key|authorization|credentials?))(?:["']?)\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}&]+)/gi;

function scrubText(value: string, depth = 0): string {
  if (depth > MAX_SCRUB_DEPTH) return REDACTED;
  // Parse nested JSON strings so escaped assignments and nested values receive
  // the same treatment as object fields, without interpreting arbitrary code.
  const trimmed = value.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    try {
      checkDepth(trimmed);
    } catch {
      return REDACTED;
    }
    let parsed: unknown;
    let isJson = false;
    try {
      parsed = JSON.parse(trimmed);
      isJson = true;
    } catch { /* Ordinary text, not JSON: use conservative pattern matching. */ }
    // Never catch traversal/serialization failures and fall back to original
    // data. Both decoded strings and containers share the same depth budget.
    if (isJson) return JSON.stringify(scrubValue(parsed, undefined, depth + 1));
  }
  return value
    .replace(/-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----|$)/gi, REDACTED)
    .replace(/\b(?:github_pat_|gh[pousr]_)[a-z0-9_]+/gi, REDACTED)
    .replace(/\bsk-[a-z0-9_-]+/gi, REDACTED)
    .replace(/\bbearer\s+[a-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    // Also cover escaped JSON fragments embedded in otherwise non-JSON logs.
    .replace(/((?:(?:[\w.-]+[_.-])?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|password|passwd|pwd|secret|client[_-]?secret|private[_-]?key|authorization|credentials?))\\+["']\s*:\s*\\+["'])([\s\S]*?)(\\+["'])/gi,
      (_match, prefix: string, _secret: string, closing: string) => `${prefix}${REDACTED}${closing}`)
    .replace(ASSIGNMENT, (_match, prefix: string, secret: string) => {
      const quote = secret.startsWith('"') ? '"' : secret.startsWith("'") ? "'" : '';
      return `${prefix}${quote}${REDACTED}${quote}`;
    })
    .replace(/\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}\b/gi, REDACTED)
    .replace(/\/(?:home|Users)\/[^\s/\\"'<>]+(?:\/[^\s"'<>]*)?|\/root(?:\/[^\s"'<>]*)?/gi, REDACTED)
    .replace(/\b[a-z]:[\\/]+(?:Users|Documents and Settings)[\\/]+[^\r\n"'<>;,}]+/gi, REDACTED);
}

function scrubValue(value: unknown, key?: string, depth = 0): unknown {
  if (depth > MAX_SCRUB_DEPTH) return REDACTED;
  if (key && SECRET_KEY.test(key)) return REDACTED;
  if (typeof value === 'string') return scrubText(value, depth);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, undefined, depth + 1));
  if (value !== null && typeof value === 'object') {
    // Null prototype also makes arbitrary runtime keys such as __proto__ safe.
    const result: Record<string, unknown> = Object.create(null);
    for (const [name, item] of Object.entries(value)) {
      const base = scrubText(name, depth + 1);
      let safeName = base;
      let suffix = 2;
      while (Object.hasOwn(result, safeName)) safeName = `${base}-${suffix++}`;
      result[safeName] = scrubValue(item, name, depth + 1);
    }
    return result;
  }
  return value;
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function numericUsage(usage: Usage | undefined): Usage | undefined {
  if (!usage) return undefined;
  const number = (value: unknown) => finite(value) && value >= 0 ? value : 0;
  return {
    input: number(usage.input), output: number(usage.output),
    cacheRead: number(usage.cacheRead), cacheWrite: number(usage.cacheWrite),
  };
}

/** Pure, best-effort sharing transform. Structure mode uses a strict allowlist. */
export function redactTrace(trace: Trace, mode: RedactionMode = 'structure'): Trace {
  if (mode !== 'patterns' && mode !== 'structure') throw new Error('Unknown redaction mode');
  const ids = new Map<string, string>();
  trace.events.forEach((event, index) => {
    // Invalid duplicate original IDs resolve consistently to the first event.
    if (!ids.has(event.id)) ids.set(event.id, `event-${index + 1}`);
  });
  const counts: Record<EventKind, number> = { user: 0, assistant: 0, tool: 0, system: 0 };
  const events = trace.events.map((event, index): TraceEvent => {
    const kind: EventKind = ['user', 'assistant', 'tool', 'system'].includes(event.kind)
      ? event.kind : 'system';
    counts[kind] += 1;
    const clean: TraceEvent = mode === 'patterns'
      ? scrubValue(event) as TraceEvent
      : {
          id: '', kind, name: `${kind[0].toUpperCase()}${kind.slice(1)} ${counts[kind]}`,
          content: REMOVED,
          status: ['ok', 'error', 'unknown'].includes(event.status) ? event.status : 'unknown',
        };
    clean.id = `event-${index + 1}`;
    delete clean.parentId;
    if (event.parentId !== undefined && ids.has(event.parentId)) {
      clean.parentId = ids.get(event.parentId);
    }
    if (mode === 'structure') {
      if (finite(event.timestamp)) clean.timestamp = event.timestamp;
      if (finite(event.durationMs) && event.durationMs >= 0) clean.durationMs = event.durationMs;
      const usage = numericUsage(event.usage);
      if (usage) clean.usage = usage;
    }
    return clean;
  });
  const result: Trace = mode === 'patterns' ? scrubValue(trace) as Trace : {
    schemaVersion: 1, id: '', name: '', source: '', events: [], warnings: [],
  };
  result.schemaVersion = 1;
  result.id = 'shared-run';
  result.name = 'Shared agent run';
  result.source = 'TraceCrate export';
  result.events = events;
  result.warnings = mode === 'patterns'
    ? [PATTERN_WARNING, ...trace.warnings.map((warning) => scrubText(warning))] : [STRUCTURE_WARNING];
  if (mode === 'structure') {
    const usage = numericUsage(trace.usage);
    if (usage) result.usage = usage;
    if (typeof trace.demo === 'boolean') result.demo = trace.demo;
  }
  return result;
}

export function exportTraceJson(trace: Trace, mode: RedactionMode = 'structure'): string {
  return JSON.stringify(redactTrace(trace, mode), null, 2);
}

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

/** Standalone, script-free report: details/summary work without JavaScript. */
export function exportTraceHtml(trace: Trace, mode: RedactionMode = 'structure'): string {
  const shared = redactTrace(trace, mode);
  const stats = getStats(shared);
  const number = (value: number | undefined) => value === undefined ? 'Unknown' : escapeHtml(value);
  const metric = (label: string, value: string) =>
    `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
  const field = (label: string, value: unknown) => value === undefined ? ''
    : `<div class="field"><h3>${escapeHtml(label)}</h3><pre>${escapeHtml(value)}</pre></div>`;
  const events = shared.events.map((event) => `<details id="${escapeHtml(event.id)}">
    <summary><span class="badge">${escapeHtml(event.kind)}</span> <strong>${escapeHtml(event.name)}</strong><span class="status">${escapeHtml(event.status)}</span></summary>
    <div class="event-body"><p class="muted">${escapeHtml(event.id)}${event.parentId ? ` · Parent: <a href="#${escapeHtml(event.parentId)}">${escapeHtml(event.parentId)}</a>` : ''}</p>
    ${field('Model', event.model)}${field('Timestamp (ms)', event.timestamp)}${field('Duration (ms)', event.durationMs)}
    ${event.usage ? field('Usage (input includes cache)', JSON.stringify(event.usage, null, 2)) : ''}
    ${field('Content', event.content)}${field('Input', event.input)}${field('Output', event.output)}</div>
  </details>`).join('\n');
  const tools = getToolBreakdown(shared).map((tool) => `<tr><th scope="row">${escapeHtml(tool.name)}</th><td>${number(tool.calls)}</td><td>${number(tool.errors)}</td><td>${number(tool.durationMs)}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(shared.name)} · TraceCrate</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0b1020;color:#e6edf8;line-height:1.6}*{box-sizing:border-box}body{margin:0}main{max-width:1060px;margin:auto;padding:48px 24px 72px}header{border-bottom:1px solid #29344d;padding-bottom:28px;margin-bottom:28px}.brand{color:#8ce9ce;font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-size:14px}h1{font-size:clamp(28px,5vw,44px);letter-spacing:-.04em;margin:12px 0 4px}h2{font-size:22px;margin-top:32px}h3{font-size:13px;text-transform:uppercase;color:#b5c4dd;margin:0 0 6px}.muted,.metric span{color:#aab8d0}.notice{background:#292415;border:1px solid #77632d;border-radius:12px;padding:16px 20px;color:#f6df9c;overflow-wrap:anywhere}.notice p{margin:6px 0}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:24px 0}.metric{background:#141d30;border:1px solid #29344d;border-radius:12px;padding:18px}.metric span{display:block;font-size:13px}.metric strong{font-size:26px}details{border:1px solid #29344d;background:#121a2c;border-radius:12px;margin:12px 0;overflow:hidden}summary{cursor:pointer;padding:18px;overflow-wrap:anywhere}summary:hover,summary:focus-visible{background:#1c2942}summary:focus-visible,a:focus-visible{outline:2px solid #8ce9ce;outline-offset:-2px}.badge{color:#8ce9ce;font-size:12px;text-transform:uppercase;margin-right:10px}.status{color:#c1cce0;margin-left:16px;font-size:13px}.event-body{border-top:1px solid #29344d;padding:0 20px 20px}.field{margin-top:18px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#0b1020;padding:14px;border-radius:8px;font-size:13px;max-height:32rem;overflow:auto}a{color:#8ce9ce}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:12px;border-bottom:1px solid #29344d;overflow-wrap:anywhere}footer{margin-top:36px;color:#aab8d0;font-size:13px}@media print{body,main{background:white;color:black}.notice,details,.metric,pre{background:white;color:black}pre{max-height:none}}
</style></head><body><main>
<header><div class="brand">◇ TraceCrate / Shared report</div><h1>${escapeHtml(shared.name)}</h1><p class="muted">${escapeHtml(shared.source)} · ${escapeHtml(shared.id)} · ${escapeHtml(mode)} sharing</p></header>
<section class="notice" aria-label="Sharing notice"><strong>Review before sharing</strong>${shared.warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join('')}<p>${BEST_EFFORT}</p></section>
<section aria-label="Summary" class="metrics">${metric('Events', number(stats.events))}${metric('Tool calls', number(stats.tools))}${metric('Errors', number(stats.errors))}${metric('Elapsed (ms)', number(stats.durationMs))}${metric('Input tokens', number(stats.usage?.input))}${metric('Output tokens', number(stats.usage?.output))}${metric('Cache read (included)', number(stats.usage?.cacheRead))}${metric('Cache write (included)', number(stats.usage?.cacheWrite))}</section>
<p class="muted">Elapsed time uses recorded timestamps and known ends, not summed tool durations. Input tokens already include cached input.</p>
<h2>Tools</h2><p class="muted">Recorded duration sums are not wall time; calls may overlap. Missing tool durations contribute no recorded milliseconds.</p>
${tools ? `<div class="table-wrap"><table><thead><tr><th scope="col">Tool</th><th scope="col">Calls</th><th scope="col">Errors</th><th scope="col">Recorded duration sum (ms)</th></tr></thead><tbody>${tools}</tbody></table></div>` : '<p class="muted">No tool calls recorded.</p>'}
<h2>Events</h2><p class="muted">Expand an event to inspect its shared details.</p>${events || '<p class="muted">No events recorded.</p>'}
<footer>Made with TraceCrate · Offline report · No scripts or external assets</footer>
</main></body></html>`;
}