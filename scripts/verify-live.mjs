import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const url = process.argv[2];
if (!url || !/^https:\/\/[a-z0-9.-]+\.github\.io\/[a-z0-9/_-]+\/$/i.test(url)) {
  throw new Error('Expected a public HTTPS GitHub Pages project URL');
}
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200);
  await page.getByRole('main').getByRole('heading', { name: /Pagination fix.*baseline/ }).waitFor();
  assert.equal(await page.getByTestId('event-row').count(), 14);
  await mkdir('live-evidence', { recursive: true });
  await page.screenshot({ path: 'live-evidence/tracecrate-desktop.png', fullPage: true });

  // Test a cold first import with no network, not just a cached worker reuse.
  await context.setOffline(true);
  await page.getByLabel('Drop a trace. See the whole story.', { exact: true }).setInputFiles('examples/claude.jsonl');
  await page.getByRole('main').getByRole('heading', { name: 'claude.jsonl', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export report' });
  assert.equal(await dialog.getByRole('radio', { name: /Structure only/i }).isChecked(), true);
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download HTML', exact: true }).click();
  const download = await downloadPromise;
  assert.equal(await download.failure(), null);
  assert.deepEqual(errors, []);
  console.log('Live Pages smoke passed: subpath assets, synthetic demo, cold offline import, structure-only HTML export, no console errors.');
} finally {
  await browser.close();
}