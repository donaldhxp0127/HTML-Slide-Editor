import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../',import.meta.url));
const out = path.join(root,'web-dist');
await rm(out,{recursive:true,force:true});
await mkdir(path.join(out,'slide-editor'),{recursive:true});
// An explicit allowlist keeps personal decks, backups and native binaries private.
for (const name of ['editor.css','editor.js','i18n.js','enhancements.js','desktop.js','exports.js','browser-storage.js','import-html.js','tutorial-language.js','tutorial.html']) {
  await cp(path.join(root,'slide-editor',name),path.join(out,'slide-editor',name));
}
await cp(path.join(root,'slide-editor/vendor'),path.join(out,'slide-editor/vendor'),{recursive:true});
const html = (await readFile(path.join(root,'slide-editor/index.html'),'utf8')).replace('name="slide-studio-mode" content="local"','name="slide-studio-mode" content="web"');
await writeFile(path.join(out,'index.html'),html);
await writeFile(path.join(out,'slide-editor/index.html'),html);
await cp(path.join(root,'examples/landing-page/LICENSE'),path.join(out,'slide-editor/TUTORIAL-LICENSE.txt'));
console.log('Static editor built in web-dist (no backend or personal files).');
