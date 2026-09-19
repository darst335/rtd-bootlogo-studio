/* RTD 开机 Logo 工作室 —— 界面逻辑（依赖 RTDLogo 引擎）
 * ---------------------------------------------------------------------------
 * 归属声明（AUTHORSHIP NOTICE · 请勿移除）：
 *   本界面由 darst335 提出全部产品需求（画笔上色 / 图片缩放定位 / 文字
 *   拖拽编辑 / 撤销重做 / 瓦片索引表识别等）并以真实固件逐项验收，
 *   与 AI 结对完成。项目代号 D335-RTDLOGO · 作者：darst335
 * --------------------------------------------------------------------------- */
'use strict';
/* 页面归属标记（隐藏，不在界面显示；可在控制台 window.__RTD_WS__ 查看） */
window.__RTD_WS__ = Object.freeze({
  author: 'darst335', coDev: 'AI pair', project: 'D335-RTDLOGO',
  since: '2026-09-17',
  note: '本作品由 darst335 委托并全程参与制作，非抄袭/非二次打包他人作品'
});
const $ = id => document.getElementById(id);
const HX = n => '0x' + n.toString(16).toUpperCase();
const hexCol = c => '#' + c.map(b => b.toString(16).padStart(2, '0')).join('');
const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/* i18n：中文原文查表翻译（i18n.js 先于本文件加载） */
const __t = s => (window.__I18N ? window.__I18N.t(s) : s);
const __tf = (s, v) => (window.__I18N ? window.__I18N.tf(s, v) : s);
const __fr = s => (window.__I18N ? window.__I18N.frag(s) : s);

const S = {
  fw: null, fwName: '', fwPath: '',
  det: null, g: null,
  ink: null, tw: 0, th: 0,
  rows: 0, cols: 0,                                       // 画布网格（记录流型可调整，其余跟随固件）
  polarity: 1,
  built: null, blk: null, plan: null,
  server: location.protocol.startsWith('http'),
  tool: 'pen', penW: 2, imgEl: null,
  imgZoom: 1, imgX: 0, imgY: 0,                           // 图片导入的缩放与位移
  cellColors: null, keepColor: false, bgIdx: 0,           // 逐格颜色（保留颜色模式）
  baseInk: null, baseCC: null,                            // 叠加文字的底层快照（可重复渲染）
  tab: 'text',
  fgc: [240, 240, 240], bgc: [10, 10, 10],
  colorOn: true, writeColor: null,
  patched: null
};

/* ------------------------------------------------ 基础 UI */
let toastTimer = null;
function toast(msg, ms) {
  const t = $('toast'); t.textContent = __t(msg); t.style.display = 'block';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.style.display = 'none', ms || 2600);
}
function setChip(el, text, cls) { el.textContent = __t(text); el.className = 'chip' + (cls ? ' ' + cls : ''); el.style.display = 'inline-flex'; }
infoRows.last = null;
function infoRows(rows) {
  infoRows.last = rows;                                   // 存原始中文行，渲染时才翻译（语言切换可整表重译）
  $('tblInfo').innerHTML = rows.map(r => `<tr><td class="k">${__fr(r[0])}</td><td class="v">${__fr(r[1])}</td></tr>`).join('');
}
function openModal(html) { $('mbox').innerHTML = html; $('modal').style.display = 'flex'; }
function closeModal() { $('modal').style.display = 'none'; }
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });

/* ------------------------------------------------ 字体列表 */
(function initFonts() {
  const fams = ['Impact', 'Arial Black', 'Arial', 'Segoe UI', 'Verdana', 'Tahoma', 'Georgia',
    'Times New Roman', 'Courier New', 'Consolas', 'Comic Sans MS',
    'Microsoft YaHei', 'SimHei', 'KaiTi', 'SimSun', 'Microsoft JhengHei', 'DengXian'];
  $('selFont').innerHTML = fams.map(f => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join('');
  $('selFont').value = 'Impact';
})();

/* ------------------------------------------------ 固件打开 */
$('btnOpen').onclick = () => $('fileFw').click();
$('fileFw').addEventListener('change', e => { const f = e.target.files[0]; if (f) readFwFile(f); e.target.value = ''; });

/* ------------------------------------------------ 归属印章（© darst335）
 * 连点 3 次弹出归属声明；同时作为隐藏校验入口（d335 mark） */
let _signTaps = 0, _signTimer = null;
$('chipSign').onclick = () => {
  _signTaps++;
  clearTimeout(_signTimer);
  _signTimer = setTimeout(() => { _signTaps = 0; }, 900);
  if (_signTaps >= 3) {
    _signTaps = 0;
    const s = (typeof RTDLogo !== 'undefined' && RTDLogo.SIGNATURE) ? RTDLogo.SIGNATURE : {};
    toast('「RTD 开机 Logo 工作室」由 darst335 与 AI 结对开发（项目 D335-RTDLOGO）\n'
      + '需求·固件实证·验收：darst335 ｜ 2026-09 ｜ 原创作品，转载请保留署名\n'
      + 'EN: Original work by darst335 (pair-programmed with AI). Keep this notice.\n'
      + '实测基准：RTD2270CLW（板 RTD270CLW-R10.1）\n'
      + '注意：RTD2270 与 RTD2270CLW 是两种芯片，固件不通用（RTD2270C = RTD2270CLW）；其他型号未测试'
      + (s.claim ? '\n校验：' + s.claim : ''), 6000);
  }
};
function readFwFile(file) {
  const r = new FileReader();
  r.onload = () => onFirmware(new Uint8Array(r.result), file.name, '');
  r.readAsArrayBuffer(file);
}

function onFirmware(bytes, name, path) {
  S.fw = bytes; S.fwName = name; S.fwPath = path || ''; S.patched = null;
  const det = RTDLogo.detect(bytes);
  S.det = det; S.g = det.groups[0] || null;
  setChip($('chipFw'), name.slice(0, 26) + (name.length > 26 ? '…' : '') + '  (' + bytes.length + ' B)', 'ok');
  setChip($('chipMode'), S.server ? '本地服务模式：可直接替换原文件' : '浏览器模式：替换后下载新文件', S.server ? 'ok' : '');
  if (!S.g) { noLogoFound(det); return; }
  const g = S.g;
  const isStr = g.type === 'stringref';
  const isRec = g.type === 'recordstream';
  S.polarity = g.polarity === 0 ? 0 : (g.polarity || 1);
  document.querySelector(`input[name=pol][value="${S.polarity}"]`).checked = true;
  S.tw = g.cols * 12; S.th = g.rows * 18;
  S.rows = g.rows; S.cols = g.cols;                       // 画布网格（记录流型可通过「画布」调整）
  S.imgZoom = 1; S.imgX = 0; S.imgY = 0; $('rgImgZoom').value = 100; $('vImgZoom').textContent = '100%';
  S.cellColors = null; S.keepColor = false; $('ckKeepColor').checked = false;
  // 记录流型：定位 OSD 16 色调色板（颜色平面给的是 LUT 索引），用于彩色预览与写入色选择
  const hasPal = !!(isRec && g.palette && g.palette.length);
  S.colorOn = hasPal;
  // 背景格调色板索引：原 logo 空白格颜色平面的主值（保留颜色模式下作底色）
  if (isRec && g.colr) {
    const bgCnt = new Map();
    for (let i = 0; i < g.disp.length; i++) {
      if (g.disp[i] > 0 && g.disp[i] < g.glyphCount) continue;
      const c = g.colr[i]; if (c >= 0 && c < 16) bgCnt.set(c, (bgCnt.get(c) || 0) + 1);
    }
    let bn = 0; S.bgIdx = 0;
    for (const [c, n] of bgCnt) if (n > bn) { bn = n; S.bgIdx = c; }
  }
  // 画布调整（仅记录流型：MAP/串引用的表格结构尺寸固定）
  const maxCells = 0x400 - g.base;
  $('rowCanvas').style.display = isRec ? '' : 'none';
  $('cvHint').style.display = isRec ? '' : 'none';
  if (isRec) {
    $('inCvW').value = S.tw; $('inCvH').value = S.th;
    $('inCvW').max = Math.min(85 * 12, Math.floor(maxCells / 2) * 12);
    $('inCvH').max = Math.min(24 * 18, Math.floor(maxCells / 8) * 18);
    S.cvHint = { tpl: '可调（12 的倍数 × 18 的倍数）。上限：OSD 属性区 {c} 格、行 ≤ 24。放大超过原尺寸时，实际屏幕 OSD 窗口由固件设定，可能被裁剪；缩小始终安全。', vars: { c: maxCells } };
    $('cvHint').textContent = __tf(S.cvHint.tpl, S.cvHint.vars);
  }
  $('lbColor').style.display = hasPal ? '' : 'none';
  $('ckColor').checked = hasPal;
  let palRow = null;
  if (hasPal) {
    const used = [...new Set(g.colr.filter(v => v >= 0 && v < g.palette.length))].sort((a, b) => a - b);
    palRow = ['调色板', HX(g.paletteOff) + ' · 16 色 LUT · logo 用色：' + used.map(i =>
      `<span class="sw" style="background:${hexCol(g.palette[i])}"></span>idx${i} ${hexCol(g.palette[i])}`).join('　')];
  }
  const rows = [
    ['识别机制', isRec ? 'OSD 记录流型（MAZON / RTD270 族）' : isStr ? '品牌字库·串引用型（HY / ENVISION 族）' : g.method === 'mapgrid' ? '瓦片索引表拼图（HY 板厂大字库 · 实机标定路径）' : '静态 MAP 型（CDrawLogo）· ' + (g.method === 'code' ? '代码常量精确解析' : '结构扫描')],
    isRec
      ? ['数据流', HX(g.streamOff) + ' → ' + HX(g.streamEnd) + ' · ' + (g.streamEnd - g.streamOff) + ' B · ' + g.dispCells + ' 格']
      : isStr
        ? ['字符串表', HX(g.strOff) + ' · ' + g.cols + ' 项索引（显示时保持不变）']
        : ['MAP 表', HX(g.mapOff) + (g.method === 'code' ? '  (CPU ' + HX(g.mapBase) + ')' : '') + ' · ' + g.rows + '×' + g.cols + ' = ' + g.mapLen + ' B'],
    ['字库块', HX(g.fontOff) + ' · ' + g.glyphCount + ' 字模 · 压缩 ' + g.compBytes + ' B'],
    palRow,
    ['画布尺寸', S.tw + ' × ' + S.th + ' px (1bpp)'],
    ['可写预算', isRec
      ? '数据流 ' + (g.streamEnd - g.streamOff) + ' B + 字库 ' + (g.blockEnd - g.fontOff) + ' B（均原地）'
      : (g.blockEnd - g.fontOff) + ' B（原地，超出自动重定位）'],
    ['墨迹极性', 'bit=' + S.polarity + (g.polarity ? '' : '（按空白块推断）')],
    ['改动范围', isRec
      ? '数据流重写 + 字库块（新字模映射到原 logo 槽位），其余原样'
      : isStr
        ? '仅字库块（字符串表原样保留），约 ' + (g.compBytes + 16) + ' B / ' + bytes.length + ' B'
        : 'MAP 表+字库（原位）,共约 ' + (g.mapLen + g.compBytes + 16) + ' B / ' + bytes.length + ' B'],
  ].filter(Boolean);
  infoRows(rows);
  // 写入颜色（记录流型）：颜色平面的 LUT 索引，默认沿用原 logo 主色
  if (hasPal) {
    const main = (g.inkColor >= 0 && g.inkColor < g.palette.length) ? g.inkColor : 15;
    S.writeColor = main;
    const inkTxt = c => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) > 140 ? '#000' : '#fff';
    const order = [main].concat(Array.from({ length: g.palette.length }, (_, i) => i).filter(i => i !== main));
    $('selInkColor').innerHTML = order.map(i => {
      const c = g.palette[i];
      return `<option value="${i}"${i === main ? ' selected' : ''} style="background:${hexCol(c)};color:${inkTxt(c)}">idx${i} · ${hexCol(c)}${i === main ? __t('（原 logo 主色）') : ''}</option>`;
    }).join('');
    $('rowInkColor').style.display = '';
    updateInkChip();
  } else {
    S.writeColor = null;
    $('rowInkColor').style.display = 'none';
  }
  $('rowKeepColor').style.display = hasPal ? '' : 'none';
  if (!hasPal) { S.keepColor = false; $('ckKeepColor').checked = false; }
  buildInkFromOriginal();
  drawOrig();
  refreshStats();
  $('btnApply').disabled = false;
  toast(__tf('已识别 logo：{r}×{c} 网格，{n} 字模', { r: g.rows, c: g.cols, n: g.glyphCount }));
}

