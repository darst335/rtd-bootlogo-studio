/* RTD 开机 Logo 工作室 —— 单文件 EXE 版内置服务
 * 目标运行时：Node 12.22.12（最后一个官方支持 Windows 7 的版本）
 * 因此本文件刻意只使用 ES2017 及更早语法：不使用 ?. / ?? / replaceAll / at()
 *
 * 与开发版 server.js 的区别：
 *   1. HTML 与自身同目录（SFX 解压目录），多路径兜底
 *   2. 自动挑空闲端口
 *   3. 自动打开默认浏览器
 *   4. 页面关闭后自动退出（无窗口残留）；最长空闲 2 小时兜底
 *   5. 日志写到 %TEMP%\RTDLogoStudio.log（exe 运行时无控制台）
 */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var os = require('os');
var cp = require('child_process');

var SECURE = /\.(bin|rom|img)$/i;
var SKIP_DIR = /^\$|^System Volume Information$|^\./;
var IDLE_EXIT_MS = 2 * 60 * 60 * 1000;   // 兜底：2 小时无任何请求自动退出
var BYE_GRACE_MS = 25000;                // 页面关闭后 25 秒无新请求则退出

var PORT_START = 8619;
var noOpen = false, noExit = false;
process.argv.slice(2).forEach(function (a) {
  if (a === '--no-open') noOpen = true;
  else if (a === '--no-exit') noExit = true;
  else if (a.indexOf('--port') === 0) PORT_START = parseInt(a.split('=')[1] || '8619', 10) || 8619;
});

/* ------------------------------------------------------------------ 日志 */
var LOG = path.join(os.tmpdir(), 'RTDLogoStudio.log');
function log(msg) {
  var line = '[' + new Date().toISOString().replace('T', ' ').slice(0, 19) + '] ' + msg + '\r\n';
  try { fs.appendFileSync(LOG, line); } catch (e) { }
}

/* -------------------------------------------------------------- HTML 定位 */
function findHtml() {
  var names = ['RTD开机Logo编辑器.html', 'RTD开机Logo工作室.html'];
  var dirs = [__dirname, path.join(__dirname, '..'), path.join(__dirname, '..', '..'), process.cwd()];
  for (var i = 0; i < dirs.length; i++) {
    for (var j = 0; j < names.length; j++) {
      var p = path.join(dirs[i], names[j]);
      try { if (fs.statSync(p).isFile()) return p; } catch (e) { }
    }
  }
  return null;
}
var HTML_PATH = findHtml();
if (!HTML_PATH) { log('找不到界面文件 HTML，退出'); process.exit(2); }
var HTML_BUF = fs.readFileSync(HTML_PATH);
log('界面文件: ' + HTML_PATH + ' (' + HTML_BUF.length + ' B)');

/* ------------------------------------------------------------ 文件浏览 API */
function listDir(dir) {
  var es = fs.readdirSync(dir, { withFileTypes: true });
  var dirs = [], bins = [];
  for (var i = 0; i < es.length; i++) {
    var e = es[i];
    if (SKIP_DIR.test(e.name)) continue;
    var p = path.join(dir, e.name);
    if (e.isDirectory()) dirs.push({ name: e.name, path: p });
    else if (e.isFile() && SECURE.test(e.name)) {
      var size = 0; try { size = fs.statSync(p).size; } catch (_) { }
      bins.push({ name: e.name, path: p, size: size });
    }
  }
  dirs.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh'); });
  bins.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh'); });
  var parent = null;
  try { var up = path.dirname(dir); if (up !== dir) parent = up; } catch (_) { }
  return { dir: dir, parent: parent, dirs: dirs, bins: bins };
}
function drives() {
  var out = [];
  for (var c = 65; c <= 90; c++) {
    var d = String.fromCharCode(c) + ':\\';
    try { fs.statSync(d); out.push(d); } catch (_) { }
  }
  return out;
}
function homeDir() {
  var h = process.env.USERPROFILE || ('C:\\Users\\' + (process.env.USERNAME || ''));
  try { if (fs.statSync(h).isDirectory()) return h; } catch (_) { }
  return 'C:\\';
}

/* ------------------------------------------------------------------ 路由 */
var lastHit = Date.now();
var byeTimer = null;

/* 启动时清理此前自解压遗留的临时目录（跳过自己所在的）。
 * SFX 宿主进程启动后即退出，不会自己清理，所以由我们来扫。
 * 有实例还在用某个目录时 rmdir 会失败 → 自动跳过，安全。 */
function purgeOldExtract() {
  try {
    var tmp = os.tmpdir(), self = __dirname, n = 0;
    var names = fs.readdirSync(tmp);
    for (var i = 0; i < names.length; i++) {
      if (!/^7ZipSfx\.\d+$/.test(names[i])) continue;
      var p = path.join(tmp, names[i]);
      if (p === self) continue;
      try { fs.rmdirSync(p, { recursive: true }); n++; } catch (e) { }
    }
    if (n) log('已清理 ' + n + ' 个旧的解压残留目录');
  } catch (e) { }
}

