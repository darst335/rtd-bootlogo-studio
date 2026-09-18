/* mapgrid 路线验证：四固件 detect + 现代固件写入回环 */
const path = require('path');
const fs = require('fs');
const E = require('./rtd-logo-engine.js');

const files = {
  hy: 'C:/液晶显示器.bin',
  mazon: 'D:/Users/Administrator/Downloads/www.chinafix.com迅维网_RTD270CLW_R10.1-1920X1080  MAZON 4.BIN',
  bubalus: 'D:/Users/Administrator/Downloads/www.chinafix.com迅维网_RTD_EXT_SPI #ISP_BUBALUS E2215.BIN',
  lehua: 'C:/原装乐华RTD2270CLW程序,老款的RTD2270L板子不能用。/LM190WH1_A1_WXGA_5V_RT2270C_NA_5KEY_SCH_R19600_140421_0xEAFA_R19600_20140421.bin'
};
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } };

// 1) 各固件路线
const det = {};
for (const [k, f] of Object.entries(files)) {
  const buf = fs.readFileSync(f);
  det[k] = E.detect(buf);
  const g = det[k].groups[0];
  console.log(k + ': method=' + det[k].method + (g ? ' rows=' + g.rows + ' cols=' + g.cols + ' font=0x' + g.fontOff.toString(16) + ' map=0x' + (g.mapOff || 0).toString(16) + ' NG=' + g.glyphCount : ''));
}
ok('现代固件走 mapgrid 路线', det.hy.method === 'mapgrid');
ok('现代固件 7×72 @0x1302E', det.hy.groups[0].rows === 7 && det.hy.cols === undefined && det.hy.groups[0].cols === 72 && det.hy.groups[0].mapOff === 0x1302e);
ok('现代固件字库 0x23000', det.hy.groups[0].fontOff === 0x23000);
ok('MAZON 仍走 recordstream', det.mazon.method === 'recordstream');
ok('BUBALUS 仍走 recordstream', det.bubalus.method === 'recordstream');
ok('乐华仍走 code/adjacent', ['code', 'adjacent'].includes(det.lehua.method));

// 2) 现代固件写入回环：改画布下半部为新图案 → buildFromBitmap → applyPatch → 重识别比对
const buf0 = fs.readFileSync(files.hy);
const g = det.hy.groups[0];
const ow = g.cols * 12, oh = g.rows * 18;
// 原墨迹
const ink0 = new Uint8Array(oh * ow);
const mapOrig = buf0.subarray(g.mapOff, g.mapOff + g.mapLen);
for (let r = 0; r < g.rows; r++) for (let y = 0; y < 18; y++) for (let c = 0; c < g.cols; c++) for (let x = 0; x < 12; x++) {
  const b = E.bitsOf(g.stored, mapOrig[r * g.cols + c]);
  ink0[(r * 18 + y) * ow + c * 12 + x] = b[y * 12 + x] === 1 ? 1 : 0;
}
// 设计新画面：右半 40% 清空（减少瓦片数，确保原地放得下），左侧保留原 logo
const ink = ink0.slice();
for (let y = 0; y < oh; y++) for (let x = Math.floor(ow * 0.6); x < ow; x++) ink[y * ow + x] = 0;
const built = E.buildFromBitmap(ink, g.rows, g.cols, { invert: g.polarity === 0, snapBlank: 0 });
ok('buildFromBitmap 成功 unique=' + built.unique, built.ok);
ok('唯一字模 ≤ 255', built.unique <= 255);
const res = E.applyPatch({
  buf: buf0, mapOff: g.mapOff, rows: g.rows, cols: g.cols, fontOff: g.fontOff,
  fontEnd: g.blockEnd, polarity: g.polarity,
  map: built.map, stored: built.stored, allowRelocate: false
});
ok('applyPatch 原地写入 OK @0x' + (res.report ? res.report.placedAt.toString(16) : '?') +
  (res.report ? ' ' + res.report.blockBytes + 'B（限 ' + res.report.limit + 'B）' : ' reason=' + res.reason), res.ok);
if (res.ok) {
  // 重识别 + 逐像素比对
  const det2 = E.detect(res.bytes);
  ok('补丁固件重识别仍为 mapgrid', det2.method === 'mapgrid');
  const g2 = det2.groups[0];
  const imgB = E.render(res.bytes.subarray(g2.mapOff, g2.mapOff + g2.mapLen), g2.rows, g2.cols, g2.stored, { polarity: g2.polarity });
  // 与「设计画面」逐像素比对（不是与原画面）
  let diff = 0;
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const want = ink[y * ow + x] === 1;
    const got = imgB.data[(y * imgB.w + x) * 4] > 127;
    if (want !== got) diff++;
  }
  ok('设计画面与回读逐像素一致（差异 ' + diff + '）', diff === 0);
  // 其余字节不变量：除 map 区与字库区外全部相同
  let changed = 0;
  for (let i = 0; i < buf0.length; i++) if (buf0[i] !== res.bytes[i]) changed++;
  const inFont = i => i >= g.fontOff && i < g.blockEnd;
  const inMap = i => i >= g.mapOff && i < g.mapOff + g.mapLen;
  let outside = 0;
  for (let i = 0; i < buf0.length; i++) if (buf0[i] !== res.bytes[i] && !inFont(i) && !inMap(i)) outside++;
  ok('改动只落在 MAP 表 + 字库块（区外改动 ' + outside + ' B）', outside === 0);
  // 串引用 ENVISION 字库未受影响
  ok('ENVISION 字库块 0x2396b 保持原样', (() => {
    for (let i = 0x2396b; i < 0x23a8f; i++) if (buf0[i] !== res.bytes[i]) return false; return true;
  })());
}
// 3) 原样往返：不改画面直接重建 → 渲染应与原 logo 逐位一致
const builtId = E.buildFromBitmap(ink0, g.rows, g.cols, { invert: g.polarity === 0, snapBlank: 0 });
const resId = E.applyPatch({ buf: buf0, mapOff: g.mapOff, rows: g.rows, cols: g.cols, fontOff: g.fontOff, fontEnd: g.blockEnd, polarity: g.polarity, map: builtId.map, stored: builtId.stored, allowRelocate: false });
if (resId.ok) {
  const det3 = E.detect(resId.bytes);
  const g3 = det3.groups[0];
  const imgA = E.render(buf0.subarray(g.mapOff, g.mapOff + g.mapLen), g.rows, g.cols, g.stored, { polarity: g.polarity });
  const imgC = E.render(resId.bytes.subarray(g3.mapOff, g3.mapOff + g3.mapLen), g3.rows, g3.cols, g3.stored, { polarity: g3.polarity });
  let diff = 0;
  for (let i = 0; i < imgA.data.length; i += 4) if ((imgA.data[i] > 127) !== (imgC.data[i] > 127)) diff++;
  ok('原样重建往返一致（差异 ' + diff + '）', diff === 0);
} else ok('原样重建往返（applyPatch 失败 ' + resId.reason + '）', false);

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
