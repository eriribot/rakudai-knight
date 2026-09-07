import fs from 'node:fs';
import vm from 'node:vm';
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const bundle = '// GENERATED: node scripts/build-state-controller.mjs --write\n(function () {\n\"use strict\";\n' +
  read('../世界书规则/MVU/schema.mjs').replace(/^export /gm, '') + '\n' +
  read('./rakudai-state-core.mjs').replace(/^export /gm, '') + '\n' +
  read('./rakudai-state-browser.js') + '\n})();\n';
new vm.Script(bundle);
const file = new URL('./rakudai-state-controller.js', import.meta.url);
const pageFile = new URL('../第一卷-世界书整理/开局页面/index.html', import.meta.url);
const page = fs.readFileSync(pageFile, 'utf8');
const block = '<!-- RK_STATE_CONTROLLER_BEGIN -->\n<script>\n' + bundle.replace(/<\/script/gi, '<\\/script') + '</script>\n<!-- RK_STATE_CONTROLLER_END -->';
const expression = /<!-- RK_STATE_CONTROLLER_BEGIN -->[\s\S]*?<!-- RK_STATE_CONTROLLER_END -->/;
const nextPage = expression.test(page) ? page.replace(expression, () => block) : page.replace(/<script(?:\s[^>]*)?>/, match => block + '\n' + match);
if (process.argv.includes('--write')) {
  fs.writeFileSync(file, bundle);
  if (process.argv.includes('--page')) fs.writeFileSync(pageFile, nextPage);
  console.log('已生成共享状态控制器' + (process.argv.includes('--page') ? '并内联到开局页' : '（尚未改开局页）'));
} else {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== bundle) throw new Error('共享控制器产物不同步');
  if (process.argv.includes('--page') && nextPage !== page) throw new Error('开局页控制器不同步');
  console.log('共享状态控制器与来源同步。');
}
