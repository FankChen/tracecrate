import { explicitStatus, finishTool, record, string, structuredOutput, text, timestamp, totalUsage, TraceBuilder, unwrapBody } from '../core/helpers';
import { registerAdapter } from '../core/registry';
import type { Adapter, TraceEvent } from '../core/types';

function messageText(value: unknown): string {
  if (!Array.isArray(value)) return text(value);
  return value.map((part) => {
    const block = record(part);
    return typeof block.text === 'string' ? block.text : '';
  }).filter(Boolean).join('\n');
}

const adapter: Adapter = {
  id: 'codex',
  label: 'Codex rollout JSONL',
  detect: ({ records }) => !records.some((item) => Object.hasOwn(item, 'schemaVersion')) && records.some((raw) => {
    const item = unwrapBody(raw);
    return ['session_meta', 'turn_context', 'response_item'].includes(String(item.type))
      || (item.type === 'event_msg' && record(item.payload).type === 'token_count');
  }),
  parse: ({ records, warnings }, filename) => {
    const builder = new TraceBuilder('codex', filename, warnings);
    const calls = new Map<string, TraceEvent>();
    const results = new Map<string, { output: unknown; status: TraceEvent['status']; time?: number }>();
    let model: string | undefined;
    let recognized = 0;
    for (const raw of records) {
      const item = unwrapBody(raw);
      const payload = record(item.payload);
      const time = timestamp(item.timestamp ?? payload.timestamp);
      if (item.type === 'session_meta' || item.type === 'turn_context') {
        recognized++;
        model = string(payload.model) ?? model;
        builder.add({ kind: 'system', name: item.type === 'session_meta' ? 'Codex session' : 'Turn context', content: text(payload), timestamp: time, status: 'unknown', model });
        continue;
      }
      if (item.type === 'event_msg') {
        recognized++;
        if (payload.type === 'token_count') {
          const usage = record(record(payload.info).total_token_usage);
          // Cumulative: replace the TRACE total with the last supplied snapshot.
          // Never place this on an event or add it to response-item usage.
          if (Object.keys(usage).length) builder.trace.usage = totalUsage(usage.input_tokens, usage.output_tokens, usage.cached_input_tokens);
        } else if (payload.type === 'error' || payload.type === 'warning') {
          builder.add({ kind: 'system', name: payload.type === 'error' ? 'Error' : 'Warning', content: text(payload.message ?? payload), timestamp: time, status: payload.type === 'error' ? 'error' : 'unknown' });
        } else builder.warn('Codex event_msg notifications ignored; response_item messages and token_count totals are supported.');
        continue;
      }
      if (item.type !== 'response_item') continue;
      recognized++;
      if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
        const callId = string(payload.call_id) ?? string(payload.id);
        if (callId && calls.has(callId)) {
          builder.warn('Repeated Codex tool call ID ignored.');
          continue;
        }
        const event = builder.add({ kind: 'tool', name: string(payload.name) ?? 'Tool', content: '', input: text(payload.arguments ?? payload.input), timestamp: time, status: 'unknown', model });
        if (callId) {
          calls.set(callId, event);
          const result = results.get(callId);
          if (result) finishTool(event, result.output, result.status, result.time);
        }
      } else if (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') {
        const callId = string(payload.call_id);
        const output = payload.output;
        const structured = structuredOutput(output);
        const status = explicitStatus(payload, structured, structured.metadata);
        const result = { output, status, time };
        if (callId) results.set(callId, result);
        const call = callId ? calls.get(callId) : undefined;
        if (call) finishTool(call, output, status, time);
        else if (!callId) {
          builder.warn('A Codex tool result has no call ID and cannot be paired.');
          builder.add({ kind: 'tool', name: 'Unpaired tool result', content: text(output), output: text(output), timestamp: time, status });
        }
      } else if (payload.type === 'message') {
        const role = payload.role;
        const kind = role === 'user' || role === 'assistant' ? role : 'system';
        builder.add({ kind, name: string(role) ?? 'Message', content: messageText(payload.content), timestamp: time, status: explicitStatus(payload), model });
      } else builder.warn('Unsupported Codex response_item ignored; reasoning and streaming deltas are not imported.');
    }
    for (const [callId, result] of results) {
      if (!calls.has(callId)) {
        builder.warn('A Codex tool result could not be paired with a tool call.');
        builder.add({ kind: 'tool', name: 'Unpaired tool result', content: text(result.output), output: text(result.output), timestamp: result.time, status: result.status });
      }
    }
    if (recognized < records.length) builder.warn('Unrecognized records ignored in Codex import.');
    return builder.trace;
  },
};

registerAdapter(adapter);