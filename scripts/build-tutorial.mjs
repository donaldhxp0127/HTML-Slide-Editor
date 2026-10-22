import {readFile, writeFile} from 'node:fs/promises';
const source = new URL('../examples/landing-page/',import.meta.url);
let html = await readFile(new URL('index.html',source),'utf8');
const license = await readFile(new URL('LICENSE',source),'utf8');
for (const match of [...html.matchAll(/src="(assets\/[^" ]+\.jpg)"/g)]) {
  const image = await readFile(new URL(match[1],source));
  html = html.replace(match[0],`src="data:image/jpeg;base64,${image.toString('base64')}"`);
}
html = html.replace('<head>','<head>\n<!--\n'+license+'\n-->');
await writeFile(new URL('../slide-editor/tutorial.html',import.meta.url),html);
console.log('Built offline tutorial with embedded images and MIT attribution.');
