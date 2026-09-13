import fs from 'node:fs';
import vm from 'node:vm';
import { inlineStoryCatalog, stripModuleSyntax } from './story-build.mjs';
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const bundle = '// GENERATED: node scripts/build-state-controller.mjs --write\n(function () {\n\"use strict\";\n' +
  inlineStoryCatalog() + '\n' +
  stripModuleSyntax(read('../世界书规则/MVU/schema.mjs')) + '\n' +
  stripModuleSyntax(read('./rakudai-state-core.mjs')) + '\n' +
  read('./rakudai-state-browser.js') + '\n})();\n';
new vm.Script(bundle);
const file = new URL('./rakudai-state-controller.js', import.meta.url);
const pageFile = new URL('../第一卷-世界书整理/开局页面/index.html', import.meta.url);
const replacementFile = new URL('../第一卷-世界书整理/开局页面/正则替换文本.txt', import.meta.url);
const page = fs.readFileSync(pageFile, 'utf8');
const block = '<!-- RK_STATE_CONTROLLER_BEGIN -->\n<script>\n' + bundle.replace(/<\/script/gi, '<\\/script') + '</script>\n<!-- RK_STATE_CONTROLLER_END -->';
const expression = /<!-- RK_STATE_CONTROLLER_BEGIN -->[\s\S]*?<!-- RK_STATE_CONTROLLER_END -->/;
const nextPage = expression.test(page) ? page.replace(expression, () => block) : page.replace(/<script(?:\s[^>]*)?>/, match => block + '\n' + match);
// 正则替换文本与页面只有代码围栏之差，--page必须同时生成，避免导入旧schema副本。
const replacement = '```\n' + nextPage.trim() + '\n```';
if (process.argv.includes('--write')) {
  fs.writeFileSync(file, bundle);
  if (process.argv.includes('--page')) {
    fs.writeFileSync(pageFile, nextPage);
    fs.writeFileSync(replacementFile, replacement);
  }
  console.log('已生成共享状态控制器' + (process.argv.includes('--page') ? '并同步开局页与正则替换文本' : '（尚未改开局页）'));
} else {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== bundle) throw new Error('共享控制器产物不同步');
  if (process.argv.includes('--page') && nextPage !== page) throw new Error('开局页控制器不同步');
  if (process.argv.includes('--page') && (!fs.existsSync(replacementFile) || fs.readFileSync(replacementFile, 'utf8').replace(/\r\n/g, '\n').trim() !== replacement)) throw new Error('开局页正则替换文本不同步');
  console.log('共享状态控制器与来源同步。');
}
