/* 打包：把引擎 + UI 内联进模板，产出单文件 HTML */
const fs = require('fs'), path = require('path');
const dir = __dirname;
const tpl = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');
const eng = fs.readFileSync(path.join(dir, 'rtd-logo-engine.js'), 'utf8');
const i18n = fs.readFileSync(path.join(dir, 'i18n.js'), 'utf8');
const ui = fs.readFileSync(path.join(dir, 'ui.js'), 'utf8');
if (!tpl.includes('/*__ENGINE__*/') || !tpl.includes('/*__I18N__*/') || !tpl.includes('/*__UI__*/')) throw new Error('template placeholder missing');
const out = tpl
  .replace('/*__ENGINE__*/', () => eng)
  .replace('/*__I18N__*/', () => i18n)
  .replace('/*__UI__*/', () => ui);
/* 构建水印：成品里唯一的时间戳标记，可证明构建来源（d335） */
const buildTag = '<!-- D335-RTDLOGO build ' + new Date().toISOString()
  + ' | author darst335 | co-developed with AI pair | verify: RTDLogo.verifyAuthor() -->\n</html>';
const outTagged = out.replace(/<\/html>\s*$/, buildTag);
const dest = path.join(dir, '..', 'RTD开机Logo编辑器.html');
fs.writeFileSync(dest, outTagged);
console.log('built:', dest, (outTagged.length / 1024).toFixed(1) + ' KB');
console.log('authorship tag: darst335 (D335-RTDLOGO)');
