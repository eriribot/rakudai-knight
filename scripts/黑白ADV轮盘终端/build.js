#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const read = file => fs.readFileSync(path.resolve(directory, file), 'utf8').replace(/^\uFEFF/, '');
const version = '1.3.0';
const html = read('terminal-app.html');
const modules = {
  STATE_CONTROLLER: read('../rakudai-state-controller.js'),
  LAYOUT: read('layout.js'),
  STYLES: JSON.stringify(read('styles.css')),
  WHEEL: read('wheel.js'),
  APP_HTML: JSON.stringify(html),
  STATE_PANEL: read('state-panel.js'),
};
let content = read('main.js');
for (const [name, source] of Object.entries(modules)) {
  const marker = '/*__INJECT_' + name + '__*/';
  if (content.split(marker).length !== 2) throw new Error('注入标记必须且只能出现一次：' + marker);
  content = content.replace(marker, () => source);
}
if (/__INJECT_[A-Z_]+__/.test(content)) throw new Error('仍有未替换的注入标记');
new vm.Script(content, { filename: 'terminal-v' + version + '.js' });
let inlineScripts = 0;
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
  new vm.Script(match[1], { filename: 'terminal-app-inline-' + (++inlineScripts) + '.js' });
}
if (!inlineScripts) throw new Error('内嵌终端脚本缺失');
const artifact = {
  type: 'script', enabled: true,
  name: '落第骑士·黑白ADV轮盘终端 v' + version,
  id: 'ee190b2f-d2ba-44b4-9f1b-0695c07fefc5',
  content,
  info: '黑白轮盘终端；第一卷剧情按钮读取共享 MVU 状态。导入替换旧版，不要同时启用多个版本。',
  button: { enabled: true, buttons: [] }, data: {},
};
const output = path.resolve(directory, '../酒馆助手脚本-小手机-黑白ADV轮盘版-v' + version + '.json');
fs.writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
console.log('已构建：' + output);
console.log('脚本语法通过，' + inlineScripts + ' 个内嵌脚本语法通过，内容 ' + Buffer.byteLength(content) + ' 字节。');