function noLogoFound(det) {
  infoRows([
    ['状态', '<span style="color:var(--warn)">未识别到可编辑的开机 logo</span>'],
    ['扫描 VLC 块', (det.blocks || []).length + ' 个'],
    ['说明', '本工具支持「静态 MAP 型」（乐华等）、「品牌字库串引用型」（HY / ENVISION 等）与「OSD 记录流型」（MAZON / RTD270 等）logo。'],
    ['', '仍未识别的话，可能是位图型或其他私有机制，暂不支持自动编辑。'],
  ]);
  S.ink = null; S.tw = S.th = 0;
  S.writeColor = null;
  $('lbColor').style.display = 'none';
  $('rowInkColor').style.display = 'none';
  $('cvOrig').width = $('cvOrig').height = 10; $('cvNew').width = $('cvNew').height = 10;
  $('btnApply').disabled = true; refreshStats();
  toast('未识别到可编辑 logo，详见固件识别面板', 4000);
}

/* ------------------------------------------------ 原 logo 渲染 */
function drawOrig() {
  const g = S.g; if (!g) return;
  const z = +$('rgZoom').value;
  const colorMode = !!(S.colorOn && g.palette && g.colr);
  const img = g.type === 'recordstream'
    ? RTDLogo.renderCells(g.disp, g.rows, g.cols, g.stored, {
        polarity: S.polarity, fg: S.fgc, bg: S.bgc, scale: z,
        palette: colorMode ? g.palette : null, colr: colorMode ? g.colr : null })
    : RTDLogo.render(S.fw.subarray(g.mapOff, g.mapOff + g.mapLen), g.rows, g.cols, g.stored,
      { polarity: S.polarity, fg: S.fgc, bg: S.bgc, scale: z });
  const cv = $('cvOrig'); cv.width = img.w; cv.height = img.h;
  cv.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
  $('origMeta').textContent = g.rows + '×' + g.cols + __t('网格 · ') + img.w + '×' + img.h + 'px · ' + z + 'x'
    + (colorMode ? __t(' · 彩色（按固件调色板）') : '');
}

/* ------------------------------------------------ 新 logo 位图 */
function buildInkFromOriginal() {
  const g = S.g;
  const inkVal = S.polarity === 0 ? 0 : 1;
  const ow = g.cols * 12, oh = g.rows * 18;               // 原始尺寸
  const ink0 = new Uint8Array(oh * ow);
  if (g.type === 'recordstream') {
    for (let r = 0; r < g.rows; r++) for (let y = 0; y < 18; y++) for (let c = 0; c < g.cols; c++) for (let x = 0; x < 12; x++) {
      const gi = g.disp[r * g.cols + c];
      if (gi <= 0 || gi >= g.glyphCount) continue;
      const b = RTDLogo.bitsOf(g.stored, gi);
      ink0[(r * 18 + y) * ow + c * 12 + x] = b[y * 12 + x] === inkVal ? 1 : 0;
    }
  } else {
    const map = S.fw.subarray(g.mapOff, g.mapOff + g.mapLen);
    for (let r = 0; r < g.rows; r++) for (let y = 0; y < 18; y++) for (let c = 0; c < g.cols; c++) for (let x = 0; x < 12; x++) {
      const b = RTDLogo.bitsOf(g.stored, map[r * g.cols + c]);
      ink0[(r * 18 + y) * ow + c * 12 + x] = b[y * 12 + x] === inkVal ? 1 : 0;
    }
  }
  // 画布被调整过 → 最近邻缩放到当前画布
  let ink = ink0;
  if (S.tw !== ow || S.th !== oh) {
    ink = new Uint8Array(S.th * S.tw);
    for (let y = 0; y < S.th; y++) {
      const sy = Math.min(oh - 1, Math.floor(y * oh / S.th));
      for (let x = 0; x < S.tw; x++) ink[y * S.tw + x] = ink0[sy * ow + Math.min(ow - 1, Math.floor(x * ow / S.tw))];
    }
  }
  S.cellColors = null;
  S.baseInk = null; S.baseCC = null;                      // 底层已重建，文字叠加快照失效
  setInk(ink);
}
function setInk(ink) {
  S.ink = ink;
  if (!S.inkCv) { S.inkCv = document.createElement('canvas'); S.ictx = S.inkCv.getContext('2d'); }
  S.inkCv.width = S.tw; S.inkCv.height = S.th;
  S.iimg = S.ictx.createImageData(S.tw, S.th);
  paintInkAll(); drawNew(); refreshStats();
}
function paintInkAll() {
  const g = S.g;
  const pal = (S.colorOn && g && g.palette && g.type === 'recordstream') ? g.palette : null;
  const cc = (pal && S.keepColor && S.cellColors) ? S.cellColors : null;
  const d = S.iimg.data;
  for (let i = 0; i < S.tw * S.th; i++) {
    let c;
    if (!S.ink[i]) c = S.bgc;
    else if (cc) {
      const y = Math.floor(i / S.tw), x = i % S.tw;
      c = pal[cc[Math.floor(y / 18) * S.cols + Math.floor(x / 12)]] || S.fgc;
    } else c = S.fgc;
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
  }
  S.ictx.putImageData(S.iimg, 0, 0);
}
function drawNew() {
  const z = +$('rgZoom').value, cv = $('cvNew');
  cv.width = S.tw * z; cv.height = S.th * z;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(S.inkCv, 0, 0, cv.width, cv.height);
  $('newMeta').textContent = S.tw + '×' + S.th + 'px · ' + z + 'x';
  // 文字层编辑框：虚线包围盒 + 右下角缩放句柄（叠加会话中、文字 tab 显示；按 Enter 固定后隐藏）
  if (S.tab === 'text' && S.baseInk && S.txtBBox && S.txtEdit) {
    const b = S.txtBBox, hs = 5;
    ctx.strokeStyle = '#37b6ff'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
    ctx.strokeRect(b.x0 * z - 1.5, b.y0 * z - 1.5, (b.x1 - b.x0 + 1) * z + 3, (b.y1 - b.y0 + 1) * z + 3);
    ctx.setLineDash([]);
    ctx.fillStyle = '#37b6ff';
    ctx.fillRect(b.x1 * z - hs, b.y1 * z - hs, hs * 2 + 2, hs * 2 + 2);
    ctx.fillStyle = '#04202f';
    ctx.fillRect(b.x1 * z - hs + 3, b.y1 * z - hs + 3, hs * 2 - 4, hs * 2 - 4);
  }
}

