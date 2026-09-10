export type EventKind = 'user' | 'assistant' | 'tool' | 'system';
export type EventStatus = 'ok' | 'error' | 'unknown';

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface TraceEvent {
  id: string;
  parentId?: string;
  kind: EventKind;
  name: string;
  content: string;
  input?: string;
  output?: string;
  timestamp?: number;
  durationMs?: number;
  status: EventStatus;
  model?: string;
  usage?: Usage;
}

export interface Trace {
  schemaVersion: 1;
  id: string;
  name: string;
  source: string;
  events: TraceEvent[];
  warnings: string[];
  usage?: Usage;
  demo?: boolean;
}

export interface TraceStats {
  events: number;
  tools: number;
  errors: number;
  durationMs?: number;
  usage?: Usage;
  models: string[];
}

export interface Finding {
  id: string;
  severity: 'warning' | 'info';
  title: string;
  description: string;
  eventIds: string[];
}

export interface ParsedInput {
  records: Record<string, unknown>[];
  warnings: string[];
}

export interface Adapter {
  id: string;
  label: string;
  detect: (input: ParsedInput) => boolean;
  parse: (input: ParsedInput, filename: string) => Trace;
}