import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// Execute the maintained page's handlers and draft parsers with an in-memory DOM
// and model double. This does not establish live Helper event timing or persistence.
const page = fs.readFileSync(new URL('../第一卷-世界书整理/开局页面/index.html', import.meta.url), 'utf8');
function between(start, end) {
  const from = page.indexOf(start), to = page.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, '缺少真实开局代码：' + start);
  return page.slice(from, to);
}
const source = [
  between('      var RATING_RULE_VERSION', '      // opening-rating-engine:end'),
  between('      var ARCHIVE_FORMAT', '      function parseAbilityLines('),
  between('      function parseAbilityLines(', '      function validateAbilityInputs('),
  between('      function readOpeningDraft()', '      function buildOpeningMessage('),
  between('      function handleProfileEdit()', '      async function readConfirmedScene()'),
  between('      var CHARACTER_SCOPE_PROMPT', '      function applySceneTemplate('),
  between('      function buildGreetingPrompts(', '      // 同步表单数据到右侧卡片'),
].join('\n');
const plain = value => JSON.parse(JSON.stringify(value));
const greeting = '章段: 第一章\n时间: 当日清晨\n地点: 破军学园·第三训练场\n开场白: 我推开训练场的门，向等候的老师打了声招呼。';

function fixture({ namespaced = false } = {}) {
  const nodes = new Map(), requests = [], forbidden = [];
  const chat = [{ is_user: false, mes: '首楼', variables: { stat_data: { 系统: { 开局状态: '待建档' } } } }];
  const originalChat = structuredClone(chat);
  function element(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', disabled: false, checked: false });
    return nodes.get(id);
  }
  const forbid = name => () => { forbidden.push(name); throw new Error('辅助生成不得调用 ' + name); };
  const generation = config => new Promise((resolve, reject) => requests.push({ config, resolve, reject }));
  const helpers = Object.fromEntries([
    'createChatMessages', 'setChatMessages', 'deleteChatMessages', 'replaceVariables', 'updateVariablesWith',
    'insertOrAssignVariables', 'executeSlashCommands', 'triggerSlash', 'generate',
  ].map(name => [name, forbid(name)]));
  const mvu = { replaceMvuData: forbid('replaceMvuData'), parseMessage: forbid('parseMessage') };
  const controller = Object.fromEntries(['commitOpening', 'replaceOpening', 'setScene'].map(name => [name, forbid(name)]));
  const window = { ...helpers, Mvu: mvu, SillyTavern: { getContext: () => ({ chat }) } };
  window.parent = window; window.top = window;
  window.TavernHelper = { ...helpers, Mvu: mvu, ...(namespaced ? { generateRaw: generation } : {}) };
  if (!namespaced) window.generateRaw = generation;
  const realm = vm.createContext({
    ...helpers, window, Mvu: mvu, fetch: forbid('fetch'),
    document: { getElementById: element, querySelectorAll: () => [] },
    activeStartProfile: 'user', avatarState: 'placeholder',
    openingController: () => controller,
    enterGame: forbid('enterGame'), captureOpeningState: forbid('captureOpeningState'),
    // Rendering and route-chip updates have no host in this fixture.
    syncCard() {}, moveToUserRoute() {},
  });
  vm.runInContext(source, realm, { filename: 'opening-ai-handlers-from-index.html' });
  element('input-name').value = '保留姓名';
  element('input-device').value = '测试灵装';
  element('input-ability').value = '只能影响自己手中物体的重量';
  element('opening-chapter').value = '待选择';
  element('opening-greeting').value = '玩家原有开场构思';
  const handlers = {
    greeting: () => realm.generateGreeting(),
    profile: () => realm.generateAiAssistance(),
  };
  function assertUntouched() {
    assert.deepEqual(forbidden, [], '只能改表单，不能调用聊天或 MVU 写接口');
    assert.deepEqual(chat, originalChat, '宿主聊天和变量保持不变');
  }
  return { realm, element, requests, handlers, assertUntouched, draft: () => plain(realm.readOpeningDraft()) };
}

function profileReply(f) {
  const profile = f.draft().profile;
  return JSON.stringify({ ...profile, name: '不应替换的 AI 姓名', personality: '沉稳',
    nobleArt: '轻羽｜减轻手中物体重量｜接触时有效', otherAbilities: '基础剑术｜掌握基本招架｜需持剑',
    stats: Object.fromEntries(f.realm.RATING_AXES.map(key => [key, 'C'])),
    context: { 当前身体: '健康', 当前能力边界: '必须接触', 本局映射: '沿用玩家设定' }, reasons: '只补空白项。' });
}
function assertRequest(request, kind) {
  assert.match(request.config.generation_id, new RegExp('^rk-opening:' + kind + ':[^:]+:[^:]+$'));
  assert.equal(request.config.should_silence, true, '辅助请求不接管酒馆停止按钮');
  assert.equal(request.config.should_stream, false);
  assert.deepEqual(Array.from(request.config.ordered_prompts, prompt => prompt.role), ['system', 'user']);
  assert.ok(request.config.ordered_prompts.every(prompt => typeof prompt.content === 'string' && prompt.content.length));
}