/* ------------------------------------------------ 撤销 / 重做（Ctrl+Z / Ctrl+Y） */
const HIST_MAX = 60;
let undoStack = [], redoStack = [];
function snapNow() {
  return {
    ink: S.ink ? S.ink.slice() : null,
    cc: S.cellColors ? S.cellColors.slice() : null,
    baseInk: S.baseInk, baseCC: S.baseCC, keepColor: S.keepColor,
    bbox: S.txtBBox,
    txtX: +$('rgTxtX').value, txtY: +$('rgTxtY').value, size: +$('rgSize').value
  };
}
function sameSnap(a, b) {
  if (!a || !b || !a.ink || !b.ink || a.ink.length !== b.ink.length) return false;
  for (let i = 0; i < a.ink.length; i++) if (a.ink[i] !== b.ink[i]) return false;
  if ((a.cc && !b.cc) || (!a.cc && b.cc)) return false;
  if (a.cc) for (let i = 0; i < a.cc.length; i++) if (a.cc[i] !== b.cc[i]) return false;
  return true;
}
function pushHistory() {
  if (!S.g || !S.ink) return;
  const s = snapNow();
  if (undoStack.length && sameSnap(undoStack[undoStack.length - 1], s)) return;
  undoStack.push(s);
  if (undoStack.length > HIST_MAX) undoStack.shift();
  redoStack = [];
  updHistBtns();
}
function applySnap(s) {
  if (!s || !s.ink) return;
  S.ink = s.ink.slice();
  S.cellColors = s.cc ? s.cc.slice() : null;
  S.keepColor = s.keepColor; $('ckKeepColor').checked = s.keepColor;
  S.baseInk = s.baseInk; S.baseCC = s.baseCC;
  S.txtBBox = s.bbox;
  $('rgTxtX').value = s.txtX; $('vTxtX').textContent = s.txtX;
  $('rgTxtY').value = s.txtY; $('vTxtY').textContent = s.txtY;
  $('rgSize').value = s.size; $('vSize').textContent = s.size + '%';
  S.inkCv.width = S.tw; S.inkCv.height = S.th;
  S.iimg = S.ictx.createImageData(S.tw, S.th);
  paintInkAll(); drawNew(); refreshStats();
}
function doUndo() {
  if (!undoStack.length || !S.g || !S.ink) return;
  const s = undoStack.pop(); redoStack.push(snapNow());
  applySnap(s); updHistBtns(); toast('已撤销');
}
function doRedo() {
  if (!redoStack.length || !S.g || !S.ink) return;
  const s = redoStack.pop(); undoStack.push(snapNow());
  applySnap(s); updHistBtns(); toast('已重做');
}
function updHistBtns() {
  const b1 = $('btnUndo'), b2 = $('btnRedo');
  if (b1) b1.disabled = !undoStack.length;
  if (b2) b2.disabled = !redoStack.length;
  const c1 = $('btnUndo2'), c2 = $('btnRedo2');
  if (c1) c1.disabled = !undoStack.length;
  if (c2) c2.disabled = !redoStack.length;
  const cb = $('btnCommitTxt');
  if (cb) cb.style.display = (S.tab === 'text' && S.baseInk && S.txtEdit) ? '' : 'none';
}
// 固定文字：退出 PS 式编辑态（Enter / Esc / 按钮），之后画笔无需 Alt 即可作画
function commitTxt() {
  if (!S.txtEdit || !S.baseInk) return false;
  S.txtEdit = false;
  updHistBtns(); drawNew();
  toast('文字已固定：退出拖动 / 缩放编辑，可直接用画笔；双击文字可重新编辑', 3200);
  return true;
}
document.addEventListener('keydown', e => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
  if (e.key === 'Enter' || e.key === 'Escape') {
    if (commitTxt()) e.preventDefault();
    return;
  }
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); doRedo(); }
});

