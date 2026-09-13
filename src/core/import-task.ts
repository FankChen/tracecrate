import type { Trace } from './types';

export const IMPORT_TIMEOUT_MS = 30_000;

export interface ImportWorkerLike {
  onmessage: ((event: MessageEvent<{ trace?: Trace; error?: string }>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage: (file: File) => void;
  terminate: () => void;
}

export type ImportOutcome = { status: 'success'; trace: Trace } | { status: 'failed' | 'timeout' | 'cancelled' };

/** One whole-file import; every exit path releases the worker, timer and handlers. */
export function runImportTask(file: File, createWorker: () => ImportWorkerLike, signal: AbortSignal): Promise<ImportOutcome> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve({ status: 'cancelled' }); return; }
    let worker: ImportWorkerLike;
    try { worker = createWorker(); }
    catch { resolve({ status: 'failed' }); return; }
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = (outcome: ImportOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      resolve(outcome);
    };
    const cancel = () => done({ status: 'cancelled' });
    worker.onmessage = ({ data }) => done(data?.trace ? { status: 'success', trace: data.trace } : { status: 'failed' });
    worker.onerror = (event) => { event.preventDefault(); done({ status: 'failed' }); };
    worker.onmessageerror = () => done({ status: 'failed' });
    signal.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => done({ status: 'timeout' }), IMPORT_TIMEOUT_MS);
    if (signal.aborted) { cancel(); return; }
    try { worker.postMessage(file); }
    catch { done({ status: 'failed' }); }
  });
}