for (const namespaced of [false, true]) {
  test(`两按钮通过${namespaced ? 'TavernHelper' : 'window'}接口使用不同来源 ID，成功后只回填草稿`, async () => {
    const f = fixture({ namespaced });
    const greetingTask = f.handlers.greeting(), profileTask = f.handlers.profile();
    assert.equal(f.requests.length, 2);
    assertRequest(f.requests[0], 'greeting'); assertRequest(f.requests[1], 'profile');
    assert.notEqual(f.requests[0].config.generation_id, f.requests[1].config.generation_id);
    f.requests[0].resolve(greeting); await greetingTask;
    assert.equal(f.element('opening-greeting').value, '我推开训练场的门，向等候的老师打了声招呼。');
    assert.equal(f.element('opening-chapter').value, '第一章');
    assert.equal(f.element('opening-location').value, '破军学园·第三训练场');
    f.requests[1].resolve(profileReply(f)); await profileTask;
    assert.equal(f.element('input-name').value, '保留姓名');
    assert.equal(f.element('input-personality').value, '沉稳');
    assert.match(f.element('input-noble-art').value, /^轻羽｜/);
    assert.equal(f.element('stat-attack').value, 'C');
    assert.match(f.element('ai-assistance-result').value, /尚未写入本局 MVU/);
    assert.equal(f.element('generate-greeting').disabled, false);
    assert.equal(f.element('ai-generate-button').disabled, false);
    f.assertUntouched();
  });
}

for (const kind of ['greeting', 'profile']) {
  const buttonId = kind === 'greeting' ? 'generate-greeting' : 'ai-generate-button';
  const statusId = kind === 'greeting' ? 'greeting-feedback' : 'ai-assistance-status';
  test(`${kind} 网络失败释放本按钮，重试使用新 ID 且不碰聊天/MVU`, async () => {
    const f = fixture(), before = f.draft();
    let task = f.handlers[kind]();
    assert.equal(f.element(buttonId).disabled, true);
    f.requests[0].reject(new Error('模拟连接失败')); await task;
    assert.deepEqual(f.draft(), before);
    assert.match(f.element(statusId).textContent, /模拟连接失败/);
    assert.equal(f.element(buttonId).disabled, false);
    task = f.handlers[kind]();
    assertRequest(f.requests[1], kind);
    assert.notEqual(f.requests[0].config.generation_id, f.requests[1].config.generation_id);
    f.requests[1].reject(new Error('模拟取消')); await task;
    assert.deepEqual(f.draft(), before); f.assertUntouched();
  });

  test(`${kind} 在请求期间修改草稿，旧结果不能覆盖新表单或写入宿主`, async () => {
    const f = fixture(), task = f.handlers[kind]();
    const response = kind === 'greeting' ? greeting : profileReply(f);
    f.element('input-name').value = '玩家刚改的姓名';
    f.realm.handleProfileEdit();
    const edited = f.draft();
    f.requests[0].resolve(response); await task;
    assert.deepEqual(f.draft(), edited);
    assert.match(f.element(statusId).textContent, /生成期间.*修改/);
    assert.equal(f.element(buttonId).disabled, false);
    f.assertUntouched();
  });
}

test('档案返回截断 JSON 时保留原文，不回填局部猜测或调用建档', async () => {
  const f = fixture(), before = f.draft(), task = f.handlers.profile();
  const broken = '{"personality":"沉稳","nobleArt":';
  f.requests[0].resolve(broken); await task;
  assert.deepEqual(f.draft(), before);
  assert.equal(f.element('ai-assistance-result').value, broken);
  assert.match(f.element('ai-assistance-status').textContent, /JSON 不完整或格式有误/);
  f.assertUntouched();
});

test('开场白空响应不覆盖原有草稿，不触发任何持久化', async () => {
  const f = fixture(), before = f.draft(), task = f.handlers.greeting();
  f.requests[0].resolve(''); await task;
  assert.deepEqual(f.draft(), before);
  assert.match(f.element('greeting-feedback').textContent, /未返回有效开场白/);
  f.assertUntouched();
});

test('同一按钮防重复，不阻止另一个独立辅助请求', async () => {
  const f = fixture();
  const first = f.handlers.profile(); await f.handlers.profile();
  const other = f.handlers.greeting(); await f.handlers.greeting();
  assert.equal(f.requests.length, 2);
  f.requests[0].resolve(profileReply(f)); await first;
  const afterProfile = f.draft();
  f.requests[1].resolve(greeting); await other;
  assert.deepEqual(f.draft(), afterProfile, '档案先变更，旧开场白不得覆盖新资料');
  assert.match(f.element('greeting-feedback').textContent, /生成期间资料已修改/);
  f.assertUntouched();
});
