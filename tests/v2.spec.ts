import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Trace, TraceEvent } from '../src/core/types';

// Manufactured fixtures only. Worker shims below exercise lifecycle failures,
// never substitute for the real-parser/offline/no-network tests.
const test = base.extend<{ runtimeGuard: void }>({
  runtimeGuard: [async ({ context }, use) => {
    const errors: string[] = [];
    context.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    context.on('weberror', (error) => errors.push(error.error().message));
    await use();
    expect(errors, 'V2 emits no console/page errors').toEqual([]);
  }, { auto: true }],
});

const upload = (page: Page) => page.getByLabel('Drop a trace. See the whole story.', { exact: true });
const sessions = (page: Page) => page.getByRole('navigation', { name: 'Loaded sessions' });
const rows = (page: Page) => page.getByTestId('event-row');
const details = (page: Page) => page.getByRole('complementary', { name: 'Event details' });
const importStatus = (page: Page) => page.locator('.import-status');
const exampleEvent = (id: string, name: string, extra: Partial<TraceEvent> = {}): TraceEvent => ({
  id, kind: 'tool', name, content: 'Synthetic content', status: 'unknown', ...extra,
});
const trace = (name: string, events: TraceEvent[]): Trace => ({ schemaVersion: 1, id: name, name, source: 'synthetic-v2', events, warnings: [] });
const payload = (value: Trace, name = 'synthetic-v2.json') => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });

async function ready(page: Page) {
  await page.goto('/');
  await expect(rows(page)).toHaveCount(14);
  await page.waitForLoadState('networkidle');
}

async function imported(page: Page, count = 1) {
  await expect(importStatus(page)).toContainText(`${count} ${count === 1 ? 'session' : 'sessions'} imported locally.`);
  await expect(importStatus(page)).not.toContainText('could not');
  await expect(upload(page)).toBeEnabled();
  await expect(upload(page)).toHaveValue('');
}

async function compare(page: Page, a: string, b: string) {
  await page.getByRole('tab', { name: /^Compare/ }).click();
  const panel = page.getByRole('region', { name: 'Session comparison', exact: true });
  await panel.getByRole('combobox', { name: 'Session A' }).selectOption({ label: a });
  await panel.getByRole('combobox', { name: 'Session B' }).selectOption({ label: b });
  return page.getByRole('region', { name: 'Event sequence comparison', exact: true });
}

async function download(page: Page, dialog: Locator, format: 'JSON' | 'HTML', info: TestInfo) {
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: `Download ${format}` }).click();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  const path = info.outputPath(`v2-report.${format.toLowerCase()}`);
  await file.saveAs(path);
  return { path, text: await readFile(path, 'utf8') };
}

async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 100; i++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target, 'Keyboard-only target is reachable without positive tabindex').toBeFocused();
}

test.beforeEach(async ({ page }) => ready(page));

