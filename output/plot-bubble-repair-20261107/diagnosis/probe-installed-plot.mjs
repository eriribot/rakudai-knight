import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

// Read installed component code and worldbook metadata only. No live chat, model call or host mutation.
const cardPath = process.argv[2] || 'F:/SillyTavern-Launcher/SillyTavern/data/default-user/characters/落第x学战v0.02.png';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const png = fs.readFileSync(cardPath);
const chunks = new Map();
for (let offset = 8; offset < png.length;) {
  const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
  const data = png.subarray(offset + 8, offset + 8 + length); offset += length + 12;
  if (type === 'tEXt') chunks.set(data.toString('latin1', 0, data.indexOf(0)), data.toString('latin1', data.indexOf(0) + 1));
}
const card = JSON.parse(Buffer.from(chunks.get('ccv3') || chunks.get('chara'), 'base64').toString('utf8'));
const script = card.data.extensions.tavern_helper.scripts.find(item => item.id === 'c6b247ce-164f-4f1e-9952-02731a212df2');
assert.equal(script.enabled, true);
const terminal = card.data.extensions.tavern_helper.scripts.find(item => item.enabled && item.name.includes('黑白ADV轮盘终端'));
const binding = card.data.extensions.world;
const worldbookPath = path.resolve(path.dirname(cardPath), '../worlds', binding + '.json');
const worldbookRaw = fs.readFileSync(worldbookPath, 'utf8');
const entries = Object.values(JSON.parse(worldbookRaw).entries).map(entry => ({
  uid: entry.uid, name: entry.comment, enabled: !entry.disable, position: { order: entry.order }, content: entry.content,
}));
const prefix = script.content.slice(0, script.content.indexOf('(function installRakudaiPlot()'));
const api = vm.runInNewContext(prefix + 'return { createRakudaiPlotRuntime,createRakudaiWorldbookReader,ASTERISK_VOLUMES,asteriskStoryPosition,STORY_ORDER_BASE };})();', {
  console, structuredClone, setTimeout, clearTimeout, Promise,
});
const reader = api.createRakudaiWorldbookReader({ getCharWorldbookNames: async () => ({ primary: binding }), getWorldbook: async () => entries });
const results = [];
for (const chapter of [...api.ASTERISK_VOLUMES[0].chapters.map(item => item.key), '入学报到']) {
  const state = { 系统: { 结构版本: 4, 作品: 'asterisk', 开局状态: '已建档' },
    场景: { 当前卷: null, 当前章: chapter, 阶段: '进行中', 时间: '诊断时间', 地点: '诊断地点', 切入说明: '' }, 玩家: {}, 人际: {} };
  const wrapper = { stat_data: state }, chat = [{ is_user: false, mes: 'Synthetic diagnostic fixture', swipe_id: 0 }];
  const runtime = api.createRakudaiPlotRuntime({
    getContext: () => ({ chatId: 'isolated-diagnostic', characterId: 'diagnostic', chat }),
    readMessages: () => [{ message_id: 0, swipe_id: 0, swipes_data: [wrapper] }],
    getMvu: () => ({ getMvuData: () => wrapper }), readSettings: () => true,
    readStoryEntry: (_world, volume, key) => reader.read(volume, key, { position: api.asteriskStoryPosition(key), orderBase: api.STORY_ORDER_BASE.asterisk }),
  });
  try {
    const preview = await runtime.preview();
    results.push({ chapter, ok: true, order: preview.entryOrder, entryName: preview.entryName,
      correctWorld: preview.text.includes('学战 第一卷'), suggestsEpilogue: preview.text.includes('相邻下一条目为 终章') });
  } catch (error) { results.push({ chapter, ok: false, error: error.message }); }
  finally { runtime.dispose(); }
}
const built = fs.readFileSync('scripts/tavern_helper_ejs_injector.js', 'utf8');
const sections = [
  ['reader', 'function createRakudaiWorldbookReader', 'function createRakudaiPlotRuntime'],
  ['runtime', 'function createRakudaiPlotRuntime', 'const W = window'],
  ['bootstrap', 'const W = window', null],
].map(([name, start, end]) => {
  const part = value => value.slice(value.indexOf(start), end ? value.indexOf(end) : value.lastIndexOf('\n})();'));
  return { name, same: part(script.content) === part(built), installedSha256: sha256(part(script.content)), builtSha256: sha256(part(built)) };
});
const report = {
  createdAt: new Date().toISOString(), mode: 'Installed component factories + installed worldbook in isolated VM; no real chat or model generation',
  card: { name: card.data.name, sha256: sha256(png) },
  plot: { id: script.id, enabled: script.enabled, sha256: sha256(script.content), builtSha256: sha256(built), sections },
  terminal: { id: terminal.id, sha256: sha256(terminal.content), matchesBuilt: terminal.content === fs.readFileSync('scripts/黑白ADV轮盘终端/dist/terminal.js', 'utf8'),
    hasPlotView: terminal.content.includes('function plotView()'), plotOnCalendar: terminal.content.includes('plotView() + panel') },
  worldbook: { name: binding, sha256: sha256(worldbookRaw), entries: entries.filter(entry => entry.name.startsWith('[剧情]') && entry.position.order >= 200 && entry.position.order <= 208)
    .map(entry => ({ uid: entry.uid, name: entry.name, order: entry.position.order, enabled: entry.enabled, nonblank: !!entry.content?.trim(), length: entry.content?.length })) },
  results,
};
fs.writeFileSync(new URL('installed-plot-probe.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
assert.equal(results.filter(item => item.ok).length, 8);
assert.ok(results.slice(0, 8).every((item, index) => item.order === 200 + index && item.correctWorld));
assert.match(results.find(item => item.chapter === '终章').error, /208/);
assert.match(results.find(item => item.chapter === '入学报到').error, /正式卷章/);
console.log(JSON.stringify({ passed: 10, total: 10, report: 'installed-plot-probe.json' }));
