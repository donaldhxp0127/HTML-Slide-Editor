import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../slide-editor/import-html.js', import.meta.url), 'utf8');
const limit = 50 * 1024 * 1024;

function importer(globals = {}) {
  const context = {window: {}, t: text => text, ...globals};
  vm.runInNewContext(source, context);
  return context.window.slideStudioImport;
}

test('import rejects empty selections and folders without HTML', async t => {
  for (const [name, files] of [
    ['empty selection', []],
    ['only assets', [{name: 'photo.png', size: 100}]],
  ]) {
    await t.test(name, async () => {
      await assert.rejects(() => importer()(files), /请选择包含 HTML 的文件或文件夹/);
    });
  }
});

test('the import size limit counts all files before reading HTML', async () => {
  let reads = 0;
  const files = [
    {name: 'index.html', size: 1, text() { reads++; throw Error('must not read'); }},
    {name: 'first.png', size: limit / 2},
    {name: 'second.png', size: limit / 2},
  ];
  await assert.rejects(() => importer()(files), /导入文件总大小不能超过 50 MB/);
  assert.equal(reads, 0);
});

// These fixtures exercise validation and file selection only. A parser stub
// marks where real browser HTML parsing would begin; it does not emulate a DOM.
test('a selection totaling exactly 50 MiB reaches HTML parsing', async () => {
  const parsed = [];
  class DOMParser {
    parseFromString(html, type) {
      parsed.push([html, type]);
      throw Error('PARSER_REACHED');
    }
  }
  const file = {name: 'deck.HTM', size: limit, text: async () => '<section class="slide"></section>'};
  await assert.rejects(() => importer({DOMParser})([file]), /PARSER_REACHED/);
  assert.deepEqual(parsed, [['<section class="slide"></section>', 'text/html']]);
});

test('ordinary HTML without slide containers is rejected', async () => {
  class DOMParser {
    parseFromString() {
      return {querySelector(selector) { assert.equal(selector, '.slide'); return null; }};
    }
  }
  const file = {name: 'index.html', size: 30, text: async () => '<p>Not a slide deck</p>'};
  await assert.rejects(() => importer({DOMParser})([file]), /需要 \.slide 页面容器/);
});

test('folder import prefers the root index over alphabetically earlier nested pages', async () => {
  const reads = [];
  const file = relativePath => ({
    name: relativePath.split('/').at(-1), webkitRelativePath: relativePath, size: 1,
    async text() { reads.push(relativePath); return relativePath; },
  });
  class DOMParser {
    parseFromString() { throw Error('PARSER_REACHED'); }
  }
  const files = ['deck/aaa/page.html', 'deck/z.html', 'deck/INDEX.HTML'].map(file);
  await assert.rejects(() => importer({DOMParser})(files), /PARSER_REACHED/);
  assert.deepEqual(reads, ['deck/INDEX.HTML']);
});
