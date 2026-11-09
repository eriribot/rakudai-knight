import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { INITIAL_STATE } from '../../世界书规则/MVU/schema.mjs';

// Offline only: actual captured script and entry metadata, existing host fixture.
// The script VM has no fetch, filesystem, or live SillyTavern connection.
const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const metadata = JSON.parse(read('./installed-plot-metadata.json'));
const rawBook = JSON.parse(fs.readFileSync(metadata.source, 'utf8'));
const rawEntries = Object.values(rawBook.entries);
const entries = metadata.entries.map(entry => {
  const raw = rawEntries.find(item => item.uid === entry.uid);
  assert.ok(raw, `Missing captured uid ${entry.uid}`);
  for (const key of ['comment', 'order', 'disable']) assert.equal(raw[key], entry[key], `Metadata changed: uid ${entry.uid}, ${key}`);
  return { uid: entry.uid, name: entry.comment, order: entry.order, enabled: !entry.disable,
    content: raw.content.trim().slice(0, 160) };
});
const testSource = read('../../scripts/check-plot-bootstrap.mjs');
const fixtureSource = testSource.slice(testSource.indexOf('const nativeEvents ='), testSource.indexOf('async function check('));
assert.ok(fixtureSource.includes('function fixture('));
const installed = read('./installed-injector.js');
assert.equal(hash(installed), 'e036986c6e672a3b3a4e4062acc96c333b0b12db9374aec013f90513e265e2bb');
const latest = JSON.parse(read('../../世界书规则/MVU/落第骑士-卷章剧情注入器-v3.0.0.json')).content;
const sources = { installed, localLatest: latest };
const cases = [];

async function replay(sourceName, volume, chapter, expectedOrder, expectedEntryName) {
  const source = sources[sourceName];
  const fixture = vm.runInNewContext(fixtureSource + '\nfixture;', {
    assert, clone: structuredClone, structuredClone, INITIAL_STATE, vm, source,
    setTimeout, clearTimeout, Promise,
  }, { filename: 'existing-host-fixture.js' });
  const f = fixture();
  f.worldEntries.splice(0, f.worldEntries.length, ...structuredClone(entries));
  const state = f.chat[0].variables[0].stat_data;
  state.系统.作品 = 'asterisk';
  state.场景.当前卷 = volume;
  state.场景.当前章 = chapter;
  state.场景.阶段 = '进行中';
  const beforeChat = JSON.stringify(f.chat), beforeSettings = JSON.stringify(f.chatVariables);
  const script = f.frame(`offline-${sourceName}-${chapter}`);
  script.W.getCharWorldbookNames = async () => ({ primary: '落第x学战v0.03' });
  script.install();
  const api = f.top.__RK_PLOT_V3__;
  const preview = await api.preview();
  const selected = entries.find(entry => entry.uid === preview.entryUid);
  assert.equal(preview.entryOrder, expectedOrder);
  assert.equal(preview.entryName, expectedEntryName);
  assert.ok(preview.text.includes(selected.content));
  assert.equal(preview.volume, 1);
  assert.ok(preview.text.includes(`当前剧情节点：学战 第一卷 · ${chapter}`));
  assert.equal(f.calls.generation, 0);
  assert.equal(f.calls.mvuWrites, 0);
  assert.equal(f.calls.variableWrites.length, 0);
  assert.equal(JSON.stringify(f.chat), beforeChat);
  assert.equal(JSON.stringify(f.chatVariables), beforeSettings);
  cases.push({ source: sourceName, revision: api.getStatus().revision,
    input: { world: 'asterisk', volume, chapter, phase: '进行中' },
    inputPassesCurrentAwVolumeContract: volume === null,
    selected: { uid: preview.entryUid, order: preview.entryOrder, name: preview.entryName },
    renderedLabel: preview.text.split('\n').find(line => line.startsWith('当前剧情节点：')),
    renderedVolume: preview.volume, actualEntryExcerptIncluded: true,
    completionPatchOnlyMarksEnded: preview.text.includes('"path":"/场景/阶段","value":"已结束"') && !preview.text.includes('"path":"/场景/当前章"'),
    modelCalls: 0, chatWrites: 0, mvuWrites: 0, settingsWrites: 0 });
  script.pagehide();
  assert.equal(JSON.stringify(f.chat), beforeChat);
}

await replay('installed', null, '终章', 208, '[剧情]第二卷.第一章.六花园会议');
await replay('installed', 2, '第一章', 201, '[剧情]第一卷.第一章.华焰魔女');
await replay('localLatest', null, '终章', 208, '[剧情]第二卷.第一章.六花园会议');

const result = {
  checkedAt: new Date().toISOString(), mode: 'isolated-vm-preview-only',
  worldbook: '落第x学战v0.03', metadataSource: 'installed-plot-metadata.json',
  scripts: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, { sha256: hash(source), revision: /const REVISION = '([^']+)'/.exec(source)?.[1] }])),
  evidence: '实际脚本在现有宿主 fixture 中执行；条目 UID、名称、order、disable 对照审计元数据核验，正文仅使用真实条目前160字。未连接酒馆或执行生成生命周期。',
  conclusion: '旧安装版和本地最新版都会把 order208 的第二卷第一章原文标为学战第一卷终章；旧版卷2/第一章反证仍读取 order201。',
  schemaBoundary: '当前正式 AW schema 要求场景.当前卷及事件卷号为 null。卷2反证是隔离 fixture 绕过 schema 的非法输入，仅证明 runtime 忽略该值；不代表可写入正式 MVU。跨卷设计还需同步确定 MVU 契约，不能只加目录。',
  cases, totals: { modelCalls: 0, liveNetworkCalls: 0, chatWrites: 0, mvuWrites: 0, settingsWrites: 0 },
};
fs.writeFileSync(new URL('./isolated-replay-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: 'passed', cases: cases.length, output: 'output/asterisk-live-audit-20261109/isolated-replay-results.json', totals: result.totals }));
