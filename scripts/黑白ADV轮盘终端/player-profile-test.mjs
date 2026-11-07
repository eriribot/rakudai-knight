import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { parseFragment } from 'parse5';
import { RAKUDAI_INITIAL_STATE as INITIAL_STATE } from '../../世界书规则/MVU/schema.mjs';
import { createStateController, validateStateOperation, stateKey } from '../rakudai-state-core.mjs';

const require = createRequire(import.meta.url);
const { z } = require('../../output/worldbook-calibration/dev/node_modules/zod');
const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8').replace(/^\uFEFF/, '');
const clone = structuredClone;
const checks = [];
async function check(name, run) {
  try { await run(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.stack }); }
}
function playerState() {
  const state = clone(INITIAL_STATE);
  state.系统.开局状态 = '已建档'; state.系统.主角模式 = '自定义角色';
  state.玩家.姓名 = '原有 OC'; state.玩家.角色简介 = '旧介绍';
  state.玩家.伐刀能力.招式 = {
    旧技能: { 说明: '旧说明', 条件与代价: '消耗魔力', 掌握状态: '已掌握', 自定义记录: '保留' },
    新技能: { 说明: '进阶', 条件与代价: '', 掌握状态: '学习中' },
  };
  state.玩家.其他能力 = { 体术: { 说明: '基础', 条件与代价: '', 掌握状态: '已掌握' } };
  // 这些是历史资料，局部编辑不可被它们拦截，也不可顺手重写。
  state.场景.当前章 = '海空陆随意起名的章'; state.人际.旧人物 = { 好感: '原始旧记录' };
  return state;
}
const slot = () => ({ messageId: 356, swipeId: 1, swipeCount: 2, chatId: 'chat-a', characterId: 7, groupId: null });
const viewState = state => Object.fromEntries(['系统', '场景', '玩家', '人际'].map(key => [key, clone(state[key])]));
function fixture() {
  let source = slot(), writes = 0;
  const pages = new Map();
  const key = value => JSON.stringify(value);
  pages.set(key(source), { stat_data: playerState(), display_data: { keep: true }, unrelated: { keep: 'yes' } });
  const adapter = {
    capture: () => ({ source: clone(source), data: clone(pages.get(key(source))) }),
    current: saved => {
      if (key(saved.source) !== key(source)) throw new Error('楼层或 swipe 已变化');
      return { data: clone(pages.get(key(source))) };
    },
    validate: (state, scope) => validateStateOperation(state, scope, z),
    write: (saved, expected, state) => {
      const current = adapter.current(saved);
      assert.equal(stateKey(current.data), stateKey(expected));
      writes++; pages.set(key(source), { ...clone(current.data), stat_data: clone(state) });
    },
  };
  return {
    api: createStateController(adapter), adapter, pages,
    get source() { return source; }, get data() { return pages.get(key(source)); }, get writes() { return writes; },
    switch(changes) { source = { ...source, ...changes }; if (!pages.has(key(source))) pages.set(key(source), { stat_data: playerState() }); },
    capture() { return this.api.capture({ scope: 'player-profile', messageId: source.messageId }); },
  };
}
const editedSkill = { action: 'saveSkill', group: 'techniques', originalName: '旧技能', name: '升级技能', description: '新说明', cost: '新代价', mastery: '已掌握' };

