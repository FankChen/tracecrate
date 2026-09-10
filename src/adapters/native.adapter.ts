import { validateTrace } from '../core/helpers';
import { registerAdapter } from '../core/registry';
import type { Adapter } from '../core/types';

const adapter: Adapter = {
  id: 'native',
  label: 'Tracecrate report (schemaVersion 1)',
  detect: ({ records }) => records.some((item) => Object.hasOwn(item, 'schemaVersion')),
  parse: ({ records, warnings }) => {
    if (records.length !== 1) throw new Error('Import one native Tracecrate report at a time.');
    const trace = validateTrace(records[0]);
    trace.warnings.push(...warnings);
    return trace;
  },
};

registerAdapter(adapter);