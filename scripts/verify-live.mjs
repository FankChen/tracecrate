import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const url = process.argv[2];
if (!url || !/^https:\/\/[a-z0-9.-]+\.github\.io\/[a-z0-9/_-]+\/$/i.test(url)) {
  throw new Error('Expected a public HTTPS GitHub Pages project URL');
}
const browser = await chromium.launch();
try {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200);
  await expect(page.locator('meta[name="application-version"]')).toHaveAttribute('content', pkg.version);
  await page.getByRole('main').getByRole('heading', { name: /Pagination fix.*baseline/ }).waitFor();
  assert.equal(await page.getByTestId('event-row').count(), 14);
  await mkdir('live-evidence', { recursive: true });
  await page.screenshot({ path: 'live-evidence/tracecrate-desktop.png', fullPage: true });

  // Test a cold first import with no network, not just a cached worker reuse.
  const requests = [];
  context.on('request', (request) => { if (/^https?:/i.test(request.url())) requests.push(request.url()); });
  page.on('websocket', (socket) => requests.push(socket.url()));
  await context.setOffline(true);
  await page.getByLabel('Drop a trace. See the whole story.', { exact: true }).setInputFiles('examples/claude.jsonl');
  await page.getByRole('main').getByRole('heading', { name: 'claude.jsonl', exact: true }).waitFor();
  await page.getByRole('combobox', { name: 'Event status' }).selectOption('ok');
  await expect(page.getByTestId('event-row').first()).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await page.getByRole('tab', { name: 'Compare', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Event sequence comparison' })).toBeVisible();
  await expect(page.getByTestId('comparison-row').first()).toBeVisible();
  await page.getByRole('region', { name: 'Event sequence comparison' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'live-evidence/tracecrate-v0.2-compare.png', fullPage: true });
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export report' });
  assert.equal(await dialog.getByRole('radio', { name: /Structure only/i }).isChecked(), true);
  assert.equal(await dialog.getByRole('checkbox', { name: 'Omit timing metadata' }).isChecked(), false);
  assert.equal(await dialog.getByRole('checkbox', { name: 'Omit token usage' }).isChecked(), false);
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download HTML', exact: true }).click();
  const download = await downloadPromise;
  assert.equal(await download.failure(), null);
  const htmlPath = await download.path();
  const html = await readFile(htmlPath, 'utf8');
  assert.equal(/<script\b|<img\b|<iframe\b/i.test(html), false);
  await dialog.getByRole('checkbox', { name: 'Omit timing metadata' }).check();
  await dialog.getByRole('checkbox', { name: 'Omit token usage' }).check();
  await dialog.getByRole('button', { name: 'Show redacted preview' }).click();
  await page.screenshot({ path: 'live-evidence/tracecrate-v0.2-export.png' });
  const jsonPending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download JSON', exact: true }).click();
  const jsonDownload = await jsonPending;
  assert.equal(await jsonDownload.failure(), null);
  const json = await readFile(await jsonDownload.path(), 'utf8');
  assert.equal(json, await dialog.getByLabel('Redacted report preview').textContent());
  const shared = JSON.parse(json);
  assert.equal(Object.hasOwn(shared, 'usage'), false);
  for (const event of shared.events) for (const field of ['usage', 'timestamp', 'durationMs']) assert.equal(Object.hasOwn(event, field), false);
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  await writeFile('live-evidence/verification.json', JSON.stringify({
    url, version: pkg.version, revision: process.env.GITHUB_SHA ?? null, browser: browser.version(),
    platform: process.platform, viewport: { width: 1440, height: 1080 }, syntheticOnly: true,
    checks: ['version-meta', 'subpath-assets', 'cold-offline-import', 'status-filter', 'sequence-comparison', 'default-html-download', 'minimized-json-preview-download-agreement', 'zero-runtime-network', 'no-console-errors'],
  }, null, 2) + '\n');
  console.log(`Live Pages v${pkg.version} smoke passed: version/subpath assets, cold offline import, V2 filtering/comparison, default HTML and minimized JSON exports, zero runtime network and no console errors. Browser: ${browser.version()}`);
} finally {
  await browser.close();
}