await check('已有自定义角色可改长介绍；场景、人际、评级、其他楼层及包装保持原样', async () => {
  const f = fixture(), before = clone(f.data), { token } = await f.capture();
  const bio = '<自定义>\n' + '介绍'.repeat(8000);
  await f.api.editPlayerProfile(token, { action: 'bio', bio });
  before.stat_data.玩家.角色简介 = bio;
  assert.deepEqual(f.data, before);
  await f.api.editPlayerProfile(token, { action: 'bio', bio }); assert.equal(f.writes, 1);
});
await check('技能升级改名保留附加记录；旧名称移除，其他技能不变', async () => {
  const f = fixture(), original = clone(f.data), { token } = await f.capture();
  await f.api.editPlayerProfile(token, editedSkill);
  assert.equal(Object.hasOwn(f.data.stat_data.玩家.伐刀能力.招式, '旧技能'), false);
  assert.deepEqual(f.data.stat_data.玩家.伐刀能力.招式.升级技能, {
    说明: '新说明', 条件与代价: '新代价', 掌握状态: '已掌握', 自定义记录: '保留',
  });
  assert.deepEqual(f.data.stat_data.玩家.伐刀能力.招式.新技能, original.stat_data.玩家.伐刀能力.招式.新技能);
  assert.deepEqual(f.data.stat_data.玩家.其他能力, original.stat_data.玩家.其他能力);
});
await check('删除旧技能只改当前助手活动 swipe；历史回复保留旧技能', async () => {
  const f = fixture();
  f.switch({ swipeId: 0 }); const historyKey = JSON.stringify(f.source), history = clone(f.data);
  f.switch({ swipeId: 1 }); const before = clone(f.data), { token } = await f.capture();
  await f.api.editPlayerProfile(token, { action: 'deleteSkill', group: 'techniques', originalName: '旧技能' });
  delete before.stat_data.玩家.伐刀能力.招式.旧技能;
  assert.deepEqual(f.data, before); assert.deepEqual(f.pages.get(historyKey), history);
});
await check('其他能力可新增编辑删除；空介绍允许保存', async () => {
  const f = fixture();
  await f.api.editPlayerProfile((await f.capture()).token, { ...editedSkill, group: 'other', originalName: null, name: '新体术', description: '' });
  assert.equal(f.data.stat_data.玩家.其他能力.新体术.说明, '');
  await f.api.editPlayerProfile((await f.capture()).token, { action: 'deleteSkill', group: 'other', originalName: '新体术' });
  assert.deepEqual(Object.keys(f.data.stat_data.玩家.其他能力), ['体术']);
  await f.api.editPlayerProfile((await f.capture()).token, { action: 'bio', bio: '' });
  assert.equal(f.data.stat_data.玩家.角色简介, '');
});
await check('能力介绍和共通限制可改；能力系别、其他字段不动', async () => {
  const f = fixture(), before = clone(f.data);
  await f.api.editPlayerProfile((await f.capture()).token, { action: 'ability', mechanism: '新的介绍', cost: '' });
  before.stat_data.玩家.伐刀能力.能力本质 = '新的介绍'; before.stat_data.玩家.伐刀能力.共通限制 = '';
  assert.deepEqual(f.data, before);
});
await check('可移除旧档中的非标准技能；不要求全局档案先合法', async () => {
  const f = fixture(); f.data.stat_data.玩家.伐刀能力.招式['旧/技能'] = '旧式说明';
  await f.api.editPlayerProfile((await f.capture()).token, { action: 'deleteSkill', group: 'techniques', originalName: '旧/技能' });
  assert.equal(Object.hasOwn(f.data.stat_data.玩家.伐刀能力.招式, '旧/技能'), false);
});
await check('拒绝黑铁一辉模式、重复名称和非法掌握状态', async () => {
  const f = fixture();
  await assert.rejects(f.api.editPlayerProfile((await f.capture()).token, { ...editedSkill, name: '新技能' }), /同名/);
  await assert.rejects(f.api.editPlayerProfile((await f.capture()).token, { ...editedSkill, mastery: '满级' }), /掌握状态/);
  f.data.stat_data.系统.主角模式 = '黑铁一辉';
  await assert.rejects(f.api.editPlayerProfile((await f.capture()).token, { action: 'bio', bio: '不要保存' }), /自定义角色/);
  assert.equal(f.writes, 0);
});
await check('捕获后换聊天、楼层或 swipe 全部拒绝，变量改动也不覆盖', async () => {
  for (const changes of [{ messageId: 358 }, { swipeId: 0 }, { chatId: 'chat-b' }]) {
    const f = fixture(), { token } = await f.capture(); f.switch(changes);
    await assert.rejects(f.api.editPlayerProfile(token, editedSkill), /已变化/); assert.equal(f.writes, 0);
  }
  const f = fixture(), { token } = await f.capture(); f.data.stat_data.玩家.角色简介 = '另一项操作';
  await assert.rejects(f.api.editPlayerProfile(token, editedSkill), /其他操作更新/); assert.equal(f.writes, 0);
});

