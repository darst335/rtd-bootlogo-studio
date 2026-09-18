/* RTD 开机 Logo 工作室 —— 本地服务
 * 提供三个浏览器模式做不到的能力：
 *   1. 直接替换原固件文件（自动先备份 .bak-时间戳）
 *   2. 从电脑任意目录挑固件（浏览器 file:// 拿不到完整路径）
 * 仅监听 127.0.0.1，无外部依赖。
 * 用法：node server.js  [可选: --no-open 不自动开浏览器] [--port 8619]
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const HTML = path.join(__dirname, '..', 'RTD开机Logo编辑器.html');
let PORT = 8619, OPEN = true;
process.argv.slice(2).forEach(a => {
  if (a === '--no-open') OPEN = false;
  else if (a.startsWith('--port')) PORT = parseInt(a.split('=')[1] || '8619', 10) || 8619;
});

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };
const SAFE_EXT = /\.(bin|rom|img)$/i;
const SKIP_DIR = /^\$RECYCLE\.BIN$|System Volume Information|^\./;

function listDir(dir) {
  const es = fs.readdirSync(dir, { withFileTypes: true });
  const dirs = [], bins = [];
  for (const e of es) {
    if (e.name.startsWith('$') || SKIP_DIR.test(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) dirs.push({ name: e.name, path: p });
    else if (e.isFile() && SAFE_EXT.test(e.name)) {
      let size = 0; try { size = fs.statSync(p).size; } catch (_) { }
      bins.push({ name: e.name, path: p, size });
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  bins.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  let parent = null; try { parent = path.dirname(dir); } catch (_) { }
  return { dir, parent: parent !== dir ? parent : null, dirs, bins };
}
function drives() {
  const out = [];
  for (let c = 65; c <= 90; c++) {
    const d = String.fromCharCode(c) + ':\\';
    try { fs.statSync(d); out.push(d); } catch (_) { }
  }
  return out;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  try {
    if (u.pathname === '/' || u.pathname === '/index.html') {
      const html = fs.readFileSync(HTML);
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      return res.end(html);
    }
    if (u.pathname === '/api/roots') {
      return res.end(JSON.stringify({ roots: drives() }));
    }
    if (u.pathname === '/api/list') {
      const dir = u.searchParams.get('dir') || '';
      if (!dir) {
        const home = 'C:/Users/' + process.env.USERNAME;
        return res.end(JSON.stringify(listDir(fs.existsSync(home) ? home : 'C:/')));
      }
      const st = fs.statSync(dir);
      if (!st.isDirectory()) throw new Error('不是文件夹');
      return res.end(JSON.stringify(listDir(dir)));
    }
    if (u.pathname === '/api/load') {
      const p = u.searchParams.get('path');
      if (!p || !SAFE_EXT.test(p)) throw new Error('仅支持 .bin/.rom/.img');
      const buf = fs.readFileSync(p);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      return res.end(buf);
    }
    if (u.pathname === '/api/save' && req.method === 'POST') {
      const p = u.searchParams.get('path');
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        try {
          if (!p || !SAFE_EXT.test(p)) throw new Error('仅支持覆盖 .bin/.rom/.img 文件');
          const buf = Buffer.concat(chunks);
          const st = fs.statSync(p);
          if (st.size !== buf.length) throw new Error('原文件大小与新固件不一致（' + st.size + '≠' + buf.length + '），拒绝覆盖');
          const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
          const backup = p + '.bak-' + ts;
          fs.copyFileSync(p, backup);
          fs.writeFileSync(p, buf);
          console.log('[save] ' + p + '  ' + buf.length + 'B  (备份: ' + backup + ')');
          res.end(JSON.stringify({ ok: true, backup }));
        } catch (e) {
          console.log('[save] 拒绝: ' + e.message);
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }
    if (MIME[path.extname(u.pathname)] && fs.existsSync(path.join(__dirname, u.pathname))) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(u.pathname)] });
      return res.end(fs.readFileSync(path.join(__dirname, u.pathname)));
    }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + PORT;
  console.log('RTD 开机 Logo 工作室已启动: ' + url + '   (Ctrl+C 退出)');
  if (OPEN) {
    const cmd = process.platform === 'win32' ? 'start "" "' + url + '"' : 'xdg-open "' + url + '"';
    exec(cmd, () => { });
  }
});
