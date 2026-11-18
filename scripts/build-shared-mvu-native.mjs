import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { inlineStoryCatalog, stripModuleSyntax } from './story-build.mjs';

const target = new URL('../世界书规则/MVU/落第骑士-MVU-原生兼容-N04.json', import.meta.url);
export function buildNativeMvuArtifact() {
  const artifact = JSON.parse(fs.readFileSync(target, 'utf8'));
  const body = ['rakudai-mvu-structure.mjs', 'rakudai-mvu-patch.mjs', 'rakudai-mvu-native.mjs']
    .map(file => stripModuleSyntax(fs.readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n'))).join('\n');
  const content = `// GENERATED: node scripts/build-shared-mvu-native.mjs --write
(function () {
"use strict";
${inlineStoryCatalog()}
${body}
window.RakudaiMvuNative = { version: "N04", runtime: rakudaiMvuRuntime, prepare: prepareRakudaiNativeMvu, install: installRakudaiNativeMvu };
void installRakudaiNativeMvu(window);
})();
`;
  new vm.Script(content);
  const note = ' 双作品W02：作品由开局确认；学战按独立字段保存，不补落第成长；共用人际。主补丁不能切作品，学战必要字段非法时回退本批，不改未知资料或历史楼层。';
  artifact.content = content;
  artifact.name = '落第 × 学战·原生 MVU 写入兼容 [N04/W02/S01]';
  if (!artifact.info.includes('双作品W02：')) artifact.info += note;
  const storyNote = ' 2026-11-13落第S01：原生MVU只写已结束时按目录推进相邻章，不依赖旧字段约束；末章保持结束，学战行为不变。';
  if (!artifact.info.includes(storyNote)) artifact.info += storyNote;
  return artifact;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifact = buildNativeMvuArtifact();
  const output = JSON.stringify(artifact, null, 2) + '\n';
  if (process.argv.includes('--write')) fs.writeFileSync(target, output);
  else if (fs.readFileSync(target, 'utf8') !== output) throw new Error('原生兼容产物尚未同步');
  console.log('N04/W02/S01 独立组件已同步；脚本ID、按钮、设置及导出策略保持。');
}
