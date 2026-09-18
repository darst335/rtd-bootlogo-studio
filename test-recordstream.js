/* 记录流型（MAZON/RTD270 族）引擎测试
 * 1) detect 识别 MAZON 固件 → 记录流 0x20575 / 字库 0x3004E(189字模)
 * 2) 引擎渲染 与 已验证的忠实模拟器（render/mazon_logo_check.js 语义）逐像素对照
 * 3) 生成新 logo → applyRecordStream 写回 → 重新 detect 校验 + 区域外字节不变
 * 4) 回归：乐华(路线A)、标定版(路线C) 不被记录流路线抢走
 */
'use strict';
const fs = require('fs'), path = require('path');
const RTDLogo = require('./rtd-logo-engine.js');

const MAZON = 'D:/Users/Administrator/Downloads/www.chinafix.com迅维网_RTD270CLW_R10.1-1920X1080  MAZON 4.BIN';
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

// ---------- 独立参考实现（render/mazon_logo_check.js 的语义转录，已与实机照片对齐） ----------
function referenceDisp(buf) {
  const CODES = ['0', '100', '1010', '1011', '1100', '11010', '11011', '11100', '111010', '111011', '111100', '111101', '1111100', '1111101', '1111110', '11111110'];
  function decodeAt(off) {
    const seen = new Set();
    for (let i = 0; i < 8; i++) { seen.add(buf[off + i] >> 4); seen.add(buf[off + i] & 0xf); }
    if (seen.size !== 16) return null;
    const num = (buf[off + 8] << 8) | buf[off + 9];
    const values = [];
    for (let i = 0; i < 8; i++) values.push(buf[off + i] >> 4, buf[off + i] & 0xf);
    let bitPos = 0, code = '', nib = [];
    while (bitPos < num * 8) {
      const byte = buf[off + 10 + (bitPos >> 3)];
      const bit = (byte >> (bitPos & 7)) & 1;
      bitPos++; code += bit;
      if (code === '11111111') break;
      const idx = CODES.indexOf(code);
      if (idx >= 0) { nib.push(values[idx]); code = ''; }
      else if (code.length > 8) return null;
    }
    return nib;
  }
  const nib = decodeAt(0x3004e);
  const NG = (nib.length >> 1) / 27;
  const N = 0x400, BASE = 9, disp = new Int32Array(N).fill(-1), colr = new Int32Array(N).fill(-1);
  let addr = 0, plane = 0, prev = 0, pos = 0x20575;
  function wr(v) {
    const idx = addr - BASE;
    if (idx >= 0 && idx < N) { if (plane & 0x40) disp[addr] = v; if (plane & 0x80) colr[addr] = v; }
    addr++;
  }
  addr = ((buf[pos] & 0x0f) << 8) | buf[pos + 1];
  plane = buf[pos] & 0xf0;
  pos += 2;
  for (let guard = 0; guard++ < 100000;) {
    const b = buf[pos];
    if (b === 0xfc) {
      const n = buf[pos + 1];
      if (n > 3) break;
      const t = 0xfc + n;
      if (buf[pos + 2] === 0xfd) { for (let k = 0; k < buf[pos + 3]; k++) wr(t); pos += 4; }
      else { wr(t); pos += 2; }
      prev = t;
    } else if (b === 0xfd) {
      const n = buf[pos + 1];
      for (let k = 0; k < n - 1; k++) wr(prev);
      pos += 2;
    } else if (b === 0xfe) {
      pos++;
      if (buf[pos] === 0xff) break;
      addr = ((buf[pos] & 0x0f) << 8) | buf[pos + 1];
      plane = buf[pos] & 0xf0;
      pos += 2;
    } else if (b === 0xff) break;
    else { wr(b); prev = b; pos++; }
  }
  return { disp, colr, NG };
}

// ---------- 主流程 ----------
const fw = new Uint8Array(fs.readFileSync(MAZON));
console.log('固件: MAZON 4.BIN (' + fw.length + ' B)');

console.time('  detect 耗时');
const det = RTDLogo.detect(fw);
console.timeEnd('  detect 耗时');
const g = det.groups[0];

