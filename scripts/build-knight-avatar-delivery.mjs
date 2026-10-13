#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Rebuild the existing avatar consumers after editing manifest.imageUrl.
// Uses prepared PNGs; does not crop artwork, change versions, or package a whole card.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentTools = '.agents/skills/sillytavern-component-update/scripts/';
const spec = 'scripts/正文气泡/发布/update-spec.json';
const output = 'scripts/正文气泡/发布/components';
const steps = [
  ['scripts/黑白ADV轮盘终端/build.js'],
  ['scripts/黑白ADV轮盘终端/preview.mjs'],
  ['scripts/正文气泡/build.mjs'],
  [componentTools + 'plan-component-update.mjs', '--spec', spec, '--out', output],
  [componentTools + 'build-importable-component.mjs', '--spec', spec, '--out', output, '--write'],
  [componentTools + 'validate-importable-component.mjs', output],
  ['scripts/正文气泡/check-artifact.mjs'],
];

try {
  for (const args of steps) execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  console.log('头像组件打包完成：使用当前版本的小手机 JSON，以及正文气泡 01／03；重新导入以应用新图床地址。');
} catch (error) {
  console.error('打包未完成，请先修复上方报错；不要导入未完成的产物。');
  process.exitCode = Number.isInteger(error.status) && error.status !== 0 ? error.status : 1;
}
