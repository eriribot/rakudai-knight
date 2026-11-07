import fs from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { buildDualMvuWorldbookUpdate, installDualMvuWorldbookUpdater } from './build-dual-mvu-worldbook-update.mjs';

// Repair the live text in place: never replace the author's current prompts with a local snapshot.
export function createMvuScopePlan(book) {
  const rows = Object.entries(book.entries ?? {});
  const groups = [['[MVU]变量列表'], ['[MVU]变量更新规则'], ['[MVU]变量更新格式', '[MVU]变量输出格式']];
  const changes = [];
  for (const names of groups) {
    const matches = rows.filter(([, entry]) => names.includes(entry.comment) && entry.disable !== true);
    if (matches.length !== 1) throw new Error(names.join(' / ') + ' 的启用条目必须唯一。');
    const [key, entry] = matches[0];
    if (typeof entry.content !== 'string' || !entry.content.trim()) throw new Error(entry.comment + ' 正文为空。');
    if (entry.content.startsWith('<% { /* MVU_ENTRY_SCOPE */ %>') && entry.content.trimEnd().endsWith('<% } %>')) continue;
    changes.push({ key, uid: entry.uid, comment: entry.comment, before: structuredClone(entry),
      content: '<% { /* MVU_ENTRY_SCOPE */ %>\n' + entry.content + '\n<% } %>' });
  }
  return { changes, skipped: [] };
}

export function buildMvuScopeRepair() {
  const { artifact } = buildDualMvuWorldbookUpdate();
  const buttons = ['预览 EJS 修复并备份', '应用 EJS 作用域修复'];
  Object.assign(artifact, {
    id: '50ec6d5c-c6b8-48f7-a373-5a9b722f9673',
    name: 'MVU · EJS 重名修复 20261106',
    info: '只给当前主世界书三条启用 MVU 提示词包独立作用域，修复拼接编译 const 重名。完整保留当前正文、条目属性和聊天变量；先预览下载备份，再应用并回读。重复应用无变化。',
    button: { enabled: true, buttons: buttons.map(name => ({ name, visible: true })) },
    content: '(function () {\n"use strict";\nconst createDualWorldbookPlan = ' + createMvuScopePlan.toString() + ';\n' +
      installDualMvuWorldbookUpdater.toString() + '\ninstallDualMvuWorldbookUpdater(window, ' + JSON.stringify({ buttons }) + ');\n})();\n',
  });
  new vm.Script(artifact.content);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = new URL('../output/mvu-ejs-scope-repair-20261106/MVU-EJS作用域修复.script.json', import.meta.url);
  const text = JSON.stringify(buildMvuScopeRepair(), null, 2) + '\n';
  if (process.argv.includes('--write')) {
    fs.mkdirSync(new URL('.', output), { recursive: true });
    fs.writeFileSync(output, text);
  }
  console.log(JSON.stringify({ mode: process.argv.includes('--write') ? 'written' : 'dry-run', output: output.pathname }));
}
