import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

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

test('CSS imports inline quoted and unquoted URLs with nested relative imports', async t => {
  for (const reference of ['url(styles/theme.css)', 'url( styles/theme.css )', 'url("styles/theme.css")', "url('styles/theme.css')", '"styles/theme.css"']) {
    await t.test(reference, async () => {
      const style = {textContent: `@import ${reference} screen;`};
      class DOMParser {
        parseFromString() {
          return {
            querySelector: () => ({}),
            querySelectorAll: selector => selector === 'style' ? [style] : [],
            documentElement: {outerHTML: '<html></html>'},
          };
        }
      }
      const files = [
        {name: 'index.html', size: 1, text: async () => '<section class="slide"></section>'},
        {name: 'styles/theme.css', size: 1, text: async () => '@import url(nested.css);'},
        {name: 'styles/nested.css', size: 1, text: async () => 'h1 { color: red; }'},
      ];
      await importer({DOMParser, URL, crypto: webcrypto})(files);
      assert.equal(style.textContent, '@media screen {\nh1 { color: red; }\n}');
    });
  }
});

test('video import embeds both the local source and poster', async () => {
  // A focused DOM fixture isolates attribute rewriting from browser parsing.
  const attributes = new Map([['src', 'clip.mp4'], ['poster', 'cover.png']]);
  const video = {
    tagName: 'VIDEO',
    hasAttribute: name => attributes.has(name),
    getAttribute: name => attributes.get(name),
    setAttribute: (name, value) => attributes.set(name, value),
  };
  class DOMParser {
    parseFromString() {
      return {
        querySelector: () => ({}),
        querySelectorAll: selector => selector.includes('video[src]') ? [video] : [],
        documentElement: {outerHTML: '<html></html>'},
      };
    }
  }
  class FileReader {
    readAsDataURL(blob) {
      blob.arrayBuffer().then(bytes => {
        this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;
        this.onload();
      }, error => this.onerror(error));
    }
  }
  const clip = Object.assign(new Blob(['video bytes'], {type: 'video/mp4'}), {name: 'clip.mp4'});
  const cover = Object.assign(new Blob(['poster bytes'], {type: 'image/png'}), {name: 'cover.png'});
  const html = {name: 'index.html', size: 1, text: async () => '<section class="slide"><video></video></section>'};
  await importer({DOMParser, FileReader, Blob, URL, crypto: webcrypto})([html, clip, cover]);
  assert.equal(attributes.get('src'), 'data:video/mp4;base64,' + Buffer.from('video bytes').toString('base64'));
  assert.equal(attributes.get('poster'), 'data:image/png;base64,' + Buffer.from('poster bytes').toString('base64'));
});