console.log('[1] 识别');
ok(det.method === 'recordstream' && g && g.type === 'recordstream', '识别为记录流型 (method=' + det.method + ')');
ok(g.streamOff === 0x20575, '记录流地址 0x20575 (实际 ' + '0x' + g.streamOff.toString(16) + ')');
ok(g.fontOff === 0x3004e && g.glyphCount === 189, '字库 0x3004E · 189 字模 (实际 0x' + g.fontOff.toString(16) + ' · ' + g.glyphCount + ')');
ok(g.polarity === 0, '极性 bit=0 墨迹 (实际 ' + g.polarity + ')');
console.log('    流预算 ' + (g.streamEnd - g.streamOff) + ' B · 画布 ' + g.rows + '×' + g.cols + ' · 主色 inkColor=0x' + g.inkColor.toString(16) + ' · 墨占比 ' + g.inkRatio.toFixed(3));
// —— 颜色平面 / 调色板（amazon 笑脸的黄色就在颜色平面里）——
const hexc = c => '#' + c.map(b => b.toString(16).padStart(2, '0')).join('');
ok(!!g.palette && g.palette.length === 16, '定位到 16 色调色板 @0x' + (g.paletteOff || 0).toString(16));
ok(!!g.palette && g.palette[8][0] === 255 && g.palette[8][1] === 255 && g.palette[8][2] === 255,
  '调色板 idx8 = 白色（amazon 文字）实际 ' + (g.palette ? hexc(g.palette[8]) : '-'));
ok(!!g.palette && g.palette[5][0] > 200 && g.palette[5][1] > 100 && g.palette[5][2] < 60,
  '调色板 idx5 = 金黄（amazon 笑脸）实际 ' + (g.palette ? hexc(g.palette[5]) : '-'));
{
  const used = new Set(g.colr.filter(v => v >= 0));
  ok(used.has(5) && used.has(8), '颜色平面用到 idx5 + idx8（双色 logo，实际 ' + [...used].join(',') + '）');
  const imgC = RTDLogo.renderCells(g.disp, g.rows, g.cols, g.stored, { polarity: g.polarity, palette: g.palette, colr: g.colr });
  const seen = new Set();
  for (let i = 0; i < imgC.w * imgC.h; i++) seen.add(imgC.data[i * 4] + ',' + imgC.data[i * 4 + 1] + ',' + imgC.data[i * 4 + 2]);
  ok(seen.has('255,255,255') && seen.has('246,182,0'), '彩色渲染同时出现白色与金色像素（实际 ' + [...seen].slice(0, 6).join(' | ') + '）');
  fs.writeFileSync(path.join(__dirname, 'render_mazon_color.png'), pngSave(imgC));
  console.log('    彩色原图 → logo-studio/render_mazon_color.png');
}

console.log('[2] 与忠实参考渲染逐像素对照');
const ref = referenceDisp(fw);
// 参考墨迹掩码（bit=0 墨，0/越界=空）——裁剪到引擎画布（base=g.base, osdw=g.osdw）
const inkVal = 0;
const sw = new Uint8Array(ref.NG * 27);
for (let gg = 0; gg < ref.NG; gg++) for (let w = 0; w < 9; w++) {
  const o = gg * 27 + w * 3, s = gg * 27;
  sw[o] = 0;
}
// 直接用引擎字库（两者解码同一块），只对模拟结果做交叉验证
const rows = g.rows, cols = g.cols, base = g.base;
let mismatch = 0, inkTotal = 0;
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const eng = g.disp[r * cols + c];
  const rv = ref.disp[base + r * cols + c];
  const refCell = (rv >= 0 && rv > 0 && rv < ref.NG) ? rv : 0;
  if ((eng <= 0 || eng >= g.glyphCount ? 0 : eng) !== refCell) mismatch++;
}
ok(mismatch === 0, 'disp 网格逐格一致 (' + rows * cols + ' 格, 不匹配 ' + mismatch + ')');
// 像素级：引擎 renderCells 的墨迹 vs 参考位 (bit=0)
const img = RTDLogo.renderCells(Int32Array.from(g.disp), rows, cols, g.stored, { polarity: 0 });
let pm = 0;
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const gi = ref.disp[base + r * cols + c];
  const bits = (gi > 0 && gi < ref.NG) ? RTDLogo.bitsOf(g.stored, gi) : null;
  for (let y = 0; y < 18; y++) for (let x = 0; x < 12; x++) {
    const want = bits ? (bits[y * 12 + x] === inkVal ? 1 : 0) : 0;
    const got = img.data[(((r * 18 + y) * img.w) + c * 12 + x) * 4] === 255 ? 1 : 0; // fg=白
    if (want !== got) pm++;
    inkTotal += want;
  }
}
ok(pm === 0, '墨迹像素逐位一致 (差异 ' + pm + ' / 墨像素 ' + inkTotal + ')');

