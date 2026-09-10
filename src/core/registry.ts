import type { Adapter } from './types';

const adapters = new Map<string, Adapter>();

export function registerAdapter(adapter: Adapter): void {
  if (adapters.has(adapter.id)) throw new Error(`Duplicate trace adapter registration: ${adapter.id}`);
  adapters.set(adapter.id, adapter);
}

export function getAdapters(): readonly Adapter[] {
  return [...adapters.values()];
}