/* ------------------------------------------------ 文字 / 图片 → 位图 */
function thresholdGray(id, th, invert, dither) {
  const w = id.width, h = id.height, d = id.data, n = w * h;
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  if (invert) for (let i = 0; i < n; i++) gray[i] = 255 - gray[i];
  if (dither) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, old = gray[i], nw = old < 128 ? 0 : 255, err = old - nw;
      gray[i] = nw;
      if (x + 1 < w) gray[i + 1] += err * 7 / 16;
      if (y + 1 < h) {
        if (x > 0) gray[i + w - 1] += err * 3 / 16;
        gray[i + w] += err * 5 / 16;
        if (x + 1 < w) gray[i + w + 1] += err * 1 / 16;
      }
    }
  }
  const ink = new Uint8Array(n);
  for (let i = 0; i < n; i++) ink[i] = gray[i] >= th ? 1 : 0;
  return ink;
}
function grayToInk(id, th, invert, dither) {
  setInk(thresholdGray(id, th, invert, dither));
}
function genText(showToast = true) {
  if (!S.g) return toast('请先打开固件');
  const lines = $('txtLogo').value.split('\n').filter(s => s.trim() !== '');
  if (!lines.length) return toast('请先输入文字');
  const SS = 3, W = S.tw * SS, H = S.th * SS;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const style = ($('ckItalic').checked ? 'italic ' : '') + ($('ckBold').checked ? 'bold ' : '');
  const fam = $('selFont').value;
  let fs = H * (+$('rgSize').value / 100) / Math.max(1.15, lines.length * 1.05);
  const setF = () => ctx.font = style + fs + 'px "' + fam + '"';
  setF();
  let maxw = 0; for (const l of lines) maxw = Math.max(maxw, ctx.measureText(l).width);
  const limitW = W * 0.97;
  if (maxw > limitW) { fs *= limitW / maxw; setF(); }
  // 位置偏移（画布宽高百分比）
  const ox = +$('rgTxtX').value / 100 * W, oy = +$('rgTxtY').value / 100 * H;
  const lh = fs * 1.12, y0 = H / 2 - (lines.length - 1) * lh / 2;
  lines.forEach((l, i) => ctx.fillText(l, W / 2 + ox, y0 + i * lh + oy));
  const cv2 = document.createElement('canvas'); cv2.width = S.tw; cv2.height = S.th;
  const c2 = cv2.getContext('2d');
  c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = 'high';
  c2.drawImage(cv, 0, 0, S.tw, S.th);
  const tInk = thresholdGray(c2.getImageData(0, 0, S.tw, S.th), +$('rgTh1').value, false, false);
  // 文字包围盒（画布像素）——供画布上直接拖动 / 拉伸句柄使用
  let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
  for (let y = 0; y < S.th; y++) for (let x = 0; x < S.tw; x++) if (tInk[y * S.tw + x]) {
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
    if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  S.txtBBox = bx1 < 0 ? null : { x0: bx0, y0: by0, x1: bx1, y1: by1 };
  const g = S.g;
  if ($('ckTextOverlay').checked && S.ink) {
    // 叠加模式：底层快照 + 文字层，滑块可实时重渲染；已有图案保持原色，新文字用「写入颜色」
    if (!S.baseInk) S.baseInk = S.ink.slice();
    if (!S.baseCC) S.baseCC = S.cellColors ? S.cellColors.slice()
      : (canColor() && S.writeColor != null
        ? new Uint8Array(S.rows * S.cols).fill(nearestIdx(g.palette, S.fgc[0], S.fgc[1], S.fgc[2]))
        : null);
    const ink = S.baseInk.slice();
    const cc = S.baseCC ? S.baseCC.slice() : null;
    let added = 0;
    for (let i = 0; i < tInk.length; i++) if (tInk[i] && !ink[i]) {
      ink[i] = 1; added++;
      if (cc) cc[Math.floor(i / S.tw / 18) * S.cols + Math.floor(i % S.tw / 12)] = S.writeColor;
    }
    if (cc) { S.cellColors = cc; S.keepColor = true; $('ckKeepColor').checked = true; }
    else S.cellColors = null;
    setInk(ink);
    S.txtEdit = true; updHistBtns();
    if (showToast) toast(__tf('文字已叠加（新增 {n} px），可直接拖动 / 缩放；按 Enter 固定文字', { n: added }));
  } else {
    S.baseInk = null; S.baseCC = null;
    if (canColor() && S.writeColor != null) S.cellColors = new Uint8Array(S.rows * S.cols).fill(S.writeColor);
    setInk(tInk);
    if (showToast) toast('文字 Logo 已生成，可在画笔模式微调');
  }
}
function canColor() {
  const g = S.g;
  return !!(g && g.type === 'recordstream' && g.palette && g.palette.length);
}
function nearestIdx(pal, r, gc, b) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const c = pal[i], dd = (c[0] - r) * (c[0] - r) + (c[1] - gc) * (c[1] - gc) + (c[2] - b) * (c[2] - b);
    if (dd < bd) { bd = dd; bi = i; }
  }
  return bi;
}
/** 保留颜色：每个 12×18 格取墨迹像素的平均色 → 匹配固件调色板最近色（OSD 颜色平面每格一色） */
function computeCellColors(idata) {
  const g = S.g, cols = S.cols, rows = S.rows, d = idata.data;
  const cellCols = new Uint8Array(rows * cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let R = 0, G = 0, B = 0, n = 0;
    const py0 = r * 18, px0 = c * 12;
    for (let y = 0; y < 18 && py0 + y < S.th; y++) for (let x = 0; x < 12 && px0 + x < S.tw; x++) {
      const p = (py0 + y) * S.tw + px0 + x;
      if (!S.ink[p]) continue;
      const o = p * 4; R += d[o]; G += d[o + 1]; B += d[o + 2]; n++;
    }
    cellCols[r * cols + c] = n ? nearestIdx(g.palette, R / n, G / n, B / n) : S.bgIdx;
  }
  S.cellColors = cellCols;
}
function genImage() {
  if (!S.g) return toast('请先打开固件');
  if (!S.imgEl) return toast('请先选择图片');
  S.baseInk = null; S.baseCC = null;                      // 图片重生成，文字叠加快照失效
  const im = S.imgEl, cv = document.createElement('canvas');
  cv.width = S.tw; cv.height = S.th;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S.tw, S.th);
  const fit = $('selFit').value;
  let dw, dh, dx, dy;
  if (fit === 'cover') { dw = S.tw; dh = S.th; dx = 0; dy = 0; }
  else {
    const k = Math.min(S.tw / im.width, S.th / im.height);
    dw = im.width * k; dh = im.height * k; dx = (S.tw - dw) / 2; dy = (S.th - dh) / 2;
  }
  // 以画布中心为锚缩放，再叠加拖动偏移
  const z = S.imgZoom;
  dw *= z; dh *= z;
  dx = (S.tw - dw) / 2 + S.imgX;
  dy = (S.th - dh) / 2 + S.imgY;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im, dx, dy, dw, dh);
  const idata = ctx.getImageData(0, 0, S.tw, S.th);
  if ($('ckKeepColor').checked && canColor()) {
    // 彩色模式：背景色从「原图自身四角」估计（与图片摆放位置无关，拖动/缩放不会跳变），
    // 按「与背景的色差」取墨迹（阈值滑块 = 色差半径）；图片矩形外的填充区永不成为墨迹
    const d = idata.data, tw = S.tw, th = S.th;
    const sc = document.createElement('canvas'); sc.width = 8; sc.height = 8;
    const sctx = sc.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(S.imgEl, 0, 0, 8, 8);
    const sd = sctx.getImageData(0, 0, 8, 8).data;
    const cs = [0, 7, 56, 63].map(i => [sd[i * 4], sd[i * 4 + 1], sd[i * 4 + 2]]);
    const bgc = [0, 1, 2].map(k => cs.reduce((a, c) => a + c[k], 0) / 4);
    const rad = (+$('rgTh2').value) / 255 * 360;
    const inv = $('ckInv').checked;
    const dist = new Float32Array(tw * th);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const i = y * tw + x;
      const inside = x >= dx && x < dx + dw && y >= dy && y < dy + dh;
      if (!inside) { dist[i] = -1; continue; }         // -1 = 填充区，永不成为墨迹
      const dr = d[i * 4] - bgc[0], dg = d[i * 4 + 1] - bgc[1], db = d[i * 4 + 2] - bgc[2];
      dist[i] = Math.sqrt(dr * dr + dg * dg + db * db);
    }
    if ($('ckDither').checked) {
      // Floyd–Steinberg 误差扩散（色差域）：渐变区域形成抖动网点
      for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
        const i = y * tw + x;
        if (dist[i] < 0) continue;
        const old = dist[i], on = old > rad, err = old - (on ? 441 : 0);
        dist[i] = on ? 441 : 0;
        const push = (x2, y2, w) => {
          if (x2 < 0 || x2 >= tw || y2 < 0 || y2 >= th) return;
          const j = y2 * tw + x2;
          if (dist[j] >= 0) dist[j] += err * w;
        };
        push(x + 1, y, 7 / 16); push(x - 1, y + 1, 3 / 16);
        push(x, y + 1, 5 / 16); push(x + 1, y + 1, 1 / 16);
      }
    }
    const ink = new Uint8Array(tw * th);
    for (let i = 0; i < tw * th; i++) ink[i] = dist[i] < 0 ? 0 : ((dist[i] > rad) !== inv ? 1 : 0);
    S.cellColors = null;
    setInk(ink);
    computeCellColors(idata);
  } else {
    grayToInk(idata, +$('rgTh2').value, $('ckInv').checked, $('ckDither').checked);
    if (canColor()) computeCellColors(idata);
  }
  paintInkAll(); drawNew(); refreshStats();
  toast(__t('图片 Logo 已生成') + (S.keepColor && canColor() ? __t('（彩色已按格匹配调色板）') : ''));
}
$('btnGenText').onclick = () => { pushHistory(); genText(); };
$('btnGenImg').onclick = () => { pushHistory(); genImage(); };
$('btnPickImg').onclick = () => $('fileImg').click();
$('fileImg').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const im = new Image();
  im.onload = () => { pushHistory(); S.imgEl = im; $('imgName').textContent = f.name.slice(0, 22); genImage(); };
  im.src = URL.createObjectURL(f);
  e.target.value = '';
});
['rgTh1'].forEach(id => $(id).addEventListener('input', () => { $('vTh1').textContent = $(id).value; }));
['rgTh2'].forEach(id => $(id).addEventListener('input', () => { $('vTh2').textContent = $(id).value; }));
$('rgSize').addEventListener('input', () => $('vSize').textContent = $('rgSize').value + '%');
$('rgTh1').addEventListener('pointerdown', pushHistory);
$('rgTh1').addEventListener('change', genText);
$('rgTh2').addEventListener('pointerdown', pushHistory);
$('rgTh2').addEventListener('change', genImage);
['ckInv', 'ckDither'].forEach(id => $(id).addEventListener('change', () => { if (S.imgEl && S.g) { pushHistory(); genImage(); } }));
// 文字大小 / 位置滑块：实时重新生成（叠加模式下基于底层快照重渲染，与画布拖动双向同步）
let warnMerge = false;
function rerenderText() {
  if (!S.g || !S.ink || $('txtLogo').value.trim() === '') return;
  if ($('ckTextOverlay').checked && !S.baseInk) {
    if (!warnMerge) { toast('文字已与画面合并（画笔修改过），滑块/拖动不再实时调整；重新点「生成文字 Logo」叠加即可', 3200); warnMerge = true; }
    return;
  }
  genText(false);
}
['rgTxtX', 'rgTxtY', 'rgSize'].forEach(id => {
  $(id).addEventListener('pointerdown', pushHistory);
  $(id).addEventListener('input', () => {
    const v = $('v' + id.slice(2));
    if (v) v.textContent = $(id).value + (id === 'rgSize' ? '%' : '');
    rerenderText();
  });
});
['ckInv', 'ckDither'].forEach(id => $(id).addEventListener('change', () => { if (S.imgEl && S.g) genImage(); }));

