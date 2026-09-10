import { MAX_FILE_BYTES, parseTrace } from '../core/import';

// File reading and parsing stay off the UI thread. No payload is logged.
self.onmessage = async ({ data }: MessageEvent<File>) => {
  try {
    if (data.size > MAX_FILE_BYTES) {
      self.postMessage({ error: 'File exceeds the 20 MiB limit. Split it before importing.' });
      return;
    }
    const trace = parseTrace(await data.text(), data.name);
    self.postMessage({ trace });
  } catch {
    // Parser exceptions can contain source text; never forward arbitrary errors.
    self.postMessage({ error: 'Could not parse this trace. Use a supported JSON/JSONL export, within the size and 20,000-event limits.' });
  }
};