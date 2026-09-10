import { explicitStatus, finishTool, number, record, string, sumUsage, text, timestamp, TraceBuilder, unwrapBody } from '../core/helpers';
import { registerAdapter } from '../core/registry';
import type { Adapter, TraceEvent, Usage } from '../core/types';

interface MessageState {
  blocks: Set<string>;
  usage?: Usage;
  usageEvent?: TraceEvent;
}

function claudeUsage(value: unknown): Usage | undefined {
  const usage = record(value);
  const input = number(usage.input_tokens);
  const output = number(usage.output_tokens);
  const cacheRead = number(usage.cache_read_input_tokens);
  const cacheWrite = number(usage.cache_creation_input_tokens);
  if ([input, output, cacheRead, cacheWrite].every((field) => field === undefined)) return undefined;
  // Store uncached input here; combine with caches AFTER maxima across snapshots.
  return { input: input ?? 0, output: output ?? 0, cacheRead: cacheRead ?? 0, cacheWrite: cacheWrite ?? 0 };
}

function maxUsage(previous: Usage | undefined, current: Usage): Usage {
  return {
    input: Math.max(previous?.input ?? 0, current.input),
    output: Math.max(previous?.output ?? 0, current.output),
    cacheRead: Math.max(previous?.cacheRead ?? 0, current.cacheRead),
    cacheWrite: Math.max(previous?.cacheWrite ?? 0, current.cacheWrite),
  };
}

const adapter: Adapter = {
  id: 'claude',
  label: 'Claude Code normal message JSONL (not streaming deltas)',
  detect: ({ records }) => !records.some((item) => Object.hasOwn(item, 'schemaVersion')) && records.some((raw) => {
    const item = unwrapBody(raw);
    return (['assistant', 'user'].includes(String(item.type)) && Object.hasOwn(record(item.message), 'content'))
      || item.type === 'stream_event'
      || (item.type === 'system' && item.subtype === 'init')
      || (item.type === 'result' && ('session_id' in item || 'is_error' in item));
  }),
  parse: ({ records, warnings }, filename) => {
    const builder = new TraceBuilder('claude-code', filename, warnings);
    const messages = new Map<string, MessageState>();
    const tools = new Map<string, TraceEvent>();
    const results = new Map<string, { value: unknown; status: TraceEvent['status']; time?: number }>();
    let recognized = 0;
    records.forEach((raw, index) => {
      const item = unwrapBody(raw);
      const time = timestamp(item.timestamp);
      if (item.type === 'stream_event') {
        recognized++;
        builder.warn('Partial stream_event records ignored; only normal message snapshots are supported. Export without --include-partial-messages for a complete normal-message trace.');
        return;
      }
      if (item.type === 'user' || item.type === 'assistant') {
        const message = record(item.message);
        if (!Array.isArray(message.content) && typeof message.content !== 'string') return;
        recognized++;
        const key = `${item.type}:${string(message.id) ?? string(item.uuid) ?? `record-${index}`}`;
        const state = messages.get(key) ?? { blocks: new Set<string>() };
        messages.set(key, state);
        const usage = claudeUsage(message.usage);
        if (usage) state.usage = maxUsage(state.usage, usage);
        const blocks = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content;
        // An occurrence ordinal preserves repeated identical blocks in one message,
        // while replayed snapshots and disjoint blocks sharing message.id deduplicate.
        const occurrences = new Map<string, number>();
        for (const rawBlock of blocks) {
          const block = record(rawBlock);
          const signature = JSON.stringify(block);
          const occurrence = (occurrences.get(signature) ?? 0) + 1;
          occurrences.set(signature, occurrence);
          const blockKey = `${signature}:${occurrence}`;
          if (state.blocks.has(blockKey)) continue;
          state.blocks.add(blockKey);
          let event: TraceEvent | undefined;
          if (block.type === 'text' && typeof block.text === 'string') {
            event = builder.add({ kind: item.type, name: item.type === 'user' ? 'User' : 'Assistant', content: block.text, timestamp: time, status: explicitStatus(item, message), model: string(message.model) });
          } else if (block.type === 'tool_use') {
            const callId = string(block.id);
            if (callId && tools.has(callId)) continue;
            event = builder.add({ kind: 'tool', name: string(block.name) ?? 'Tool', content: '', input: text(block.input), timestamp: time, status: 'unknown', model: string(message.model) });
            if (callId) {
              tools.set(callId, event);
              const result = results.get(callId);
              if (result) finishTool(event, result.value, result.status, result.time);
            }
          } else if (block.type === 'tool_result') {
            const callId = string(block.tool_use_id);
            const result = { value: block.content, status: explicitStatus(block), time };
            if (callId) results.set(callId, result);
            const call = callId ? tools.get(callId) : undefined;
            if (call) finishTool(call, result.value, result.status, time);
            else if (!callId) {
              builder.warn('A tool result has no call ID and cannot be paired.');
              builder.add({ kind: 'tool', name: 'Unpaired tool result', content: text(block.content), output: text(block.content), timestamp: time, status: result.status });
            }
          } else builder.warn('Unsupported Claude content blocks ignored; text, tool_use and tool_result blocks are supported.');
          if (event && !state.usageEvent) state.usageEvent = event;
        }
        return;
      }
      if (['system', 'error', 'result'].includes(String(item.type))) {
        recognized++;
        const failed = item.type === 'error' || item.is_error === true || String(item.subtype ?? '').startsWith('error');
        builder.add({
          kind: 'system',
          name: item.type === 'error' ? 'Error' : `Claude ${string(item.subtype) ?? String(item.type)}`,
          content: text(item.result ?? item.message ?? item.error ?? item.errors ?? item),
          timestamp: time,
          status: failed ? 'error' : explicitStatus(item),
        });
        // Result usage is an aggregate, not another billable message.
      }
    });
    for (const [callId, result] of results) {
      if (!tools.has(callId)) {
        builder.warn('A tool result could not be paired with a tool call.');
        builder.add({ kind: 'tool', name: 'Unpaired tool result', content: text(result.value), output: text(result.value), timestamp: result.time, status: result.status });
      }
    }
    const usageValues: Usage[] = [];
    for (const state of messages.values()) {
      if (!state.usage) continue;
      const usage = { ...state.usage, input: state.usage.input + state.usage.cacheRead + state.usage.cacheWrite };
      usageValues.push(usage);
      if (state.usageEvent) state.usageEvent.usage = usage;
    }
    builder.trace.usage = sumUsage(usageValues);
    if (recognized < records.length) builder.warn('Unrecognized records ignored in Claude Code import.');
    return builder.trace;
  },
};

registerAdapter(adapter);