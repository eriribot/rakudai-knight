#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildTerminal, directory } from './bundle.mjs';

// 维护源文件，产物只由这一入口生成；验证失败时不写出 JSON。
const { artifact, html, map, version } = buildTerminal();
const output = path.resolve(directory, '../酒馆助手脚本-小手机-黑白ADV轮盘版-v' + version + '.json');
const dist = path.join(directory, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'terminal.js'), artifact.content);
fs.writeFileSync(path.join(dist, 'terminal.js.map'), JSON.stringify(map));
fs.writeFileSync(path.join(dist, 'terminal-app.html'), html);
fs.writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n');
console.log('已构建：' + output);
console.log('已检查完整宿主 HTML → JS 解析链；附 sourceURL 和内联 source map。');
console.log('调试副本：' + path.join(dist, 'terminal.js'));
