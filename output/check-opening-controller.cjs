// Page contracts with a mocked controller. Does not claim live SillyTavern acceptance.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.resolve(__dirname, '../第一卷-世界书整理/开局页面/index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
scripts.forEach((script, index) => new vm.Script(script, { filename: `opening-inline-${index}.js` }));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length);
const script = scripts.find(value => value.includes('var START_PROFILES'));
const rating = scripts.find(value => value.includes('var RATING_RULE_VERSION'));
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', checked: false, disabled: false, hidden: false, dataset: {}, setAttribute() {}, focus() {}, select() {}, scrollIntoView() {}, getAttribute() { return null; } });
  return nodes.get(id);
}
let copied = [];
const ctx = vm.createContext({
  window: {}, document: { getElementById: node }, navigator: { clipboard: { async writeText(text) { copied.push(text); } } },
  requireCompleteProfile: () => true, getCurrentMessageId: () => 0, Number,
});
vm.runInContext(rating.slice(0, rating.indexOf('var START_PROFILES')), ctx);
vm.runInContext(script.slice(script.indexOf('var START_PROFILES'), script.indexOf('var activeStartProfile')), ctx);
vm.runInContext(script.slice(script.indexOf('var CANON_GREETING'), script.indexOf('async function generateGreeting')), ctx);
vm.runInContext(script.slice(script.indexOf('var ARCHIVE_FORMAT'), script.indexOf('function applyArchiveAvatar')), ctx);
vm.runInContext('var activeStartProfile = "user"; var avatarState = "placeholder"; function syncCard() { updateOpeningPreview(readOpeningDraft()); }', ctx);
let checks = 1;
function check(fn) { fn(); checks++; }
const json = value => JSON.parse(JSON.stringify(value));
const fixture = {
  format: 'rakudai-opening-profile', schema_version: 5, profile_key: 'user', avatar: null,
  profile: {
    name: '测试来客', personality: '谨慎、守约', conduct: '先观察再行动', school: '破军学园', device: '折光镜',
    nobleArt: '分光｜折射光线｜需直视目标\n余辉｜留下光影｜短暂维持', otherAbilities: '格挡｜基础剑术｜需要持剑',
    category: '自然干涉系', desc: '曾在异乡修行，保留既往的剑术经验。', ability: '折射可见光', limits: '需要光源', style: '牵制后近身',
    stats: { attack: 'B+', defense: 'C+', magic: 'C+', control: 'A', physical: 'B', luck: 'E' },
  },
  scene: { 当前章: '第一章', 时间: '春假期间的清晨', 地点: '破军学园·理事长办公室门外', 切入说明: '等待入学面谈' },
  context: { 当前身体: '身体变年轻，仍需适应', 当前能力边界: '只保留已填写的招式，爆发后脱力', 本局映射: '把魔力称作气；不另授境界' },
  greeting: '我站在理事长办公室门外，轻轻敲门，等待回应。',
};
function fill(draft = fixture) {
  ctx.activeStartProfile = draft.profile_key;
  for (const [key, id] of Object.entries(ctx.OPENING_FIELDS)) node(id).value = draft.profile[key] || '';
  for (const key of Object.keys(ctx.AXIS_LABELS)) node('stat-' + key).value = draft.profile.stats[key];
  for (const [key, id] of Object.entries(ctx.SCENE_FIELDS)) node(id).value = draft.scene?.[key] || (key === '当前章' ? '待选择' : '');
  for (const [key, id] of Object.entries(ctx.CONTEXT_FIELDS)) node(id).value = draft.context?.[key] || '';
  node('opening-greeting').value = draft.greeting || '';
  node('opening-scene-confirmed').checked = true;
  ctx.openingReceipt = null; ctx.openingPendingAttempt = null;
}
fill();
const clean = ctx.validateArchive(json(fixture));
check(() => assert.equal(ctx.openingDraftKey(ctx.readOpeningDraft()), ctx.openingDraftKey(clean), 'raw and normalized draft signatures agree'));
check(() => assert.deepEqual(json(ctx.validateArchive(json(clean))), json(clean)));
for (const version of [2, 3, 4]) {
  const old = json(fixture); old.schema_version = version; delete old.scene; delete old.context;
  if (version < 4) delete old.profile.otherAbilities;
  check(() => {
    const migrated = ctx.validateArchive(old);
    assert.equal(migrated.schema_version, 5);
    assert.deepEqual(json(migrated.scene), { 当前章: '待选择', 时间: '', 地点: '', 切入说明: '' });
    assert.equal(migrated.context.当前身体, '');
  });
}
check(() => { const bad = json(fixture); bad.scene.当前章 = '第五章'; assert.throws(() => ctx.validateArchive(bad)); });
check(() => { const bad = json(fixture); bad.context.当前身体 = {}; assert.throws(() => ctx.validateArchive(bad)); });
check(() => { const bad = json(fixture); bad.profile_key = 'kurogane'; const canon = ctx.validateArchive(bad); assert.equal(canon.profile.name, '黑铁一辉'); assert.equal(canon.context.本局映射, ''); assert.equal(canon.profile.rank, 'F'); });
check(() => {
  const payload = ctx.buildOpeningVariables(clean);
  assert.equal(payload.系统.开局状态, '待建档');
  assert.equal(payload.玩家.登记等级, null);
  assert.equal(payload.玩家.综合初评.等级, 'B');
  assert.equal(Object.keys(payload.玩家.伐刀能力.招式).length, 2);
  assert(payload.玩家.角色简介.includes('【当前身体】\n身体变年轻'));
  assert(payload.玩家.角色简介.includes('【本局映射】'));
  assert.deepEqual(json(payload.场景), fixture.scene);
});
check(() => {
  const text = ctx.buildOpeningMessage(clean);
  assert(text.includes('档案草稿，尚未写入聊天'));
  assert(!text.includes('【已确认的开局变量】'));
  assert(!text.includes('代码已将本次档案写入'));
  assert(!text.includes('请将上述已确认档案'));
});
check(() => {
  const prompts = ctx.buildGreetingPrompts(clean);
  const data = JSON.parse(prompts[1].content);
  assert.deepEqual(data.scene, fixture.scene);
  assert.deepEqual(data.context, fixture.context);
  assert(prompts[0].content.includes('不另造日期'));
  assert(prompts[0].content.includes('既往经历不自动授予当前巅峰能力'));
  assert(prompts[0].content.includes('【开场模板规范】'));
  assert(!/黎恩|舒华泽|八叶|无想神气/.test(prompts[0].content));
});
check(() => {
  const parsed = ctx.parseGreetingTemplate("章段: 第一章\n时间: 春假期间·上午\n地点: 破军学园·第三训练场\n开场白: 我站在训练场上……");
  assert.equal(parsed.chapter, "第一章");
  assert.equal(parsed.time, "春假期间·上午");
  assert.equal(parsed.location, "破军学园·第三训练场");
  assert.equal(parsed.greeting, "我站在训练场上……");
});
check(() => {
  ctx.applySceneTemplate('training');
  assert.equal(node('opening-chapter').value, '第一章');
  assert.equal(node('opening-time').value, '春假期间·上午');
  assert.equal(node('opening-location').value, '破军学园·第三训练场');
  assert.equal(node('opening-scene-confirmed').checked, true);
  assert(node('opening-greeting').value.includes('第三训练场'));
});
check(() => {
  ctx.insertBlankTemplate();
  assert(node('opening-greeting').value.includes('章段: 第一章'));
  assert.equal(node('opening-chapter').value, '第一章');
  assert.equal(node('opening-scene-confirmed').checked, true);
});
function initialState() { return { 系统: { 结构版本: 3, 开局状态: '待建档', 主角模式: '未选择' }, 场景: { 当前卷: 1, 当前章: '待选择', 阶段: '未开始', 时间: '', 地点: '', 切入说明: '', 已发生事件: {} }, 玩家: {}, 人际: {} }; }
let state, writes, captures, verifies, failNext, ambiguousNext, scopeValid;
let token;
function setupController() {
  state = initialState(); writes = 0; captures = 0; verifies = 0; failNext = false; ambiguousNext = false; scopeValid = true;
  token = Object.freeze({ opaque: 'test-token' });
  ctx.window.RakudaiStateController = {
    async capture({ messageId }) { assert.equal(messageId, 0); captures++; return { state: json(state), token }; },
    async commitOpening(received, payload) {
      assert.equal(received, token);
      if (!scopeValid) throw new Error('聊天已切换');
      if (failNext) { failNext = false; throw new Error('模拟写入失败'); }
      if (state.系统.开局状态 !== '已建档') {
        writes++;
        state = { ...state, 系统: { ...json(payload.系统), 开局状态: '已建档' }, 玩家: json(payload.玩家), 场景: { ...state.场景, ...json(payload.场景), 阶段: '进行中' } };
      }
      if (ambiguousNext) { ambiguousNext = false; throw new Error('回读失败，写入结果待复核'); }
      return { state: json(state) };
    },
    async verify(received) { assert.equal(received, token); verifies++; if (!scopeValid) throw new Error('聊天已切换'); return { state: json(state) }; },
  };
}
(async () => {
  await ctx.enterGame();
  check(() => { assert(node('archive-feedback').textContent.includes('未检测到建档控制器')); assert.equal(ctx.openingReceipt, null); });
  setupController();
  node('opening-scene-confirmed').checked = false;
  await ctx.enterGame();
  check(() => { assert.equal(writes, 0); assert(node('archive-feedback').textContent.includes('勾选')); });
  node('opening-scene-confirmed').checked = true;
  state.场景.地点 = '破军学园·训练场';
  await ctx.enterGame();
  check(() => { assert.equal(writes, 0); assert(node('archive-feedback').textContent.includes('场景冲突')); });
  state = initialState();
  failNext = true;
  await ctx.enterGame();
  check(() => { assert.equal(writes, 0); assert.equal(ctx.openingReceipt, null); assert(ctx.openingPendingAttempt); assert.equal(node('opening-commit-button').disabled, false); });
  await Promise.all([ctx.enterGame(), ctx.enterGame()]);
  check(() => { assert.equal(writes, 1); assert(ctx.openingReceipt); assert.equal(ctx.openingPendingAttempt, null); assert(node('opening-message').value.includes('【建档结果】')); });
  await ctx.enterGame();
  check(() => assert.equal(writes, 1, 'repeated confirmation does not write again'));
  await ctx.copyCardSummary();
  check(() => { assert.equal(copied.length, 1); assert(copied[0].includes('第一幕请求')); assert(verifies > 0); });
  scopeValid = false;
  await ctx.copyCardSummary();
  check(() => { assert.equal(copied.length, 1); assert.equal(ctx.openingReceipt, null); assert(node('archive-feedback').textContent.includes('聊天已切换')); });
  fill(); setupController(); ambiguousNext = true;
  await ctx.enterGame();
  check(() => { assert.equal(writes, 1); assert.equal(ctx.openingReceipt, null); assert(ctx.openingPendingAttempt); });
  await ctx.enterGame();
  check(() => { assert.equal(writes, 1); assert.equal(captures, 1, 'ambiguous result retries its original opaque token'); assert(ctx.openingReceipt); });
  node('opening-greeting').value += '我整理好衣领。'; ctx.editGreeting();
  check(() => { assert.equal(ctx.openingReceipt, null); assert.equal(node('opening-scene-confirmed').checked, false); assert(node('opening-message').value.includes('档案草稿')); });
  fill(); setupController(); state.系统.开局状态 = '已建档';
  await ctx.enterGame();
  check(() => { assert.equal(writes, 0); assert(node('archive-feedback').textContent.includes('已经建档')); });
  fill(); setupController();
  let finishCapture;
  ctx.window.RakudaiStateController.capture = () => new Promise(resolve => { finishCapture = resolve; });
  const inFlight = ctx.enterGame();
  node('input-name').value = '改名后的草稿';
  finishCapture({ state: initialState(), token });
  await inFlight;
  check(() => { assert.equal(writes, 0); assert(node('archive-feedback').textContent.includes('草稿已修改')); });
  console.log(JSON.stringify({ checks, inlineScripts: scripts.length, uniqueIds: ids.length, status: 'pass', scope: 'offline page contracts; live runtime pending' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
