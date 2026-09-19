/* ============================================================================
 * RTD 开机 Logo 引擎  rtd-logo-engine.js
 * ----------------------------------------------------------------------------
 * 版权与归属（AUTHORSHIP NOTICE · 请勿移除）：
 *   本引擎由 darst335 委托并全程参与（提供真实固件样本、刷机实证、
 *   逐项验收测试），与 AI 结对开发完成 —— 非任何第三方代码的拷贝。
 *   全部格式结论来自对乐华 / HY / MAZON / BUBALUS 四块真实固件的
 *   独立逆向与实物刷机验证。发布、转载请保留本声明。
 *   项目代号：D335-RTDLOGO · 起始日期：2026-09-17
 *   EN: Original work by darst335 (D335-RTDLOGO), pair-programmed with an
 *   AI assistant — not copied from any third-party tool. Keep this notice.
 * ----------------------------------------------------------------------------
 * 实测基准（verified on）：RTD2270CLW 主控 · 驱动板版号 RTD270CLW-R10.1 20.1
 * 注意：RTD2270 与 RTD2270CLW 是两种不同芯片，固件不通用（「RTD2270C」
 * 即指 RTD2270CLW）；其他型号未测试，请自行验证
 * (RTD2270 and RTD2270CLW are two different chips with incompatible
 * firmware; "RTD2270C" = RTD2270CLW. Other models untested — self-test)
 * ----------------------------------------------------------------------------
 * 适用：RTD2270 / RTD2660 / RTD2662 系列 Scaler 固件的开机 logo 读写
 * 机制：logo = VLC 压缩字库（12x18 字模）+ 静态 MAP 表（字模索引网格）
 *       —— 即 SDK CDrawLogo 的 "静态 map" 实现（乐华/HY 等固件同型）
 *
 * 关键格式（逆向自三个独立固件 + 与 floppes/RTD266xFlash FontCoder 交叉验证）：
 *   1. VLC 块 = 8B nibble 置换表 + 2B 大端长度(字节数) + 压缩流
 *      16 个前缀码（见 VLC_CODES），EOB = 11111111，位序 LSB-first
 *      每个字模 27 字节 = 12x18 位图，每 3 字节**反序**存储（swap3）
 *   2. MAP 表 = rows*cols 字节，每字节 = 字库字模索引（0 = 空白常用）
 *      紧跟字库块之前，紧凑相接
 *   3. 字模位图的墨迹极性（bit=1 或 bit=0 为墨迹）**逐字库不同**，需实证
 * ==========================================================================*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RTDLogo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---- 归属签名（d335）——独立校验点，头注释被剥掉也能验明正身 ---- */
  const SIGNATURE = {
    project: 'D335-RTDLOGO',
    author: 'darst335',
    built: '2026-09-17/18',
    origin: 'original work: co-developed with AI (requirements & firmware experiments & acceptance testing by darst335)',
    claim: (typeof Buffer !== 'undefined') ? Buffer.from('ZGFyc3QzMzUg5Y6f5Yib5L2c5ZOB', 'base64').toString('utf8') : '本工具作者 darst335'
  };
  const verifyAuthor = () => {
    const s = SIGNATURE;
    return s.author === 'darst335'
      && s.project === 'D335-RTDLOGO'
      && (s.author.length + s.project.length) === 20;
  };

  // ---------------------------------------------------------------- VLC 编解码
  const VLC_CODES = ['0', '100', '1010', '1011', '1100', '11010', '11011', '11100',
    '111010', '111011', '111100', '111101', '1111100', '1111101', '1111110', '11111110'];

  /** 解码位于 off 的 VLC 块；失败返回 null */
  function decodeBlock(buf, off) {
    if (off < 0 || off + 10 > buf.length) return null;
    const seen = new Set();
    for (let i = 0; i < 8; i++) { seen.add(buf[off + i] >> 4); seen.add(buf[off + i] & 0xf); }
    if (seen.size !== 16) return null;                      // 表头必须是 0..15 的一个置换
    const num = (buf[off + 8] << 8) | buf[off + 9];
    if (num < 8 || off + 10 + num > buf.length) return null;
    const values = [];
    for (let i = 0; i < 8; i++) values.push(buf[off + i] >> 4, buf[off + i] & 0xf);
    let bitPos = 0, code = '', nib = [];
    while (bitPos < num * 8) {
      const byte = buf[off + 10 + (bitPos >> 3)];
      const bit = (byte >> (bitPos & 7)) & 1;
      bitPos++; code += bit;
      if (code === '11111111') break;                       // EOB
      const idx = VLC_CODES.indexOf(code);
      if (idx >= 0) { nib.push(values[idx]); code = ''; }
      else if (code.length > 8) return null;
    }
    const stored = new Uint8Array(nib.length >> 1);
    for (let i = 0; i < stored.length; i++) stored[i] = (nib[2 * i] << 4) | nib[2 * i + 1];
    return { off, num, stored, glyphCount: Math.floor(stored.length / 27), end: off + 10 + num };
  }

  /** 按指定 nibble→码字顺序编码 */
  function encodeWithOrder(stored, order) {
    const valueCode = new Array(16);
    order.forEach((v, i) => { valueCode[v] = i; });
    const header = new Uint8Array(8);
    for (let i = 0; i < 16; i++) {
      const v = order[i];
      if (i % 2 === 0) header[i >> 1] |= v << 4; else header[i >> 1] |= v;
    }
    const bits = [];
    const pushCode = c => { for (let i = 0; i < c.length; i++) bits.push(c.charCodeAt(i) - 48); };
    for (let i = 0; i < stored.length; i++) {
      pushCode(VLC_CODES[valueCode[stored[i] >> 4]]);
      pushCode(VLC_CODES[valueCode[stored[i] & 0xf]]);
    }
    pushCode('11111111');                                   // EOB
    while (bits.length % 8) bits.push(0);
    const num = bits.length / 8;
    const out = new Uint8Array(10 + num);
    out.set(header, 0);
    out[8] = num >> 8; out[9] = num & 0xff;
    for (let i = 0; i < bits.length; i++) if (bits[i]) out[10 + (i >> 3)] |= 1 << (i & 7);
    return out;
  }

  /**
   * 将 27N 字节字库编码为 VLC 块（与硬件加载器格式一致，已在实机固件上验证）
   * 频率相同的 nibble 有多种排法，逐个尝试取最短结果（通常能省几十字节）。
   */
  function encodeBlock(stored) {
    const freq = new Array(16).fill(0);
    for (let i = 0; i < stored.length; i++) { freq[stored[i] >> 4]++; freq[stored[i] & 0xf]++; }
    const base = []; for (let i = 0; i < 16; i++) base.push(i);
    const variants = [
      base.slice().sort((a, b) => freq[b] - freq[a] || a - b),
      base.slice().sort((a, b) => freq[b] - freq[a] || b - a)
    ];
    let best = null;
    for (const o of variants) { const e = encodeWithOrder(stored, o); if (!best || e.length < best.length) best = e; }
    return best;
  }

  /** 全镜像扫描 VLC 块 */
  function scanBlocks(buf, minBytes) {
    minBytes = minBytes == null ? 200 : minBytes;
    const out = [];
    for (let off = 0; off + 10 < buf.length - 32; off++) {
      const d = decodeBlock(buf, off);
      if (!d) continue;
      if (d.stored.length < minBytes) continue;
      out.push(d);
      off += 8;                                             // 允许紧密相邻块
    }
    return out;
  }

  // ------------------------------------------------------------- 字模位图工具
  /**
   * 取第 gi 个字模的 216 位（1 = 存储位为 1）
   * 注意：字库中每个字模的 27 字节是"每 3 字节反序"存储的（swap3），
   *       必须先还原，否则图案会整体错位（踩过的坑）。
   */
  function bitsOf(stored, gi) {
    const bits = new Uint8Array(216);
    const base = gi * 27;
    const lg = new Uint8Array(27);
    for (let o = 0; o < 27; o += 3) { lg[o] = stored[base + o + 2]; lg[o + 1] = stored[base + o + 1]; lg[o + 2] = stored[base + o]; }
    for (let i = 0; i < 216; i++) bits[i] = (lg[i >> 3] >> (7 - (i & 7))) & 1;
    return bits;
  }
  /** 216 位 → 27 字节物理存储（3 字节反序） */
  function storeBits(bits) {
    const logical = new Uint8Array(27);
    for (let i = 0; i < 216; i++) if (bits[i]) logical[i >> 3] |= 0x80 >> (i & 7);
    const phys = new Uint8Array(27);
    for (let o = 0; o < 27; o += 3) { phys[o] = logical[o + 2]; phys[o + 1] = logical[o + 1]; phys[o + 2] = logical[o]; }
    return phys;
  }
  function invertBits(bits) { const o = new Uint8Array(216); for (let i = 0; i < 216; i++) o[i] = bits[i] ^ 1; return o; }

  // ------------------------------------------------------------------- 渲染器
  /**
   * @param map       Uint8Array rows*cols 字模索引
   * @param stored    Uint8Array 字库
   * @param opts      {polarity:1|0(1 表示 bit=1 是墨迹), fg:[r,g,b], bg:[r,g,b], scale}
   * @returns {w,h,data:Uint8ClampedArray(RGBA), inkRatio}
   */
  function render(map, rows, cols, stored, opts) {
    opts = opts || {};
    const S = opts.scale || 1;
    const fg = opts.fg || [255, 255, 255];
    const bg = opts.bg || [0, 0, 0];
    const bitIsInk = opts.polarity === 0 ? 0 : 1;
    const w = cols * 12 * S, h = rows * 18 * S;
    const data = new Uint8ClampedArray(w * h * 4);
    const NG = Math.floor(stored.length / 27);
    let ink = 0;
    for (let i = 0; i < w * h; i++) { data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; data[i * 4 + 3] = 255; }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const gi = map[r * cols + c];
      if (gi >= NG) continue;                               // 越界索引按空白处理
      const bits = bitsOf(stored, gi);
      const x0 = c * 12 * S, y0 = r * 18 * S;
      for (let y = 0; y < 18; y++) for (let x = 0; x < 12; x++) {
        const on = bits[y * 12 + x] === bitIsInk;
        if (on) ink++;
        const col = on ? fg : bg;
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
          const o = ((y0 + y * S + dy) * w + x0 + x * S + dx) * 4;
          data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2];
        }
      }
    }
    return { w, h, data, inkRatio: ink / (rows * cols * 216) };
  }

  // --------------------------------------------------------------- logo 自动识别
  /**
   * 从 8051 代码里读出 logo 绘制循环常量（确定性，非启发式猜测）
   *
   * 目标指令序列（Keil C51 生成的 row*cols+col 索引计算）：
   *   75 f0 <C>        MOV  F0,#C          ; C = 列数（乘数）
   *   ...
   *   24 <lo>          ADD  A,#lo         \
   *   34 <hi>          ADDC A,#hi         /  MAP 表基址 = hi<<8|lo
   *   93               MOVC A,@A+DPTR     ; 读 MAP
   *   ...
   *   94 <C>           SUBB A,#C          ; 列计数比较
   *   94 <R>           SUBB A,#R          ; 行计数比较
   * 已在乐华 RTD2270CLW 固件上逐条验证（0x1C1DE..0x1C20F）。
   */
  function findLogoLoops(buf) {
    const out = [];
    for (let i = 0; i + 10 < buf.length; i++) {
      if (buf[i] !== 0x75 || buf[i + 1] !== 0xf0) continue;
      const cols = buf[i + 2];
      if (cols < 8 || cols > 160) continue;
      const lim = Math.min(buf.length - 2, i + 96);
      let lo = -1, hi = -1, rows = 0, movc = false, sawColCheck = false;
      for (let j = i + 3; j < lim; j++) {
        const b = buf[j];
        if (b === 0x24 && lo < 0) lo = buf[j + 1];                    // ADD A,#lo
        else if (b === 0x34 && hi < 0 && lo >= 0) hi = buf[j + 1];    // ADDC A,#hi
        else if (b === 0x93) movc = true;                             // MOVC
        else if (b === 0x94 && buf[j + 1] === cols) {                 // SUBB A,#cols
          sawColCheck = true;
          for (let k = j + 2; k < Math.min(j + 20, lim); k++) {
            if (buf[k] === 0x94 && buf[k + 1] >= 2 && buf[k + 1] <= 24) { rows = buf[k + 1]; break; }
          }
        }
      }
      if (!sawColCheck || !rows || !movc || lo < 0 || hi < 0) continue;
      out.push({ codeAt: i, mapBase: (hi << 8) | lo, rows, cols });
      i += 8;
    }
    return out;
  }

  /**
   * 墨迹极性判定（带置信度）。
   * OSD 硬件约定：字模 bit=1 → 该像素画成平面颜色（墨迹），bit=0 → 背景。
   * 厂家字体编译器偶有整库反相，因此用"空白填充字模"佐证：
   * 若某个全 0/全 1 字模在 MAP 中占绝对多数（≥2 倍），它就是背景块，
   * 墨迹 = 其相反位；无信号时 confident=false，由调用方按机制选默认。
   * （两极渲染互为反色，纯图像统计无法区分，实机验证以乐华固件为准 = bit1 墨。）
   */
  function detectPolarityEx(map, stored, defaultPol) {
    const NG = Math.floor(stored.length / 27);
    const cnt = new Map();
    for (const v of map) if (v < NG) cnt.set(v, (cnt.get(v) || 0) + 1);
    let u0 = 0, u1 = 0;                                     // 全0/全1 字模的用量
    for (let i = 0; i < NG; i++) {
      const b = bitsOf(stored, i);
      let s = 0; for (const x of b) s += x;
      if (s === 0) u0 += cnt.get(i) || 0;
      else if (s === 216) u1 += cnt.get(i) || 0;
    }
    if (u0 >= u1 * 2 && u0 > 0) return { polarity: 1, confident: true };
    if (u1 >= u0 * 2 && u1 > 0) return { polarity: 0, confident: true };
    return { polarity: defaultPol === 0 ? 0 : 1, confident: false };
  }
  function detectPolarity(map, stored) { return detectPolarityEx(map, stored, 1).polarity; }

  function gridStats(map, rows, cols, stored, polarity) {
    const NG = Math.floor(stored.length / 27);
    const blank = gi => { if (gi >= NG) return true; const b = bitsOf(stored, gi); let s = 0; for (const x of b) s += x; return s === 0 || s === 216; };
    let marginHits = 0, marginTot = 0;
    for (let r = 0; r < rows; r++) {
      marginTot += 2;
      if (blank(map[r * cols])) marginHits++;
      if (blank(map[r * cols + cols - 1])) marginHits++;
    }
    let edgeHits = 0, edgeTot = 0;
    for (let c = 0; c < cols; c++) {
      edgeTot += 2;
      if (blank(map[c])) edgeHits++;
      if (blank(map[(rows - 1) * cols + c])) edgeHits++;
    }
    // 水平相邻字模的"接缝"失配（正确网格下笔画连续 → 失配低）
    let seam = 0, seamTot = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c + 1 < cols; c++) {
      const a = map[r * cols + c], b = map[r * cols + c + 1];
      if (a >= NG || b >= NG) continue;
      const ba = bitsOf(stored, a), bb = bitsOf(stored, b);
      for (let y = 0; y < 18; y++) {
        const pa = ba[y * 12 + 11] === (polarity === 0 ? 0 : 1);
        const pb = bb[y * 12] === (polarity === 0 ? 0 : 1);
        seamTot++;
        if (pa !== pb) seam++;
      }
    }
    return {
      margin: marginTot ? marginHits / marginTot : 0,
      edge: edgeTot ? edgeHits / edgeTot : 0,
      seam: seamTot ? seam / seamTot : 1
    };
  }

  const BANK_BASES = [0x00000, 0x08000, 0x10000, 0x18000, 0x20000];

  /**
   * 自动识别 logo。优先走"代码常量"确定性路线，失败再退回"紧邻字库块的 MAP 表"启发式。
   * 返回 { blocks, groups:[{fontOff,glyphCount,mapOff,rows,cols,...}], method, loops }
   */
  function detect(buf, opt) {
    opt = opt || {};
    const blocks = scanBlocks(buf, opt.minBytes == null ? 200 : opt.minBytes);
    const groups = [];
    const loops = findLogoLoops(buf);

    // ---- 路线 A：代码常量（确定性）----
    for (const lp of loops) {
      const need = lp.rows * lp.cols;
      for (const bb of BANK_BASES) {
        const mapOff = bb + lp.mapBase;
        const fontOff = mapOff + need;
        if (fontOff + 10 > buf.length) continue;
        const map = buf.subarray(mapOff, mapOff + need);
        let mx = 0; for (const v of map) if (v > mx) mx = v;
        const blk = decodeBlock(buf, fontOff);
        const ok = blk && blk.glyphCount > mx && mx >= 4;
        if (!ok) continue;
        const polarity = detectPolarity(map, blk.stored);
        groups.push({
          method: 'code', codeAt: lp.codeAt, bankBase: bb, mapBase: lp.mapBase,
          fontOff, glyphCount: blk.glyphCount, compBytes: blk.num, blockEnd: blk.end,
          mapOff, rows: lp.rows, cols: lp.cols, mapLen: need, stored: blk.stored,
          maxIndex: mx, polarity, candidates: [{ rows: lp.rows, cols: lp.cols, score: 99, polarity }],
          best: { rows: lp.rows, cols: lp.cols, score: 99, polarity }
        });
        break;                                                 // 同一 loop 只认一个 bank
      }
    }
    if (groups.length) {
      groups.sort((a, b) => b.glyphCount - a.glyphCount);
      return { blocks, groups, loops, method: 'code' };
    }

    // ---- 路线 B：紧邻字库块的 MAP 表（启发式）----

    for (const blk of blocks) {
      const NG = blk.glyphCount;
      if (NG < 16 || NG > 255) continue;
      const cands = [];
      for (let L = 24; L <= 512; L++) {
        const mapOff = blk.off - L;
        if (mapOff < 0) continue;
        let ok = true;
        for (let i = 0; i < L; i++) if (buf[mapOff + i] >= NG) { ok = false; break; }
        if (!ok) continue;
        // 覆盖率：索引要真正用满字库
        let mx = 0; const seen = new Set();
        for (let i = 0; i < L; i++) { const v = buf[mapOff + i]; if (v > mx) mx = v; seen.add(v); }
        if (mx < Math.min(NG - 1, Math.max(8, (NG * 0.5) | 0))) continue;
        if (seen.size < 6) continue;
        const map = buf.subarray(mapOff, mapOff + L);
        const polarity = detectPolarity(map, blk.stored);
        for (let rows = 3; rows <= 24; rows++) {
          if (L % rows) continue;
          const cols = L / rows;
          if (cols < 8 || cols > 160) continue;
          const st = gridStats(map, rows, cols, blk.stored, polarity);
          // 打分：边距空白多 + 接缝失配低
          const score = st.margin * 1.0 + st.edge * 0.5 - st.seam * 1.2;
          // 纵横比惩罚：显示器开场 logo 常为横幅 1:1 ~ 12:1
          const ar = (cols * 12) / (rows * 18);
          const arPen = ar > 12 ? (ar - 12) * 0.02 : (ar < 1 ? (1 - ar) * 0.05 : 0);
          cands.push({ rows, cols, score: score - arPen, margin: st.margin, edge: st.edge, seam: st.seam, ar, polarity });
        }
      }
      if (!cands.length) continue;
      cands.sort((a, b) => b.score - a.score);
      groups.push({
        method: 'adjacent',
        fontOff: blk.off, glyphCount: NG, compBytes: blk.num, blockEnd: blk.end,
        mapOff: blk.off - (cands[0].rows * cands[0].cols), mapLen: cands[0].rows * cands[0].cols,
        rows: cands[0].rows, cols: cands[0].cols, polarity: cands[0].polarity,
        candidates: cands, best: cands[0], stored: blk.stored
      });
    }
    groups.sort((a, b) => b.glyphCount - a.glyphCount);
    if (groups.length) return { blocks, groups, loops, method: 'adjacent' };

    // ---- 路线 D：OSD 记录流型（MAZON / RTD270 族：COsdFxCodeWrite 解释器数据流）----
    const rGroups = detectRecordStream(buf, blocks);
    if (rGroups.length) return { blocks, groups: rGroups, loops, method: 'recordstream' };

    // ---- 路线 E：远程瓦片索引表（HY 板厂：任意位置的 7×72 类索引表 → 大瓦片字库拼图，
    //      如 液晶显示器.bin：表 0x1302E(7行×72列) → 字库 0x23000(151 瓦片)，实机照片+标定实证。
    //      同固件里的串引用 ENVISION 字库（0x2396b）已刷机证明不是开机路径，故本路线优先于路线 C）----
    const mGroups = detectMapGrid(buf, blocks);
    if (mGroups.length) return { blocks, groups: mGroups, loops, method: 'mapgrid' };

    // ---- 路线 C：字符串引用字库块（HY 族：logo 字符串按字模索引直取，如 08 09 0A..11 FF）----
    const sGroups = detectStringRef(buf, blocks);
    if (sGroups.length) return { blocks, groups: sGroups, loops, method: 'stringref' };
    return { blocks, groups, loops, method: 'none' };
  }

  /**
   * 路线 E 检测：远程瓦片索引表。特征：某大字库块（24~400 字模）之前存在一整段
   * 全部 < NG 的字节区（≥150B），按 rows×cols 排成网格后，相邻字模的笔画边界
   * 失配率显著低于其他排布（真布局下大字母笔画跨格连续）。
   * 门槛：①最优边界失配率 < 0.03；②决定性 —— 最优须 < 次优排布的一半（排除步距无主见的乱码）。
   */
  /* d335 original: tile-index-grid detection, scored by border-mismatch rate (2026-09-18) */
  function detectMapGrid(buf, blocks) {
    const inBlock = o => blocks.some(b => o >= b.off && o < b.end);
    const groups = [];
    for (const blk of blocks) {
      const NG = blk.glyphCount;
      if (NG < 24 || NG > 400) continue;
      // 每字模的边界位缓存：最右/最左列、最下/最上行
      const R = [], Lf = [], B = [], T = [];
      for (let gi = 0; gi < NG; gi++) {
        const b = bitsOf(blk.stored, gi);
        const r = new Uint8Array(18), l = new Uint8Array(18), bt = new Uint8Array(12), t = new Uint8Array(12);
        for (let y = 0; y < 18; y++) { r[y] = b[y * 12 + 11]; l[y] = b[y * 12]; }
        for (let x = 0; x < 12; x++) { bt[x] = b[17 * 12 + x]; t[x] = b[x]; }
        R.push(r); Lf.push(l); B.push(bt); T.push(t);
      }
      const Z18 = new Uint8Array(18), Z12 = new Uint8Array(12);
      let i = 0;
      while (i < blk.off) {
        if (buf[i] >= NG || inBlock(i)) { i++; continue; }
        let j = i;
        while (j < blk.off && buf[j] < NG && !inBlock(j)) j++;
        const L = j - i;
        if (L >= 150 && L <= 4096) {
          const cands = [];
          for (let rows = 2; rows <= 30; rows++) for (let cols = 8; cols <= 160; cols++) {
            const used = rows * cols;
            if (used < 150) continue;
            const pad = L - used;
            if (pad < 0 || pad >= cols) continue;             // 尾部允许不足一行
            const map = buf.subarray(i, i + used);
            let H = 0, V = 0;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
              const a = map[r * cols + c];
              if (c + 1 < cols) {
                const ra = R[a] || Z18, lb = Lf[map[r * cols + c + 1]] || Z18;
                for (let y = 0; y < 18; y++) if (ra[y] !== lb[y]) H++;
              }
              if (r + 1 < rows) {
                const ba = B[a] || Z12, tb = T[map[(r + 1) * cols + c]] || Z12;
                for (let x = 0; x < 12; x++) if (ba[x] !== tb[x]) V++;
              }
            }
            const score = H / (rows * (cols - 1) * 18) + V / ((rows - 1) * cols * 12);
            cands.push({ rows, cols, score });
          }
          cands.sort((a, b) => a.score - b.score);
          const best = cands[0], second = cands.find(c => c.rows !== best.rows || c.cols !== best.cols);
          const accept = best && best.score < 0.03 && (!second || best.score * 2 < second.score);
          if (accept) {                                       // 失配率低且步距有主见 → 真网格
            const used = best.rows * best.cols;
            const map = buf.subarray(i, i + used);
            const polarity = detectPolarity(map, blk.stored);
            groups.push({
              method: 'mapgrid',
              fontOff: blk.off, glyphCount: NG, compBytes: blk.num, blockEnd: blk.end,
              mapOff: i, mapLen: used, rows: best.rows, cols: best.cols,
              stored: blk.stored, polarity,
              candidates: cands.slice(0, 6), best
            });
          }
        }
        i = j;
      }
    }
    groups.sort((a, b) => a.best.score - b.best.score);
    return groups;
  }

  /**
   * 路线 C 检测：小字库块 + 递增索引字符串（HY/ENVISION 族机制）。
   * 该族固件的 logo 显示 = 代码里的字符串表逐字节作为字模索引（加载基址 0，字符码=字模号），
   * 字符串以 0xFF 结尾，如 0x13CE3: 08 09 0A .. 11 FF = ●●⬤HYUNDAI / ENVISION。
   * 已在 液晶显示器_标定版/原版/HYUNDAI改 实证：字库 0x2396B(18字模)，串 0x13CE3(10项)。
   */
  function detectStringRef(buf, blocks) {
    const groups = [];
    const ranges = blocks.map(b => [b.off, b.end]);
    const inBlock = o => ranges.some(r => o >= r[0] && o < r[1]);
    for (const blk of blocks) {
      const NG = blk.glyphCount;
      if (NG < 8 || NG > 64) continue;                        // logo 字库都是小库
      let best = null;
      for (let i = 0; i + 5 < buf.length; i++) {
        if (buf[i] >= NG || inBlock(i)) continue;
        let j = i;
        while (buf[j + 1] === buf[j] + 1 && buf[j + 1] < NG) j++;
        const len = j - i + 1;
        if (len >= 5 && buf[j + 1] === 0xff) {
          // 打分：串越长越可信；索引偏向字库高段（logo 常用后段）加分
          const score = len * 3 + (buf[j] / NG) * 6;
          if (!best || score > best.score) best = { strOff: i, len, score, str: Array.from(buf.slice(i, j + 1)) };
          i = j;
        }
      }
      if (!best || best.strOff > blk.off) continue;           // 串必须在字库之前（代码区引用资源）
      const tight = NG - 1 - best.str[best.str.length - 1];   // 索引恰好铺满字库 = 专属 logo 库
      if (tight > 6) continue;                                // 大量字模未被该串引用 → 是别的字库
      const img = render(Uint8Array.from(best.str), 1, best.len, blk.stored, { polarity: 1 });
      if (img.inkRatio > 0.8) continue;                       // 全 1 乱块
      // （inkRatio 极低也保留：有的"修改版"固件把原 logo 字模清空了，仍应可编辑）
      // 可写窗口：块尾到下一个块起始（限 FF 空隙）
      let end = blk.end;
      const next = blocks.filter(b => b.off > blk.off).map(b => b.off);
      const nb = next.length ? Math.min(...next) : buf.length;
      let k = blk.end; while (k < nb && buf[k] === 0xff) k++;
      if (k > end) end = k;
      groups.push({
        method: 'stringref', type: 'stringref',
        fontOff: blk.off, glyphCount: NG, compBytes: blk.num, blockEnd: end,
        strOff: best.strOff, str: best.str, tight,
        loaderRefs: findLoaderRefs(buf, blk.off).length,
        mapOff: best.strOff, mapLen: best.len, rows: 1, cols: best.len,
        stored: blk.stored, polarity: 1, inkRatio: img.inkRatio
      });
    }
    // 排序：①索引铺满程度（tight 越小越专属） ②被加载指令引用者优先（重定位后区分新旧块）
    //      ③串长 ④墨迹占比适中
    groups.sort((a, b) => (a.tight - b.tight) || (b.loaderRefs - a.loaderRefs) ||
      (b.cols - a.cols) || (Math.abs(a.inkRatio - 0.25) - Math.abs(b.inkRatio - 0.25)));
    return groups;
  }

  /**
   * 路线 C 专用：把新 logo 字模合成进「保持原字库结构」的新字库。
   * 字符串引用型固件按固定索引（str）取字模，因此：
   *   - 新 logo 的唯一字模逐个放到 str[i] 指定的字模号上
   *   - 其余字模号保留原内容（可能被菜单等其他画面引用，不能动）
   * 返回 { map(=str 原样), stored(NG*27) }，可直接交给 applyPatch。
   */
  function composeStringFont(built, str, origStored) {
    const stored = new Uint8Array(origStored);
    for (let i = 0; i < str.length; i++) {
      const gi = str[i];
      if (gi * 27 + 27 > stored.length) continue;
      stored.set(built.stored.subarray(built.map[i] * 27, built.map[i] * 27 + 27), gi * 27);
    }
    return { map: Uint8Array.from(str), stored };
  }

  // ------------------------------------------------- OSD 记录流型（MAZON / RTD270 族）
  /**
   * SDK COsdFxCodeWrite 解释器的忠实模拟（逆向自 MAZON 4.BIN，渲染与实机照片 100% 一致）。
   * 流结构：入口先读一个「裸头」2 字节 [PAAA AAAA]（无 fe 前缀），
   *   P = 平面位（0x40=字模 0x80=颜色 0x10=属性），AAA = OSD RAM 地址（12 位）
   * 之后逐字节解释直到流结束：
   *   数据字节      写入当前平面，addr++
   *   fc n (n<=3)   写特殊码 0xfc+n；后随 fd m = 连写 m 遍
   *   fd n          重复前值 n-1 遍
   *   fe H L        新记录头（plane=H&0xf0, addr=(H&0x0f)<<8|L）
   *   fe ff / ff    流结束
   * 返回 { ok, end, consumed, rowHeads, disp, colr, dispCells, colrCells, maxDisp }
   * disp/colr 为按原始 addr 索引的 Int32Array（-1 = 未写）。
   */
  function simulateStream(buf, start, trace) {
    const N = 0x400;
    const disp = new Int32Array(N).fill(-1);
    const colr = new Int32Array(N).fill(-1);
    const writes = trace ? [] : null;                       // 字模平面写字节轨迹 {pos,plane,v,fc}
    const rd = i => (i >= 0 && i < buf.length ? buf[i] : -1);
    let addr = 0, plane = 0, prev = 0, steps = 0, ok = false;
    let pos = start;
    const h0 = rd(pos), h1 = rd(pos + 1);
    if (h0 < 0 || h1 < 0) return null;
    addr = ((h0 & 0x0f) << 8) | h1;
    plane = h0 & 0xf0;
    if (!(plane & 0xc0) || addr >= N) return null;         // 入口头必须写东西
    pos += 2;
    const rowHeads = (plane & 0x40) ? [addr] : [];
    function wr(v, vpos, fc) {
      if (trace && (plane & 0x40) && vpos >= 0) writes.push({ pos: vpos, plane, v, fc: !!fc });
      if (addr < N) {
        if (plane & 0x40) { disp[addr] = v; }
        if (plane & 0x80) { colr[addr] = v; }
      }
      addr++;
    }
    while (steps++ < 20000 && pos < start + 8192) {
      const b = rd(pos);
      if (b < 0) return null;
      if (b === 0xff) { pos++; ok = true; break; }
      if (b === 0xfe) {
        const h = rd(pos + 1);
        if (h === 0xff) { pos += 2; ok = true; break; }     // fe ff = 终止
        const l = rd(pos + 2);
        if (h < 0 || l < 0) return null;
        addr = ((h & 0x0f) << 8) | l;
        plane = h & 0xf0;
        if (addr >= N) return null;
        if (plane & 0x40) rowHeads.push(addr);
        pos += 3;
      } else if (b === 0xfc) {
        const n = rd(pos + 1);
        if (n < 0 || n > 3) { pos += 2; ok = true; break; } // n>3 与固件一致视为终止
        const t = 0xfc + n;
        if (rd(pos + 2) === 0xfd) {
          const m = rd(pos + 3);
          if (m < 0) return null;
          for (let k = 0; k < m; k++) wr(t, pos + 1, true);
          pos += 4;
        } else { wr(t, pos + 1, true); pos += 2; }
        prev = t;
      } else if (b === 0xfd) {
        const n = rd(pos + 1);
        if (n < 0) return null;
        for (let k = 0; k < n - 1; k++) wr(prev, -1, false);
        pos += 2;
      } else { wr(b, pos, false); prev = b; pos++; }
    }
    if (!ok) return null;
    let dispCells = 0, colrCells = 0, maxDisp = 0;
    for (let i = 0; i < N; i++) {
      if (disp[i] >= 0) { dispCells++; if (disp[i] > maxDisp) maxDisp = disp[i]; }
      if (colr[i] >= 0) colrCells++;
    }
    const r = { ok, end: pos, consumed: pos - start, rowHeads, disp, colr, dispCells, colrCells, maxDisp };
    if (trace) r.writes = writes;
    return r;
  }

  /** 记录流 → 规范编码（裸头 + RLE 游程 + fe ff 终止），返回字节数组 */
  function emitRuns(out, vals) {
    let i = 0;
    while (i < vals.length) {
      const v = vals[i];
      let n = 1;
      while (i + n < vals.length && vals[i + n] === v) n++;
      if (v >= 0xfc) out.push(0xfc, v - 0xfc); else out.push(v);
      let rem = n - 1;                                      // fd m 再写 m-1 遍
      while (rem > 0) { const r = Math.min(rem, 254); out.push(0xfd, r + 1); rem -= r; }
      i += n;
    }
  }
  function encodeStream(cells, rows, cols, color, base, osdw, colors) {
    const out = [];
    // 字模平面：每行一个行头（首个为裸头，与解释器入口约定一致），
    // 行头差 = osdw，检测器据此推导行宽
    for (let r = 0; r < rows; r++) {
      const a = base + r * osdw;
      if (r === 0) out.push(0x40 | ((a >> 8) & 0x0f), a & 0xff);
      else out.push(0xfe, 0x40 | ((a >> 8) & 0x0f), a & 0xff);
      emitRuns(out, cells.subarray(r * osdw, r * osdw + osdw));
    }
    // 颜色平面：colors（逐格调色板索引，彩色 logo）或单色铺满画布
    out.push(0xfe, 0x80 | ((base >> 8) & 0x0f), base & 0xff);
    emitRuns(out, colors || new Array(rows * cols).fill(color));
    out.push(0xfe, 0xff);
    return Uint8Array.from(out);
  }

  /**
   * OSD 16 色调色板定位（RTD Scaler 的 Overlay Color LUT：16 项 × RGB 3 字节 = 48 B，
   * 由 SDK COsdColorPalette() 写入 _COLOR_LUT_PORT_6F）。
   * 结构判据：idx0 接近黑（背景）、idx8 接近白、至少 4 种不同颜色；
   * 在多个候选中取距 logo 数据流最近的一个。
   * 返回 { off, colors:[[r,g,b]×16], uniq, dist } 或 null。
   */
  function findPalette(buf, nearOff) {
    const cands = [];
    for (let T = 0; T + 48 <= buf.length; T++) {
      const c = i => [buf[T + i * 3], buf[T + i * 3 + 1], buf[T + i * 3 + 2]];
      const c0 = c(0), c8 = c(8);
      // 逐分量判据（表地址不保证 3 对齐，故必须靠分量严格性排除错位窗口）
      if (c0[0] > 0x20 || c0[1] > 0x20 || c0[2] > 0x20) continue;   // idx0 近黑
      if (c8[0] < 0xd8 || c8[1] < 0xd8 || c8[2] < 0xd8) continue;   // idx8 近白
      const set = new Set();
      for (let i = 0; i < 16; i++) set.add(c(i).join(','));
      if (set.size < 4) continue;                           // 至少 4 种颜色才像调色板
      cands.push({
        off: T, colors: Array.from({ length: 16 }, (_, i) => c(i)),
        uniq: set.size, dist: nearOff == null ? 0 : Math.abs(T - nearOff)
      });
    }
    if (!cands.length) return null;
    // 越完整越像主 LUT；同样完整时取离 logo 数据最近的
    cands.sort((a, b) => (b.uniq - a.uniq) || (a.dist - b.dist));
    return cands[0];
  }

  /** 记录流网格渲染（disp<0 或 0 或 ≥NG = 空格；ink 由字模位 + 极性决定）
   *  传入 opts.palette + opts.colr 时按颜色平面逐格上色（记录流型的彩色 logo）。 */
  function renderCells(disp, rows, cols, stored, opts) {
    opts = opts || {};
    const S = opts.scale || 1;
    const fg = opts.fg || [255, 255, 255];
    const bg = opts.bg || [0, 0, 0];
    const pal = opts.palette || null;
    const colr = opts.colr || null;
    const useColor = !!(pal && colr && pal.length && opts.color !== false);
    const bitIsInk = opts.polarity === 0 ? 0 : 1;
    const NG = Math.floor(stored.length / 27);
    const w = cols * 12 * S, h = rows * 18 * S;
    const data = new Uint8ClampedArray(w * h * 4);
    let ink = 0;
    for (let i = 0; i < w * h; i++) { data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; data[i * 4 + 3] = 255; }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const gi = disp[idx];
      if (gi < 0 || gi >= NG) continue;                     // 未写格保持背景色
      const bits = bitsOf(stored, gi);
      let col = fg;
      if (useColor) {
        const ci = colr[idx];
        if (ci >= 0 && ci < pal.length) col = pal[ci];       // 颜色平面给出的调色板索引
      }
      const x0 = c * 12 * S, y0 = r * 18 * S;
      for (let y = 0; y < 18; y++) for (let x = 0; x < 12; x++) {
        const on = bits[y * 12 + x] === bitIsInk;
        if (!on) continue;
        ink++;
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
          const o = ((y0 + y * S + dy) * w + x0 + x * S + dx) * 4;
          data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2];
        }
      }
    }
    return { w, h, data, inkRatio: ink / (rows * cols * 216) };
  }

  /** 由墨迹位图重建 disp 网格（buildFromBitmap 的 map 直接就是 cells） */
  function recordStreamInkColor(disp, colr, rows, cols, glyphCount) {
    const cnt = new Map();
    let fb = -1;
    for (let i = 0; i < rows * cols; i++) {
      if (disp[i] <= 0 || disp[i] >= glyphCount) continue;
      const c = colr[i];
      if (c >= 0) { cnt.set(c, (cnt.get(c) || 0) + 1); fb = c; }
    }
    let best = -1, bn = 0;
    for (const [c, n] of cnt) if (n > bn) { bn = n; best = c; }
    return best >= 0 ? best : (fb >= 0 ? fb : 0x07);
  }

  /**
   * 路线 D 检测：OSD 记录流型（MAZON / RTD270 族）。
   * 全镜像扫描「裸头」入口并模拟解释器，要求严格终止 + 结构合理：
   *   消耗 ≥48B、字模格 ≥60、颜色格 ≥1、字模行头 ≥3、行宽 gcd ∈ [16,160]、
   *   存在字模数 > maxDisp 的 VLC 字库块（优先索引铺满的专属库）、墨迹占比合理。
   * 返回按写入格数降序的组列表（通常取第一项）。
   */
  /* d335 original: OSD record-stream (COsdFxCodeWrite) interpreter + re-encoder (2026-09-18) */
  function detectRecordStream(buf, blocks) {
    const out = [];
    const ranges = blocks.map(b => [b.off, b.end]);
    const inBlock = o => ranges.some(r => o >= r[0] && o < r[1]);
    let palCache;                                           // 调色板只定位一次
    for (let o = 0; o + 8 < buf.length; o++) {
      if (inBlock(o)) continue;
      const sim = simulateStream(buf, o);
      if (!sim || sim.consumed < 48 || sim.dispCells < 60 || sim.colrCells < 1) continue;
      if (sim.rowHeads.length < 3) continue;
      let g = 0;
      for (let i = 1; i < sim.rowHeads.length; i++) {
        let a = sim.rowHeads[i] - sim.rowHeads[i - 1], b = g;
        while (b) { const t = a % b; a = b; b = t; }
        g = a;
      }
      if (g < 16 || g > 160) continue;
      const base = sim.rowHeads[0];
      // 找能容纳 maxDisp 的字库块：被「7b ff 7a hi 79 lo」严格加载模式引用的优先（真字库），
      // 其余按「索引铺满」程度
      const strictRefs = b => {
        const hi = (b.off & 0xff00) >> 8, lo = b.off & 0xff;
        let n = 0;
        for (let i = 0; i + 6 <= buf.length; i++) {
          if (buf[i] === 0x7b && buf[i + 1] === 0xff && buf[i + 2] === 0x7a &&
              buf[i + 3] === hi && buf[i + 4] === 0x79 && buf[i + 5] === lo) n++;
        }
        return n;
      };
      const cands = blocks.filter(b => b.glyphCount > sim.maxDisp && b.glyphCount >= 7 && b.glyphCount <= 256)
        .map(b => ({ b, refs: strictRefs(b) }));
      if (!cands.length) continue;
      cands.sort((x, y) => ((y.refs > 0) - (x.refs > 0)) ||
        (x.b.glyphCount - sim.maxDisp) - (y.b.glyphCount - sim.maxDisp));
      const font = cands[0].b;
      if (font.glyphCount - 1 - sim.maxDisp > 24) continue; // 与字库耦合太松 → 不是 logo 流
      let maxIdx = 0;
      for (let i = 0; i < 0x400; i++) {
        if (sim.disp[i] >= 0) { const idx = i - base; if (idx > maxIdx) maxIdx = idx; }
      }
      if (maxIdx < 2 * g) continue;                          // 至少 3 行
      const nRows = Math.floor(maxIdx / g) + 1;
      if (nRows < 2 || nRows > 24) continue;
      const cells = new Int32Array(nRows * g).fill(-1);
      const colr = new Int32Array(nRows * g).fill(-1);
      for (let i = 0; i < 0x400; i++) {
        const idx = i - base;
        if (idx < 0 || idx >= nRows * g) continue;
        if (sim.disp[i] >= 0) cells[idx] = sim.disp[i];
        if (sim.colr[i] >= 0) colr[idx] = sim.colr[i];
      }
      const pseudo = [];
      for (let i = 0; i < cells.length; i++) if (cells[i] >= 0) pseudo.push(cells[i]);
      // 极性：墨迹少数派原则——logo 的字与图案永远占画面少数像素，
      // 取「两种极性下墨迹像素更少」的一边为墨迹（MAZON→bit0，BUBALUS→bit1 均实测吻合）
      const inkCnt = [0, 0];
      for (const gi of pseudo) {
        if (gi < 0 || gi >= font.glyphCount) continue;
        const b = bitsOf(font.stored, gi);
        for (let k = 0; k < 216; k++) inkCnt[b[k]]++;
      }
      const polarity = inkCnt[0] <= inkCnt[1] ? 0 : 1;
      const img = renderCells(cells, nRows, g, font.stored, { polarity });
      if (img.inkRatio < 0.008 || img.inkRatio > 0.6) continue;
      if (palCache === undefined) palCache = findPalette(buf, o);
      out.push({
        type: 'recordstream', method: 'recordstream',
        streamOff: o, streamEnd: sim.end, consumed: sim.consumed,
        fontOff: font.off, glyphCount: font.glyphCount, compBytes: font.num, blockEnd: font.end,
        stored: font.stored, polarity,
        base, osdw: g, rows: nRows, cols: g,
        disp: Array.from(cells), colr: Array.from(colr),
        palette: palCache ? palCache.colors : null,
        paletteOff: palCache ? palCache.off : -1,
        inkColor: recordStreamInkColor(cells, colr, nRows, g, font.glyphCount),
        inkRatio: img.inkRatio, dispCells: sim.dispCells
      });
      if (out.length >= 8) break;
    }
    out.sort((a, b) => b.dispCells - a.dispCells);
    return out;
  }

  /**
   * 记录流型写入计划：
   *  - 新画面的唯一字模不能直接用索引（会顶掉菜单等画面共用的低号字模），
   *    优先映射到原 logo 流自己占用的槽位（降序），不够时再从空闲高槽补充；
   *  - 空白格映射到「无墨迹字模」（原 0 号 / 原流最常用的背景格）。
   * 返回 { ok, cells, newStored, stream, streamLimit, fontLimit, blankSlot, ... }
   * spec = { buf, origDisp, origStored, built:{map,stored,unique}, polarity,
   *          rows, cols, color, base, osdw }
   */
  /** 扫描主数据流之后的各记录组（动画/附加元素），返回 {start,end,writes} 列表
   *  只认紧跟主流的 spanCap 字节内开始的组（动画帧紧贴主流；更远的"组"是数据误判）*/
  function scanTailGroups(buf, from, maxLen, spanCap) {
    spanCap = spanCap == null ? 64 : spanCap;
    const groups = [];
    const cap = Math.min(buf.length, from + maxLen);
    let pos = from;
    while (pos < Math.min(cap, from + spanCap) && groups.length < 16) {
      let g = null, gAt = -1;
      for (let s = pos; s < Math.min(pos + 96, cap, from + spanCap); s++) {
        if (buf[s] === 0xff && buf[s + 1] === 0xff) break;   // 进入 FF 区，后面没有了
        const sim = simulateStream(buf, s, true);
        if (sim && sim.ok && sim.consumed >= 8 && (sim.dispCells + sim.colrCells) >= 3) { g = sim; gAt = s; break; }
      }
      if (!g) break;
      groups.push({ start: gAt, end: g.end, writes: g.writes });
      pos = g.end;
    }
    return groups;
  }

  function planRecordStream(spec) {
    const origStored = spec.origStored;
    const NG = Math.floor(origStored.length / 27);
    const built = spec.built;
    // OSD 属性区上限：字模/颜色平面共 0x400 格，画布必须落在 [base, 0x400)
    if (spec.base + spec.rows * spec.osdw > 0x400) {
      return { ok: false, reason: 'canvas-overflow', avail: 0x400 - spec.base };
    }
    const colors = spec.colors || null;                     // 逐格颜色（彩色导入）
    const usedCnt = new Map();
    for (let i = 0; i < spec.origDisp.length; i++) {
      const v = spec.origDisp[i];
      if (v > 0 && v < NG) usedCnt.set(v, (usedCnt.get(v) || 0) + 1);
    }
    const origUsed = [...usedCnt.keys()].sort((a, b) => b - a);
    const inkVal = spec.polarity === 0 ? 0 : 1;
    const isInkFree = gi => {
      if (gi < 0 || gi >= NG) return false;
      const b = bitsOf(origStored, gi);
      for (let i = 0; i < 216; i++) if (b[i] === inkVal) return false;
      return true;
    };
    // 字库写入预算：原块 + 其后紧邻的 0xFF 空隙
    const blk0 = decodeBlock(spec.buf, spec.fontOff);
    let limitEnd = blk0 ? blk0.end : spec.fontOff + 10 + encodeBlock(origStored).length;
    while (limitEnd < spec.buf.length && spec.buf[limitEnd] === 0xff) limitEnd++;
    const fontLimit = limitEnd - spec.fontOff;
    const streamLimit = spec.streamEnd - spec.streamOff;

    // ---- 方案 A：完整保留原字库结构，只换掉 logo 流引用的槽位（零副作用，优先）----
    let blankSlot = -1;
    if (isInkFree(0)) blankSlot = 0;
    else {
      let bn = 0;
      for (const [v, n] of usedCnt) if (isInkFree(v) && n > bn) { bn = n; blankSlot = v; }
    }
    if (blankSlot >= 0) {
      const need = built.unique - 1;
      const pool = origUsed.filter(v => v !== blankSlot).slice();
      if (pool.length < need) {
        const inPool = new Set(pool);
        for (let v = NG - 1; v >= 1 && pool.length < need; v--) {
          if (!inPool.has(v) && v !== blankSlot) pool.push(v);
        }
      }
      if (pool.length >= need) {
        const newStored = new Uint8Array(origStored);
        const slotOf = new Array(built.unique);
        slotOf[0] = blankSlot;
        for (let k = 1; k < built.unique; k++) {
          const slot = pool[k - 1];
          newStored.set(built.stored.subarray(k * 27, k * 27 + 27), slot * 27);
          slotOf[k] = slot;
        }
        const cells = new Uint8Array(built.map.length);
        for (let i = 0; i < built.map.length; i++) cells[i] = slotOf[built.map[i]];
        const stream = encodeStream(cells, spec.rows, spec.cols, spec.color, spec.base, spec.osdw, colors);
        const fontBytes = encodeBlock(newStored).length;
        if (fontBytes <= fontLimit) {
          return {
            ok: true, mode: 'full', cells, newStored, stream, fontBytes, blankSlot,
            streamLimit, fontLimit, origUsedSlots: origUsed.length
          };
        }
      }
    }

    // ---- 方案 B：字库收缩为「空白 + 新字模」（+动画引用保留），
    //      尾部记录组里字模平面写的值做等长字节重映射 ----
    const anim = scanTailGroups(spec.buf, spec.streamEnd, 4096);
    const remap = new Map();
    const preserved = [];
    for (const a of anim) for (const w of a.writes) {
      if (!(w.plane & 0x40) || remap.has(w.v)) continue;
      if (w.fc) return { ok: false, reason: 'anim-fc-token', streamLimit, fontLimit };
      if (isInkFree(w.v)) remap.set(w.v, 0);                // 原字模就是空白 → 指向 0 号空白
      else { remap.set(w.v, -1); preserved.push(w.v); }     // 非空白 → 保留内容副本槽
    }
    const U = built.unique;
    const NG2 = U + preserved.length;
    if (NG2 > 255) return { ok: false, reason: 'unique-tiles-overflow', unique: U, avail: 255 - preserved.length };
    preserved.forEach((v, i) => remap.set(v, U + i));
    const newStored = new Uint8Array(NG2 * 27);
    newStored.set(built.stored.subarray(0, U * 27), 0);     // 0=空白, 1..U-1=新字模
    for (const v of preserved) newStored.set(origStored.subarray(v * 27, v * 27 + 27), remap.get(v) * 27);
    const cells = new Uint8Array(built.map);                // 值恰好就是 0..U-1
    const stream = encodeStream(cells, spec.rows, spec.cols, spec.color, spec.base, spec.osdw, colors);
    const fontBytes = encodeBlock(newStored).length;
    if (fontBytes > fontLimit) return { ok: false, reason: 'font-too-big', need: fontBytes, limit: fontLimit };
    const animPatches = [];
    for (const a of anim) for (const w of a.writes) {
      if (!(w.plane & 0x40)) continue;
      const nv = remap.get(w.v);
      if (nv != null && nv !== w.v) animPatches.push({ pos: w.pos, from: w.v, to: nv });
    }
    return {
      ok: true, mode: 'shrink', cells, newStored, stream, fontBytes, blankSlot: 0,
      streamLimit, fontLimit, animPatches, animGroups: anim.length, origUsedSlots: origUsed.length
    };
  }

  /**
   * 记录流型写盘：
   *  ① 重编码数据流原地写入 [streamOff, streamEnd)，余量填 0xFF（其后动画记录组原位保留）
   *  ② 新字库 VLC 重编码原地写入字库块（含紧邻 0xFF 空隙），字库加载指令不动
   *  ③ 收缩模式：尾部动画组字模平面值等长重映射（字节位置与长度不变）
   *  ④ 回读校验：重新模拟数据流逐格比对 + 重新解码字库逐字节比对 + 动画组重模拟
   */
  function applyRecordStream(spec) {
    const report = { placedAt: spec.streamOff, relocated: false, notes: [] };
    const p = planRecordStream(spec);
    if (!p.ok) return { ok: false, reason: p.reason, report, unique: p.unique, avail: p.avail, need: p.need, limit: p.limit };
    if (p.stream.length > p.streamLimit) return { ok: false, reason: 'stream-too-big', report, need: p.stream.length, limit: p.streamLimit };
    const fontBlk = encodeBlock(p.newStored);
    if (fontBlk.length > p.fontLimit) return { ok: false, reason: 'font-too-big', report, need: fontBlk.length, limit: p.fontLimit };
    const out = new Uint8Array(spec.buf);
    // ① 数据流
    out.set(p.stream, spec.streamOff);
    for (let i = spec.streamOff + p.stream.length; i < spec.streamEnd; i++) out[i] = 0xff;
    report.streamBytes = p.stream.length; report.streamLimit = p.streamLimit;
    // ② 字库块
    out.set(fontBlk, spec.fontOff);
    for (let i = spec.fontOff + fontBlk.length; i < spec.fontOff + p.fontLimit && i < out.length; i++) out[i] = 0xff;
    report.fontBytes = fontBlk.length; report.fontLimit = p.fontLimit;
    // ③ 收缩模式：动画字模值等长重映射
    if (p.mode === 'shrink') {
      for (const a of p.animPatches) out[a.pos] = a.to;
      report.animPatched = p.animPatches.length;
      report.notes.push('字库已收缩为新画面专用（' + p.newStored.length / 27 + ' 字模），尾部动画组字模值已等长重映射 ' + p.animPatches.length + ' 处');
    } else {
      report.notes.push('新字模映射到原 logo 槽位（空白→' + p.blankSlot + '），其余字模原样保留');
    }
    report.mode = p.mode;
    // ④ 校验
    const sim = simulateStream(out, spec.streamOff);
    let verified = !!(sim && sim.ok);
    for (let i = 0; i < p.cells.length && verified; i++) {
      const a = spec.base + i;
      const wantC = spec.colors ? spec.colors[i] : spec.color;
      if (sim.disp[a] !== p.cells[i] || sim.colr[a] !== wantC) verified = false;
    }
    const fb = decodeBlock(out, spec.fontOff);
    if (!fb || fb.stored.length !== p.newStored.length || !fb.stored.every((v, i) => v === p.newStored[i])) verified = false;
    if (p.mode === 'shrink') {
      // 动画组重模拟：确认仍可解释、字模值已重映射
      const anim2 = scanTailGroups(out, spec.streamEnd, 4096);
      if (anim2.length !== (p.animGroups || 0)) verified = false;
      const expect = new Map(p.animPatches.map(a => [a.pos, a.to]));
      for (const a of anim2) for (const w of a.writes) {
        if (!(w.plane & 0x40)) continue;
        if (expect.has(w.pos) && w.v !== expect.get(w.pos)) verified = false;
      }
    }
    report.verified = verified;
    report.bytes = out;
    return { ok: true, bytes: out, report };
  }

  // ------------------------------------------------- 位图 → 字库/MAP（去重）
  /**
   * 由目标 1bpp 位图生成 MAP + 字库
   * @param bits   Uint8Array rows*18*cols*12，1 = 需要画成前景（墨迹）
   * @param rows,cols
   * @param opt    {invert:bool(字库位极性翻转), snapBlank:0..1 近空白吸附阈值}
   * @returns {ok, reason?, map, stored, unique, blankIdx, inkRatio}
   */
  function buildFromBitmap(bits, rows, cols, opt) {
    opt = opt || {};
    const snap = opt.snapBlank == null ? 0 : opt.snapBlank;
    const tileW = cols * 12, tileH = rows * 18;
    const tiles = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const t = new Uint8Array(216);
      let ink = 0;
      for (let y = 0; y < 18; y++) for (let x = 0; x < 12; x++) {
        const v = bits[(r * 18 + y) * tileW + c * 12 + x] ? 1 : 0;
        t[y * 12 + x] = v; ink += v;
      }
      if (snap > 0 && ink <= 216 * snap) t.fill(0);          // 近空白 → 吸附为空白，省字模
      tiles.push(t);
    }
    // 去重（空白垫首）
    const dict = new Map(); const uniq = [];
    const key = t => { let s = ''; for (let i = 0; i < 27; i++) s += String.fromCharCode(t[i]); return s; };
    const blankTile = new Uint8Array(216);
    const blankKey = key(storeBits(blankTile));
    dict.set(blankKey, 0); uniq.push(blankTile);
    const map = new Uint8Array(rows * cols);
    for (let i = 0; i < tiles.length; i++) {
      const k = key(storeBits(tiles[i]));
      let idx = dict.get(k);
      if (idx === undefined) { idx = uniq.length; dict.set(k, idx); uniq.push(tiles[i]); }
      map[i] = idx;
    }
    if (uniq.length > 255) return { ok: false, reason: 'unique-tiles-overflow', unique: uniq.length, map };
    const stored = new Uint8Array(uniq.length * 27);
    for (let i = 0; i < uniq.length; i++) {
      let t = uniq[i];
      if (opt.invert) t = invertBits(t);
      stored.set(storeBits(t), i * 27);
    }
    let ink = 0; for (const t of tiles) for (const v of t) ink += v;
    return { ok: true, map, stored, unique: uniq.length, inkRatio: ink / (rows * cols * 216) };
  }

  // ------------------------------------------------------------------- 写盘
  /** 在 [from,to) 内找最长的 0xFF 空闲区 */
  function freeRuns(buf, from, to, minLen) {
    const out = []; let s = -1;
    for (let i = from; i < to; i++) {
      if (buf[i] === 0xff) { if (s < 0) s = i; }
      else { if (s >= 0 && i - s >= minLen) out.push({ off: s, len: i - s }); s = -1; }
    }
    if (s >= 0 && to - s >= minLen) out.push({ off: s, len: to - s });
    out.sort((a, b) => b.len - a.len);
    return out;
  }
  /**
   * 找字库加载函数的窗口地址立即数。两种已实证的装载格式：
   *   乐华型: 7b ff 7a <hi> 79 <lo>   （R3=FF; R2:R1=地址）
   *   HY 型:  7a <hi> 79 <lo>         （同 R2:R1，无 R3 前缀，如 0x1CA2F: 7a 39 79 6b）
   * 两种格式 hi 与 lo 都相距 2 字节，返回 hi 所在偏移，补丁写法一致。
   */
  function findLoaderRefs(buf, fileOff) {
    const hi = (fileOff & 0xff00) >> 8, lo = fileOff & 0xff;
    const hits = [];
    for (let i = 0; i + 6 <= buf.length; i++) {
      if (buf[i] === 0x7b && buf[i + 1] === 0xff && buf[i + 2] === 0x7a && buf[i + 3] === hi &&
          buf[i + 4] === 0x79 && buf[i + 5] === lo) hits.push(i + 3);
      else if (buf[i] === 0x7a && buf[i + 1] === hi && buf[i + 2] === 0x79 && buf[i + 3] === lo) {
        // HY 型无 7b ff 前缀，误报率略高：要求紧邻 ±8 字节内出现 7b ff（加载器惯例 R3=FF）佐证
        let ok = false;
        for (let k = Math.max(0, i - 8); k < Math.min(buf.length - 1, i + 8); k++) {
          if (buf[k] === 0x7b && buf[k + 1] === 0xff) { ok = true; break; }
        }
        if (ok) hits.push(i + 1);
      }
    }
    return hits;
  }

  /**
   * 生成打过补丁的新固件
   * spec = { buf, mapOff, rows, cols, fontOff, polarity, map(Uint8Array), stored(Uint8Array),
   *          allowRelocate, bankFrom, bankTo }
   */
  /* d335 original: in-place VLC font re-encode + map rewrite with budget planner (2026-09-18) */
  function applyPatch(spec) {
    const src = spec.buf;
    const out = new Uint8Array(src);                          // 复制
    const report = { placedAt: spec.fontOff, relocated: false, loaderPatched: [], notes: [] };
    const blk = encodeBlock(spec.stored);
    const origEnd = spec.fontEnd || decodeBlock(src, spec.fontOff)?.end || (spec.fontOff + blk.length);
    // 1) 原地写
    const inPlaceLimit = origEnd - spec.fontOff;
    if (blk.length <= inPlaceLimit) {
      out.set(blk, spec.fontOff);
      for (let i = spec.fontOff + blk.length; i < origEnd; i++) out[i] = 0xff;
      report.blockBytes = blk.length; report.limit = inPlaceLimit;
    } else if (spec.allowRelocate) {
      // 2) 重定位到同 bank 空闲区 + 改写 loader 立即数
      const refs = findLoaderRefs(src, spec.fontOff);
      if (!refs.length) return { ok: false, reason: 'loader-ref-not-found', report };
      const from = spec.bankFrom == null ? 0x10000 : spec.bankFrom;
      const to = spec.bankTo == null ? 0x18000 : spec.bankTo;
      const runs = freeRuns(src, from, to, blk.length + 32);
      if (!runs.length) return { ok: false, reason: 'no-free-space', report, need: blk.length };
      const target = runs[0].off;
      out.set(blk, target);
      for (let i = target + blk.length; i < Math.min(target + blk.length + 32, out.length); i++) out[i] = 0xff;
      for (const r of refs) { out[r] = (target & 0xff00) >> 8; out[r + 2] = target & 0xff; report.loaderPatched.push(r - 3); }
      report.placedAt = target; report.relocated = true;
      report.blockBytes = blk.length; report.limit = runs[0].len;
      report.notes.push('字库重定位到 0x' + target.toString(16) + '，并改写加载函数立即数 ' + refs.length + ' 处');
    } else {
      return { ok: false, reason: 'too-big', report, need: blk.length, limit: inPlaceLimit };
    }
    // 3) MAP 表（尺寸必须不变）
    if (spec.map.length !== spec.rows * spec.cols) return { ok: false, reason: 'map-size', report };
    out.set(spec.map, spec.mapOff);
    // 4) 验证：从新固件重新解码 + 重绘对比
    const verify = decodeBlock(out, report.placedAt);
    if (!verify) return { ok: false, reason: 'verify-decode-failed', report };
    const equal = verify.stored.length === spec.stored.length &&
      verify.stored.every((v, i) => v === spec.stored[i]);
    report.verified = equal;
    report.bytes = out;
    return { ok: true, bytes: out, report };
  }

  return {
    VLC_CODES, decodeBlock, encodeBlock, scanBlocks,
    bitsOf, storeBits, invertBits,
    render, renderCells, detect, findLogoLoops, detectPolarity, gridStats,
    detectStringRef, composeStringFont, detectMapGrid,
    detectRecordStream, simulateStream, encodeStream, planRecordStream, applyRecordStream,
    findPalette,
    buildFromBitmap, freeRuns, findLoaderRefs, applyPatch,
    // 归属签名（可验证：RTDLogo.SIGNATURE / RTDLogo.verifyAuthor() → true）
    SIGNATURE, verifyAuthor
  };
});
