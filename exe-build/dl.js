// 下载 Win7 兼容的 Node 12.22.12 win-x64（官方最后官方支持 Win7 的版本）
const https = require('https'), fs = require('fs'), path = require('path');

const OUT = 'C:/Users/Administrator/WorkBuddy/2026-09-17-22-17-40/logo-studio/exe-build';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const TARGET = path.join(OUT, 'node-v12.22.12-win-x64.zip');
const URLS = [
  'https://registry.npmmirror.com/-/binary/node/v12.22.12/node-v12.22.12-win-x64.zip',
  'https://nodejs.org/dist/v12.22.12/node-v12.22.12-win-x64.zip'
];

function download(url, idx) {
  console.log('[dl] ' + url);
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, idx).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let got = 0, last = 0;
      const ws = fs.createWriteStream(TARGET);
      res.on('data', c => {
        got += c.length;
        if (total && got - last > 2 * 1024 * 1024) { last = got; process.stdout.write('  ' + (got / 1048576).toFixed(1) + '/' + (total / 1048576).toFixed(1) + ' MB\r'); }
      });
      res.pipe(ws);
      ws.on('finish', () => { console.log('\n[dl] 完成 ' + (fs.statSync(TARGET).size / 1048576).toFixed(1) + ' MB'); resolve(TARGET); });
      ws.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', e => {
      if (idx + 1 < URLS.length) { console.log('[dl] fail ' + e.message + ' → 换源'); return download(URLS[idx + 1], idx + 1).then(resolve, reject); }
      reject(e);
    });
  });
}

download(URLS[0], 0).then(p => console.log('OK ' + p), e => { console.log('FAIL ' + e.message); process.exit(1); });