/* ------------------------------------------------ 画笔 */
$('btnPen').onclick = () => { S.tool = 'pen'; $('btnPen').style.borderColor = 'var(--acc)'; $('btnErase').style.borderColor = 'var(--line)'; };
$('btnErase').onclick = () => { S.tool = 'erase'; $('btnErase').style.borderColor = 'var(--acc)'; $('btnPen').style.borderColor = 'var(--line)'; };
$('rgPen').addEventListener('input', () => { S.penW = +$('rgPen').value; $('vPen').textContent = S.penW; });
$('btnInkInv').onclick = () => { if (!S.ink) return; pushHistory(); S.baseInk = null; S.baseCC = null; for (let i = 0; i < S.ink.length; i++) S.ink[i] ^= 1; paintInkAll(); drawNew(); refreshStats(); };
$('btnInkClr').onclick = () => { if (!S.ink) return; pushHistory(); S.baseInk = null; S.baseCC = null; S.ink.fill(0); paintInkAll(); drawNew(); refreshStats(); };
$('btnInkRestore').onclick = () => { if (S.g) { pushHistory(); buildInkFromOriginal(); } };
$('btnUndo').onclick = doUndo;
$('btnRedo').onclick = doRedo;
$('btnUndo2').onclick = doUndo;
$('btnRedo2').onclick = doRedo;
$('btnCommitTxt').onclick = commitTxt;

let painting = false, imgDrag = null, txtDrag = null, wheelLock = false;
const cvNew = $('cvNew');
// 文字层命中检测：返回 'move'（框内）/ 'scale'（右下角句柄）/ null（e 坐标为画布内屏幕 px）
// ignoreEdit=true 时只做几何判定（供「双击重新进入编辑」使用）
function txtHit(mx, my, ignoreEdit) {
  if (S.tab !== 'text' || !S.baseInk || !S.txtBBox) return null;
  if (!S.txtEdit && !ignoreEdit) return null;
  const z = cvNew.width / S.tw, b = S.txtBBox;
  if (Math.abs(mx - b.x1 * z) <= 8 && Math.abs(my - b.y1 * z) <= 8) return 'scale';
  if (mx >= b.x0 * z - 3 && mx <= (b.x1 + 1) * z + 3 && my >= b.y0 * z - 3 && my <= (b.y1 + 1) * z + 3) return 'move';
  return null;
}
cvNew.addEventListener('pointerdown', e => {
  if (!S.ink) return;
  // 图片替换 Tab：拖动 = 移动图片（缩放定位编辑）
  if (S.tab === 'img' && S.imgEl) {
    pushHistory();
    imgDrag = { x: e.clientX, y: e.clientY, ix: S.imgX, iy: S.imgY };
    cvNew.setPointerCapture(e.pointerId);
    cvNew.style.cursor = 'grabbing';
    return;
  }
  // 文字 Tab：叠加会话中，拖文字 = 移动，拖右下角句柄 = 缩放（按住 Alt 绕过，直接画笔）
  if (S.tab === 'text' && !e.altKey && S.baseInk && S.txtBBox) {
    const r = cvNew.getBoundingClientRect();
    const hit = txtHit(e.clientX - r.left, e.clientY - r.top);
    if (hit) {
      pushHistory();
      txtDrag = {
        mode: hit, sx: e.clientX, sy: e.clientY,
        ox: +$('rgTxtX').value, oy: +$('rgTxtY').value, osz: +$('rgSize').value,
        h0: S.txtBBox.y1 - S.txtBBox.y0 + 1
      };
      cvNew.setPointerCapture(e.pointerId);
      cvNew.style.cursor = hit === 'scale' ? 'nwse-resize' : 'move';
      return;
    }
  }
  painting = true; pushHistory(); cvNew.setPointerCapture(e.pointerId); paintAt(e);
});
cvNew.addEventListener('pointermove', e => {
  if (imgDrag) {
    const r = cvNew.getBoundingClientRect(), z = cvNew.width / S.tw;
    S.imgX = imgDrag.ix + (e.clientX - imgDrag.x) / z;
    S.imgY = imgDrag.iy + (e.clientY - imgDrag.y) / z;
    genImage();                                          // 实时重生成（画布小，开销可接受）
    return;
  }
  if (txtDrag) {
    const r = cvNew.getBoundingClientRect(), z = cvNew.width / S.tw;
    if (txtDrag.mode === 'move') {
      let nx = txtDrag.ox + (e.clientX - txtDrag.sx) / z / S.tw * 100;
      let ny = txtDrag.oy + (e.clientY - txtDrag.sy) / z / S.th * 100;
      nx = Math.max(-100, Math.min(100, Math.round(nx)));
      ny = Math.max(-100, Math.min(100, Math.round(ny)));
      $('rgTxtX').value = nx; $('vTxtX').textContent = nx;
      $('rgTxtY').value = ny; $('vTxtY').textContent = ny;
    } else {
      const k = ((e.clientY - r.top) / z - S.txtBBox.y0) / txtDrag.h0;
      const ns = Math.max(20, Math.min(100, Math.round(txtDrag.osz * k)));
      $('rgSize').value = ns; $('vSize').textContent = ns + '%';
    }
    rerenderText();
    return;
  }
  // 悬停光标反馈（文字层可拖 / 可缩放）
  if (S.tab === 'text' && !painting) {
    const r = cvNew.getBoundingClientRect();
    const hit = (!e.altKey && S.baseInk) ? txtHit(e.clientX - r.left, e.clientY - r.top) : null;
    cvNew.style.cursor = hit === 'scale' ? 'nwse-resize' : hit === 'move' ? 'move' : '';
  }
  if (painting) paintAt(e);
});
cvNew.addEventListener('pointerup', () => {
  if (imgDrag) { imgDrag = null; cvNew.style.cursor = ''; return; }
  if (txtDrag) { txtDrag = null; cvNew.style.cursor = ''; return; }
  if (painting) { painting = false; refreshStats(); }
});
// 文字固定后：双击文字区域重新进入编辑态
cvNew.addEventListener('dblclick', e => {
  if (S.tab !== 'text' || !S.baseInk || !S.txtBBox || S.txtEdit) return;
  const r = cvNew.getBoundingClientRect();
  if (txtHit(e.clientX - r.left, e.clientY - r.top, true)) {
    S.txtEdit = true; updHistBtns(); drawNew();
    toast('已重新进入文字编辑：拖动移动 / 右下角缩放，按 Enter 固定', 2600);
  }
});
cvNew.addEventListener('wheel', e => {
  if (S.tab === 'img' && S.imgEl) {
    e.preventDefault();
    if (!wheelLock) { pushHistory(); wheelLock = true; setTimeout(() => wheelLock = false, 600); }
    S.imgZoom = Math.min(4, Math.max(0.2, S.imgZoom * (e.deltaY < 0 ? 1.1 : 0.9)));
    $('rgImgZoom').value = Math.round(S.imgZoom * 100);
    $('vImgZoom').textContent = Math.round(S.imgZoom * 100) + '%';
    genImage();
    return;
  }
  // 文字 Tab：悬停在文字上滚轮 = 缩放文字
  if (S.tab === 'text' && !e.altKey && S.baseInk && S.txtBBox) {
    const r = cvNew.getBoundingClientRect();
    if (txtHit(e.clientX - r.left, e.clientY - r.top)) {
      e.preventDefault();
      if (!wheelLock) { pushHistory(); wheelLock = true; setTimeout(() => wheelLock = false, 600); }
      const ns = Math.max(20, Math.min(100, +$('rgSize').value + (e.deltaY < 0 ? 2 : -2)));
      $('rgSize').value = ns; $('vSize').textContent = ns + '%';
      rerenderText();
    }
  }
}, { passive: false });
function paintAt(e) {
  const r = cvNew.getBoundingClientRect(), z = cvNew.width / S.tw;
  const x = Math.floor((e.clientX - r.left) / z), y = Math.floor((e.clientY - r.top) / z);
  const v = S.tool === 'erase' ? 0 : 1, rad = S.penW - 1;
  S.baseInk = null; S.baseCC = null;                      // 手绘后文字叠加基于新现状
  const g = S.g;
  // 调色板固件：画笔颜色 = 「写入颜色」，逐格记录到颜色平面（首次上色自动启用保留颜色）
  let cc = null;
  if (g && g.type === 'recordstream' && g.palette && g.palette.length && S.writeColor != null && v) {
    if (!S.cellColors) {
      S.cellColors = new Uint8Array(S.rows * S.cols).fill(S.writeColor);
      S.keepColor = true; $('ckKeepColor').checked = true;
      toast(__tf('画笔颜色 = 写入颜色 {c}，换选颜色可分区域上色', { c: hexCol(g.palette[S.writeColor]) }), 2800);
    }
    cc = S.cellColors;
  }
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    if (dx * dx + dy * dy > rad * rad + 0.4) continue;
    const px = x + dx, py = y + dy;
    if (px < 0 || py < 0 || px >= S.tw || py >= S.th) continue;
    S.ink[py * S.tw + px] = v;
    let c;
    if (cc && v) {
      const ci = Math.floor(py / 18) * S.cols + Math.floor(px / 12);
      cc[ci] = S.writeColor;
      c = g.palette[S.writeColor];
    } else c = v ? S.fgc : S.bgc;
    const o = (py * S.tw + px) * 4, d = S.iimg.data;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  S.ictx.putImageData(S.iimg, 0, 0); drawNew();
}

