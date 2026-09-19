/* 打包单文件 EXE（Win7 兼容）
 * 原理：7zSD.sfx（自解压模块，纯原生 32 位，Win7/XP 均可运行）
 *      + config.txt（UTF-8，RunProgram 静默启动内置 Node）
 *      + payload.7z（node.exe 12.22.12 + server.js + 界面 HTML + 说明）
 *   三者按顺序二进制拼接即为单文件 exe。
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');

const DIR = __dirname;
const WS = path.join(DIR, '..', '..');                       // workspace 根
const PAYLOAD = path.join(DIR, 'payload');
const SFX = 'E:/Program Files/7z SFX Builder/3rdParty/Modules/7zsd_All.sfx';  // 支持 hidcon: / GUIMode
const SEVENZ = 'E:/Program Files/7-Zip x64/7z.exe';
const OUT_NAME = 'RTD开机Logo工作室.exe';
const OUT = path.join(WS, OUT_NAME);

function step(n, msg) { console.log('[' + n + '] ' + msg); }

/* 1. 重新生成界面 HTML */
step(1, '生成界面 HTML …');
cp.execFileSync(process.execPath, [path.join(DIR, '..', 'build.js')], { stdio: 'inherit' });
const builtHtml = path.join(WS, 'RTD开机Logo编辑器.html');
if (!fs.existsSync(builtHtml)) throw new Error('HTML 未生成');
fs.mkdirSync(PAYLOAD, { recursive: true });
fs.copyFileSync(builtHtml, path.join(PAYLOAD, 'RTD开机Logo编辑器.html'));
console.log('    → payload/RTD开机Logo编辑器.html  ' + fs.statSync(builtHtml).size + ' B');

/* 2. 服务端脚本 */
step(2, '复制内置服务 …');
fs.copyFileSync(path.join(DIR, 'server.js'), path.join(PAYLOAD, 'server.js'));
if (!fs.existsSync(path.join(PAYLOAD, 'node.exe'))) throw new Error('payload/node.exe 缺失（先运行 dl.js）');

/* 3. 使用说明（UTF-8 BOM，Win7 记事本可读） */
step(3, '写使用说明 …');
const README = [
  'RTD 开机 Logo 工作室  ·  单文件版',
  '=========================================',
  '',
  '【作者 / Author】',
  '  © darst335  ·  项目代号 D335-RTDLOGO（2026-09）',
  '  本工具由 darst335 与 AI 结对开发：需求设计、真实固件样本、',
  '  刷机实证与逐项验收均由 darst335 完成，引擎与界面为原创作品。',
  '  转载 / 分享请保留本署名。验证：界面连点 3 次「© darst335」。',
  '  EN: Original work by darst335, pair-programmed with an AI assistant.',
  '  Not copied from any third-party tool. Please keep this notice.',
  '',
  '【实测基准 / Tested on】',
  '  RTD2270CLW 主控，驱动板版号 RTD270CLW-R10.1 20.1',
  '  注意：RTD2270 与 RTD2270CLW 是两种不同芯片，固件不通用',
  '  （「RTD2270C」就是指 RTD2270CLW）；其他型号均未测试，',
  '  请自行测试验证，刷机前务必备份原始固件。',
  '  EN: RTD2270 and RTD2270CLW are two different chips with',
  '  incompatible firmware ("RTD2270C" = RTD2270CLW). All other models',
  '  are untested — test on your own hardware and keep a backup first.',
  '',
  '【怎么用】',
  '  双击本 exe → 自动打开浏览器进入界面 → 用完关掉浏览器页面即可。',
  '  后台程序会在页面关闭 25 秒后自动退出，不留残留进程；',
  '  也可以点界面右上角「退出程序」立即退出。',
  '',
  '【支持的固件】',
  '  1) 静态 MAP 型：乐华 LM190WH1 / RTD2270CLW 那一类（CDrawLogo 网格铺字）',
  '  2) 品牌字库串引用型：液晶显示器_标定版 / HYUNDAI / ENVISION 那类（512KB）',
  '  3) OSD 记录流型：MAZON / RTD270 那一类（COsdFxCodeWrite 数据流）',
  '  识别不出时界面会明确提示。',
  '',
  '【改 logo 的两种保存方式】',
  '  · 「从电脑打开…」挑固件 → 改完点「直接替换原文件」',
  '      写入前自动备份：原文件名.bak-时间戳（同一目录）',
  '  · 「生成新固件」：把改好的 .bin 另存 / 下载，自己用编程器刷回',
  '',
  '【系统要求】',
  '  · Windows 7 SP1 / 8 / 8.1 / 10 / 11，32 位与 64 位均可',
  '  · 需要现代浏览器（Chrome / Edge / Firefox）。程序会自动调用系统默认浏览器。',
  '    Windows 7 提示：IE 太旧跑不动本界面，请用 Chrome 109 或 Firefox ESR 115。',
  '  · 不需要安装 Node.js，不需要联网，不写注册表。',
  '',
  '【安全说明】',
  '  · 只监听 127.0.0.1（本机回环），端口 8619 起自动找空位，不对外开放。',
  '  · 刷机有风险，务必保留原始固件备份。',
  '  · 其他型号固件未测试，识别失败或刷后异常请到 GitHub Issues 反馈：',
  '    https://github.com/darst335/rtd-bootlogo-studio/issues',
  ''
].join('\r\n');
fs.writeFileSync(path.join(PAYLOAD, '使用说明.txt'), '\ufeff' + README);

/* 4. 压缩 payload */
step(4, '7z 压缩（LZMA2 -mx=9，约需 1 分钟）…');
const ARC = path.join(DIR, 'payload.7z');
try { fs.unlinkSync(ARC); } catch (e) { }
cp.execFileSync(SEVENZ, ['a', '-t7z', '-mx=9', '-m0=lzma2', '-ms=on', ARC, path.join(PAYLOAD, '*')], { stdio: 'inherit' });
console.log('    → payload.7z  ' + (fs.statSync(ARC).size / 1048576).toFixed(2) + ' MB');

/* 5. 写 config.txt 并拼接 */
step(5, '拼接 exe …');
const CFG = path.join(DIR, 'config.txt');
fs.writeFileSync(CFG, [
  ';!@Install@!UTF-8!',
  'Title="RTD 开机 Logo 工作室 © darst335"',
  'Progress="no"',
  'GUIMode="2"',
  'RunProgram="hidcon:node.exe server.js"',
  ';!@InstallEnd@!',
  '; authorship: darst335 / D335-RTDLOGO / 2026-09 / original work with AI pair',
  ''
].join('\r\n'), 'utf8');
if (!fs.existsSync(SFX)) throw new Error('找不到 7zSD.sfx: ' + SFX);
const buf = Buffer.concat([fs.readFileSync(SFX), fs.readFileSync(CFG), fs.readFileSync(ARC)]);
fs.writeFileSync(OUT, buf);
console.log('    → ' + OUT + '  ' + (buf.length / 1048576).toFixed(2) + ' MB');
console.log('\n完成 ✔');