console.log('[3] 生成新 logo 并写回');
// 新画面：画布中央画一个实心边框 + 横条（确定性图案）
const pat = new Uint8Array(rows * 18 * cols * 12);
{
  const W = cols * 12, H = rows * 18;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inBox = y >= 20 && y < H - 20 && x >= 40 && x < W - 40;
    const border = inBox && (y === 20 || y === H - 21 || x === 40 || x === W - 41);
    const bar = y >= Math.floor(H / 2) - 8 && y < Math.floor(H / 2) + 8 && x >= 90 && x < W - 90;
    if (border || bar) pat[y * W + x] = 1;
  }
}
const nb = RTDLogo.buildFromBitmap(pat, rows, cols, { invert: g.polarity === 0 });
ok(nb.ok, '新位图构建成功 · 唯一字模 ' + nb.unique + '/255');
const res = RTDLogo.applyRecordStream({
  buf: fw, origDisp: g.disp, origStored: g.stored, built: nb, polarity: g.polarity,
  rows, cols, color: g.inkColor, base: g.base, osdw: g.osdw,
  streamOff: g.streamOff, streamEnd: g.streamEnd, fontOff: g.fontOff
});
ok(res.ok, '写回成功 · 数据流 ' + res.report.streamBytes + ' B/' + res.report.streamLimit + ' B · 字库 ' + res.report.fontBytes + ' B/' + res.report.fontLimit + ' B');
ok(res.report.verified, '回读模拟校验通过（流逐格 + 字库逐字节）');
// 区域外字节不变
let outside = 0;
for (let i = 0; i < fw.length; i++) if ((i < g.streamOff || i >= g.streamEnd) && (i < g.fontOff || i >= g.fontOff + res.report.fontLimit) && res.bytes[i] !== fw[i]) outside++;
ok(outside === 0, '流区与字库区之外字节原样保留 (改动 ' + outside + ')');
// 补丁固件渲染 == 设计图案（逐像素）
const det2 = RTDLogo.detect(res.bytes);
const g2 = det2.groups[0];
ok(det2.method === 'recordstream' && g2 && g2.streamOff === g.streamOff, '补丁固件重新识别 OK (0x' + (g2 ? g2.streamOff.toString(16) : '?') + ')');
const img2 = RTDLogo.renderCells(Int32Array.from(g2.disp), g2.rows, g2.cols, g2.stored, { polarity: g2.polarity });
let pm2 = 0;
for (let i = 0; i < pat.length; i++) {
  const o = i * 4;
  const got = img2.data[o] === 255 ? 1 : 0;
  if (got !== pat[i]) pm2++;
}
ok(pm2 === 0, '补丁固件渲染与设计图案逐像素一致 (差异 ' + pm2 + '/' + pat.length + ')');
fs.writeFileSync(path.join(__dirname, 'render_recordstream_patch.png'), pngSave(img2));
console.log('    补丁预览 → logo-studio/render_recordstream_patch.png');

