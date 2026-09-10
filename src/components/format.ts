export const number = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString('en-US');
export function duration(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1000) return `${Math.round(value)} ms`;
  if (Math.abs(value) < 60000) return `${(value / 1000).toFixed(1)} s`;
  return `${(value / 60000).toFixed(1)} min`;
}
export const clip = (text: string, limit = 160) => text.length > limit ? `${text.slice(0, limit)}…` : text;