function hostFixture() {
  const f = fixture();
  const realm = vm.createContext({ structuredClone, window: { RakudaiStateController: f.api }, SS: { destroyed: false },
    generationPending: false, limeNativeStarting: false, correctionJob: null, correctionAutoTurn: null,
    correctionMainBusy: () => false, rosterEditRevision: 0,
    readSnapshot: () => ({ state: viewState(f.data.stat_data), source: clone(f.source), pending: false }),
    terminalStateReader: { clear() {} }, emit() {},
  });
  const main = read('main.js');
  vm.runInContext(main.slice(main.indexOf('  function rosterSnapshotKey('), main.indexOf('  async function editRoster(')), realm);
  vm.runInContext(main.slice(main.indexOf('  let playerEditBusy ='), main.indexOf('  /*__INJECT_CORRECTION__*/')), realm);
  return { f, host: realm, save: request => realm.editPlayerProfile(request, clone(f.source), JSON.stringify(viewState(f.data.stat_data))) };
}
await check('宿主只捕获当前助手楼层；保存后成功回读', async () => {
  const h = hostFixture(), capture = h.f.adapter.capture;
  h.f.adapter.capture = options => { assert.equal(options.messageId, 356); assert.equal(options.scope, 'player-profile'); return capture(); };
  await h.save(editedSkill); assert.equal(h.f.writes, 1);
});
await check('生成启动、生成中、副校正请求/排队、等待 MVU 的宿主入口拒绝提交', async () => {
  for (const reason of ['generation', 'native-start', 'correction', 'correction-job', 'correction-queued', 'pending']) {
    const h = hostFixture();
    if (reason === 'generation') h.host.generationPending = true;
    if (reason === 'native-start') h.host.limeNativeStarting = true;
    if (reason === 'correction') h.host.correctionMainBusy = () => true;
    if (reason === 'correction-job') h.host.correctionJob = {};
    if (reason === 'correction-queued') h.host.correctionAutoTurn = {};
    if (reason === 'pending') { const readSnapshot = h.host.readSnapshot; h.host.readSnapshot = () => ({ ...readSnapshot(), pending: true }); }
    await assert.rejects(h.save(editedSkill), /保存完成|已变化/); assert.equal(h.f.writes, 0);
  }
});
await check('捕获等待时切 swipe 或开始生成不能提交', async () => {
  for (const change of ['swipe', 'generation']) {
    const h = hostFixture(), capture = h.f.adapter.capture;
    h.f.adapter.capture = async () => {
      const saved = capture();
      if (change === 'swipe') h.f.switch({ swipeId: 0 }); else h.host.generationPending = true;
      return saved;
    };
    await assert.rejects(h.save(editedSkill), /保存完成|已变化/); assert.equal(h.f.writes, 0);
  }
});
await check('commit 的 current 等待后开始生成或副校正，临写同步检查拒绝', async () => {
  for (const flag of ['generationPending', 'limeNativeStarting', 'correctionJob', 'correctionAutoTurn']) {
    const h = hostFixture(), current = h.f.adapter.current;
    h.f.adapter.current = async saved => { const result = current(saved); h.host[flag] = true; return result; };
    await assert.rejects(h.save(editedSkill), /保存完成/); assert.equal(h.f.writes, 0);
  }
});

