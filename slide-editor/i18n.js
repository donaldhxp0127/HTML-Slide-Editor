/* UI text only: slide content and source code are never translated. */
const translations = {
  en: {
    '选择幻灯片':'Choose a deck', '打开':'Open', '就绪':'Ready',
    '导出 HTML':'Export HTML', '保存到原文件':'Save file',
    '↶ 撤销':'↶ Undo', '↷ 重做':'↷ Redo', '＋ 文本框':'＋ Text box',
    '复制当前页':'Duplicate slide', '↗ 放映':'↗ Present', '拖动模式':'Drag mode',
    '属性':'Properties', '〈/〉源码':'〈/〉Source', '幻灯片':'Slides',
    '单击选择 · 双击编辑':'Click to select · Double-click to edit',
    '拖动模式下移动元素':'Move elements in drag mode', '⌘ / Ctrl + S 保存':'⌘ / Ctrl + S to save',
    'HTML 幻灯片编辑器':'HTML slide editor', '幻灯片编辑画布':'Slide editing canvas',
    '双击文字直接输入 · Esc 结束编辑 · 修改后请保存':'Double-click text to edit · Esc to finish · Save your changes',
    '应用源码':'Apply source', 'HTML 源码':'HTML source', '元素属性':'Element properties',
    '尚未选择元素':'No element selected', '点击画布中的文字或图片':'Click text or an image on the canvas',
    '字号 / px':'Font size / px', '文字颜色':'Text color', '背景颜色':'Background color',
    '左':'Left', '中':'Center', '右':'Right', '宽度 / px':'Width / px', '高度 / px':'Height / px',
    '图片地址':'Image path', '选择父容器 ↑':'Select parent ↑', '删除所选元素':'Delete element',
    '保留标签、class、外部 CSS 和图片路径。样式修改写入标准行内 CSS，人工和 AI 都能继续编辑。':'Tags, classes, external CSS and image paths are preserved. Style changes use standard inline CSS, editable by people and AI.',
    '有未保存的修改':'Unsaved changes', '无 class':'No class', '页':'slides',
    '当前有未保存的修改，确定打开其他文件吗？':'Discard unsaved changes and open a file?',
    '已打开 · 本地文件':'Opened · Local file', '已保存 · 已自动备份':'Saved · Backup created',
    '已撤销 · 尚未保存':'Undone · Not saved', '已重做 · 尚未保存':'Redone · Not saved',
    '双击编辑文本':'Double-click to edit text', '源码需要包含 .slide 元素':'Source must contain a .slide element.',
    '源码已应用 · 尚未保存':'Source applied · Not saved', '请先保存，再放映最新内容。':'Save first to present your latest changes.',
    '源码有待应用的修改，应用或还原后即可定位元素。':'Source has pending edits. Apply or revert them to locate the selected element.',
    '源码尚未应用':'Source changes not applied', '还原源码':'Revert source',
    '定位到所选元素':'Located selected element', '语言':'Language',
    '原文件已被外部修改。请先导出当前修改，再重新打开。':'The file was changed externally. Export your edits before reopening it.',
    '来源不允许':'Origin not allowed', '文件过大':'File too large', '无效路径':'Invalid path', '不存在':'Not found'
  },
  ja: {
    '选择幻灯片':'スライドを選択', '打开':'開く', '就绪':'準備完了',
    '导出 HTML':'HTMLを書き出す', '保存到原文件':'ファイルに保存',
    '↶ 撤销':'↶ 元に戻す', '↷ 重做':'↷ やり直す', '＋ 文本框':'＋ テキスト',
    '复制当前页':'スライドを複製', '↗ 放映':'↗ スライドショー', '拖动模式':'ドラッグモード',
    '属性':'プロパティ', '〈/〉源码':'〈/〉ソース', '幻灯片':'スライド',
    '单击选择 · 双击编辑':'クリックで選択 · ダブルクリックで編集',
    '拖动模式下移动元素':'ドラッグモードで要素を移動', '⌘ / Ctrl + S 保存':'⌘ / Ctrl + S で保存',
    'HTML 幻灯片编辑器':'HTMLスライドエディター', '幻灯片编辑画布':'スライド編集キャンバス',
    '双击文字直接输入 · Esc 结束编辑 · 修改后请保存':'文字をダブルクリックして編集 · Escで終了 · 変更後は保存',
    '应用源码':'ソースを適用', 'HTML 源码':'HTMLソース', '元素属性':'要素のプロパティ',
    '尚未选择元素':'要素が選択されていません', '点击画布中的文字或图片':'キャンバスの文字や画像をクリック',
    '字号 / px':'文字サイズ / px', '文字颜色':'文字の色', '背景颜色':'背景の色',
    '左':'左', '中':'中央', '右':'右', '宽度 / px':'幅 / px', '高度 / px':'高さ / px',
    '图片地址':'画像のパス', '选择父容器 ↑':'親要素を選択 ↑', '删除所选元素':'選択した要素を削除',
    '保留标签、class、外部 CSS 和图片路径。样式修改写入标准行内 CSS，人工和 AI 都能继续编辑。':'タグ、class、外部CSS、画像パスを保持します。スタイルの変更は標準のインラインCSSで保存するため、人もAIも引き続き編集できます。',
    '有未保存的修改':'未保存の変更があります', '无 class':'classなし', '页':'枚',
    '当前有未保存的修改，确定打开其他文件吗？':'未保存の変更を破棄してファイルを開きますか？',
    '已打开 · 本地文件':'開きました · ローカルファイル', '已保存 · 已自动备份':'保存しました · バックアップ作成済み',
    '已撤销 · 尚未保存':'元に戻しました · 未保存', '已重做 · 尚未保存':'やり直しました · 未保存',
    '双击编辑文本':'ダブルクリックして編集', '源码需要包含 .slide 元素':'ソースには .slide 要素が必要です。',
    '源码已应用 · 尚未保存':'ソースを適用しました · 未保存', '请先保存，再放映最新内容。':'最新の内容を表示するには、先に保存してください。',
    '源码有待应用的修改，应用或还原后即可定位元素。':'ソースに未適用の変更があります。適用または元に戻すと、選択した要素に移動できます。',
    '源码尚未应用':'ソースの変更は未適用です', '还原源码':'ソースを元に戻す',
    '定位到所选元素':'選択した要素の位置', '语言':'言語',
    '原文件已被外部修改。请先导出当前修改，再重新打开。':'元のファイルが外部で変更されました。変更内容を書き出してから開き直してください。',
    '来源不允许':'許可されていないアクセス元です', '文件过大':'ファイルが大きすぎます', '无效路径':'無効なパスです', '不存在':'見つかりません'
  }
};
let language = 'zh-CN';
try { language = localStorage.getItem('slide-studio-language') || language; } catch {}
if (!['zh-CN','en','ja'].includes(language)) language = 'zh-CN';
function t(text) { return translations[language]?.[text] || text; }
const uiTextNodes = [], uiAttributes = [];
function initializeLanguage() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while(walker.nextNode()) {
    const node=walker.currentNode, key=node.textContent.trim();
    if (translations.en[key] && !node.parentElement.closest('script,textarea,#slides,#decks'))
      uiTextNodes.push({node,key,prefix:node.textContent.match(/^\s*/)[0],suffix:node.textContent.match(/\s*$/)[0]});
  }
  document.querySelectorAll('[aria-label],[title]').forEach(el=>{
    ['aria-label','title'].forEach(attr=>{const key=el.getAttribute(attr);if(translations.en[key])uiAttributes.push({el,attr,key});});
  });
  $('language').value=language;
  $('language').onchange=()=>{
    language=$('language').value;
    try { localStorage.setItem('slide-studio-language',language); } catch {}
    applyLanguage();
  };
  applyLanguage();
}
function applyLanguage() {
  document.documentElement.lang=language;
  uiTextNodes.forEach(({node,key,prefix,suffix})=>node.textContent=prefix+t(key)+suffix);
  uiAttributes.forEach(({el,attr,key})=>el.setAttribute(attr,t(key)));
  if (typeof refreshDynamicLanguage==='function')refreshDynamicLanguage();
}