/* ------------------------------------------------ 写入体检 */
let statTimer = null;
function refreshStats() {
  clearTimeout(statTimer);
  statTimer = setTimeout(doStats, 90);
}
function doStats() {
  const g = S.g;
  if (!g || !S.ink) {
    $('stTiles').textContent = $('stComp').textContent = $('stLimit').textContent = $('stPlan').textContent = '-';
    $('stPlan').style.color = ''; $('planHint').textContent = '';
    return;
  }
  const isRec = g.type === 'recordstream';
  const RR = isRec ? S.rows : g.rows, CC = isRec ? S.cols : g.cols;
  const built = RTDLogo.buildFromBitmap(S.ink, RR, CC, { invert: S.polarity === 0, snapBlank: 0 });
  S.built = built; S.blk = null; S.plan = null;
  if (g.type === 'recordstream') {
    const sLimit = g.streamEnd - g.streamOff, fLimit = g.blockEnd - g.fontOff;
    const colors = (S.keepColor && S.cellColors) ? S.cellColors : null;
    $('stLimit').textContent = __tf('流 {s} B + 字库 {f} B', { s: sLimit, f: fLimit });
    if (!built.ok) {
      $('stTiles').innerHTML = __tf('{u} &gt; 255 超限', { u: built.unique });
      $('stComp').textContent = '-';
      $('stPlan').innerHTML = '<span style="color:var(--bad)">' + __t('字模数超上限') + '</span>';
      $('planHint').textContent = __t('唯一字模超过 255 个。请降低图片细节 / 关闭抖动，或提高阈值减少噪点。');
      $('btnApply').disabled = true; return;
    }
    const plan = RTDLogo.planRecordStream({
      buf: S.fw, origDisp: g.disp, origStored: g.stored, built, polarity: S.polarity,
      rows: RR, cols: CC, color: (S.writeColor != null ? S.writeColor : g.inkColor), base: g.base, osdw: CC, fontOff: g.fontOff,
      colors
    });
    $('stTiles').innerHTML = __tf('{u} <span style="color:var(--tx2)">/ {a} 可用槽位</span>', { u: built.unique, a: (plan.avail ? plan.avail : g.glyphCount) });
    if (!plan.ok) {
      const why = plan.reason === 'no-blank-glyph' ? __t('字库里找不到空白字模作为背景格')
        : plan.reason === 'unique-tiles-overflow' ? __tf('唯一字模 {u} 超过可用槽位 {a}', { u: plan.unique, a: plan.avail })
        : plan.reason === 'canvas-overflow' ? __tf('画布超出 OSD 属性区（上限 {a} 格）', { a: plan.avail })
        : plan.reason;
      $('stComp').textContent = '-';
      $('stPlan').innerHTML = '<span style="color:var(--bad)">' + why + '</span>';
      $('planHint').textContent = __t('请简化图案（减少细节 / 提高吸附阈值）。');
      $('btnApply').disabled = true; return;
    }
    const fBytes = plan.fontBytes;
    S.blk = plan.stream;
    $('stComp').innerHTML = __tf('流 {s} B + 字库 {f} B ', { s: plan.stream.length, f: fBytes }) +
      ((plan.stream.length <= sLimit && fBytes <= fLimit) ? '<span style="color:var(--ok)">✓</span>' : '<span style="color:var(--bad)">' + __t('超预算') + '</span>');
    if (plan.stream.length > sLimit) {
      $('stPlan').innerHTML = '<span style="color:var(--bad)">' + __t('数据流超预算') + '</span>';
      $('planHint').textContent = __tf('新数据流 {s} B 超过原流预算 {l} B。请简化图案（空白多、笔画成块会显著减小数据流）。', { s: plan.stream.length, l: sLimit });
      $('btnApply').disabled = true; return;
    }
    if (fBytes > fLimit) {
      $('stPlan').innerHTML = '<span style="color:var(--bad)">' + __t('字库块放不下') + '</span>';
      $('planHint').textContent = __tf('新字库 {f} B 超过原块预算 {l} B。请简化图案减少唯一字模。', { f: fBytes, l: fLimit });
      $('btnApply').disabled = true; return;
    }
    S.plan = { relocate: false };
    $('stPlan').innerHTML = __tf('<span style="color:var(--ok)">原地写入 @{a} + 字库 @{f}{m}</span>', { a: HX(g.streamOff), f: HX(g.fontOff), m: plan.mode === 'shrink' ? __t(' · 收缩模式') : '' });
    $('planHint').textContent = plan.mode === 'shrink'
      ? __tf('字库放不下完整内容，已收缩为新画面专用字库，并等长重映射尾部动画的字模引用（{n} 处）。', { n: plan.animPatches.length })
      : __t('数据流与字库均原地重写，新字模映射到原 logo 槽位，其余固件字节不动。');
    $('btnApply').disabled = false;
    return;
  }
  // 串引用型：把新字模合成进「保留原字库结构」的字库（字符串表引用的字模号不变）
  const composed = g.type === 'stringref' && built.ok
    ? RTDLogo.composeStringFont(built, g.str, g.stored) : null;
  const eff = composed ? { ok: true, map: composed.map, stored: composed.stored, unique: built.unique } : built;
  S.built = eff;
  const limit = g.blockEnd - g.fontOff;
  const uniqMax = g.type === 'stringref' ? g.cols : 255;
  $('stTiles').innerHTML = eff.ok ? eff.unique + ' <span style="color:var(--tx2)">/ ' + uniqMax + '</span>' :
    __tf('{u} &gt; 255 超限', { u: eff.unique });
  if (!eff.ok) {
    $('stComp').textContent = '-'; $('stLimit').textContent = limit + ' B';
    $('stPlan').innerHTML = '<span style="color:var(--bad)">' + __t('字模数超上限') + '</span>';
    $('planHint').textContent = __t('唯一字模超过 255 个（MAP 表每格只有 1 字节索引）。请在图片模式降低细节 / 关闭抖动，或提高阈值减少噪点。');
    $('btnApply').disabled = true; return;
  }
  const blk = RTDLogo.encodeBlock(eff.stored);
  S.blk = blk;
  $('stComp').innerHTML = blk.length + ' B ' + (blk.length <= limit ? '<span style="color:var(--ok)">✓</span>' : '<span style="color:var(--warn)">&gt; ' + __tf('{l} B（原地）', { l: limit }) + '</span>');
  $('stLimit').textContent = __tf('{l} B（原地）', { l: limit });
  const bankFrom = g.fontOff & ~0x7fff, bankTo = bankFrom + 0x8000;
  if (blk.length <= limit) {
    S.plan = { relocate: false };
    $('stPlan').innerHTML = __tf('<span style="color:var(--ok)">原地写入 @{a}</span>', { a: HX(g.fontOff) });
    $('planHint').textContent = (limit - blk.length > 0)
      ? __tf('新字库比原来小 {d} B，无需移动任何代码。', { d: limit - blk.length })
      : __t('新字库与原块同大小，无需移动任何代码。');
  } else if ($('ckReloc').checked) {
    const runs = RTDLogo.freeRuns(S.fw, bankFrom, bankTo, blk.length + 32);
    if (runs.length) {
      S.plan = { relocate: true, target: runs[0].off };
      $('stPlan').innerHTML = __tf('<span style="color:var(--warn)">重定位 @{a}</span>', { a: HX(runs[0].off) });
      $('planHint').textContent = __tf('原地放不下，将把字库挪到同 bank 空闲区 {a}（{l} B 空闲），并改写字库加载指令的地址立即数。', { a: HX(runs[0].off), l: runs[0].len });
    } else {
      $('stPlan').innerHTML = '<span style="color:var(--bad)">' + __t('空间不足') + '</span>';
      $('planHint').textContent = __tf('原地与同 bank 空闲区都放不下 {n} B。请简化图案（减少细节/提高吸附）。', { n: blk.length });
      $('btnApply').disabled = true; return;
    }
  } else {
    $('stPlan').innerHTML = '<span style="color:var(--bad)">' + __t('超出原地预算') + '</span>';
    $('planHint').textContent = __t('可勾选「自动重定位」，或简化图案。');
    $('btnApply').disabled = true; return;
  }
  $('btnApply').disabled = false;
}
$('ckReloc').addEventListener('change', refreshStats);