test('focus filters combine status/duration and stable ordering without treating missing as zero', async ({ page }) => {
  const data = trace('Synthetic filter cases', [
    exampleEvent('unknown-time', 'Unknown time', { kind: 'user', status: 'ok' }),
    exampleEvent('zero', 'Zero duration', { status: 'error', durationMs: 0 }),
    exampleEvent('long-a', 'Long first', { status: 'error', durationMs: 10000 }),
    exampleEvent('long-b', 'Long second', { status: 'ok', durationMs: 10000, model: 'synthetic-model-v2' }),
  ]);
  await upload(page).setInputFiles(payload(data));
  await imported(page);
  const status = page.getByRole('combobox', { name: 'Event status' });
  const minimum = page.getByRole('spinbutton', { name: 'Minimum duration in milliseconds' });
  const order = page.getByRole('combobox', { name: 'Event order' });
  await order.selectOption('longest');
  expect(await rows(page).evaluateAll((elements) => elements.map((e) => e.getAttribute('data-event-id')))).toEqual(['long-a', 'long-b', 'zero', 'unknown-time']);
  await minimum.fill('0');
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByText('Events with unknown duration are excluded.')).toBeVisible();
  await status.selectOption('error');
  await expect(rows(page)).toHaveCount(2);
  await minimum.fill('1');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Long first');
  await page.getByRole('searchbox', { name: 'Search events' }).fill('synthetic-model-v2');
  await expect(rows(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Search events' })).toBeFocused();
  await expect(order).toHaveValue('recorded');
  await expect(status).toHaveValue('all');
  await expect(minimum).toHaveValue('');
  await expect(rows(page)).toHaveCount(4);
  await page.getByRole('searchbox', { name: 'Search events' }).fill('LONG-B');
  await expect(rows(page)).toHaveCount(1);
  await rows(page).click();
  await expect(details(page).getByRole('heading', { name: 'Long second', exact: true })).toBeVisible();
});

test('event sequence comparison identifies changed fields and inspects either original session', async ({ page }) => {
  const a = trace('Synthetic comparison A', [
    exampleEvent('a-prompt', 'Prompt', { kind: 'user' }),
    exampleEvent('a-read', 'Read', { input: 'old input', output: 'same output', durationMs: 10 }),
    exampleEvent('a-bash', 'Bash', { status: 'error' }),
  ]);
  const b = trace('Synthetic comparison B', [
    exampleEvent('b-prompt', 'Prompt', { kind: 'user', timestamp: 1000 }),
    exampleEvent('b-write', 'Write'),
    exampleEvent('b-read', 'Read', { input: 'new input', output: 'same output', durationMs: 10, status: 'ok' }),
  ]);
  await upload(page).setInputFiles([payload(a, 'synthetic-a.json'), payload(b, 'synthetic-b.json')]);
  await imported(page, 2);
  const panel = await compare(page, a.name, b.name);
  await expect(panel.getByTestId('comparison-row')).toHaveCount(3);
  for (const change of ['changed', 'added', 'removed', 'unchanged']) await expect(panel.locator(`.diff-summary .diff-${change} dd`)).toHaveText('1');
  const changed = panel.getByTestId('comparison-row').filter({ has: page.getByRole('rowheader', { name: 'Changed', exact: true }) });
  await expect(changed.locator('.changed-fields > span')).toHaveText(['Input', 'Status']);
  await expect(panel.getByText(/Repeated names can align ambiguously/)).toBeVisible();
  await panel.getByRole('checkbox', { name: 'Differences only' }).uncheck();
  await expect(panel.getByTestId('comparison-row')).toHaveCount(4);
  const axe = await new AxeBuilder({ page }).include('#panel-compare').analyze();
  expect(axe.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
  await panel.getByRole('button', { name: 'Inspect session B event 3: Read', exact: true }).click();
  await expect(page.getByRole('tab', { name: /^Timeline/ })).toHaveAttribute('aria-selected', 'true');
  await expect(sessions(page).locator('[aria-current="true"]')).toContainText(b.name);
  await expect(rows(page).filter({ hasText: /^Read tool/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(details(page).locator('pre').filter({ hasText: 'new input' }).first()).toBeVisible();
  await expect(details(page)).toBeFocused();
});

test('comparison pagination and inspection retain original indexes past the first timeline page', async ({ page }) => {
  const events = Array.from({ length: 205 }, (_, i) => exampleEvent(`a${i}`, `Tool ${i}`));
  const a = trace('Synthetic paged A', events);
  const b = trace('Synthetic paged B', events.map((e, i) => ({ ...e, id: `b${i}`, content: `changed ${i}` })));
  await upload(page).setInputFiles([payload(a, 'synthetic-a.json'), payload(b, 'synthetic-b.json')]);
  await imported(page, 2);
  const panel = await compare(page, a.name, b.name);
  await expect(panel.getByTestId('comparison-row')).toHaveCount(50);
  await expect(panel.getByRole('status')).toContainText('205 alignment rows · page 1 of 5');
  await panel.getByRole('button', { name: 'Next comparison page' }).click();
  await panel.getByRole('button', { name: 'Next comparison page' }).click();
  await expect(panel.getByRole('status')).toContainText('page 3 of 5');
  await panel.getByRole('button', { name: 'Inspect session A event 126: Tool 125', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Event timeline' }).getByRole('status')).toContainText('page 2 of 3');
  await expect(rows(page)).toHaveCount(100);
  await expect(page.locator('[data-event-id="a125"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(details(page).getByRole('heading', { name: 'Tool 125', exact: true })).toBeVisible();
});

test('oversize sequence comparison shows a limit, not a partial diff, and tools scope can recover', async ({ page }) => {
  const a = trace('Synthetic large comparison', Array.from({ length: 2001 }, (_, i) => exampleEvent(`e${i}`, 'Prompt', { kind: 'user' })));
  await upload(page).setInputFiles(payload(a));
  await imported(page);
  const panel = await compare(page, a.name, a.name);
  await expect(panel.getByRole('status')).toContainText('limited to 2,000 events per side');
  await expect(panel.getByRole('status')).toContainText('No partial diff is shown');
  await expect(panel.getByTestId('comparison-row')).toHaveCount(0);
  await panel.getByRole('combobox', { name: 'Comparison scope' }).selectOption('tools');
  await expect(panel.getByText('No events in this comparison scope.')).toBeVisible();
  await expect(panel.locator('.comparison-limit')).toHaveCount(0);
});

for (const policy of [{ timing: true, usage: false }, { timing: false, usage: true }, { timing: true, usage: true }]) {
  test(`metadata-minimized JSON/HTML and preview agree (timing=${policy.timing}, tokens=${policy.usage})`, async ({ page, context }, info) => {
    const usage = { input: 120, output: 30, cacheRead: 10, cacheWrite: 20 };
    const original = trace('Synthetic sensitive metadata', [
      exampleEvent('private-parent-sentinel', 'private-user-sentinel', { kind: 'user', timestamp: 987654321000, status: 'ok' }),
      exampleEvent('private-child-sentinel', 'private-tool-sentinel', { parentId: 'private-parent-sentinel', timestamp: 987654321025, durationMs: 12345, status: 'error', usage }),
    ]);
    original.usage = usage;
    await upload(page).setInputFiles(payload(original));
    await imported(page);
    await page.getByRole('button', { name: 'Export report', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export report' });
    await expect(dialog.getByRole('checkbox', { name: 'Omit timing metadata' })).not.toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Omit token usage' })).not.toBeChecked();
    if (policy.timing) await dialog.getByRole('checkbox', { name: 'Omit timing metadata' }).check();
    if (policy.usage) await dialog.getByRole('checkbox', { name: 'Omit token usage' }).check();
    await dialog.getByRole('button', { name: 'Show redacted preview' }).click();
    const json = await download(page, dialog, 'JSON', info);
    expect(json.text).toBe(await dialog.getByLabel('Redacted report preview').textContent());
    const shared = JSON.parse(json.text) as Trace;
    expect(shared.events[1].parentId).toBe('event-1');
    expect(shared.events[1].status).toBe('error');
    expect(json.text).not.toContain('private-');
    expect(Object.hasOwn(shared, 'usage')).toBe(!policy.usage);
    expect(Object.hasOwn(shared.events[1], 'usage')).toBe(!policy.usage);
    expect(Object.hasOwn(shared.events[1], 'timestamp')).toBe(!policy.timing);
    expect(Object.hasOwn(shared.events[1], 'durationMs')).toBe(!policy.timing);
    const html = await download(page, dialog, 'HTML', info);
    const report = await context.newPage();
    await report.setContent(html.text);
    await expect(report.locator('script, img, iframe, link, object, embed, svg')).toHaveCount(0);
    const metrics = report.getByRole('region', { name: 'Summary' });
    await expect(metrics.locator('.metric').filter({ hasText: 'Elapsed (ms)' }).locator('strong')).toHaveText(policy.timing ? 'Unknown' : '12370');
    await expect(metrics.locator('.metric').filter({ hasText: 'Input tokens' }).locator('strong')).toHaveText(policy.usage ? 'Unknown' : '120');
    await expect(report.getByRole('cell').last()).toHaveText(policy.timing ? 'Unknown' : '12345');
    if (policy.timing) expect(html.text).not.toContain('987654321');
    await report.close();
    await page.keyboard.press('Escape');
    await upload(page).setInputFiles(json.path);
    await imported(page);
    await expect(rows(page)).toHaveCount(2);
    await expect(sessions(page).locator('[aria-current="true"]')).toContainText('Shared agent run');
    const metricRegion = page.getByRole('region', { name: 'Session metrics' });
    await expect(metricRegion.locator('article').filter({ hasText: 'Reported tokens' }).locator('strong')).toHaveText(policy.usage ? '—' : '150');
  });
}

test('keyboard-only tabs, inspector, filter reset, modal focus trap and reset stay usable', async ({ page }) => {
  const timelineTab = page.getByRole('tab', { name: /^Timeline/ });
  await tabTo(page, timelineTab);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Insights', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Compare', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(timelineTab).toBeFocused();
  const first = rows(page).first();
  await tabTo(page, first);
  await page.keyboard.press('Enter');
  await expect(details(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(first).toBeFocused();
  const exportButton = page.getByRole('button', { name: 'Export report', exact: true });
  await tabTo(page, exportButton);
  await page.keyboard.press('Enter');
  let dialog = page.getByRole('dialog', { name: 'Export report' });
  await expect(dialog.getByRole('button', { name: 'Close export report' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Download HTML' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close export report' })).toBeFocused();
  await tabTo(page, dialog.getByRole('checkbox', { name: 'Omit timing metadata' }));
  await page.keyboard.press('Space');
  await expect(dialog.getByRole('checkbox', { name: 'Omit timing metadata' })).toBeChecked();
  await tabTo(page, dialog.getByRole('button', { name: 'Show redacted preview' }));
  await page.keyboard.press('Enter');
  const axe = await new AxeBuilder({ page }).include('dialog[open]').analyze();
  expect(axe.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(exportButton).toBeFocused();
  await page.keyboard.press('Enter');
  dialog = page.getByRole('dialog', { name: 'Export report' });
  await expect(dialog.getByRole('checkbox', { name: 'Omit timing metadata' })).not.toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Omit token usage' })).not.toBeChecked();
  await expect(dialog.getByLabel('Redacted report preview')).toHaveCount(0);
  await expect(dialog.getByRole('radio', { name: /Structure only/ })).toBeChecked();
});

test('switching to pattern export clears minimization instead of making unsafe numeric-redaction claims', async ({ page }) => {
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export report' });
  await dialog.getByRole('checkbox', { name: 'Omit timing metadata' }).check();
  await dialog.getByRole('checkbox', { name: 'Omit token usage' }).check();
  await dialog.getByRole('radio', { name: /Pattern redaction/ }).check();
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await expect(dialog.getByText(/preserved free text may contain timing and token usage/)).toBeVisible();
  await dialog.getByRole('radio', { name: /Structure only/ }).check();
  await expect(dialog.getByRole('checkbox', { name: 'Omit timing metadata' })).not.toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Omit token usage' })).not.toBeChecked();
});

async function controlledWorkers(page: Page) {
  await page.addInitScript(() => {
    const workers: ControlledWorker[] = [];
    class ControlledWorker extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror = null;
      onmessageerror = null;
      late: ((event: MessageEvent) => void) | null = null;
      terminated = false;
      constructor() { super(); workers.push(this); }
      postMessage(file: File) {
        this.late = this.onmessage;
        if (file.name.startsWith('stall')) return;
        void file.text().then((text) => this.onmessage?.({ data: { trace: JSON.parse(text) } } as MessageEvent));
      }
      terminate() { this.terminated = true; }
    }
    Object.defineProperty(window, 'Worker', { value: ControlledWorker, configurable: true });
    Reflect.set(window, '__v2Workers', workers);
    Reflect.set(window, '__v2LateResult', () => {
      for (const worker of workers) worker.late?.({ data: { trace: {
        schemaVersion: 1, id: 'late', name: 'Late result must not appear', source: 'synthetic', warnings: [],
        events: [{ id: 'late', name: 'Late', kind: 'user', content: '', status: 'unknown' }],
      } } } as MessageEvent);
    });
  });
  await ready(page);
}

test('cancelling a batch discards earlier pending results, ignores late replies, and permits the next import', async ({ page }) => {
  await controlledWorkers(page);
  const data = trace('Synthetic lifecycle fixture', [exampleEvent('one', 'One')]);
  await upload(page).setInputFiles([payload(data, 'fast.json'), payload(data, 'stall.json')]);
  await expect(importStatus(page)).toContainText('Importing file 2 of 2 locally');
  await expect(sessions(page).getByRole('button')).toHaveCount(2);
  await page.getByRole('button', { name: 'Cancel import', exact: true }).click();
  await expect(importStatus(page)).toContainText('Import cancelled. Pending batch discarded');
  await expect(page.getByRole('button', { name: 'Choose files' })).toBeFocused();
  await expect(upload(page)).toHaveValue('');
  await page.evaluate(() => Reflect.get(window, '__v2LateResult')());
  await expect(sessions(page).getByRole('button')).toHaveCount(2);
  expect(await page.evaluate(() => Reflect.get(window, '__v2Workers').every((w: { terminated: boolean }) => w.terminated))).toBe(true);
  await upload(page).setInputFiles(payload(data, 'next.json'));
  await imported(page);
  await expect(sessions(page).getByRole('button')).toHaveCount(3);
  await page.evaluate(() => Reflect.get(window, '__v2LateResult')());
  await expect(sessions(page).getByRole('button')).toHaveCount(3);
  await upload(page).setInputFiles(payload(data, 'stall-clear.json'));
  await expect(page.getByRole('button', { name: 'Cancel import' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear sessions', exact: true }).click();
  await page.evaluate(() => Reflect.get(window, '__v2LateResult')());
  await expect(sessions(page).getByRole('button')).toHaveCount(0);
  await expect(importStatus(page)).toContainText('Sessions cleared');
});

test('a worker that never responds is terminated at the deadline without clearing existing sessions', async ({ page }) => {
  await controlledWorkers(page);
  await page.clock.install();
  const data = trace('Synthetic stalled import', [exampleEvent('one', 'One')]);
  await upload(page).setInputFiles(payload(data, 'stall-timeout.json'));
  await expect(importStatus(page)).toContainText('Importing file 1 of 1');
  await page.clock.fastForward(30001);
  await expect(importStatus(page)).toContainText('1 exceeded the 30-second import limit');
  await expect(upload(page)).toBeEnabled();
  await expect(upload(page)).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Cancel import' })).toHaveCount(0);
  await page.evaluate(() => Reflect.get(window, '__v2LateResult')());
  await expect(sessions(page).getByRole('button')).toHaveCount(2);
  expect(await page.evaluate(() => Reflect.get(window, '__v2Workers').every((w: { terminated: boolean }) => w.terminated))).toBe(true);
});

test('workspace enforces ten sessions and rejects excessive selections before starting import', async ({ page }) => {
  const data = trace('Synthetic session limit', [exampleEvent('one', 'One')]);
  await upload(page).setInputFiles(Array.from({ length: 6 }, (_, i) => payload(data, `synthetic-${i}.json`)));
  await expect(importStatus(page)).toContainText('Choose up to 5 files');
  await expect(sessions(page).getByRole('button')).toHaveCount(2);
  for (const count of [5, 3]) {
    await upload(page).setInputFiles(Array.from({ length: count }, (_, i) => payload(data, `synthetic-${i}.json`)));
    await imported(page, count);
  }
  await expect(sessions(page).getByRole('button')).toHaveCount(10);
  await expect(page.getByRole('button', { name: 'Import trace', exact: false })).toBeDisabled();
  await upload(page).setInputFiles(payload(data));
  await expect(importStatus(page)).toContainText('The limit is 10 sessions');
  await expect(importStatus(page)).toContainText('No files were read');
  await expect(sessions(page).getByRole('button')).toHaveCount(10);
});

test('V2 filters, comparison and minimized downloads remain offline with zero runtime requests', async ({ page, context }, info) => {
  const requests: string[] = [];
  context.on('request', (request) => { if (/^https?:/i.test(request.url())) requests.push(request.url()); });
  page.on('websocket', (socket) => requests.push(socket.url()));
  await context.setOffline(true);
  const a = trace('Offline A', [exampleEvent('a', 'Tool', { input: 'old', durationMs: 0 })]);
  const b = trace('Offline B', [exampleEvent('b', 'Tool', { input: 'new', durationMs: 1 })]);
  await upload(page).setInputFiles([payload(a, 'offline-a.json'), payload(b, 'offline-b.json')]);
  await imported(page, 2);
  await page.getByRole('spinbutton', { name: 'Minimum duration in milliseconds' }).fill('0');
  await expect(rows(page)).toHaveCount(1);
  await compare(page, a.name, b.name);
  await expect(page.getByTestId('comparison-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export report' });
  await dialog.getByRole('checkbox', { name: 'Omit timing metadata' }).check();
  await dialog.getByRole('checkbox', { name: 'Omit token usage' }).check();
  await dialog.getByRole('button', { name: 'Show redacted preview' }).click();
  await download(page, dialog, 'JSON', info);
  await download(page, dialog, 'HTML', info);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});

test('V2 controls and wide comparison tables confine horizontal overflow to inner panels', async ({ page }) => {
  const check = async () => expect(await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await check();
  await page.getByRole('spinbutton', { name: 'Minimum duration in milliseconds' }).fill('0');
  await check();
  await page.getByRole('tab', { name: 'Compare', exact: true }).click();
  await expect(page.getByTestId('comparison-row').first()).toBeVisible();
  await check();
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export report' });
  await dialog.getByRole('checkbox', { name: 'Omit timing metadata' }).check();
  await dialog.getByRole('button', { name: 'Show redacted preview' }).click();
  await check();
  expect(await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
  })).toBe(true);
});