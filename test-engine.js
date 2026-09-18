/* 引擎自测：识别 / 渲染 / 重建回写 / 往返一致性 */
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const E = require('./rtd-logo-engine.js');

const FW = process.argv[2];
const OUT = path.join(__dirname, 'test-out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// ---- PNG（RGB）写出 ----
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = rgba[i]; raw[o + 1] = rgba[i + 1]; raw[o + 2] = rgba[i + 2];
    }
  }
  const idat = zlib.deflateSync(raw);
  const sig = Buffer.from('89504e470d0a1a0a', 'hex');
  const tbl = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; tbl[n] = c >>> 0; }
  function chunk(t, d) {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const tb = Buffer.from(t, 'ascii'); const cb = Buffer.concat([tb, d]);
    let crc = 0xffffffff; for (const b of cb) crc = tbl[(crc ^ b) & 0xff] ^ (crc >>> 8); crc = (crc ^ 0xffffffff) >>> 0;
    const c = Buffer.alloc(4); c.writeUInt32BE(crc);
    return Buffer.concat([l, tb, d, c]);
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([sig, chunk('IHDR', ih), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
const savePng = (name, img) => fs.writeFileSync(path.join(OUT, name), png(img.w, img.h, img.data));

const buf = new Uint8Array(fs.readFileSync(FW));
const rpt = r => ({ placedAt: '0x' + r.placedAt.toString(16), relocated: r.relocated, blockBytes: r.blockBytes, limit: r.limit, verified: r.verified, loaderPatched: r.loaderPatched.map(x => '0x' + x.toString(16)), notes: r.notes });
console.log('=== 固件 ' + path.basename(FW) + '  ' + buf.length + ' 字节 ===\n');

// ============================================================ 1) 自动识别
const det = E.detect(buf);
console.log('[识别] 路线 =', det.method, ' 扫描到 VLC 块', det.blocks.length, '个');
console.log('[识别] 代码里的 logo 循环常量:', JSON.stringify(det.loops));
for (const g of det.groups) {
  console.log('[识别] 候选: method=' + g.method,
    'map=0x' + g.mapOff.toString(16), 'font=0x' + g.fontOff.toString(16),
    'grid=' + g.rows + 'x' + g.cols, 'glyphs=' + g.glyphCount,
    'comp=' + g.compBytes, 'maxIdx=' + g.maxIndex, 'polarity(bit1=墨)= ' + g.polarity);
}
if (!det.groups.length) { console.log('!! 未识别到 logo'); process.exit(1); }
const g = det.groups[0];
console.log('');

// ============================================================ 2) 渲染原 logo
const mapOrig = buf.subarray(g.mapOff, g.mapOff + g.mapLen);
const imgOrig = E.render(mapOrig, g.rows, g.cols, g.stored, { polarity: g.polarity, scale: 2 });
savePng('01_original.png', imgOrig);
console.log('[渲染] 原 logo → test-out/01_original.png  ' + imgOrig.w + 'x' + imgOrig.h + '  墨迹占比 ' + (imgOrig.inkRatio * 100).toFixed(1) + '%');

// ============================================================ 3) 原 logo 重建回写（往返测试）
function inkBitmapFrom(map, rows, cols, stored, polarity) {
  const tw = cols * 12;
  const bits = new Uint8Array(rows * 18 * tw);
  const inkVal = polarity === 0 ? 0 : 1;
  for (let r = 0; r < rows; r++) for (let y = 0; y < 18; y++) for (let c = 0; c < cols; c++) for (let x = 0; x < 12; x++) {
    const b = E.bitsOf(stored, map[r * cols + c]);
    bits[(r * 18 + y) * tw + c * 12 + x] = b[y * 12 + x] === inkVal ? 1 : 0;
  }
  return bits;
}
function renderFromPatch() { /* 保留占位 */ }

const inkOrig = inkBitmapFrom(mapOrig, g.rows, g.cols, g.stored, g.polarity);
const built1 = E.buildFromBitmap(inkOrig, g.rows, g.cols, { invert: g.polarity === 0, snapBlank: 0 });
console.log('[重建] 原 logo 位图 → 去重后唯一字模 ' + built1.unique + ' 个（原字库 ' + g.glyphCount + ' 个）');

const p1 = E.applyPatch({
  buf, mapOff: g.mapOff, rows: g.rows, cols: g.cols, fontOff: g.fontOff,
  polarity: g.polarity, map: built1.map, stored: built1.stored,
  allowRelocate: true, bankFrom: 0x10000, bankTo: 0x18000
});
console.log('[回写] ' + JSON.stringify(rpt(p1.report)));
if (!p1.ok) { console.log('!! 回写失败:', p1.reason); process.exit(1); }

// 从新固件重新解码 → 渲染 → 与原图逐像素比对
const nb = E.decodeBlock(p1.bytes, p1.report.placedAt);
const imgNew = E.render(p1.bytes.subarray(g.mapOff, g.mapOff + g.mapLen), g.rows, g.cols, nb.stored, { polarity: g.polarity, scale: 2 });
savePng('02_rebuilt.png', imgNew);
let diff = 0;
for (let i = 0; i < imgOrig.data.length; i += 4) if (imgOrig.data[i] !== imgNew.data[i]) diff++;
console.log('[往返] 重建固件渲染 vs 原图：差异像素 ' + diff + ' / ' + (imgOrig.data.length / 4) + (diff === 0 ? '  ✓ 完全一致' : '  ✗'));

// ============================================================ 4) 改内容：横向镜像 + 外框
const tw = g.cols * 12, th = g.rows * 18;
const ink2 = new Uint8Array(th * tw);
for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
  let v = inkOrig[y * tw + (tw - 1 - x)] || 0;                       // 镜像
  if (y < 2 || y >= th - 2 || x < 2 || x >= tw - 2) v = 1;           // 加外框
  ink2[y * tw + x] = v;
}
const built2 = E.buildFromBitmap(ink2, g.rows, g.cols, { invert: g.polarity === 0, snapBlank: 0 });
console.log('\n[改图] 镜像+边框 → 唯一字模 ' + built2.unique + ' 个');
const p2 = E.applyPatch({
  buf, mapOff: g.mapOff, rows: g.rows, cols: g.cols, fontOff: g.fontOff,
  polarity: g.polarity, map: built2.map, stored: built2.stored,
  allowRelocate: true, bankFrom: 0x10000, bankTo: 0x18000
});
console.log('[回写] ' + JSON.stringify(rpt(p2.report)));
if (!p2.ok) { console.log('!! 回写失败:', p2.reason); }
else {
  const nb2 = E.decodeBlock(p2.bytes, p2.report.placedAt);
  const chk = E.render(p2.bytes.subarray(g.mapOff, g.mapOff + g.mapLen), g.rows, g.cols, nb2.stored, { polarity: g.polarity, scale: 2 });
  savePng('03_custom.png', chk);
  // 逐像素对照目标位图（渲染是 2x 放大，坐标要除回去；取 R 通道）
  const SC = chk.w / tw;
  let d2 = 0;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    if (chk.data[((y * SC) * chk.w + x * SC) * 4] !== (ink2[y * tw + x] ? 255 : 0)) d2++;
  }
  console.log('[改图] 固件内实际渲染 vs 目标位图：差异像素 ' + d2 + (d2 === 0 ? '  ✓ 完全一致' : '  ✗'));
  fs.writeFileSync(path.join(OUT, '04_custom_patched.bin'), Buffer.from(p2.bytes));
}

// ============================================================ 5) 空间不足 → 重定位
const p3 = E.applyPatch({
  buf, mapOff: g.mapOff, rows: g.rows, cols: g.cols, fontOff: g.fontOff,
  fontEnd: g.fontOff + 300,                                          // 人为把窗口压到 300B
  polarity: g.polarity, map: built2.map, stored: built2.stored,
  allowRelocate: true, bankFrom: 0x10000, bankTo: 0x18000
});
console.log('\n[重定位] 窗口压到 300B: ok=' + p3.ok + ' ' + (p3.ok ? JSON.stringify({ placedAt: '0x' + p3.report.placedAt.toString(16), loaderPatched: p3.report.loaderPatched.map(x => '0x' + x.toString(16)) }) : p3.reason));
if (p3.ok) {
  const nb3 = E.decodeBlock(p3.bytes, p3.report.placedAt);
  const rr = E.render(p3.bytes.subarray(g.mapOff, g.mapOff + g.mapLen), g.rows, g.cols, nb3.stored, { polarity: g.polarity, scale: 2 });
  const SC3 = rr.w / tw;
  let d3 = 0;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    if (rr.data[((y * SC3) * rr.w + x * SC3) * 4] !== (ink2[y * tw + x] ? 255 : 0)) d3++;
  }
  savePng('05_relocated.png', rr);
  console.log('[重定位] 重定位后渲染 vs 目标位图：差异像素 ' + d3 + (d3 === 0 ? '  ✓ 完全一致' : '  ✗'));
  fs.writeFileSync('C:/Users/Administrator/WorkBuddy/2026-09-17-22-17-40/logo-studio/test-out/06_reloc_patched.bin', Buffer.from(p3.bytes));
}
console.log('\n=== 测试结束 ===');
