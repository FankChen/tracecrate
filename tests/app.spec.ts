import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Trace } from '../src/core/types';

// Both projects in playwright.config.ts run every test. Session navigation is a
// sidebar on desktop and a horizontally scrolling strip on mobile: do not use
// coordinates, nth-child session selectors, or assume an off-screen item is hidden.
const examples = {
  claude: fileURLToPath(new URL('../examples/claude.jsonl', import.meta.url)),
  codex: fileURLToPath(new URL('../examples/codex.jsonl', import.meta.url)),
  otlp: fileURLToPath(new URL('../examples/otlp.json', import.meta.url)),
};
const test = base.extend<{ runtimeGuard: void }>({
  runtimeGuard: [async ({ context }, runFixture) => {
    const errors: string[] = [];
    const onConsole = (message: import('@playwright/test').ConsoleMessage) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    };
    const onError = (error: import('@playwright/test').WebError) => {
      errors.push(`uncaught: ${error.error().message}`);
    };
    context.on('console', onConsole);
    context.on('weberror', onError);
    try { await runFixture(); }
    finally {
      context.off('console', onConsole);
      context.off('weberror', onError);
      expect(errors, 'No console errors or uncaught errors, including report pages').toEqual([]);
    }
  }, { auto: true }],
});

const sessions = (page: Page) => page.getByRole('navigation', { name: 'Loaded sessions' });
const activeSession = (page: Page) => sessions(page).locator('button[aria-current="true"]');
const timeline = (page: Page) => page.getByRole('region', { name: 'Event timeline' });
const rows = (page: Page) => timeline(page).getByTestId('event-row');
const details = (page: Page) => page.getByRole('complementary', { name: 'Event details' });
const upload = (page: Page) => page.getByLabel('Drop a trace. See the whole story.', { exact: true });
// There are other status regions (pagination and export); scope the import one.
const importStatus = (page: Page) => page.getByRole('main').locator('[role="status"]').filter({ hasText: /import|parsed|cleared/i });
const field = (page: Page, name: string) => details(page).getByRole('heading', { name, exact: true }).locator('..').locator('pre');

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('heading', { name: /Pagination fix.*baseline/ })).toBeVisible();
  await expect(rows(page)).toHaveCount(14);
  await expect(upload(page)).toBeEnabled();
  // Settle initial assets only. No import/worker prewarming, routing, cache
  // injection, service worker, or network exception is used by privacy tests.
  await page.waitForLoadState('networkidle');
}

async function view(page: Page, name: 'Timeline' | 'Insights' | 'Compare') {
  const tab = page.getByRole('tab', { name: new RegExp(`^${name}\\b`) });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  return page.getByRole('tabpanel', { name: new RegExp(`^${name}\\b`) });
}

async function imported(page: Page, count = 1) {
  await expect(importStatus(page)).toContainText(new RegExp(`^${count} sessions? imported locally\\.`));
  await expect(importStatus(page)).not.toContainText(/could not|rejected/i);
  await expect(upload(page)).toBeEnabled();
  await expect(upload(page)).toHaveValue('');
}

async function importExample(page: Page, path: string) {
  await upload(page).setInputFiles(path);
  await imported(page);
}

async function openExport(page: Page) {
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export report' });
  await expect(dialog).toBeVisible();
  // Deliberately never select structure here: the default itself is a contract.
  await expect(dialog.getByRole('radio', { name: /Structure only/i })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: /Pattern redaction/i })).not.toBeChecked();
  return dialog;
}

async function downloadReport(page: Page, dialog: Locator, format: 'JSON' | 'HTML', info: TestInfo) {
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: `Download ${format}`, exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(`tracecrate-report.${format.toLowerCase()}`);
  const path = info.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  expect(await download.failure()).toBeNull();
  await expect(dialog.getByRole('status')).toContainText(/report prepared/i);
  return { path, text: await readFile(path, 'utf8') };
}

