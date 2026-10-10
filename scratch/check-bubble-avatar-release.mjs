import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { applyRules } from '../scripts/正文气泡/build.mjs';
const directory = 'scripts/正文气泡/发布/components';
const reports = 'scripts/正文气泡/验证记录/风祭与夏洛特头像';
const files = ['dialogue-bubbles', 'dialogue-player-candidates', 'dialogue-bubble-style'].map(n => n + '.regex.json');
const rules = files.map(file => JSON.parse(fs.readFileSync(directory + '/' + file, 'utf8')));
const baseline = files.map(file => JSON.parse(fs.readFileSync('scratch/bubble-avatar-before/' + file, 'utf8')));
for (let i = 0; i < rules.length; i++) {
  const { findRegex, replaceString, ...fields } = rules[i];
  const { findRegex: oldFind, replaceString: oldReplace, ...oldFields } = baseline[i];
  assert.deepEqual(fields, oldFields, '不得更改稳定ID或显示字段');
}
assert.deepEqual(fs.readFileSync(directory + '/' + files[1]), fs.readFileSync('scratch/bubble-avatar-before/' + files[1]), '02候选必须字节不变');
const names = ['风祭', '風祭', '风祭凛奈', '風祭凜奈', '凛奈', '凜奈', '夏洛特', '夏洛特·科黛', 'Charlotte Cordé', 'Charlotte Corde'];
const dialogue = name => `<div data-rkd="bubble" data-rkd-name="${name}" data-rkd-player=""><span data-rkd-avatar aria-hidden="true"></span><div data-rkd-body><span data-rkd-speaker>${name}</span><div data-rkd-line>头像匹配。</div></div></div>`;
const cases = names.map((name, i) => ({ id: 'npc-name-' + i, input: name + '：头像匹配。', source: 'ai_output', placement: 2, destination: 'display', depth: 0, expected: dialogue(name) }));
cases.push(
  { id: 'prompt-remains-source', input: '风祭：头像匹配。', source: 'ai_output', placement: 2, destination: 'prompt', depth: 0, expected: '风祭：头像匹配。' },
  { id: 'other-placement-remains-source', input: '夏洛特：头像匹配。', placement: 1, destination: 'display', depth: 0, expected: '夏洛特：头像匹配。' },
  { id: 'fenced-code-remains-source', input: '```\n夏洛特：头像匹配。\n```', placement: 2, destination: 'display', depth: 0, expected: '```\n夏洛特：头像匹配。\n```' }
);
for (const name of ['风祭家的新同学', '风祭凛', '凛奈的侍从', '夏洛特小姐', '艾莉丝']) {
  const rendered = applyRules(name + '：保持原文。', rules);
  assert.equal((rendered.match(/<div data-rkd="bubble"/g) || []).length, 0, '未知或歧义名称不得绑定NPC：' + name);
  assert.ok(rendered.includes('<span data-rkd-source>' + name + '：保持原文。</span>'));
}
fs.writeFileSync(reports + '/name-fixtures.json', JSON.stringify({ schemaVersion: 1, cases }, null, 2) + '\n');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const review = {
  dialect: 'SillyTavern card RegexScriptData', deliveryMode: 'component',
  names, originalIDsAndFlagsPreserved: true,
  ocCandidateBytesUnchanged: true,
  unknownNamesNotBoundToNPC: ['风祭家的新同学', '风祭凛', '凛奈的侍从', '夏洛特小姐', '艾莉丝'],
  existingCheckCount: JSON.parse(fs.readFileSync('scripts/正文气泡/验证记录/check-results.json', 'utf8')).passed,
  exactArtifactParity: JSON.parse(fs.readFileSync('scripts/正文气泡/验证记录/artifact-check.json', 'utf8')).exactArtifactParity,
  artifacts: files.map(file => ({ file, sha256: hash(fs.readFileSync(directory + '/' + file)) })),
  browserPreview: 'pending', realSillyTavernImport: 'not-run',
  sourceReferences: ['resource/knightavatars/manifest.json', 'scripts/正文气泡/build.mjs']
};
fs.writeFileSync(reports + '/acceptance.json', JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify({ names: names.length, stageFixtures: cases.length, preservedIDsAndFlags: true, candidateFileUnchanged: true, unknownNameCases: 5 }));
