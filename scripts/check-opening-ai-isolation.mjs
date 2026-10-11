import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// Execute the maintained page's handlers and draft parsers with an in-memory DOM
// and model double. This does not establish live Helper event timing or persistence.
const page = fs.readFileSync(new URL('../第一卷-世界书整理/开局页面/index.html', import.meta.url), 'utf8');
test('开局 HTML 不包含会被 EJS 预处理误识别的原样起始分隔符', () => {
  assert.doesNotMatch(page, /\x3c%/, '即使位于 JavaScript 正则或注释，EJS 起始分隔符也须转义');
});
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

function fixture({ namespaced = false, bindings = { primary: null, additional: [] }, books = {}, readBook } = {}) {
  const nodes = new Map(), requests = [], requestWaiters = new Map(), forbidden = [];
  const worldbookReads = { characters: [], books: [] };
  const chat = [{ is_user: false, mes: '首楼', variables: { stat_data: { 系统: { 开局状态: '待建档' } } } }];
  const originalChat = structuredClone(chat);
  function createElement(tagName = 'div') {
    return {
      tagName, value: '', textContent: '', disabled: false, checked: false, open: false,
      className: '', dataset: {}, children: [], isConnected: true,
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      querySelectorAll(selector) {
        const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
        return descendants.filter(child => selector === '*' || (selector.startsWith('.') ?
          child.className.split(/\s+/).includes(selector.slice(1)) : child.tagName === selector));
      },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      focus() { document.activeElement = this; },
    };
  }
  function element(id) {
    if (!nodes.has(id)) nodes.set(id, createElement());
    return nodes.get(id);
  }
  const document = {
    activeElement: null, getElementById: element, createElement,
    querySelectorAll(selector) {
      const match = /^#([^ ]+) (.+)$/.exec(selector);
      return match ? element(match[1]).querySelectorAll(match[2]) : [];
    },
  };
  const forbid = name => () => { forbidden.push(name); throw new Error('辅助生成不得调用 ' + name); };
  const generation = config => new Promise((resolve, reject) => {
    const request = { config, resolve, reject }, index = requests.push(request) - 1;
    requestWaiters.get(index)?.(request);
    requestWaiters.delete(index);
  });
  const readers = {
    getCharWorldbookNames(character) {
      worldbookReads.characters.push(character);
      return structuredClone(typeof bindings === 'function' ? bindings(character, worldbookReads.characters.length) : bindings);
    },
    async getWorldbook(name) {
      worldbookReads.books.push(name);
      if (readBook) return readBook(name);
      assert.ok(Object.hasOwn(books, name), '不应读取未提供的世界书：' + name);
      return structuredClone(books[name]);
    },
  };
  const helpers = Object.fromEntries([
    'createChatMessages', 'setChatMessages', 'deleteChatMessages', 'replaceVariables', 'updateVariablesWith',
    'insertOrAssignVariables', 'executeSlashCommands', 'triggerSlash', 'generate',
  ].map(name => [name, forbid(name)]));
  const mvu = { replaceMvuData: forbid('replaceMvuData'), parseMessage: forbid('parseMessage') };
  const controller = Object.fromEntries(['commitOpening', 'replaceOpening', 'setScene'].map(name => [name, forbid(name)]));
  const window = { ...helpers, Mvu: mvu, SillyTavern: { getContext: () => ({ chat }) } };
  window.parent = window; window.top = window;
  window.TavernHelper = { ...helpers, Mvu: mvu, ...(namespaced ? { generateRaw: generation, ...readers } : {}) };
  if (!namespaced) Object.assign(window, { generateRaw: generation, ...readers });
  const realm = vm.createContext({
    ...helpers, window, Mvu: mvu, fetch: forbid('fetch'),
    document,
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
  // Observe the actual model call, without guessing how many microtasks retrieval needs.
  function requestAt(index, task) {
    const arrival = requests[index] ? Promise.resolve(requests[index]) :
      new Promise(resolve => requestWaiters.set(index, resolve));
    return Promise.race([arrival, task.then(() => {
      assert.fail('处理器结束前未发出预期模型请求：' + index);
    })]);
  }
  return { realm, element, requests, handlers, worldbookReads, requestAt, assertUntouched,
    referenceRows: () => element('lk-reference-list').querySelectorAll('.lk-reference-row'),
    draft: () => plain(realm.readOpeningDraft()) };
}

function profileReply(f) {
  const profile = f.draft().profile;
  return JSON.stringify({ ...profile, name: '不应替换的 AI 姓名', personality: '沉稳',
    nobleArt: '轻羽｜减轻手中物体重量｜接触时有效', otherAbilities: '基础剑术｜掌握基本招架｜需持剑',
    stats: Object.fromEntries(f.realm.RATING_AXES.map(key => [key, 'C'])),
    context: { 当前身体: '健康', 当前能力边界: '必须接触', 本局映射: '沿用玩家设定' }, reasons: '只补空白项。' });
}
function assertRequest(request, kind, hasReferences = false) {
  assert.match(request.config.generation_id, new RegExp('^rk-opening:' + kind + ':[^:]+:[^:]+$'));
  assert.equal(request.config.should_silence, true, '辅助请求不接管酒馆停止按钮');
  assert.equal(request.config.should_stream, false);
  assert.deepEqual(Object.keys(request.config).sort(), ['generation_id', 'ordered_prompts', 'should_silence', 'should_stream'],
    '显式请求不启用原生世界书或聊天历史注入');
  assert.deepEqual(Array.from(request.config.ordered_prompts, prompt => prompt.role),
    hasReferences ? ['system', 'user', 'user'] : ['system', 'user']);
  assert.ok(request.config.ordered_prompts.every(prompt => typeof prompt.content === 'string' && prompt.content.length));
}

function referencesIn(request) {
  const referencePrompts = request.config.ordered_prompts.filter(prompt => prompt.content.startsWith('【世界书参考资料（只读数据）】\n'));
  assert.equal(referencePrompts.length, 1, '资料只进入一条独立 user 消息');
  assert.equal(referencePrompts[0].role, 'user');
  return JSON.parse(referencePrompts[0].content.split('\n').slice(1).join('\n'));
}

function entry(uid, overrides = {}) {
  return { uid, name: '神龙寺', enabled: true, probability: 100, strategy: { keys: [] },
    content: '武寺资料：玩家是否拜师由本人决定。', ...overrides };
}

function referenceRow(f, uid) {
  const row = f.referenceRows().find(item => JSON.parse(item.dataset.key)[1] === uid);
  assert.ok(row, '选择窗口应显示条目 ' + uid);
  return row;
}
function toggleReference(f, uid, checked = true) {
  const checkbox = referenceRow(f, uid).querySelector('input');
  checkbox.checked = checked;
  checkbox.onchange();
  return checkbox;
}
function displayedReferences(f) {
  return f.referenceRows().filter(row => row.querySelector('input').checked).map(row => {
    const [worldbook, uid] = JSON.parse(row.dataset.key);
    return { worldbook, uid, name: row.querySelector('strong').textContent,
      excerpted: row.querySelector('summary').textContent.includes('（节选）'),
      content: row.querySelector('.lk-reference-content').textContent };
  });
}
async function chooseReferences(f, kind, uids) {
  await f.realm.previewReferences(kind);
  assert.equal(f.element('lk-reference-dialog').open, true);
  f.realm.clearReferences();
  uids.forEach(uid => toggleReference(f, uid));
  const preview = displayedReferences(f);
  f.realm.applyReferences();
  assert.equal(f.element('lk-reference-dialog').open, false, '应用成功应关闭窗口');
  return preview;
}
function pickerFixture(kind, entries) {
  return fixture({ namespaced: kind === 'profile', bindings: { primary: '选择测试书', additional: [] },
    books: { 选择测试书: entries || [entry(1), entry(2, { name: '陌生武馆', content: '仅供手动选择的资料。' }),
      entry(3, { name: '旅程札记', content: '描述独立的 NEEDLE 线索。' })] } });
}

for (const namespaced of [false, true]) {
  test(`两按钮通过${namespaced ? 'TavernHelper' : 'window'}接口使用不同来源 ID，成功后只回填草稿`, async () => {
    const f = fixture({ namespaced });
    const greetingTask = f.handlers.greeting(), profileTask = f.handlers.profile();
    await Promise.all([f.requestAt(0, greetingTask), f.requestAt(1, profileTask)]);
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
    await f.requestAt(0, task);
    f.requests[0].reject(new Error('模拟连接失败')); await task;
    assert.deepEqual(f.draft(), before);
    assert.match(f.element(statusId).textContent, /模拟连接失败/);
    assert.equal(f.element(buttonId).disabled, false);
    task = f.handlers[kind]();
    await f.requestAt(1, task);
    assertRequest(f.requests[1], kind);
    assert.notEqual(f.requests[0].config.generation_id, f.requests[1].config.generation_id);
    f.requests[1].reject(new Error('模拟取消')); await task;
    assert.deepEqual(f.draft(), before); f.assertUntouched();
  });

  test(`${kind} 在请求期间修改草稿，旧结果不能覆盖新表单或写入宿主`, async () => {
    const f = fixture(), task = f.handlers[kind]();
    await f.requestAt(0, task);
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
  await f.requestAt(0, task);
  const broken = '{"personality":"沉稳","nobleArt":';
  f.requests[0].resolve(broken); await task;
  assert.deepEqual(f.draft(), before);
  assert.equal(f.element('ai-assistance-result').value, broken);
  assert.match(f.element('ai-assistance-status').textContent, /JSON 不完整或格式有误/);
  f.assertUntouched();
});

test('开场白空响应不覆盖原有草稿，不触发任何持久化', async () => {
  const f = fixture(), before = f.draft(), task = f.handlers.greeting();
  await f.requestAt(0, task);
  f.requests[0].resolve(''); await task;
  assert.deepEqual(f.draft(), before);
  assert.match(f.element('greeting-feedback').textContent, /未返回有效开场白/);
  f.assertUntouched();
});

test('同一按钮防重复，不阻止另一个独立辅助请求', async () => {
  const f = fixture();
  const first = f.handlers.profile(); await f.handlers.profile();
  const other = f.handlers.greeting(); await f.handlers.greeting();
  await Promise.all([f.requestAt(0, first), f.requestAt(1, other)]);
  assert.equal(f.requests.length, 2);
  f.requests[0].resolve(profileReply(f)); await first;
  const afterProfile = f.draft();
  f.requests[1].resolve(greeting); await other;
  assert.deepEqual(f.draft(), afterProfile, '档案先变更，旧开场白不得覆盖新资料');
  assert.match(f.element('greeting-feedback').textContent, /生成期间资料已修改/);
  f.assertUntouched();
});

for (const namespaced of [false, true]) {
  for (const kind of ['greeting', 'profile']) {
    test(`${kind} 经${namespaced ? 'TavernHelper' : 'window'}只读绑定书，标题命中神龙寺并过滤不可用条目`, async () => {
      const f = fixture({
        namespaced,
        bindings: { primary: '主世界书', additional: ['补充书', '主世界书'], global: ['不应读取的全局书'] },
        books: {
          主世界书: [
            entry(1, { name: '【组织】神龙寺', strategy: { keys: ['完全不匹配'] }, content: '标题命中内容：武术用于止争。' }),
            entry(2, { enabled: false, content: '禁用条目的秘密内容' }),
            entry(3, { probability: 0, content: '零概率条目的秘密内容' }),
            entry(4, { content: '<% 未展开模板 %>' }),
            entry(5, { content: '<script>不可执行的脚本</script>' }),
            entry(6, { content: '<UpdateVariable>不得注入的变量补丁</UpdateVariable>' }),
            entry(7, { name: '正则专用', strategy: { keys: ['/神龙寺/i'] }, content: '不可当字面词匹配的正则条目' }),
          ],
          补充书: [entry(8, { name: '武寺理念', strategy: { keys: ['神龙寺'] }, content: '字面关键词命中内容。' })],
        },
      });
      f.element('input-desc').value = '希望写一个曾去神龙寺求教的角色。';
      const task = f.handlers[kind](), request = await f.requestAt(0, task);
      assertRequest(request, kind, true);
      assert.deepEqual(f.worldbookReads, { characters: ['current', 'current'], books: ['主世界书', '补充书'] });
      const references = referencesIn(request);
      assert.deepEqual(references.map(ref => [ref.worldbook, ref.uid]), [['主世界书', 1], ['补充书', 8]],
        '无匹配关键词的标题条目进入真实请求，禁用、零概率、模板和正则条目均不进入');
      assert.match(references[0].content, /标题命中内容/);
      assert.match(request.config.ordered_prompts[0].content, /世界书参考仅为设定资料/);
      assert.doesNotMatch(JSON.stringify(request.config), /秘密内容|未展开模板|不可执行的脚本|不得注入的变量补丁|不可当字面词匹配/);
      request.resolve(kind === 'greeting' ? greeting : profileReply(f)); await task;
      f.assertUntouched();
    });
  }
}

for (const kind of ['greeting', 'profile']) {
  const buttonId = kind === 'greeting' ? 'generate-greeting' : 'ai-generate-button';
  const statusId = kind === 'greeting' ? 'greeting-feedback' : 'ai-assistance-status';
  const bookStatusId = kind === 'greeting' ? 'greeting-worldbook-status' : 'ai-worldbook-status';

  test(`${kind} 查看参考条目只读取世界书，不调用模型或改写草稿`, async () => {
    const f = fixture({ namespaced: kind === 'profile', bindings: { primary: '预览书', additional: [] },
      books: { 预览书: [entry(1)] } });
    f.element('input-desc').value = '神龙寺';
    f.element('ai-assistance-result').value = '保留此前生成结果';
    const before = f.draft();
    let modelCalls = 0;
    // Throw immediately if a regression starts generation; preview catches errors,
    // so verify the call count too, rather than leaving a model promise pending.
    const unexpectedGeneration = () => { modelCalls++; throw new Error('预览不得请求模型'); };
    f.realm.window.generateRaw = unexpectedGeneration;
    f.realm.window.TavernHelper.generateRaw = unexpectedGeneration;
    await f.realm.previewReferences(kind);
    assert.equal(modelCalls, 0);
    assert.equal(f.requests.length, 0);
    assert.deepEqual(f.worldbookReads, { characters: ['current', 'current'], books: ['预览书'] });
    assert.equal(f.element('lk-reference-dialog').open, true);
    assert.equal(referenceRow(f, 1).querySelector('input').checked, true, '匹配条目默认推荐勾选');
    assert.match(f.element(bookStatusId).textContent, /请选择.*应用前仍保留原选择/);
    assert.equal(f.realm.openingReferenceChoices[kind], null, '打开窗口不等于保存选择');
    assert.deepEqual(f.draft(), before);
    assert.equal(f.element('ai-assistance-result').value, '保留此前生成结果');
    assert.equal(f.element(buttonId).disabled, false);
    f.assertUntouched();
  });

  test(`${kind} 纯括号标题与称号前缀命中优先于宽泛关键词，不被六条上限挤走`, async () => {
    const broadKeys = Array.from({ length: 12 }, (_, i) => '背景词' + i);
    const f = fixture({ bindings: { primary: '标题回归', additional: [] }, books: { 标题回归: [
      ...Array.from({ length: 6 }, (_, i) => entry(i, { name: '宽泛条目' + i, strategy: { keys: broadKeys } })),
      entry(100, { name: '【神龙寺】' }),
      entry(101, { name: '〈雷切〉东堂刀华' }),
    ] } });
    f.element('input-desc').value = '神龙寺、东堂刀华；' + broadKeys.join('、');
    const task = f.handlers[kind](), request = await f.requestAt(0, task);
    assertRequest(request, kind, true);
    const references = referencesIn(request);
    assert.deepEqual(references.slice(0, 2).map(ref => ref.uid), [100, 101]);
    assert.equal(references.length, 6);
    request.resolve(kind === 'greeting' ? greeting : profileReply(f)); await task;
    f.assertUntouched();
  });

  for (const { length, count, total } of [
    { length: 2600, count: 6, total: 15600 },
    { length: 80, count: 6, total: 480 },
  ]) {
    test(`${kind} 真实参考请求最多六条，${length > 2000 ? '长文' : '短文'}完整发送`, async () => {
      const f = fixture({ bindings: { primary: '容量测试', additional: [] },
        books: { 容量测试: Array.from({ length: 8 }, (_, i) => entry(i, { content: String(i).repeat(length) })) } });
      f.element('input-desc').value = '神龙寺';
      const task = f.handlers[kind](), request = await f.requestAt(0, task);
      assertRequest(request, kind, true);
      const references = referencesIn(request);
      assert.equal(references.length, count);
      assert.equal(references.reduce((sum, ref) => sum + ref.content.length, 0), total);
      for (const ref of references) {
        assert.equal(ref.content.length, length);
        assert.equal(ref.excerpted, false);
        assert.equal(ref.content, String(ref.uid).repeat(length), '完整保留来源正文');
      }
      assert.match(f.element(bookStatusId).textContent, new RegExp('共 ' + total + ' 字'));
      assert.doesNotMatch(f.element(bookStatusId).textContent, /（节选）/);
      request.resolve(kind === 'greeting' ? greeting : profileReply(f)); await task;
      f.assertUntouched();
    });
  }

  test(`${kind} 任一绑定书读取失败都不得用部分资料发模型请求`, async () => {
    const f = fixture({ bindings: { primary: '可读取', additional: ['读取失败'] },
      readBook: async name => {
        if (name === '读取失败') throw new Error('模拟世界书读取失败');
        return [entry(1)];
      } });
    f.element('input-desc').value = '神龙寺';
    const before = f.draft();
    await f.handlers[kind]();
    assert.equal(f.requests.length, 0);
    assert.deepEqual(f.draft(), before);
    assert.match(f.element(bookStatusId).textContent, /世界书读取失败，本次未生成/);
    assert.match(f.element(statusId).textContent, /模拟世界书读取失败/);
    assert.equal(f.element(buttonId).disabled, false);
    f.assertUntouched();
  });

  test(`${kind} 检索期间改资料，不发出基于旧草稿的模型请求`, async () => {
    let finishRead;
    const pendingBook = new Promise(resolve => { finishRead = resolve; });
    const f = fixture({ bindings: { primary: '延迟书', additional: [] }, readBook: () => pendingBook });
    f.element('input-desc').value = '神龙寺';
    const task = f.handlers[kind]();
    assert.deepEqual(f.worldbookReads.books, ['延迟书']);
    assert.equal(f.requests.length, 0, '取书完成前不应请求模型');
    f.element('input-name').value = '检索期间修改的新姓名';
    f.realm.handleProfileEdit();
    const edited = f.draft();
    finishRead([entry(1)]); await task;
    assert.equal(f.requests.length, 0, '旧草稿即使检索命中也不应请求模型');
    assert.deepEqual(f.draft(), edited);
    assert.match(f.element(statusId).textContent, /检索期间资料已修改/);
    assert.equal(f.element(buttonId).disabled, false);
    f.assertUntouched();
  });

  test(`${kind} 检索期间绑定书切换，旧资料不得发给模型`, async () => {
    let finishRead, currentBindings = { primary: '旧书', additional: [] };
    const pendingBook = new Promise(resolve => { finishRead = resolve; });
    const f = fixture({ namespaced: true, bindings: () => currentBindings, readBook: () => pendingBook });
    f.element('input-desc').value = '神龙寺';
    const before = f.draft(), task = f.handlers[kind]();
    assert.deepEqual(f.worldbookReads.characters, ['current']);
    currentBindings = { primary: '新书', additional: [] };
    finishRead([entry(1)]); await task;
    assert.deepEqual(f.worldbookReads, { characters: ['current', 'current'], books: ['旧书'] });
    assert.equal(f.requests.length, 0);
    assert.deepEqual(f.draft(), before);
    assert.match(f.element(bookStatusId).textContent, /绑定的世界书已切换/);
    assert.match(f.element(statusId).textContent, /绑定的世界书已切换/);
    assert.equal(f.element(buttonId).disabled, false);
    f.assertUntouched();
  });
}

for (const kind of ['greeting', 'profile']) {
  const statusId = kind === 'greeting' ? 'greeting-feedback' : 'ai-assistance-status';
  const bookStatusId = kind === 'greeting' ? 'greeting-worldbook-status' : 'ai-worldbook-status';

  test(`${kind} 手动选择无关键词条目后，关闭或取消新勾选仍发送已保存选择`, async () => {
    const f = pickerFixture(kind);
    f.element('input-desc').value = '神龙寺';
    const preview = await chooseReferences(f, kind, [2]);
    assert.equal(preview[0].name, '陌生武馆');
    const saved = plain(f.realm.openingReferenceChoices[kind]);
    for (const cancelWithEscape of [false, true]) {
      await f.realm.previewReferences(kind);
      assert.equal(referenceRow(f, 2).querySelector('input').checked, true);
      f.realm.clearReferences(); toggleReference(f, 3);
      if (cancelWithEscape) {
        let prevented = false;
        f.element('lk-reference-dialog').oncancel({ preventDefault() { prevented = true; } });
        assert.equal(prevented, true);
      } else f.realm.closeReferences();
      assert.equal(f.element('lk-reference-dialog').open, false);
      assert.deepEqual(plain(f.realm.openingReferenceChoices[kind]), saved);
    }
    const task = f.handlers[kind](), request = await f.requestAt(0, task);
    assertRequest(request, kind, true);
    assert.deepEqual(referencesIn(request), preview, '真实请求只包含手动确认的非匹配条目');
    request.resolve(kind === 'greeting' ? greeting : profileReply(f)); await task;
    f.assertUntouched();
  });

  test(`${kind} 清空应用后不恢复推荐，世界书接口失效也能直接生成`, async () => {
    const f = pickerFixture(kind);
    f.element('input-desc').value = '神龙寺';
    await chooseReferences(f, kind, []);
    await f.realm.previewReferences(kind);
    assert.equal(displayedReferences(f).length, 0, '重新打开仍保留空选');
    f.realm.closeReferences();
    const readsBeforeGeneration = structuredClone(f.worldbookReads);
    let unexpectedReads = 0;
    const unavailableReader = () => { unexpectedReads++; throw new Error('绑定或取书接口不可用'); };
    for (const owner of [f.realm.window, f.realm.window.TavernHelper]) {
      owner.getCharWorldbookNames = unavailableReader;
      owner.getWorldbook = unavailableReader;
    }
    const task = f.handlers[kind](), request = await f.requestAt(0, task);
    assert.equal(unexpectedReads, 0, '显式空选不再检查绑定或读取世界书');
    assert.deepEqual(f.worldbookReads, readsBeforeGeneration);
    assertRequest(request, kind);
    assert.doesNotMatch(JSON.stringify(request.config), /【世界书参考资料（只读数据）】/);
    assert.match(f.element(bookStatusId).textContent, /已选择不参考世界书/);
    request.resolve(kind === 'greeting' ? greeting : profileReply(f)); await task;
    f.assertUntouched();
  });

  test(`${kind} 搜索标题、正文、书名不丢隐藏条目的勾选`, async () => {
    const f = pickerFixture(kind);
    await f.realm.previewReferences(kind);
    f.realm.clearReferences(); toggleReference(f, 2); toggleReference(f, 3);
    f.realm.filterReferences('陌生武馆');
    assert.deepEqual(f.referenceRows().map(row => JSON.parse(row.dataset.key)[1]), [2]);
    f.realm.filterReferences('needle');
    assert.deepEqual(f.referenceRows().map(row => JSON.parse(row.dataset.key)[1]), [3]);
    f.realm.filterReferences('选择测试书');
    assert.equal(f.referenceRows().length, 3);
    f.realm.filterReferences('搜索无结果');
    assert.equal(f.referenceRows().length, 0);
    assert.match(f.element('lk-reference-count').textContent, /已选 2 \/ 6 条/);
    f.realm.filterReferences('');
    const preview = displayedReferences(f);
    assert.deepEqual(preview.map(ref => ref.uid), [2, 3]);
    f.realm.applyReferences();
    const task = f.handlers[kind](), request = await f.requestAt(0, task);
    assert.deepEqual(referencesIn(request), preview);
    request.resolve(kind === 'greeting' ? greeting : profileReply(f)); await task;
    f.assertUntouched();
  });

  for (const change of ['删除', '禁用', '正文改变']) {
    test(`${kind} 确认后${change}已选条目，阻止旧参考请求模型`, async () => {
      let current = [entry(1)];
      const f = fixture({ bindings: { primary: '变化书', additional: [] }, readBook: () => structuredClone(current) });
      await chooseReferences(f, kind, [1]);
      const before = f.draft();
      if (change === '删除') current = [];
      else if (change === '禁用') current[0].enabled = false;
      else current[0].content = '正文已经改变，必须重新确认。';
      await f.handlers[kind]();
      assert.equal(f.requests.length, 0);
      assert.deepEqual(f.draft(), before);
      assert.match(f.element(statusId).textContent, change === '正文改变' ? /内容已更新/ : /禁用、删除或不再可用/);
      f.assertUntouched();
    });
  }

  test(`${kind} 手选六条长文均完整保留，不能选第七条，窗口正文与发送正文完全一致`, async () => {
    const f = pickerFixture(kind, Array.from({ length: 7 }, (_, i) => entry(i + 1,
      { name: '长文' + (i + 1), content: String(i + 1).repeat(2600) })));
    await f.realm.previewReferences(kind);
    for (let uid = 1; uid <= 6; uid++) toggleReference(f, uid);
    assert.equal(toggleReference(f, 7).checked, false);
    assert.match(f.element('lk-reference-feedback').textContent, /最多选择 6 条/);
    const preview = displayedReferences(f);
    assert.equal(preview.length, 6);
    assert.equal(preview.reduce((sum, ref) => sum + ref.content.length, 0), 15600);
    assert.ok(preview.every(ref => !ref.excerpted && ref.content === String(ref.uid).repeat(2600)));
    assert.match(f.element('lk-reference-count').textContent, /已选 6 \/ 6 条.*15600 字/);
    f.realm.applyReferences();
    const task = f.handlers[kind](), request = await f.requestAt(0, task);
    assert.deepEqual(referencesIn(request), preview, '逐条核对用户看到的完整正文与真实请求');
    request.resolve(kind === 'greeting' ? greeting : profileReply(f)); await task;
    f.assertUntouched();
  });

  test(`${kind} 模型生成期间不能应用新选择或改掉正在使用的资料`, async () => {
    const f = pickerFixture(kind);
    await chooseReferences(f, kind, [2]);
    const saved = plain(f.realm.openingReferenceChoices[kind]);
    await f.realm.previewReferences(kind);
    f.realm.clearReferences(); toggleReference(f, 3);
    const task = f.handlers[kind](), request = await f.requestAt(0, task);
    f.realm.applyReferences();
    assert.match(f.element('lk-reference-feedback').textContent, /AI 正在生成/);
    assert.equal(f.element('lk-reference-dialog').open, true);
    assert.deepEqual(plain(f.realm.openingReferenceChoices[kind]), saved);
    assert.deepEqual(referencesIn(request).map(ref => ref.uid), [2]);
    request.resolve(kind === 'greeting' ? greeting : profileReply(f)); await task;
    f.realm.applyReferences();
    assert.equal(f.element('lk-reference-dialog').open, false);
    assert.deepEqual(plain(f.realm.openingReferenceChoices[kind].references).map(ref => ref.uid), [3]);
    f.assertUntouched();
  });
}

test('档案与开场白独立保存参考选择，两个真实请求各用自己的条目', async () => {
  const f = pickerFixture('profile');
  await chooseReferences(f, 'profile', [2]);
  await chooseReferences(f, 'greeting', [3]);
  const profileTask = f.handlers.profile(), greetingTask = f.handlers.greeting();
  const [profileRequest, greetingRequest] = await Promise.all([
    f.requestAt(0, profileTask), f.requestAt(1, greetingTask),
  ]);
  assert.deepEqual(referencesIn(profileRequest).map(ref => ref.uid), [2]);
  assert.deepEqual(referencesIn(greetingRequest).map(ref => ref.uid), [3]);
  profileRequest.reject(new Error('结束请求观测')); greetingRequest.reject(new Error('结束请求观测'));
  await Promise.all([profileTask, greetingTask]);
  f.assertUntouched();
});