async function noPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewport;
  }), { message: 'Only inner panels/nav may scroll horizontally, never the page' }).toBeLessThanOrEqual(1);
}

// Entirely manufactured data: no production trace, personal data, or live secret.
// Put sentinels in every identifying/text field, including an actual parent link.
function syntheticTrace(): Trace {
  return {
    schemaVersion: 1, id: 'private-run-sentinel', name: 'Private synthetic session sentinel',
    source: 'private-source-sentinel', warnings: ['private-warning-sentinel'],
    usage: { input: 12, output: 3, cacheRead: 2, cacheWrite: 1 },
    events: [
      { id: 'private-parent-sentinel', kind: 'user', name: 'private-user-name-sentinel',
        content: 'private-user-content-sentinel', status: 'ok', timestamp: 1000 },
      { id: 'private-tool-id-sentinel', parentId: 'private-parent-sentinel', kind: 'tool',
        name: 'private-tool-name-sentinel', content: 'private-tool-content-sentinel',
        input: '{"query":"private-input-sentinel"}', output: 'private-output-sentinel',
        model: 'private-model-sentinel', status: 'error', timestamp: 1100, durationMs: 25,
        usage: { input: 4, output: 1, cacheRead: 1, cacheWrite: 0 } },
    ],
  };
}

