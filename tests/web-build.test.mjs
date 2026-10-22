import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, readdir, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));

test('static deploy ships only the editor, vendored libraries and public tutorial', async()=>{
  execFileSync(process.execPath,['scripts/build-web.mjs'],{cwd:root});
  const top=await readdir(path.join(root,'web-dist'));
  assert.deepEqual(top.sort(),['index.html','slide-editor']);
  const assets=await readdir(path.join(root,'web-dist/slide-editor'));
  assert.deepEqual(assets.sort(),['TUTORIAL-LICENSE.txt','browser-storage.js','desktop.js','editor.css','editor.js','enhancements.js','exports.js','i18n.js','import-html.js','index.html','tutorial.html','vendor'].sort());
  const html=await readFile(path.join(root,'web-dist/index.html'),'utf8');
  assert.match(html,/name="slide-studio-mode" content="web"/);
  const local=await readFile(path.join(root,'slide-editor/index.html'),'utf8');
  assert.match(local,/name="slide-studio-mode" content="local"/);
  for (const match of html.matchAll(/(?:src|href)="(\/slide-editor\/[^"#]+)"/g)) {
    assert.ok((await stat(path.join(root,'web-dist',match[1].split('?')[0]))).isFile(),match[1]);
  }
});

test('offline tutorial has five lessons, embedded images and the complete upstream license', async()=>{
  const html=await readFile(path.join(root,'slide-editor/tutorial.html'),'utf8');
  assert.equal([...html.matchAll(/<section class="slide[" ]/g)].length,5);
  const images=[...html.matchAll(/<img[^>]+src="([^"]+)"/g)];
  assert.equal(images.length,6);
  assert.ok(images.every(match=>match[1].startsWith('data:image/jpeg;base64,')));
  assert.ok(!/<link[^>]+https?:|<script[^>]+src=/.test(html));
  const license=await readFile(path.join(root,'examples/landing-page/LICENSE'),'utf8');
  assert.ok(html.includes(license));
});
