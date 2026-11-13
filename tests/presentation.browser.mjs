// Optional real-browser regression test. The default unit suite needs no packages.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));

test('Present opens rendered slides and supports navigation in both browser editions', async t => {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/api/decks') {
        response.setHeader('Content-Type', 'application/json');
        response.end('[]'); return;
      }
      if (pathname === '/' || pathname === '/web/') {
        let html = await readFile(path.join(root, 'slide-editor/index.html'), 'utf8');
        if (pathname === '/web/') html = html.replace('content="local"', 'content="web"');
        response.setHeader('Content-Type', 'text/html'); response.end(html); return;
      }
      const file = path.resolve(root, '.' + decodeURIComponent(pathname));
      if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
      const types = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html'};
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {})});
    for (const edition of ['/', '/web/']) {
      await t.test(edition === '/' ? 'local tutorial' : 'online tutorial', async () => {
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          await page.goto(`http://127.0.0.1:${server.address().port}${edition}`);
          await page.frameLocator('#canvas').locator('.slide').first().waitFor();
          const popupPromise = context.waitForEvent('page');
          await page.locator('#preview').click();
          const popup = await popupPromise;
          await popup.locator('.slide.present').waitFor();
          assert.equal(await popup.locator('.slide').count(), 5);
          assert.equal(await popup.locator('.slide').nth(0).isVisible(), true);
          assert.equal(await popup.evaluate(() => window.opener), null);
          const policy = await popup.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
          const nonce = await popup.locator('script').evaluate(script => script.nonce);
          assert.ok(nonce);
          assert.ok(policy.includes(`'nonce-${nonce}'`));
          await popup.keyboard.press('ArrowRight');
          assert.equal(await popup.locator('.slide').nth(1).isVisible(), true);
          assert.equal(await popup.locator('.slide').nth(0).isVisible(), false);
          await popup.keyboard.press('ArrowLeft');
          assert.equal(await popup.locator('.slide').nth(0).isVisible(), true);
          if (process.env.PRESENTATION_SCREENSHOT && edition === '/web/') {
            await popup.screenshot({path: process.env.PRESENTATION_SCREENSHOT});
          }
          await popup.close();

          // Pending source edits must explain the problem rather than silently return.
          await page.locator('#sourceToggle').click();
          const source = page.locator('#source');
          await source.fill((await source.inputValue()) + '\n<!-- pending edit -->');
          const dialogPromise = page.waitForEvent('dialog').then(async dialog => {
            assert.match(dialog.message(), /源码有待应用/);
            await dialog.dismiss();
          });
          await page.locator('#preview').click();
          await dialogPromise;
          assert.equal(context.pages().length, 1);
        } finally { await context.close(); }
      });
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
