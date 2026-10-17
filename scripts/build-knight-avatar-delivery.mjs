#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Rebuild the current B1 from maintained sources, including the shared avatar manifest.
// The historical avatar-only patcher cannot carry newer terminal fixes.
// Uses prepared PNGs; does not crop artwork, change MVU fields, or package a whole card.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentTools = '.agents/skills/sillytavern-component-update/scripts/';
const spec = 'scripts/正文气泡/发布/update-spec.json';
const output = 'scripts/正文气泡/发布/components';
const steps = [
  ['scripts/build-state-controller.mjs', '--write'],
  ['scripts/黑白ADV轮盘终端/build.js'],
  [componentTools + 'validate-importable-component.mjs', '世界书规则/MVU/落第骑士-小手机-v1.3.29-B1-头像更新.json'],
  ['scripts/正文气泡/build.mjs'],
  [componentTools + 'plan-component-update.mjs', '--spec', spec, '--out', output],
  [componentTools + 'build-importable-component.mjs', '--spec', spec, '--out', output, '--write'],
  [componentTools + 'validate-importable-component.mjs', output],
  ['scripts/正文气泡/check-artifact.mjs'],
];

try {
  const candidatePath = path.resolve(root, output, 'dialogue-player-candidates.regex.json');
  const candidateBefore = fs.readFileSync(candidatePath);
  for (const args of steps) {
    execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
    if (args[0] === componentTools + 'build-importable-component.mjs') {
      // Avatar-only updates keep rule 02 intact, including its existing line endings.
      assert.deepEqual(JSON.parse(fs.readFileSync(candidatePath, 'utf8')), JSON.parse(candidateBefore.toString('utf8')),
        '02 OC 候选发生非头像变化；请单独审查规则更新');
      fs.writeFileSync(candidatePath, candidateBefore);
      const manifestPath = path.resolve(root, output, 'component-update-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const candidate = manifest.artifacts.find(item => item.relativePath === path.basename(candidatePath));
      assert.ok(candidate, '组件清单缺少 02 OC 候选');
      candidate.sha256 = createHash('sha256').update(candidateBefore).digest('hex');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    }
  }
  console.log('头像组件打包完成：世界书规则/MVU/落第骑士-小手机-v1.3.29-B1-头像更新.json，以及正文气泡 01／03；02 保留。停用对应旧组件后导入并重载。');
} catch (error) {
  console.error('打包未完成，请先修复上方报错；不要导入未完成的产物。');
  process.exitCode = Number.isInteger(error.status) && error.status !== 0 ? error.status : 1;
}