function uiFixture() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', style: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {},
    });
    return elements.get(id);
  }
  const realm = vm.createContext({ structuredClone, console, setTimeout: () => 0, clearTimeout() {},
    document: { body: element('body'), getElementById: element, querySelectorAll: () => [], querySelector: () => null, addEventListener() {} },
    addEventListener() {},
  });
  realm.window = realm; vm.runInContext(read('terminal-app.js'), realm);
  realm.stat = viewState(playerState()); realm.stateSource = slot(); realm.hasDisplayedState = true;
  realm.dataStatus = 'ready'; realm.blazerSubTab = 'device'; realm.currentStack = ['scr-home', 'scr-blazer'];
  realm.bridge = { editPlayerProfile: async () => {} };
  realm.refreshTerminalView = () => realm.renderBlazer();
  function button(action, group, name, abilitySystem = 'blazer') {
    const attrs = { 'data-source': realm.sourceKey(realm.stateSource), 'data-skill-group': group, 'data-skill-name': name, 'data-ability-system': abilitySystem };
    realm.beginPlayerEdit({ getAttribute: key => attrs[key] ?? null }, action);
  }
  return { ui: realm, element, button, html: () => element('blazer-body').innerHTML };
}
function nodes(html, name) {
  const result = [];
  function visit(node) { if (node.tagName === name) result.push(node); for (const child of node.childNodes || []) visit(child); }
  visit(parseFragment(html)); return result;
}
await check('已有 OC 可看到编辑删除，介绍无 maxlength 且特殊内容转义', () => {
  const f = uiFixture(); f.ui.renderBlazer();
  assert.match(f.html(), /新增伐刀绝技/); assert.match(f.html(), /删除/);
  f.button('saveSkill', 'techniques', '旧技能');
  f.ui.updatePlayerDraft({ getAttribute: () => 'description', value: '</textarea><img src=x onerror=alert(1)>\n' + '长'.repeat(12000) });
  f.ui.renderBlazer();
  assert.equal(nodes(f.html(), 'img').length, 0);
  assert.equal(nodes(f.html(), 'textarea').some(node => node.attrs.some(attr => attr.name === 'maxlength')), false);
  assert.ok(f.html().includes('长'.repeat(12000)));
});
await check('煌武无需六花学籍即可展示；混合能力编辑明确选择目标模块', async () => {
  const f = uiFixture();
  f.ui.stat.玩家.学战 = { 武装: { 类别: '煌式武装', 名称: '<测试煌武>', 使用条件: '本局适配条件' } };
  f.ui.renderBlazer();
  assert.match(f.html(), /&lt;测试煌武&gt;/); assert.match(f.html(), /本局适配条件/);
  assert.doesNotMatch(f.html(), /新增学战招式|<测试煌武>/);
  Object.assign(f.ui.stat.玩家.学战, { 能力机制: '星辰力机制', 共通限制: '学战限制', 招式: { 旧技能: { 说明: '同名学战招式', 条件与代价: '学战代价', 掌握状态: '学习中' } } });
  f.ui.renderBlazer();
  assert.match(f.html(), /data-ability-system="asterisk"/);
  f.button('saveSkill', 'techniques', '旧技能', 'asterisk');
  assert.equal(f.ui.playerEditDraft.values.description, '同名学战招式');
  let saved;
  f.ui.bridge.editPlayerProfile = async request => { saved = structuredClone(request); };
  await f.ui.savePlayerEdit();
  assert.equal(saved.abilitySystem, 'asterisk');
  f.button('ability', null, null, 'blazer');
  assert.equal(f.ui.playerEditDraft.values.mechanism, f.ui.stat.玩家.伐刀能力.能力本质);
  assert.equal(f.ui.playerEditDraft.values.abilitySystem, 'blazer');
});
await check('UI 删除先确认；提交携带原楼层、swipe 和状态快照', async () => {
  const f = uiFixture(), original = JSON.stringify(f.ui.stat), source = clone(f.ui.stateSource);
  let calls = 0;
  f.ui.bridge.editPlayerProfile = async (request, expectedSource, expectedState) => {
    calls++; assert.equal(request.action, 'deleteSkill'); assert.equal(request.originalName, '旧技能');
    assert.equal(JSON.stringify(expectedSource), JSON.stringify(source)); assert.equal(expectedState, original);
  };
  f.button('deleteSkill', 'techniques', '旧技能');
  assert.equal(calls, 0); assert.match(f.html(), /确认删除/);
  await f.ui.savePlayerEdit(); assert.equal(calls, 1); assert.equal(f.ui.playerEditDraft, null);
});
await check('草稿后切楼层/swipe、资料更新或 pending，UI 不调用写入桥接', async () => {
  for (const change of ['floor', 'swipe', 'state', 'pending']) {
    const f = uiFixture(); let calls = 0; f.ui.bridge.editPlayerProfile = async () => { calls++; };
    f.button('saveSkill', 'techniques', '旧技能');
    if (change === 'floor') f.ui.stateSource.messageId++;
    if (change === 'swipe') f.ui.stateSource.swipeId = 0;
    if (change === 'state') f.ui.stat.玩家.角色简介 = '异步更新';
    if (change === 'pending') f.ui.dataStatus = 'pending';
    await f.ui.savePlayerEdit(); assert.equal(calls, 0);
  }
});
await check('刷新到新 swipe 会清草稿；原角色只读，待建档也不开编辑', async () => {
  const f = uiFixture(); f.button('saveSkill', 'techniques', '旧技能');
  f.ui.bridge.getSnapshot = async () => ({ state: clone(f.ui.stat), source: { ...slot(), swipeId: 0 } });
  await f.ui.refreshTerminalState({ type: 'MESSAGE_SWIPED', reset: true, retainDisplay: true });
  assert.equal(f.ui.playerEditDraft, null);
  f.ui.stat.系统.主角模式 = '黑铁一辉'; f.ui.renderBlazer(); assert.doesNotMatch(f.html(), /beginPlayerEdit/);
  f.ui.stat.系统.主角模式 = '自定义角色'; f.ui.stat.系统.开局状态 = '待建档'; f.ui.renderBlazer(); assert.doesNotMatch(f.html(), /beginPlayerEdit/);
});

console.log(JSON.stringify({ passed: checks.filter(item => item.passed).length, total: checks.length, checks }, null, 2));
if (checks.some(item => !item.passed)) process.exitCode = 1;
