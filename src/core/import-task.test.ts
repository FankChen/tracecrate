import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMPORT_TIMEOUT_MS, runImportTask } from './import-task';
import type { ImportWorkerLike } from './import-task';
import type { Trace } from './types';

const trace: Trace = { schemaVersion: 1, id: 'synthetic', name: 'Synthetic', source: 'native', warnings: [], events: [
  { id: 'e1', kind: 'user', name: 'User', content: 'synthetic', status: 'unknown' },
] };
const file = new File(['synthetic'], 'synthetic.json');
const message = (data: { trace?: Trace; error?: string }) => ({ data }) as MessageEvent<typeof data>;

function setup() {
  const worker: ImportWorkerLike = { onmessage: null, onerror: null, onmessageerror: null, postMessage: vi.fn(), terminate: vi.fn() };
  const controller = new AbortController();
  const result = runImportTask(file, () => worker, controller.signal);
  return { worker, controller, result };
}

describe('import worker lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
  it('publishes a successful result once, cleaning all handlers and timers', async () => {
    const { worker, controller, result } = setup();
    expect(worker.postMessage).toHaveBeenCalledWith(file);
    const late = worker.onmessage!;
    late(message({ trace }));
    controller.abort();
    late(message({ error: 'late synthetic response' }));
    expect(await result).toEqual({ status: 'success', trace });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect([worker.onmessage, worker.onerror, worker.onmessageerror]).toEqual([null, null, null]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('terminates at the per-file deadline and ignores a late success', async () => {
    const { worker, result } = setup();
    const late = worker.onmessage!;
    await vi.advanceTimersByTimeAsync(IMPORT_TIMEOUT_MS - 1);
    expect(worker.terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    late(message({ trace }));
    expect(await result).toEqual({ status: 'timeout' });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts a pending import, with no timer or late-result leak', async () => {
    const { worker, controller, result } = setup();
    const late = worker.onmessage!;
    controller.abort();
    late(message({ trace }));
    expect(await result).toEqual({ status: 'cancelled' });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not create a worker for an already cancelled batch', async () => {
    const controller = new AbortController();
    controller.abort();
    const factory = vi.fn();
    expect(await runImportTask(file, factory, controller.signal)).toEqual({ status: 'cancelled' });
    expect(factory).not.toHaveBeenCalled();
  });
  it('handles worker-construction failure without scheduling work', async () => {
    expect(await runImportTask(file, () => { throw new Error('synthetic'); }, new AbortController().signal)).toEqual({ status: 'failed' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cleans up if structured cloning fails at postMessage', async () => {
    const worker: ImportWorkerLike = { onmessage: null, onerror: null, onmessageerror: null, postMessage: () => { throw new Error('synthetic'); }, terminate: vi.fn() };
    expect(await runImportTask(file, () => worker, new AbortController().signal)).toEqual({ status: 'failed' });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['message', 'error', 'messageerror'])('cleans up on %s failure without returning source text', async (kind) => {
    const { worker, result } = setup();
    if (kind === 'message') worker.onmessage!(message({ error: 'private-synthetic-content' }));
    if (kind === 'messageerror') worker.onmessageerror!({} as MessageEvent);
    if (kind === 'error') {
      const preventDefault = vi.fn();
      worker.onerror!({ preventDefault } as unknown as ErrorEvent);
      expect(preventDefault).toHaveBeenCalledOnce();
    }
    expect(await result).toEqual({ status: 'failed' });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('handles cancellation during construction before posting the file', async () => {
    const controller = new AbortController();
    const worker: ImportWorkerLike = { onmessage: null, onerror: null, onmessageerror: null, postMessage: vi.fn(), terminate: vi.fn() };
    const result = runImportTask(file, () => { controller.abort(); return worker; }, controller.signal);
    expect(await result).toEqual({ status: 'cancelled' });
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});