/* ------------------------------------------------ 确认替换 */
$('btnApply').onclick = () => {
  if (!S.g || !S.built || !S.blk) return;
  const g = S.g, blk = S.blk, plan = S.plan;
  const inPlace = !plan.relocate;
  const target = inPlace ? g.fontOff : plan.target;
  const resized = g.type === 'recordstream' && (S.rows !== g.rows || S.cols !== g.cols);
  openModal(`
    <h2>${__t('⚠ 确认替换开机 Logo')}</h2>
    <div class="kv">${__tf('固件：<b>{n}</b>（{s} 字节，改后大小不变）', { n: S.fwName, s: S.fw.length })}</div>
    ${resized ? `<div class="kv">${__tf('画布：{w1}×{h1} → <b>{w2}×{h2}</b> px（若实机 OSD 窗口较小，放大部分可能被裁剪）', { w1: g.cols * 12, h1: g.rows * 18, w2: S.tw, h2: S.th })}</div>` : ''}
    ${S.keepColor && S.cellColors ? `<div class="kv">${__tf('颜色：逐格写入图片匹配色（背景格 = 调色板 idx{i}）', { i: S.bgIdx })}</div>` : ''}
    ${g.type === 'recordstream'
      ? `<div class="kv">${__tf('① OSD 数据流：<b>{a}</b> → {b}（预算 {n} B）→ 重写为新画面的记录流', { a: HX(g.streamOff), b: HX(g.streamEnd), n: g.streamEnd - g.streamOff })}</div>
    <div class="kv">${__tf('② 字库块：<b>{a}</b>（预算 {n} B）→ 新字模映射到原 logo 槽位后 VLC 重编码写入', { a: HX(g.fontOff), n: g.blockEnd - g.fontOff })}</div>`
      : g.type === 'stringref'
        ? `<div class="kv">${__tf('① 字符串索引表：<b>{a}</b>（{n} 项）→ <b>原样保留</b>，新画面写入其引用的字模号', { a: HX(g.strOff), n: g.cols })}</div>`
        : `<div class="kv">${__tf('① MAP 表：<b>{a}</b> 起 {n} 字节 → 重写为新画面拼图', { a: HX(g.mapOff), n: g.mapLen })}</div>`}
    ${g.type !== 'recordstream' ? `<div class="kv">${__tf('② 字库块：{opt}', { opt: inPlace
      ? __tf('<b>{a}</b> 起原地写入 {n} 字节（预算 {l} B）', { a: HX(g.fontOff), n: blk.length, l: g.blockEnd - g.fontOff })
      : __tf('原地放不下 → 重定位到 <b>{a}</b> 写入 {n} 字节，并改写加载指令地址（{c} 处）', { a: HX(target), n: blk.length, c: RTDLogo.findLoaderRefs(S.fw, g.fontOff).length }) })}</div>` : ''}
    <div class="kv">${__tf('③ 其余字节：原样保留{ext}', { ext: g.type === 'recordstream' ? __t('（含数据流之后的动画记录组）') : '' })}</div>
    <div class="kv">${__tf('④ 写入后回读校验：{m}', { m: g.type === 'recordstream' ? __t('重新模拟数据流逐格比对 + 重新解码字库比对（自动执行）') : __t('重新解码字库并比对（自动执行）') })}</div>
    <div class="note">${__t('⚠ 刷机有风险：请务必保留原固件备份。')}${S.server && S.fwPath
      ? __t('点击「直接替换原文件」会先把原文件备份为 <b>.bak-时间戳</b> 再覆盖。')
      : __t('将下载新固件文件，原文件不会被改动；刷机前建议先刷「原文件备份」确认可回退。')}</div>
    <div class="btns">
      <button onclick="closeModal()">${__t('取消')}</button>
      ${S.server && S.fwPath ? `<button class="primary" onclick="doApply(true)">${__t('直接替换原文件')}</button>` : ''}
      <button class="primary" onclick="doApply(false)">${__t('生成新固件')}${S.server && S.fwPath ? __t('（下载）') : ''}</button>
    </div>`);
};
window.closeModal = closeModal;
window.doApply = function (writeBack) {
  const g = S.g;
  const isRec = g.type === 'recordstream';
  const RR = isRec ? S.rows : g.rows, CC = isRec ? S.cols : g.cols;
  const res = isRec
    ? RTDLogo.applyRecordStream({
      buf: S.fw, origDisp: g.disp, origStored: g.stored, built: S.built, polarity: S.polarity,
      rows: RR, cols: CC, color: (S.writeColor != null ? S.writeColor : g.inkColor), base: g.base, osdw: CC,
      colors: (S.keepColor && S.cellColors) ? S.cellColors : null,
      streamOff: g.streamOff, streamEnd: g.streamEnd, fontOff: g.fontOff
    })
    : RTDLogo.applyPatch({
      buf: S.fw, mapOff: g.mapOff, rows: g.rows, cols: g.cols, fontOff: g.fontOff,
      fontEnd: g.blockEnd, polarity: S.polarity,
      map: S.built.map, stored: S.built.stored,
      allowRelocate: $('ckReloc').checked,
      bankFrom: g.fontOff & ~0x7fff, bankTo: (g.fontOff & ~0x7fff) + 0x8000
    });
  if (!res.ok) { closeModal(); toast(__tf('写入失败：{r}', { r: res.reason }), 4000); return; }
  S.patched = res.bytes; window.__lastReport = res.report;   // 便于外部校验/调试
  const outName = S.fwName.replace(/\.bin$/i, '') + '_newlogo.bin';
  const done = (msg) => openModal(`
    <h2 style="color:var(--ok)">${__t('✓ 新固件已生成')}</h2>
    <div class="kv">${__tf('回读校验：{r}', { r: res.report.verified ? __t('通过（解码后与设计完全一致）') : __t('失败') })}</div>
    ${g.type === 'recordstream'
      ? `<div class="kv">${__tf('数据流：{a} · {s} 字节（预算 {l} B）', { a: HX(res.report.placedAt), s: res.report.streamBytes, l: res.report.streamLimit })}</div>
    <div class="kv">${__tf('字库块：{a} · {s} 字节（预算 {l} B）', { a: HX(g.fontOff), s: res.report.fontBytes, l: res.report.fontLimit })}</div>`
      : `<div class="kv">${__tf('字库写入：{a}{m} · {s} 字节', { a: HX(res.report.placedAt), m: res.report.relocated ? __t('（重定位，加载指令已改写）') : __t('（原地）'), s: res.report.blockBytes })}</div>`}
    ${msg ? `<div class="kv">${msg}</div>` : ''}
    <div class="note">${__t('下一步：用编程器 / ISP 工具把新 .bin 写回主板。若开机异常，刷回备份的原固件即可恢复。')}</div>
    <div class="btns">
      <button onclick="closeModal()">${__t('关闭')}</button>
      <button class="primary" id="btnDl">${__t('下载新固件')}</button>
    </div>`) || setTimeout(() => {
      $('btnDl').onclick = () => download(S.patched, outName);
      if (!S.server) $('btnDl').click();
    }, 0);
  if (writeBack && S.fwPath) {
    apiSave(S.fwPath, res.bytes).then(r => {
      closeModal();
      if (r.ok) done(__tf('已直接替换原文件：<b>{p}</b><br>备份：{b}', { p: S.fwPath, b: r.backup || '-' }));
      else { toast(__tf('写回失败：{e}', { e: r.error || '?' }), 4000); download(S.patched, outName); }
    }).catch(() => { closeModal(); toast(__t('写回失败，已转为下载'), 4000); download(S.patched, outName); });
  } else {
    done('');
    setTimeout(() => { $('btnDl').onclick = () => download(S.patched, outName); if (!S.server) $('btnDl').click(); }, 0);
  }
};
function download(bytes, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  a.download = name; a.click();
  toast(__tf('已下载：{n}', { n: name }));
}
window.download = download;

/* ------------------------------------------------ 本地服务模式 */
async function apiLoad(path) {
  const r = await fetch('/api/load?path=' + encodeURIComponent(path));
  if (!r.ok) throw new Error(await r.text());
  return new Uint8Array(await r.arrayBuffer());
}
async function apiSave(path, bytes) {
  // 直接传原始字节，避免 base64 分段填充（'='）截断问题
  const r = await fetch('/api/save?path=' + encodeURIComponent(path), {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes
  });
  return r.json();
}
async function apiList(dir) { const r = await fetch('/api/list?dir=' + encodeURIComponent(dir)); return r.json(); }
async function apiRoots() { const r = await fetch('/api/roots'); return r.json(); }

