import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { migrateV2 } from '../世界书规则/MVU/schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'output/worldbook-calibration/dev/package.json'));
const { z } = require('zod');
const args = process.argv.slice(2);
function option(name) { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; }
const input = option('--input');
if (!input) throw new Error('使用 --input <原始stat_data.json> [--out <新文件.json>]。默认只验证，不写文件。');
const state = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
if (Object.hasOwn(state, 'stat_data')) throw new Error('输入须为单独的 stat_data 树；不迁移整个 MVU 楼层包装或显示缓存');
const migrated = migrateV2(state, z);
const output = option('--out');
if (output) {
  const target = path.resolve(output);
  if (!target.startsWith(root + path.sep)) throw new Error('输出须在当前项目内');
  if (fs.existsSync(target)) throw new Error('不覆盖已有文件，请选择新的输出路径');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(migrated, null, 2) + '\n', { flag: 'wx' });
  console.log(`已生成离线迁移候选：${target}；未写入酒馆。`);
} else console.log('离线迁移与 v3 校验通过；未写文件，未修改原始数据。');
