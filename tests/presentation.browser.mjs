// Optional real-browser regression test. The default unit suite needs no packages.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile, mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));

test('Browser import and presentation', async t => {
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
    browser = await chromium.launch({headless: true, ignoreDefaultArgs: ['--disable-popup-blocking'],
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {})});
    for (const edition of ['/', '/web/']) {
      await t.test(edition === '/' ? 'local tutorial' : 'online tutorial', async () => {
        const context = await browser.newContext();
        try {
          // Reproduce browsers/hosts that do not open a new popup at all.
          await context.addInitScript(() => { window.open = () => { throw Error('Popup unavailable'); }; });
          const page = await context.newPage();
          await page.goto(`http://127.0.0.1:${server.address().port}${edition}`);
          await page.frameLocator('#canvas').locator('.slide').first().waitFor();
          await page.locator('#preview').click();
          const popup = page.frameLocator('#presentationFrame');
          await popup.locator('.slide.present').waitFor();
          assert.equal(await popup.locator('.slide').count(), 5);
          assert.equal(await popup.locator('.slide').nth(0).isVisible(), true);
          assert.equal(context.pages().length, 1);
          assert.equal(await page.locator('#presentationFrame').getAttribute('sandbox'), 'allow-scripts');
          const policy = await popup.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
          const nonce = await popup.locator('script').evaluate(script => script.nonce);
          assert.ok(nonce);
          assert.ok(policy.includes(`'nonce-${nonce}'`));
          await popup.locator('body').press('ArrowRight');
          assert.equal(await popup.locator('.slide').nth(1).isVisible(), true);
          assert.equal(await popup.locator('.slide').nth(0).isVisible(), false);
          await popup.locator('body').press('ArrowLeft');
          assert.equal(await popup.locator('.slide').nth(0).isVisible(), true);
          await page.locator('#presentationNext').click();
          await popup.locator('.slide').nth(1).waitFor({state:'visible'});
          await page.locator('#presentationPrevious').click();
          await popup.locator('.slide').nth(0).waitFor({state:'visible'});
          if (process.env.PRESENTATION_SCREENSHOT && edition === '/web/') {
            await page.screenshot({path: process.env.PRESENTATION_SCREENSHOT});
          }
          await popup.locator('body').press('Escape');
          await page.locator('#presentation').waitFor({state:'detached'});
          assert.equal(await page.locator('#preview').evaluate(el => el === document.activeElement), true);
          // Reopening creates a fresh player, and the close button returns to editing.
          await page.locator('#preview').click();
          await popup.locator('.slide.present').waitFor();
          await page.locator('#presentationClose').click();
          await page.locator('#presentation').waitFor({state:'detached'});

          if (edition === '/web/') {
            await page.locator('#openFolder').click();
            await page.locator('#htmlFiles').setInputFiles({name:'presentation-regression.html',mimeType:'text/html',buffer:Buffer.from(`<!doctype html><html><head><title>Imported deck</title><style>.deck{width:1280px;height:720px}.slide{background:white}h1{font-size:64px}</style></head><body><main class="deck"><section class="slide"><h1>Imported first</h1></section><section class="slide"><h1>Imported second</h1></section></main><script>document.body.textContent='Original script must not run';</script></body></html>`)});
            await page.frameLocator('#canvas').getByText('Imported first').waitFor();
            // Start at the selected slide; playback must not change editor selection.
            await page.locator('#slides button').filter({hasText:'Imported second'}).click();
            await page.locator('#preview').click();
            await popup.getByText('Imported second').waitFor();
            await page.locator('#presentationPrevious').click();
            await popup.getByText('Imported first').waitFor();
            assert.equal(await popup.locator('body').textContent().then(text => text.includes('Original script must not run')), false);
            await page.locator('#presentationClose').click();
            await page.frameLocator('#canvas').getByText('Imported second').waitFor();
          }

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
          assert.equal(await page.locator('#presentation').count(), 0);
        } finally { await context.close(); }
      });
    }
    await t.test('SVG images survive folder import and standalone HTML export', async () => {
      const directory = await mkdtemp(path.join(tmpdir(), 'slide-studio-svg-'));
      const context = await browser.newContext();
      try {
        await mkdir(path.join(directory, 'assets'));
        await writeFile(path.join(directory, 'assets/swatch.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="lime"/></svg>');
        await writeFile(path.join(directory, 'index.html'), `<!doctype html><html><head><title>SVG image fixture</title></head><body><main class="deck"><section class="slide"><h1>SVG image fixture</h1><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="240" height="100"><image id="modern" href="assets/swatch.svg" width="100" height="100"/><image id="legacy" xlink:href="assets/swatch.svg" x="120" width="100" height="100"/></svg></section></main></body></html>`);
        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}/web/`);
        await page.frameLocator('#canvas').locator('.slide').first().waitFor();
        await page.locator('#openFolder').click();
        await page.locator('#directoryFiles').setInputFiles(directory);
        const frame = page.frameLocator('#canvas');
        await frame.getByText('SVG image fixture').waitFor();
        const modern = await frame.locator('#modern').getAttribute('href');
        assert.match(modern, /^data:image\/svg\+xml;base64,/);
        assert.equal(await frame.locator('#legacy').getAttribute('xlink:href'), modern);
        // Export and reimport just the HTML, without supplying the assets folder.
        const downloadPromise = page.waitForEvent('download');
        await page.locator('#export').click();
        const download = await downloadPromise;
        const exported = await readFile(await download.path());
        await page.locator('#openFolder').click();
        await page.locator('#htmlFiles').setInputFiles({name:'svg-export.html',mimeType:'text/html',buffer:exported});
        await page.locator('#importDialog').waitFor({state:'hidden'});
        await frame.getByText('SVG image fixture').waitFor();
        assert.equal(await frame.locator('#modern').getAttribute('href'), modern);
        assert.equal(await frame.locator('#legacy').getAttribute('xlink:href'), modern);
        // Rasterize the exported SVG in the browser: both image elements must
        // actually render green pixels, not merely retain their attributes.
        const pixels = await frame.locator('svg').evaluate(async svg => {
          const image = new Image();
          image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
          await image.decode();
          const canvas = document.createElement('canvas'); canvas.width=240; canvas.height=100;
          const ctx = canvas.getContext('2d'); ctx.drawImage(image,0,0);
          return [10,130].map(x => [...ctx.getImageData(x,10,1,1).data]);
        });
        assert.deepEqual(pixels, [[0,255,0,255],[0,255,0,255]]);
      } finally {
        await context.close();
        await rm(directory, {recursive:true,force:true});
      }
    });
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