$('btnServerOpen').onclick = serverBrowse;
async function serverBrowse() {
  let cur = '';
  const roots = S.server ? await apiRoots().catch(() => ({ roots: [] })) : { roots: [] };
  openModal(`<h2 style="color:var(--acc)">${__t('从电脑打开固件')}</h2>
    <div class="row"><input type="text" id="brPath" style="flex:1" placeholder="${__t('输入文件夹路径，如 D:\\Users\\...\\Downloads')}" value="${cur}">
    <button id="brGo">${__t('打开')}</button></div>
    <div id="brList" style="max-height:50vh;overflow:auto;margin-top:8px"></div>
    <div class="btns"><button onclick="closeModal()">${__t('取消')}</button></div>`);
  const go = async d => {
    cur = d; $('brPath').value = d;
    const res = await apiList(d).catch(e => ({ error: String(e) }));
    if (res.error) { $('brList').innerHTML = '<div class="hint">' + res.error + '</div>'; return; }
    $('brList').innerHTML =
      (res.dir + '  <span class="hint">' + __t('上级：<a href="#" id="brUp">..</a>') + '</span><hr style="border-color:var(--line)">' +
        res.dirs.map(x => `<a href="#" class="brd" data-p="${x.path}">📁 ${x.name}</a>`).join('<br>') +
        '<hr style="border-color:var(--line)">' +
        (res.bins.length ? res.bins.map(x => `<a href="#" class="brf" data-p="${x.path}">📄 ${x.name} <span class="hint">(${x.size} B)</span></a>`).join('<br>')
          : '<span class="hint">' + __t('此目录没有 .bin 文件') + '</span>'));
    $('brList').querySelectorAll('.brd').forEach(a => a.onclick = ev => { ev.preventDefault(); go(a.dataset.p); });
    $('brList').querySelectorAll('.brf').forEach(a => a.onclick = async ev => {
      ev.preventDefault();
      try { const b = await apiLoad(a.dataset.p); closeModal(); onFirmware(b, a.dataset.p.split(/[\\/]/).pop(), a.dataset.p); }
      catch (e) { toast(__tf('读取失败：{e}', { e }), 4000); }
    });
    const up = $('brUp'); if (up) up.onclick = ev => { ev.preventDefault(); go(res.parent || cur); };
  };
  $('brGo').onclick = () => go($('brPath').value.trim());
  if (roots.roots && roots.roots.length) go(roots.roots[0]); else go('');
}

/* ------------------------------------------------ 颜色 / 缩放 / Tab */
function onColorChange() {
  S.fgc = hex2rgb($('colFg').value); S.bgc = hex2rgb($('colBg').value);
  if (S.ink) { paintInkAll(); drawNew(); }
  if (S.g) drawOrig();
}
$('colFg').addEventListener('input', onColorChange);
$('colBg').addEventListener('input', onColorChange);
$('ckColor').addEventListener('change', () => { S.colorOn = $('ckColor').checked; drawOrig(); });
/** 写入颜色选中项旁边的色块 */
function updateInkChip() {
  const g = S.g, el = $('swInkColor');
  if (!g || !g.palette || S.writeColor == null || !el) return;
  const c = g.palette[S.writeColor];
  el.style.background = hexCol(c);
  el.title = hexCol(c);
}
$('selInkColor').addEventListener('change', () => {
  S.writeColor = +$('selInkColor').value;
  updateInkChip();
  if (S.g && S.ink) refreshStats();
});
$('rgZoom').addEventListener('input', () => { $('vZoom').textContent = $('rgZoom').value + 'x'; if (S.g) { drawOrig(); if (S.ink) drawNew(); } });
function tab(name) {
  S.tab = name;
  ['Text', 'Img', 'Paint'].forEach(t => {
    $('tab' + t).classList.toggle('on', t.toLowerCase() === name);
    $('pane' + t).classList.toggle('on', t.toLowerCase() === name);
  });
  cvNew.style.cursor = (name === 'img' && S.imgEl) ? 'grab' : '';
  updHistBtns();
}
$('tabText').onclick = () => tab('text');
$('tabImg').onclick = () => tab('img');
$('tabPaint').onclick = () => tab('paint');

/* ------------------------------------------------ 画布调整 / 图片交互控件 */
$('btnCanvas').onclick = () => { pushHistory(); applyCanvas(); };
function applyCanvas() {
  const g = S.g;
  if (!g || g.type !== 'recordstream') return toast('仅 OSD 记录流型支持调整画布（MAP / 串引用的表格结构尺寸固定）');
  const W = +$('inCvW').value, H = +$('inCvH').value;
  const cols = Math.round(W / 12), rows = Math.round(H / 18);
  if (!S.ink) return toast('请先打开固件');
  if (cols < 4 || rows < 2) return toast('画布太小（至少 4×2 格）');
  if (rows > 24 || cols > 85) return toast('超出上限：行 ≤ 24、列 ≤ 85');
  if (g.base + rows * cols > 0x400) return toast('超出 OSD 属性区上限（当前基础地址还剩 ' + (0x400 - g.base) + ' 格）');
  if (cols === S.cols && rows === S.rows) return;
  // 现有内容最近邻缩放到新画布
  const old = S.ink, ow = S.tw, oh = S.th;
  const ink = new Uint8Array(rows * 18 * cols * 12);
  for (let y = 0; y < rows * 18; y++) {
    const sy = Math.min(oh - 1, Math.floor(y * oh / (rows * 18)));
    for (let x = 0; x < cols * 12; x++) ink[y * cols * 12 + x] = old[sy * ow + Math.min(ow - 1, Math.floor(x * ow / (cols * 12)))];
  }
  S.cols = cols; S.rows = rows; S.tw = cols * 12; S.th = rows * 18;
  S.cellColors = null; S.imgX = 0; S.imgY = 0;
  S.baseInk = null; S.baseCC = null;
  setInk(ink);
  toast(__tf('画布已调整为 {w}×{h} px（{r}×{c} 格）', { w: S.tw, h: S.th, r: rows, c: cols }));
}
$('rgImgZoom').addEventListener('pointerdown', pushHistory);
$('rgImgZoom').addEventListener('input', () => {
  S.imgZoom = +$('rgImgZoom').value / 100;
  $('vImgZoom').textContent = $('rgImgZoom').value + '%';
  if (S.imgEl && S.g) genImage();
});
$('selFit').addEventListener('change', () => { if (S.imgEl && S.g) pushHistory(); S.imgX = 0; S.imgY = 0; if (S.imgEl && S.g) genImage(); });
$('ckKeepColor').addEventListener('change', () => {
  S.keepColor = $('ckKeepColor').checked;
  if (!S.keepColor) S.cellColors = null;
  if (S.imgEl && S.g) genImage(); else { paintInkAll(); drawNew(); refreshStats(); }
});

/* ------------------------------------------------ 拖放 */
let dragCnt = 0;
window.addEventListener('dragenter', e => { e.preventDefault(); dragCnt++; $('drop').style.display = 'flex'; });
window.addEventListener('dragleave', e => { e.preventDefault(); if (--dragCnt <= 0) { dragCnt = 0; $('drop').style.display = 'none'; } });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => {
  e.preventDefault(); dragCnt = 0; $('drop').style.display = 'none';
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (/\.(bin|rom|img)$/i.test(f.name)) readFwFile(f);
  else if (/^image\//.test(f.type)) {
    const im = new Image();
    im.onload = () => { S.imgEl = im; $('imgName').textContent = f.name.slice(0, 22); tab('img'); genImage(); };
    im.src = URL.createObjectURL(f);
  } else toast(__t('请拖入 .bin 固件或图片'));
});

/* ------------------------------------------------ 初始化 */
document.querySelector(`input[name=pol][value="1"]`).checked = true;
document.querySelectorAll('input[name=pol]').forEach(r => r.addEventListener('change', () => {
  S.polarity = +document.querySelector('input[name=pol]:checked').value;
  if (S.g) { drawOrig(); if (S.ink) refreshStats(); }
}));
if (S.server) {
  $('btnServerOpen').style.display = '';
  $('btnExit').style.display = '';
  $('btnExit').onclick = async () => {
    if (!confirm(__t('退出 RTD 开机 Logo 工作室？\n\n已写入的固件不受影响（备份文件也保留）。\n退出后本页面失效，关掉即可。'))) return;
    try { await fetch('/api/exit'); } catch (e) { }
    document.getElementById('modal').style.display = 'none';
    document.body.innerHTML = '<div style="padding:48px;font:15px/2 \'Microsoft YaHei\',sans-serif;color:#dbe4f0">' +
      '<h2 style="color:#4ea1ff;margin-bottom:12px">' + __t('程序已退出') + '</h2>' + __t('现在可以关闭这个页面了。') + '</div>';
  };
  // 关页 / 刷新 → 通知后台收工（25 秒内若没有新请求，后台自动退出）
  window.addEventListener('beforeunload', () => { try { navigator.sendBeacon('/api/bye'); } catch (e) { } });
}
infoRows([['状态', '请先打开固件文件（.bin）'], ['实测', 'RTD2270CLW（= RTD2270C，与 RTD2270 固件不通用）· 板 RTD270CLW-R10.1，其他型号请自行测试 · 支持：静态 MAP 型 / 串引用型 / OSD 记录流型开机 logo']]);

/* ------------------------------------------------ 语言切换（中 / EN / RU） */
(function initLang() {
  const sel = $('selLang');
  const saved = (window.__I18N && window.__I18N.lang) || 'zh';
  sel.value = saved;
  if (saved !== 'zh') window.__I18N.apply(saved);        // 非中文：静态 DOM 立即翻译
  sel.addEventListener('change', () => window.__I18N.apply(sel.value));
  // 语言切换后重渲染动态区域（信息表 / 统计 / 元信息 / 画布提示）
  window.addEventListener('rtdlang', () => {
    if (infoRows.last) infoRows(infoRows.last);
    if (S.cvHint) $('cvHint').textContent = __tf(S.cvHint.tpl, S.cvHint.vars);
    if (S.g) { drawOrig(); refreshStats(); }
  });
})();