console.log('[3b] 收缩模式：复杂图案超出原地字库预算 → 字库收缩 + 动画重映射');
// 6×9 块状棋盘 + 斜条纹 → 唯一字模几十个（超过 15 触发方案 B，但不超 255）
const pat2 = new Uint8Array(rows * 18 * cols * 12);
{
  const W = cols * 12, H = rows * 18;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const blk = (Math.floor(x / 6) + Math.floor(y / 9)) % 2;
    const diag = ((x + y * 3) % 23) < 4 ? 1 : 0;
    pat2[y * W + x] = (blk ^ diag) ? 1 : 0;
  }
}
const nb2 = RTDLogo.buildFromBitmap(pat2, rows, cols, { invert: g.polarity === 0 });
ok(nb2.ok, '复杂位图构建成功 · 唯一字模 ' + nb2.unique);
const planB = RTDLogo.planRecordStream({
  buf: fw, origDisp: g.disp, origStored: g.stored, built: nb2, polarity: g.polarity,
  rows, cols, color: g.inkColor, base: g.base, osdw: g.osdw,
  streamOff: g.streamOff, streamEnd: g.streamEnd, fontOff: g.fontOff
});
ok(planB.ok, 'plan 成功 · mode=' + planB.mode + ' · 字库 ' + planB.fontBytes + ' B/' + planB.fontLimit + ' B' + (planB.animPatches ? ' · 动画重映射 ' + planB.animPatches.length + ' 处' : ''));
const resB = RTDLogo.applyRecordStream({
  buf: fw, origDisp: g.disp, origStored: g.stored, built: nb2, polarity: g.polarity,
  rows, cols, color: g.inkColor, base: g.base, osdw: g.osdw,
  streamOff: g.streamOff, streamEnd: g.streamEnd, fontOff: g.fontOff
});
ok(resB.ok && resB.report.verified, '收缩模式写回 + 回读校验通过');
ok(!resB.ok || resB.report.animPatched > 0, '动画字模值重映射 ' + (resB.report ? resB.report.animPatched : 0) + ' 处');
const detB = RTDLogo.detect(resB.bytes);
const gB = detB.groups[0];
ok(detB.method === 'recordstream' && gB && gB.streamOff === g.streamOff, '补丁固件重新识别 OK');
// 棋盘图案 ~50% 密度属极性歧义（少数派原则两边打平），两种极性渲染任一吻合即算数据往返正确
let pmB = -1, imgB = null;
for (const pol of [gB.polarity, 1 - gB.polarity]) {
  const im = RTDLogo.renderCells(Int32Array.from(gB.disp), gB.rows, gB.cols, gB.stored, { polarity: pol });
  let d = 0;
  for (let i = 0; i < pat2.length; i++) if ((im.data[i * 4] === 255 ? 1 : 0) !== pat2[i]) d++;
  if (pmB < 0 || d < pmB) { pmB = d; imgB = im; }
}
ok(pmB === 0, '收缩模式补丁渲染与设计图案逐像素一致 (最小差异 ' + pmB + ')');
// 动画组在补丁后仍可解释且写入的字模有形状（不再引用被删字模）
let animBad = 0;
const tail = RTDLogo.simulateStream(resB.bytes, 0x20770, true);
ok(!!(tail && tail.ok), '动画组补丁后重模拟 OK (writes=' + (tail ? tail.writes.length : 0) + ')');
if (tail) {
  const NGB = Math.floor(gB.stored.length / 27);
  for (const w of tail.writes) if (w.v >= NGB) animBad++;
  ok(animBad === 0, '动画引用字模均在收缩后字库范围内 (越界 ' + animBad + ')');
}
fs.writeFileSync(path.join(__dirname, 'render_recordstream_patch2.png'), pngSave(imgB));

console.log('[4] 回归：其他固件路线不被抢占');
const CASES = [
  ['C:/原装乐华RTD2270CLW程序,老款的RTD2270L板子不能用。/LM190WH1_A1_WXGA_5V_RT2270C_NA_5KEY_SCH_R19600_140421_0xEAFA_R19600_20140421.bin', 'code'],
  ['C:/液晶显示器_标定版.bin', 'stringref'],
  ['C:/液晶显示器_HYUNDAI_logo修改版.bin', 'stringref']
];
for (const [p, want] of CASES) {
  if (!fs.existsSync(p)) { console.log('  - 跳过（不存在）: ' + p); continue; }
  const d = RTDLogo.detect(new Uint8Array(fs.readFileSync(p)));
  ok(d.method === want, path.basename(p).slice(0, 24) + ' → ' + d.method + ' (期望 ' + want + ')');
}

console.log('[5] 回归：BUBALUS 极性与全背景一致（用户实机反馈修复）');
const BUBALUS = 'D:/Users/Administrator/Downloads/www.chinafix.com迅维网_RTD_EXT_SPI #ISP_BUBALUS E2215.BIN';
if (fs.existsSync(BUBALUS)) {
  const dB = RTDLogo.detect(new Uint8Array(fs.readFileSync(BUBALUS)));
  const gB0 = dB.groups[0];
  ok(dB.method === 'recordstream', 'BUBALUS → recordstream');
  ok(gB0.polarity === 1, '极性 bit=1 墨迹·白字黑底 (实际 ' + gB0.polarity + ')');
  const imB = RTDLogo.renderCells(gB0.disp, gB0.rows, gB0.cols, gB0.stored, { polarity: gB0.polarity });
  // 全画布逐像素二值化后统计连通一致性：暗底像素应占多数且白墨迹连成字（非补丁状）
  let dark = 0, lite = 0;
  for (let i = 0; i < imB.w * imB.h; i++) (imB.data[i * 4] > 128 ? lite++ : dark++);
  ok(dark > lite, '背景为暗色且占多数 (暗 ' + dark + ' / 亮 ' + lite + ')');
  ok(imB.inkRatio > 0.05 && imB.inkRatio < 0.5, '墨迹为少数派 (' + imB.inkRatio.toFixed(3) + ')');
} else console.log('  - 跳过（不存在）: ' + BUBALUS);