async function importSynthetic(page: Page, trace: Trace) {
  await upload(page).setInputFiles({
    name: 'synthetic-private-fixture.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(trace)),
  });
  await imported(page);
  await expect(page.getByRole('main').getByRole('heading', { name: trace.name, exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => { await ready(page); });

test('first load is an explicitly synthetic demo and session navigation changes the active trace', async ({ page }) => {
  await expect(sessions(page).getByRole('button')).toHaveCount(2);
  await expect(activeSession(page)).toContainText(/baseline/);
  await expect(sessions(page).getByRole('button').filter({ hasText: 'Synthetic demo' })).toHaveCount(2);
  await expect(page.getByText(/Manufactured runs, synthetic tokens and timings/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load synthetic demo', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Session metrics' })).toBeVisible();
  await sessions(page).getByRole('button', { name: /Pagination fix.*optimized/ }).click();
  await expect(activeSession(page)).toContainText(/optimized/);
  await expect(rows(page)).toHaveCount(9);
  await sessions(page).getByRole('button', { name: /Pagination fix.*baseline/ }).click();
  await expect(activeSession(page)).toContainText(/baseline/);
  await expect(rows(page)).toHaveCount(14);
});

test('timeline combines kind filters and case-insensitive content search, then clears empty results', async ({ page }) => {
  const kind = page.getByRole('combobox', { name: 'Event kind' });
  const search = page.getByRole('searchbox', { name: 'Search events' });
  await kind.selectOption('tool');
  await expect(rows(page)).toHaveCount(10);
  await search.fill('NPM TEST');
  await expect(rows(page)).toHaveCount(2);
  for (const row of await rows(page).all()) await expect(row).toHaveAccessibleName(/^Bash tool/);
  await kind.selectOption('assistant');
  await expect(rows(page)).toHaveCount(0);
  await expect(timeline(page).getByRole('heading', { name: /No matching events/ })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(kind).toHaveValue('all');
  await expect(rows(page)).toHaveCount(14);
  for (const [value, count] of [['user', 1], ['assistant', 3], ['system', 0]] as const) {
    await kind.selectOption(value);
    await expect(rows(page)).toHaveCount(count);
  }
  await kind.selectOption('all');
  await search.fill('no-such-synthetic-event-938');
  await expect(rows(page)).toHaveCount(0);
});

test('tool details expose input, output, metadata and error status without executing anything', async ({ page }) => {
  const failedTool = rows(page).filter({ hasText: 'Run pagination tests' });
  await failedTool.click();
  await expect(failedTool).toHaveAttribute('aria-pressed', 'true');
  await expect(details(page).getByRole('heading', { name: 'Bash', exact: true })).toBeVisible();
  await expect(details(page).getByText('Reported error', { exact: true })).toBeVisible();
  await expect(field(page, 'Tool input')).toContainText('npm test -- pagination');
  await expect(field(page, 'Tool output')).toContainText('1 failed, 2 passed');
  expect(JSON.parse(await field(page, 'Metadata').innerText())).toMatchObject({ kind: 'tool', status: 'error' });
  await page.getByRole('button', { name: 'Close event details' }).click();
  await expect(failedTool).toHaveAttribute('aria-pressed', 'false');
  await expect(details(page).getByRole('heading', { name: /Follow the details/ })).toBeVisible();
});

test('insight evidence and tool breakdown navigate back to the selected timeline event', async ({ page }) => {
  let panel = await view(page, 'Insights');
  await expect(panel.getByRole('heading', { name: 'Signals in the sequence' })).toBeVisible();
  const repeated = panel.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Identical tool calls observed' }) });
  await expect(repeated.getByRole('button', { name: /Inspect event/ })).toHaveCount(3);
  await repeated.getByRole('button', { name: 'Inspect event 1', exact: true }).click();
  await expect(page.getByRole('tab', { name: /^Timeline\b/ })).toHaveAttribute('aria-selected', 'true');
  await expect(rows(page).filter({ hasText: 'Inspect the pagination helper' })).toHaveAttribute('aria-pressed', 'true');
  await expect(field(page, 'Tool input')).toContainText('src/pagination.ts');
  panel = await view(page, 'Insights');
  await panel.getByRole('button', { name: /^Bash 3 calls/ }).click();
  await expect(details(page).getByRole('heading', { name: 'Bash', exact: true })).toBeVisible();
  await expect(rows(page).filter({ hasText: 'Run pagination tests' })).toHaveAttribute('aria-pressed', 'true');
});

test('compare shows descriptive metrics, changed selectors, and same-session zero differences', async ({ page }) => {
  const panel = await view(page, 'Compare');
  await expect(panel.getByText(/not a controlled benchmark/)).toBeVisible();
  await expect(panel.getByText(/Synthetic demo pair/)).toBeVisible();
  const a = panel.getByRole('combobox', { name: 'Session A' });
  const b = panel.getByRole('combobox', { name: 'Session B' });
  await expect(a).toHaveValue('demo-baseline');
  await expect(b).toHaveValue('demo-optimized');
  const metrics = panel.getByRole('table', { name: /Recorded metrics/ });
  const calls = metrics.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Tool calls', exact: true }) });
  await expect(calls.getByRole('cell')).toHaveText(['10', '6', '-4']);
  await a.selectOption('demo-optimized');
  await b.selectOption('demo-baseline');
  await expect(calls.getByRole('cell')).toHaveText(['6', '10', '+4']);
  await b.selectOption('demo-optimized');
  await expect(panel.getByText(/comparing the same session/)).toBeVisible();
  await expect(calls.getByRole('cell')).toHaveText(['6', '6', '0']);
  const tools = panel.getByRole('table', { name: 'Tool call counts', exact: true });
  for (const row of await tools.getByRole('row').filter({ has: page.getByRole('rowheader') }).all()) {
    await expect(row.getByRole('cell').last()).toHaveText('0');
  }
});

test('invalid file import shows an error while retaining the prior active imported trace', async ({ page }) => {
  await importExample(page, examples.claude);
  const before = await activeSession(page).innerText();
  const beforeIds = await rows(page).evaluateAll((elements) => elements.map((element) => element.getAttribute('data-event-id')));
  for (const buffer of [Buffer.from('{invalid synthetic JSON'), Buffer.from('{"unsupported":true}')]) {
    await upload(page).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer });
    await expect(importStatus(page)).toContainText(/0 sessions imported locally.*could not be parsed/);
    await expect(importStatus(page)).toBeVisible();
    await expect(upload(page)).toBeEnabled();
    await expect(upload(page)).toHaveValue('');
    // Match the innerText snapshot: block-level session labels insert a rendered
    // newline that textContent (the default for toHaveText) does not contain.
    await expect(activeSession(page)).toHaveText(before, { useInnerText: true });
    await expect(sessions(page).getByRole('button')).toHaveCount(3);
    await expect(page.getByRole('main').getByRole('heading', { name: 'claude.jsonl', exact: true })).toBeVisible();
    expect(await rows(page).evaluateAll((elements) => elements.map((element) => element.getAttribute('data-event-id')))).toEqual(beforeIds);
  }
});

for (const example of [
  { path: examples.claude, name: 'claude.jsonl', tool: 'count_items', input: 'items', output: '2', status: 'Reported OK', count: 4 },
  { path: examples.codex, name: 'codex.jsonl', tool: 'shell', input: 'echo synthetic', output: 'synthetic', status: 'Reported OK', count: 4 },
  { path: examples.otlp, name: 'otlp.json', tool: 'lookup', input: 'synthetic', output: 'not found', status: 'Reported error', count: 2 },
]) {
  test(`imports ${example.name} from the existing example path with paired tool data`, async ({ page }) => {
    await importExample(page, example.path);
    await expect(activeSession(page)).toContainText(example.name);
    await expect(sessions(page).getByRole('button')).toHaveCount(3);
    await expect(rows(page)).toHaveCount(example.count);
    await rows(page).filter({ hasText: new RegExp(`^${example.tool}\\s`) }).click();
    await expect(field(page, 'Tool input')).toContainText(example.input);
    await expect(field(page, 'Tool output')).toContainText(example.output);
    await expect(details(page).getByText(example.status, { exact: true })).toBeVisible();
  });
}

test('selecting the same file twice adds distinct sessions and resets the file input', async ({ page }) => {
  await importExample(page, examples.claude);
  const firstRowIds = await rows(page).evaluateAll((elements) => elements.map((element) => element.getAttribute('data-event-id')));
  await importExample(page, examples.claude);
  const copies = sessions(page).getByRole('button', { name: /claude\.jsonl/ });
  await expect(copies).toHaveCount(2);
  await expect(sessions(page).getByRole('button')).toHaveCount(4);
  await expect(copies.last()).toHaveAttribute('aria-current', 'true');
  await expect(copies.first()).not.toHaveAttribute('aria-current', 'true');
  expect(await rows(page).evaluateAll((elements) => elements.map((element) => element.getAttribute('data-event-id')))).toEqual(firstRowIds);
  await copies.first().click();
  await expect(copies.first()).toHaveAttribute('aria-current', 'true');
  await expect(copies.last()).not.toHaveAttribute('aria-current', 'true');
});

test('clear sessions removes all imports and demo data, then demo can be restored', async ({ page }) => {
  await upload(page).setInputFiles(Object.values(examples));
  await imported(page, 3);
  await expect(sessions(page).getByRole('button')).toHaveCount(5);
  await page.getByRole('button', { name: 'Clear sessions', exact: true }).click();
  await expect(sessions(page).getByRole('button')).toHaveCount(0);
  await expect(importStatus(page)).toContainText(/Sessions cleared/);
  await expect(page.getByRole('heading', { name: /A fresh workspace/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export report', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tablist', { name: 'Trace views' })).toHaveCount(0);
  await expect(upload(page)).toHaveValue('');
  // The empty state and sidebar both have a Load button; scope to main.
  await page.getByRole('main').getByRole('button', { name: 'Load synthetic demo', exact: true }).click();
  await expect(sessions(page).getByRole('button')).toHaveCount(2);
  await expect(sessions(page).getByRole('button', { name: /claude\.jsonl|codex\.jsonl|otlp\.json/ })).toHaveCount(0);
  await expect(rows(page)).toHaveCount(14);
});

test('default JSON download strips all original text and identities, keeps structure, and reimports', async ({ page }, info) => {
  const original = syntheticTrace();
  await importSynthetic(page, original);
  const dialog = await openExport(page);
  const result = await downloadReport(page, dialog, 'JSON', info);
  const report = JSON.parse(result.text) as Trace;
  expect(report).toMatchObject({ schemaVersion: 1, id: 'shared-run', name: 'Shared agent run', source: 'TraceCrate export', usage: original.usage });
  expect(Object.keys(report).sort()).toEqual(['schemaVersion', 'id', 'name', 'source', 'events', 'warnings', 'usage'].sort());
  expect(report.events).toEqual([
    { id: 'event-1', kind: 'user', name: 'User 1', content: '[Removed for sharing]', status: 'ok', timestamp: 1000 },
    { id: 'event-2', parentId: 'event-1', kind: 'tool', name: 'Tool 1', content: '[Removed for sharing]', status: 'error',
      timestamp: 1100, durationMs: 25, usage: original.events[1].usage },
  ]);
  for (const value of [original.id, original.name, original.source, ...original.warnings,
    ...original.events.flatMap((event) => [event.id, event.parentId, event.name, event.content, event.input, event.output, event.model])]) {
    if (value) expect(result.text, `Original field must not survive: ${value}`).not.toContain(value);
  }
  expect(result.text).not.toContain('private-');
  expect(report.warnings.join(' ')).toMatch(/Content removed/);
  await expect(dialog.getByRole('status')).toContainText('structure-only');
  await dialog.getByRole('button', { name: 'Close export report' }).click();
  await importExample(page, result.path);
  await expect(activeSession(page)).toContainText('Shared agent run');
  await expect(rows(page)).toHaveCount(2);
  await rows(page).filter({ hasText: /^Tool 1\s/ }).click();
  await expect(field(page, 'Content')).toHaveText('[Removed for sharing]');
  await expect(details(page).getByRole('heading', { name: /^Tool (input|output)$/ })).toHaveCount(0);
  expect(JSON.parse(await field(page, 'Metadata').innerText())).toMatchObject({ id: 'event-2', parentId: 'event-1', status: 'error' });
});

test('pattern export warns, preserves escaped HTML as text, and does not persist as the default', async ({ page, context }, info) => {
  const payload = '<script>globalThis.__tracecrateXss=1</script><img src="data:,x" onerror="globalThis.__tracecrateXss=2"><svg onload="globalThis.__tracecrateXss=3"></svg>';
  const original = syntheticTrace();
  Object.assign(original.events[1], { name: `<b>synthetic-markup-tool</b>`, content: payload,
    input: JSON.stringify({ password: 'synthetic-password-value' }), output: payload });
  original.warnings.push(payload);
  await importSynthetic(page, original);
  let dialog = await openExport(page);
  await dialog.getByRole('radio', { name: /Pattern redaction/i }).check();
  await expect(dialog.getByText(/Patterns may miss secrets/)).toBeVisible();
  await expect(dialog.getByText(/Redaction is not a security guarantee/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Show redacted preview' }).click();
  const preview = dialog.getByLabel('Redacted report preview');
  await expect(preview).toContainText('<script>');
  await expect(preview.locator('script, img, svg, b')).toHaveCount(0);
  await expect(preview).not.toContainText('synthetic-password-value');
  await expect(preview).toContainText('[REDACTED]');
  const result = await downloadReport(page, dialog, 'HTML', info);
  await expect(dialog.getByRole('status')).toContainText('pattern redaction');
  expect(result.text).toContain('&lt;script&gt;');
  expect(result.text).not.toContain('<script>');
  expect(result.text).not.toContain('synthetic-password-value');
  // Render actual downloaded bytes, not a second call into the exporter.
  const reportPage = await context.newPage();
  try {
    await reportPage.setContent(result.text);
    await expect(reportPage.getByRole('region', { name: 'Sharing notice' })).toContainText(/BEST-EFFORT REDACTION ONLY/);
    await expect(reportPage.locator('script, img, svg, iframe, object, embed, [onerror], [onload]')).toHaveCount(0);
    await expect(reportPage.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /default-src 'none'/);
    await expect(reportPage.locator('link[href], script[src]')).toHaveCount(0);
    await expect(reportPage.getByText('<b>synthetic-markup-tool</b>', { exact: true }).first()).toBeVisible();
    await reportPage.locator('summary').filter({ hasText: 'synthetic-markup-tool' }).click();
    await expect(reportPage.locator('pre').filter({ hasText: payload })).toHaveCount(2);
    expect(await reportPage.evaluate(() => Reflect.get(globalThis, '__tracecrateXss'))).toBeUndefined();
    expect(await page.evaluate(() => Reflect.get(globalThis, '__tracecrateXss'))).toBeUndefined();
  } finally { await reportPage.close(); }
  await dialog.getByRole('button', { name: 'Close export report' }).click();
  dialog = await openExport(page);
  await expect(dialog.getByRole('radio', { name: /Structure only/i })).toBeChecked();
});

test('after initial load, offline import and content search work without prewarming an import', async ({ page, context }) => {
  await context.setOffline(true);
  try {
    await importExample(page, examples.codex);
    await page.getByRole('combobox', { name: 'Event kind' }).selectOption('tool');
    await page.getByRole('searchbox', { name: 'Search events' }).fill('ECHO SYNTHETIC');
    await expect(rows(page)).toHaveCount(1);
    await rows(page).click();
    await expect(field(page, 'Tool input')).toContainText('echo synthetic');
    await expect(field(page, 'Tool output')).toContainText('synthetic');
  } finally { await context.setOffline(false); }
});

test('import and both exports make zero runtime network requests after initial readiness', async ({ page, context }, info) => {
  const requests: string[] = [];
  const onRequest = (request: import('@playwright/test').Request) => {
    if (/^https?:/i.test(request.url())) requests.push(`${request.method()} ${request.resourceType()} ${request.url()}`);
  };
  const onSocket = (socket: import('@playwright/test').WebSocket) => { requests.push(`WebSocket ${socket.url()}`); };
  context.on('request', onRequest); // Includes worker requests; no same-origin exemption.
  page.on('websocket', onSocket);
  try {
    await importExample(page, examples.claude);
    const dialog = await openExport(page);
    await downloadReport(page, dialog, 'JSON', info);
    await downloadReport(page, dialog, 'HTML', info);
  } finally {
    context.off('request', onRequest);
    page.off('websocket', onSocket);
    expect(requests, 'HTTP(S) and WebSocket traffic are forbidden during local import/export').toEqual([]);
  }
});

test('default sample main timeline has no serious or critical axe violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).include('#main-content').analyze();
  expect(results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
});

test('default sample export dialog has no serious or critical axe violations and restores focus', async ({ page }) => {
  const dialog = await openExport(page);
  const results = await new AxeBuilder({ page }).include('dialog[open]').analyze();
  expect(results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Export report', exact: true })).toBeFocused();
});

test('mobile and desktop keep horizontal overflow inside panels throughout navigation and export', async ({ page }) => {
  await noPageOverflow(page);
  await sessions(page).getByRole('button', { name: /Pagination fix.*optimized/ }).click();
  await noPageOverflow(page);
  await view(page, 'Insights');
  await noPageOverflow(page);
  await view(page, 'Compare');
  await noPageOverflow(page);
  await importSynthetic(page, syntheticTrace());
  await rows(page).filter({ hasText: 'private-tool-name-sentinel' }).click();
  await noPageOverflow(page);
  const dialog = await openExport(page);
  await dialog.getByRole('button', { name: 'Show redacted preview' }).click();
  await noPageOverflow(page);
  await expect.poll(() => dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= -1 && bounds.right <= document.documentElement.clientWidth + 1;
  })).toBe(true);
});