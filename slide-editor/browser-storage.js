/* Browser-only storage adapter. Imported files never go to an API or cloud store. */
window.slideStudioStorage = (() => {
  const web = document.querySelector('meta[name="slide-studio-mode"]')?.content === 'web';
  const tutorial = '@tutorial';
  let database;
  function openDatabase() {
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open('slide-studio', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('decks', {keyPath:'path'});
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(Error(t('浏览器存储不可用，请导出 HTML 保存修改。')));
    });
    return database;
  }
  async function transaction(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('decks', mode), request = action(tx.objectStore('decks'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || Error('Storage transaction aborted'));
    });
  }
  async function read(name) { return transaction('readonly', store => store.get(name)); }
  async function write(record) { return transaction('readwrite', store => store.put(record)); }
  const handles = name => web || name === tutorial;
  async function list() {
    const local = web ? [] : await fetch('/api/decks').then(r => {if (!r.ok) throw Error('Unable to list files'); return r.json();});
    let stored = [];
    try { stored = await transaction('readonly', store => store.getAllKeys()); } catch {}
    return [tutorial, ...new Set([...local, ...(web ? stored.filter(name => name !== tutorial) : [])])];
  }
  async function load(name) {
    let record;
    try { record = await read(name); } catch {}
    if (record) return record;
    if (name !== tutorial) throw Error(t('找不到浏览器草稿，请重新导入。'));
    const response = await fetch('/slide-editor/tutorial.html');
    if (!response.ok) throw Error('Unable to load tutorial');
    return {path:tutorial, html:await response.text(), version:'tutorial-original'};
  }
  async function save(request) {
    // Compare and put in the same transaction, including edits from another tab.
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('decks', 'readwrite'), store = tx.objectStore('decks');
      let result, conflict = false;
      const get = store.get(request.path);
      get.onsuccess = () => {
        const previous = get.result;
        if (previous && previous.version !== request.version) { conflict = true; tx.abort(); return; }
        const version = crypto.randomUUID();
        store.put({path:request.path, html:request.html, version, previousHTML:previous?.html || savedHTML});
        result = {version, statusKey:'已保存到此浏览器 · 请导出 HTML 备份'};
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(Error(t(conflict ? '原文件已被外部修改。请先导出当前修改，再重新打开。' : '浏览器存储不可用，请导出 HTML 保存修改。')));
      tx.onerror = () => reject(tx.error);
    });
  }
  function label(name) { return name === tutorial ? t('教学示例 · Landing Page') : name.startsWith('@import/') ? name.slice(8) : name; }
  function updateLabels() {
    [...$('decks').options].forEach(option => option.textContent = label(option.value));
    $('openFolder').hidden = !web && !window.slideStudioDesktop;
    if (web) $('openFolder').textContent = t('导入 HTML / 文件夹');
    $('save').textContent = t(handles(path) ? '保存到浏览器' : '保存到原文件');
  }
  async function useTutorial() {
    if ((dirty || sourceDraft) && !confirm(t('当前有未保存的修改，确定打开其他文件吗？'))) return;
    // Keep the user's saved tutorial copy. Reset is an explicit separate action.
    $('decks').value = tutorial; dirty = false; sourceDraft = false; await window.load();
  }
  async function resetTutorial() {
    if (!confirm(t('重置教学示例？此浏览器保存的教学修改将被清除。'))) return;
    await transaction('readwrite', store => store.delete(tutorial));
    $('decks').value = tutorial; dirty = false; sourceDraft = false; await window.load();
  }
  function presentation() {
    if (!path || sourceDraft) return;
    finish();
    const parsed = new DOMParser().parseFromString(clean(), 'text/html');
    parsed.querySelectorAll('script,base,meta[http-equiv="refresh" i]').forEach(el => el.remove());
    const base = parsed.createElement('base'); base.href = deckBaseURL(); parsed.head.prepend(base);
    const nonce = crypto.randomUUID();
    const policy = parsed.createElement('meta'); policy.httpEquiv = 'Content-Security-Policy';
    policy.content = `script-src 'nonce-${nonce}'; object-src 'none'; form-action 'none'`; parsed.head.prepend(policy);
    const style = parsed.createElement('style');
    style.textContent = 'html,body{margin:0;background:#101827;overflow:hidden}.deck{position:absolute!important;width:1280px!important;height:720px!important;left:50%;top:50%;transform:translate(-50%,-50%) scale(var(--fit));transform-origin:center}.slide{display:none!important;position:absolute!important;inset:0!important;width:1280px!important;height:720px!important}.slide.present{display:block!important}.speaker-notes,.hud{display:none!important}';
    parsed.head.append(style);
    const script = parsed.createElement('script'); script.nonce = nonce;
    script.textContent = `const pages=[...document.querySelectorAll('.slide')];let index=${current};function show(){pages.forEach((p,i)=>p.classList.toggle('present',i===index));document.documentElement.style.setProperty('--fit',Math.min(innerWidth/1280,innerHeight/720));}onresize=show;onkeydown=e=>{if(['ArrowRight','PageDown',' '].includes(e.key))index=Math.min(pages.length-1,index+1);if(['ArrowLeft','PageUp'].includes(e.key))index=Math.max(0,index-1);show()};show();`;
    parsed.body.append(script);
    const url = URL.createObjectURL(new Blob(['<!doctype html>\n'+parsed.documentElement.outerHTML], {type:'text/html'}));
    window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function setup() {
    $('tutorial').onclick = () => useTutorial().catch(error => alert(error.message));
    $('resetTutorial').onclick = () => resetTutorial().catch(error => alert(error.message));
    if (web) {
      $('openFolder').hidden = false;
      $('openFolder').onclick = () => $('importDialog').showModal();
      $('chooseHTML').onclick = () => $('htmlFiles').click();
      $('chooseDirectory').onclick = () => $('directoryFiles').click();
      $('closeImport').onclick = () => $('importDialog').close();
      ['htmlFiles','directoryFiles'].forEach(id => $(id).onchange = async () => {
        const files = [...$(id).files]; $(id).value = '';
        if (!files.length) return;
        if ((dirty || sourceDraft) && !confirm(t('当前有未保存的修改，确定打开其他文件吗？'))) return;
        $('importStatus').textContent = t('正在导入');
        try {
          const result = await window.slideStudioImport(files);
          if (await read(result.path)) result.path = result.path.replace(/(\.html?)$/i, ` (${crypto.randomUUID().slice(0,6)})$1`);
          await write(result);
          if (![...$('decks').options].some(option => option.value === result.path)) {
            const option = document.createElement('option'); option.value = result.path; $('decks').append(option);
          }
          $('decks').value = result.path; dirty = false; sourceDraft = false;
          await window.load(); $('importStatus').textContent = ''; $('importDialog').close();
        } catch (error) { $('importStatus').textContent = error.message; }
      });
      $('preview').onclick = presentation;
    } else {
      const preview = $('preview').onclick;
      $('preview').onclick = () => path === tutorial ? presentation() : preview();
    }
    $('language').addEventListener('change', updateLabels);
    updateLabels();
  }
  return {web, tutorial, handles, list, load, save, label, setup, updateLabels};
})();

function deckBaseURL() {
  const name = path === '@tutorial' ? 'slide-editor/tutorial.html' : path.startsWith('@import/') ? '' : path;
  return new URL('/'+name.split('/').map(encodeURIComponent).join('/'), location.origin).href;
}