function pngSave(img) {
  // 极简 PNG (RGB) 输出，仅用于人工核对预览
  const zlib = require('zlib');
  const raw = Buffer.alloc((img.w * 3 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 3 + 1)] = 0;
    for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4, o = y * (img.w * 3 + 1) + 1 + x * 3;
      raw[o] = img.data[i]; raw[o + 1] = img.data[i + 1]; raw[o + 2] = img.data[i + 2];
    }
  }
  function chunk(t, d) {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const tb = Buffer.from(t, 'ascii');
    const cb = Buffer.concat([tb, d]);
    let crc = 0xffffffff;
    for (const b of cb) { crc ^= b; for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
    crc = (crc ^ 0xffffffff) >>> 0;
    const c = Buffer.alloc(4); c.writeUInt32BE(crc);
    return Buffer.concat([l, tb, d, c]);
  }
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(img.w, 0); ih.writeUInt32BE(img.h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ih),
    chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

console.log('[6] 画布调整 + 逐格颜色（保留颜色模式）');
{
  // MAZON 8×51 → 10×51：放大画布 + 逐格调色板颜色，写回 → 重识别逐格比对 disp + colr
  const rows2 = 10, cols2 = g.cols;                       // base=9 → 9+510=519 ≤ 0x400
  const W = cols2 * 12, H = rows2 * 18;
  const pat3 = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const border = y < 8 || y >= H - 8 || x < 8 || x >= W - 8;
    const bar = y >= Math.floor(H / 2) - 6 && y < Math.floor(H / 2) + 6 && x >= 40 && x < W - 40;
    pat3[y * W + x] = (border || bar) ? 1 : 0;
  }
  const nb3 = RTDLogo.buildFromBitmap(pat3, rows2, cols2, { invert: g.polarity === 0 });
  ok(nb3.ok, '新画布位图构建成功 · 唯一字模 ' + nb3.unique);
  // 逐格颜色：墨迹格交替 idx5(金)/idx8(白)，空白格 idx8
  const colors3 = new Uint8Array(rows2 * cols2).fill(8);
  for (let r = 0; r < rows2; r++) for (let c = 0; c < cols2; c++) {
    const p0 = r * 18 * W + c * 12;
    let n = 0;
    for (let y = 0; y < 18; y++) for (let x = 0; x < 12; x++) if (pat3[p0 + y * W + x]) n++;
    if (n) colors3[r * cols2 + c] = (r + c) % 2 ? 5 : 8;
  }
  const spec3 = {
    buf: fw, origDisp: g.disp, origStored: g.stored, built: nb3, polarity: g.polarity,
    rows: rows2, cols: cols2, color: 8, base: g.base, osdw: cols2, fontOff: g.fontOff,
    streamOff: g.streamOff, streamEnd: g.streamEnd, colors: colors3
  };
  const plan3 = RTDLogo.planRecordStream(spec3);
  ok(plan3.ok, 'plan 成功 · mode=' + plan3.mode + ' · 流 ' + (plan3.stream ? plan3.stream.length : '-') + ' B');
  const res3 = RTDLogo.applyRecordStream(spec3);
  ok(res3.ok && res3.report.verified, '画布调整 + 逐格颜色写回 + 回读校验通过');
  const det3 = RTDLogo.detect(res3.bytes);
  const g3 = det3.groups[0];
  ok(det3.method === 'recordstream' && g3.rows === rows2 && g3.cols === cols2,
    '补丁固件重新识别 OK · 画布 ' + g3.rows + '×' + g3.cols);
  let dm = 0, cm2 = 0;
  for (let i = 0; i < rows2 * cols2; i++) {
    if ((g3.disp[i] || 0) !== (nb3.map[i] || 0)) dm++;
    if ((g3.colr[i] || 0) !== colors3[i]) cm2++;
  }
  ok(dm === 0, '重识别 disp 与设计逐格一致 (差异 ' + dm + ')');
  ok(cm2 === 0, '重识别颜色平面与设计逐格一致 (差异 ' + cm2 + ')');
  // 彩色渲染：金 + 白 + 暗底都出现
  const im3 = RTDLogo.renderCells(g3.disp, g3.rows, g3.cols, g3.stored, { polarity: g3.polarity, palette: g3.palette, colr: g3.colr });
  const seen3 = new Set();
  for (let i = 0; i < im3.w * im3.h; i++) seen3.add(im3.data[i * 4] + ',' + im3.data[i * 4 + 1] + ',' + im3.data[i * 4 + 2]);
  ok(seen3.has('246,182,0') && seen3.has('255,255,255'), '放大画布 + 彩色渲染同时出现金色与白色像素');
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