function exitNow() {
  log('页面已关闭，后台退出');
  // 自解压（exe）模式下顺手删掉自己的解压目录：延时等本进程退出、node.exe 解锁后再删。
  // 注意 cmd 命令里不能再嵌引号（会被转义搞坏），所以写成一个 .bat 再跑；
  // 路径含非 ASCII 时 cmd 读 bat 可能乱码 → 这种情况跳过（下次启动时由 purgeOldExtract 扫掉）。
  try {
    var tmpRoot = os.tmpdir().toLowerCase().replace(/\\+$/, '');
    var here = __dirname.toLowerCase().replace(/\\+$/, '');
    if (here !== tmpRoot && here.indexOf(tmpRoot + '\\') === 0 && /^[\x20-\x7E]+$/.test(__dirname)) {
      var bat = path.join(os.tmpdir(), 'rtd_logo_cleanup.bat');
      fs.writeFileSync(bat, '@echo off\r\nping -n 3 127.0.0.1 >nul\r\nrmdir /s /q "' + __dirname + '"\r\n');
      cp.spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    }
  } catch (e) { }
  process.exit(0);
}

function handler(req, res) {
  lastHit = Date.now();
  // 退出宽限期内的请求处理：
  //   重新打开界面  → 完全取消退出
  //   其它 API 调用 → 说明还有人在用，重置倒计时
  //   无关请求（favicon 等）→ 不影响，避免浏览器杂项请求把退出顶掉
  var isPage = (req.url === '/' || req.url.indexOf('/index.html') === 0);
  var isApi = (req.url.indexOf('/api/') === 0);
  if (byeTimer && isPage) {
    clearTimeout(byeTimer); byeTimer = null; log('界面重新打开，取消退出');
  } else if (byeTimer && isApi) {
    clearTimeout(byeTimer); byeTimer = setTimeout(exitNow, BYE_GRACE_MS);
  }

  var qi = req.url.indexOf('?');
  var pathname = qi < 0 ? req.url : req.url.slice(0, qi);
  var query = qi < 0 ? '' : req.url.slice(qi + 1);
  function qs(name) {
    var m = query.match(new RegExp('(?:^|&)' + name + '=([^&]*)'));
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  }

  try {
    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(HTML_BUF);
    }
    if (pathname === '/api/roots') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ roots: drives(), home: homeDir() }));
    }
    if (pathname === '/api/list') {
      var dir = qs('dir');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      if (!dir) return res.end(JSON.stringify(listDir(homeDir())));
      var st = fs.statSync(dir);
      if (!st.isDirectory()) throw new Error('不是文件夹');
      return res.end(JSON.stringify(listDir(dir)));
    }
    if (pathname === '/api/load') {
      var lp = qs('path');
      if (!lp || !SECURE.test(lp)) throw new Error('仅支持 .bin/.rom/.img');
      var buf = fs.readFileSync(lp);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
      log('load ' + lp + '  ' + buf.length + ' B');
      return res.end(buf);
    }
    if (pathname === '/api/save' && req.method === 'POST') {
      var sp = qs('path');
      var chunks = [], got = 0;
      req.on('data', function (c) { chunks.push(c); got += c.length; });
      req.on('end', function () {
        try {
          if (!sp || !SECURE.test(sp)) throw new Error('仅支持覆盖 .bin/.rom/.img 文件');
          var data = Buffer.concat(chunks);
          var st2 = fs.statSync(sp);
          if (st2.size !== data.length) {
            throw new Error('原文件大小与新固件不一致（' + st2.size + '≠' + data.length + '），拒绝覆盖');
          }
          var ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
          var backup = sp + '.bak-' + ts;
          fs.copyFileSync(sp, backup);
          fs.writeFileSync(sp, data);
          log('save ' + sp + '  ' + data.length + ' B  (备份: ' + path.basename(backup) + ')');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, backup: backup }));
        } catch (e) {
          log('save 拒绝: ' + e.message + ' (收到 ' + got + ' B)');
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }
    if (pathname === '/api/bye') {                       // 页面关闭信号
      res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('bye');
      if (!noExit) {
        if (byeTimer) clearTimeout(byeTimer);
        byeTimer = setTimeout(exitNow, BYE_GRACE_MS);
        log('收到页面关闭信号，' + Math.round(BYE_GRACE_MS / 1000) + ' 秒后退出');
      }
      return;
    }
    if (pathname === '/api/exit') {                      // 界面上的"退出程序"按钮
      res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('exiting');
      log('用户请求退出');
      setTimeout(function () { process.exit(0); }, 400);
      return;
    }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    log('ERR ' + pathname + ': ' + e.message);
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

/* ------------------------------------------------------------ 启动与端口 */
purgeOldExtract();
var server = http.createServer(handler);
var port = PORT_START, tries = 0;
server.on('error', function (e) {
  if (e.code === 'EADDRINUSE' && tries < 20) { tries++; port++; server.listen(port, '127.0.0.1'); }
  else { log('启动失败: ' + e.message); process.exit(3); }
});
server.listen(port, '127.0.0.1', function () {
  var url = 'http://127.0.0.1:' + port + '/';
  log('服务已启动 ' + url);
  if (!noOpen) {
    try { cp.exec('start "" "' + url + '"'); } catch (e) { log('打开浏览器失败: ' + e.message); }
  }
  if (!noExit) {
    setInterval(function () {
      if (Date.now() - lastHit > IDLE_EXIT_MS) { log('空闲超时，退出'); process.exit(0); }
    }, 60000);
  }
});
