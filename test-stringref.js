/* HY 族（字符串引用型）引擎级验证：识别 → 往返 → 自定义写入 → 磁盘级重识别渲染比对 */
const fs = require('fs'), E = require('./rtd-logo-engine.js');
const files = [
  ['标定版', 'C:/液晶显示器_标定版.bin'],
  ['原版', 'C:/液晶显示器'],
  ['HYUNDAI改', 'C:/液晶显示器_HYUNDAI_logo修改版.bin'],
  ['AOC改', 'C:/液晶显示器_AOC_logo修改版.bin']
];
for (const [name, fp] of files) {
  const buf = new Uint8Array(fs.readFileSync(fp));
  const det = E.detect(buf);
  const g = det.groups[0];
  console.log('=== ' + name + ' === method=' + det.method + ' groups=' + det.groups.length);
  if (!g) { console.log('  未识别'); continue; }
  console.log('  font=0x' + g.fontOff.toString(16), 'NG=' + g.glyphCount,
    'str@0x' + (g.strOff ?? -1).toString(16), 'str=[' + (g.str || []).join(',') + ']',
    g.inkRatio != null ? 'ink=' + (g.inkRatio * 100).toFixed(1) + '%' : '',
    'budget=' + (g.blockEnd - g.fontOff) + 'B');
  if (det.method !== 'stringref') continue;
  const tw = g.cols * 12, th = 18;
  // 原图 ink
  const ink2 = new Uint8Array(tw * th);
  for (let c = 0; c < g.cols; c++) {
    const b = E.bitsOf(g.stored, g.str[c]);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 12; x++)
      ink2[y * tw + c * 12 + x] = b[y * 12 + x] === (g.polarity === 0 ? 0 : 1) ? 1 : 0;
  }
  // 往返
  const built = E.buildFromBitmap(ink2, 1, g.cols, { invert: g.polarity === 0 });
  const comp = E.composeStringFont(built, g.str, g.stored);
  const blk = E.encodeBlock(comp.stored);
  const limit = g.blockEnd - g.fontOff;
  console.log('  往返: uniq=' + built.unique, 'comp=' + blk.length + 'B / limit ' + limit + 'B ' + (blk.length <= limit ? 'OK' : 'OVER'));
  // 渲染一致性（compose 后 stored 应与原图逐像素一致）
  const r1 = E.render(comp.map, 1, g.cols, comp.stored, { polarity: g.polarity });
  let d0 = 0;
  for (let i = 0; i < r1.data.length; i += 4) {
    const on = ink2[((i / 4 / r1.w) | 0) * tw + ((i / 4) % r1.w)];
    if (r1.data[i] !== (on ? 255 : 0)) d0++;
  }
  console.log('  compose 后渲染 vs 原 logo: diff=' + d0 + '/' + (tw * th));
  // 自定义（反相）写入
  const inv = new Uint8Array(tw * th); for (let i = 0; i < inv.length; i++) inv[i] = ink2[i] ^ 1;
  const b2 = E.buildFromBitmap(inv, 1, g.cols, { invert: g.polarity === 0 });
  const c2 = E.composeStringFont(b2, g.str, g.stored);
  const p = E.applyPatch({
    buf, mapOff: g.mapOff, rows: 1, cols: g.cols, fontOff: g.fontOff, fontEnd: g.blockEnd,
    polarity: g.polarity, map: c2.map, stored: c2.stored, allowRelocate: true,
    bankFrom: g.fontOff & ~0x7fff, bankTo: (g.fontOff & ~0x7fff) + 0x8000
  });
  console.log('  写入: ok=' + p.ok + (p.ok ? ' placed=0x' + p.report.placedAt.toString(16) + ' reloc=' + p.report.relocated +
    ' verify=' + p.report.verified + ' loaders=' + p.report.loaderPatched.length : ' reason=' + p.reason + ' need=' + (p.need || '') + '/' + (p.limit || '')));
  if (p.ok) {
    const det2 = E.detect(p.bytes); const g2 = det2.groups[0];
    if (!g2 || det2.method !== 'stringref') { console.log('  重识别失败: ' + det2.method); continue; }
    const img2 = E.render(Uint8Array.from(g2.str), 1, g2.cols, g2.stored, { polarity: g2.polarity });
    let diff = 0;
    for (let i = 0; i < img2.data.length; i += 4) {
      const on = inv[((i / 4 / img2.w) | 0) * tw + ((i / 4) % img2.w)];
      if (img2.data[i] !== (on ? 255 : 0)) diff++;
    }
    console.log('  重识别+渲染 vs 目标: diff=' + diff + '/' + (tw * th) + (diff === 0 ? '  ✓ 完全一致' : ''));
  }
}
