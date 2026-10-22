/* Turn a user-selected folder into portable HTML; no files are uploaded. */
window.slideStudioImport = async function(files) {
  const limit = 50 * 1024 * 1024;
  if (files.reduce((sum,file) => sum + file.size, 0) > limit) throw Error(t('导入文件总大小不能超过 50 MB'));
  const directory = files.some(file => file.webkitRelativePath);
  const root = directory ? files[0].webkitRelativePath.split('/')[0]+'/' : '';
  const map = new Map(files.map(file => [(file.webkitRelativePath || file.name).replace(root,''), file]));
  const pages = [...map.keys()].filter(name => /\.html?$/i.test(name)).sort((a,b) => a.localeCompare(b));
  const name = pages.find(name => /^index\.html?$/i.test(name)) || pages[0];
  if (!name) throw Error(t('请选择包含 HTML 的文件或文件夹'));
  const parsed = new DOMParser().parseFromString(await map.get(name).text(), 'text/html');
  if (!parsed.querySelector('.slide')) throw Error(t('该网页尚未适配：需要 .slide 页面容器。请先使用教学示例。'));
  parsed.querySelectorAll('base').forEach(el => el.remove());
  const origin = 'https://local-files.invalid/';
  function resolve(reference, from) {
    if (!reference || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(reference)) return null;
    const url = new URL(reference, origin+from);
    const key = decodeURIComponent(url.pathname.slice(1));
    const file = map.get(key);
    if (!file) throw Error(t('缺少资源，请导入完整文件夹：')+' '+key);
    return {file, key, hash:url.hash};
  }
  const mime = {svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',mp4:'video/mp4'};
  const cache = new Map();
  async function asset(reference, from) {
    const found = resolve(reference, from);
    if (!found) return reference;
    if (!cache.has(found.key)) cache.set(found.key, new Promise((resolve,reject) => {
      const type = found.file.type || mime[found.key.split('.').pop().toLowerCase()] || 'application/octet-stream';
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject;
      reader.readAsDataURL(new Blob([found.file],{type}));
    }));
    return await cache.get(found.key) + found.hash;
  }
  async function replaceAsync(text, pattern, transform) {
    const matches = [...text.matchAll(pattern)];
    const values = await Promise.all(matches.map(transform));
    let output = '', cursor = 0;
    matches.forEach((match,i) => {output += text.slice(cursor,match.index)+values[i]; cursor = match.index+match[0].length;});
    return output+text.slice(cursor);
  }
  async function css(text, from, chain=[]) {
    text = await replaceAsync(text, /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*([^;]*);/gi, async match => {
      const found = resolve(match[1],from);
      if (!found) return match[0];
      if (chain.includes(found.key)) throw Error('Circular CSS import: '+found.key);
      const content = await css(await found.file.text(), found.key, [...chain,found.key]);
      return match[2].trim() ? `@media ${match[2]} {\n${content}\n}` : content;
    });
    return replaceAsync(text, /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi,
      async match => `url("${await asset(match[1]??match[2]??match[3],from)}")`);
  }
  for (const link of parsed.querySelectorAll('link[rel="stylesheet"]')) {
    const found = resolve(link.getAttribute('href'),name);
    if (!found) continue;
    const style = parsed.createElement('style');
    style.textContent = `/* Imported from ${found.key.replace(/\*\//g,'')} */\n`+await css(await found.file.text(),found.key,[found.key]);
    if (link.media) style.media = link.media;
    link.replaceWith(style);
  }
  for (const style of parsed.querySelectorAll('style')) style.textContent = await css(style.textContent,name);
  for (const el of parsed.querySelectorAll('[style]')) el.setAttribute('style',await css(el.getAttribute('style'),name));
  for (const el of parsed.querySelectorAll('img[src],source[src],video[src],audio[src],video[poster],link[rel="icon"]')) {
    const attr = el.hasAttribute('poster') ? 'poster' : el.tagName === 'LINK' ? 'href' : 'src';
    el.setAttribute(attr,await asset(el.getAttribute(attr),name));
  }
  for (const el of parsed.querySelectorAll('[srcset]')) {
    const original = el.getAttribute('srcset');
    if (original.includes('data:')) continue;
    const candidates = await Promise.all(original.split(',').map(async part => {
      const [reference,...descriptor] = part.trim().split(/\s+/);
      return [await asset(reference,name),...descriptor].join(' ');
    }));
    el.setAttribute('srcset',candidates.join(', '));
  }
  const html = '<!doctype html>\n'+parsed.documentElement.outerHTML;
  if (html.length > 30*1024*1024) throw Error(t('导入后的 HTML 过大，请减少图片大小。'));
  return {path:'@import/'+name, html, version:crypto.randomUUID()};
};
