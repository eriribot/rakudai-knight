#!/usr/bin/env node
import fs from 'node:fs';
import sourceMap from 'source-map-js';
const args = process.argv.slice(2);
const offsetIndex = args.indexOf('--offset');
const offset = offsetIndex === -1 ? 0 : Number(args[offsetIndex + 1]);
const line = Number(args[0]), column = args[1] && args[1] !== '--offset' ? Number(args[1]) : 1;
if (!Number.isInteger(line) || !Number.isInteger(column) || !Number.isInteger(offset) || line - offset < 1 || column < 1) {
  console.error('用法：node locate-error.mjs <terminal.js行号> [列号] [--offset 已确认的宿主前置行数]');
  process.exit(1);
}
const map = JSON.parse(fs.readFileSync(new URL('./dist/terminal.js.map', import.meta.url), 'utf8'));
const consumer = new sourceMap.SourceMapConsumer(map);
const original = consumer.originalPositionFor({ line: line - offset, column: column - 1 });
if (!original.source) throw new Error('此位置没有源映射；先确认使用同一版本产物及正确的包装偏移。');
console.log(original.source + ':' + original.line + ':' + (original.column + 1));
const lines = consumer.sourceContentFor(original.source).split('\n');
for (let index = Math.max(0, original.line - 3); index < Math.min(lines.length, original.line + 2); index++) {
  console.log((index + 1 === original.line ? '> ' : '  ') + (index + 1) + ' | ' + lines[index]);
}
