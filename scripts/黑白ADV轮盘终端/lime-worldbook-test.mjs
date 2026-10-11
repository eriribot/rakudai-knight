import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = fs.readFileSync(new URL('lime-worldbook.js', import.meta.url), 'utf8');
const realm = vm.createContext({});
vm.runInContext(source, realm);
const plain = value => JSON.parse(JSON.stringify(value));
const entry = (uid = 104, name = '风祭凛奈', extra = {}) => ({ uid, name, enabled: true, content: '明确的人物性格资料', ...extra });
const aliases = [
  { name: '风祭凛奈', aliases: ['风祭', '風祭凛奈', 'Rinna Kazamatsuri'] },
  { name: '夏洛特·科黛', aliases: ['夏洛特', 'Charlotte Corde'] },
  { name: '莎拉·布拉德莉莉', aliases: ['莎拉'] },
];
function fixture(entries = [entry()], aliasTable = aliases) {
  let context = { chat: [], chatId: 'chat-a', characterId: 0, groupId: null, characters: [{ avatar: 'rakudai.png' }] };
  let binding = { primary: '角色主世界书', additional: ['不能读取的附加书'] };
  let bindingRead = async () => binding, worldbookRead = async () => entries;
  const calls = [];
  const reader = realm.createLimeWorldbookReader({
    aliases: aliasTable, getContext: () => context,
    getCharWorldbookNames: async option => { calls.push(['binding', option]); return bindingRead(); },
    getWorldbook: async name => { calls.push(['worldbook', name]); return worldbookRead(name); },
  });
  return { read: name => reader.read(name), calls,
    get context() { return context; }, set context(value) { context = value; },
    get binding() { return binding; }, set binding(value) { binding = value; },
    set bindingRead(value) { bindingRead = value; }, set worldbookRead(value) { worldbookRead = value; } };
}
const rejected = (promise, code) => assert.rejects(promise, error => error.code === code);

test('真实导出转换为 runtime name 后按人物全名读取，不依赖人物前缀', async () => {
  const book = JSON.parse(fs.readFileSync(new URL('../../世界书规则/v0.3/导出/落第骑士英雄谭.json', import.meta.url), 'utf8'));
  const entries = Object.values(book.entries).map(item => ({ uid: item.uid, name: item.comment, content: item.content, enabled: item.disable !== true }));
  const f = fixture(entries);
  const result = plain(await f.read('风祭'));
  assert.equal(result.name, '风祭凛奈');
  assert.deepEqual(result.entries.map(item => item.uid), [104]);
  assert.match(result.entries[0].content, /Rinna Kazamatsuri/);
  assert.deepEqual(f.calls, [['binding', 'current'], ['worldbook', '角色主世界书'], ['binding', 'current']]);
  assert.equal((await f.read('夏洛特')).entries[0].uid, 130);
  assert.equal((await f.read('莎拉')).entries[0].uid, 106);
});

test('明确别名与 NFKC、空白和中点格式归一，未知 OC 可精确匹配', async () => {
  const f = fixture([entry(), entry(130, '夏洛特·科黛'), entry(500, '自创角色'), entry(501, '自创 / 二人组合')]);
  assert.equal((await f.read(' Ｒｉｎｎａ　Ｋａｚａｍａｔｓｕｒｉ ')).name, '风祭凛奈');
  assert.equal((await f.read('夏洛特・科黛')).name, '夏洛特·科黛');
  assert.equal((await f.read('自创角色')).entries[0].uid, 500);
  assert.equal((await f.read('自创 / 二人组合')).entries[0].uid, 501);
});

test('别名冲突拒绝构建，不能按注册顺序选择人物', () => {
  assert.throws(() => fixture([], [{ name: '甲', aliases: ['同称'] }, { name: '乙', aliases: ['同 称'] }]), error => error.code === 'LORE_ALIAS_AMBIGUOUS');
});

test('组合标题仅按斜线明确姓名分段选择，正文和触发关键字不是人物身份', async () => {
  const f = fixture([
    entry(106, '莎拉·布拉德莉莉 / 玛莉欧·罗索'),
    entry(110, '国立晓学园', { content: '风祭凛奈的性格描述', strategy: { keys: ['风祭凛奈'] } }),
    entry(120, '[剧情]风祭凛奈'), entry(121, '风祭凛奈的女仆'),
  ]);
  assert.equal((await f.read('莎拉')).entries[0].uid, 106);
  await rejected(f.read('风祭'), 'LORE_MISSING');
  assert.equal((await f.read('玛莉欧·罗索')).entries[0].uid, 106);
});

test('多个同名启用档案合并并稳定排序，返回副本不持有源条目引用', async () => {
  const entries = [entry(90, '折木有里', { content: '补充资料' }), entry(50, '折木有里', { content: '基础资料' })];
  const f = fixture(entries);
  const result = await f.read('折木有里');
  assert.deepEqual(plain(result.entries.map(item => item.uid)), [50, 90]);
  result.entries[0].content = '用户修改副本';
  assert.equal(entries[1].content, '基础资料');
  assert.equal((await f.read('折木有里')).entries[0].content, '基础资料');
});

test('禁用人物和缺失人物分别明确报错，允许同名启用档案仍提供材料', async () => {
  await rejected(fixture([entry(104, '风祭凛奈', { enabled: false })]).read('风祭'), 'LORE_DISABLED');
  await rejected(fixture([]).read('风祭'), 'LORE_MISSING');
  const result = await fixture([entry(104, '风祭凛奈', { enabled: false }), entry(105)]).read('风祭');
  assert.deepEqual(plain(result.entries.map(item => item.uid)), [105]);
});

test('条目正文须非空、UID 须明确唯一，不能把资料错误当性格激活', async () => {
  for (const content of ['', '  ', null]) await rejected(fixture([entry(104, '风祭凛奈', { content })]).read('风祭'), 'LORE_CONTENT_EMPTY');
  for (const uid of [-1, 1.2, '104']) await rejected(fixture([entry(uid)]).read('风祭'), 'LORE_FORMAT_INVALID');
  await rejected(fixture([entry(), entry()]).read('风祭'), 'LORE_FORMAT_INVALID');
});

test('人物材料总长 100000 字符可读，超限拒绝而不静默截断', async () => {
  const f = fixture([entry(104, '风祭凛奈', { content: '甲'.repeat(60000) }), entry(105, '风祭凛奈', { content: '乙'.repeat(40000) })]);
  assert.equal((await f.read('风祭')).entries.reduce((total, item) => total + item.content.length, 0), 100000);
  await rejected(fixture([entry(104, '风祭凛奈', { content: '甲'.repeat(100001) })]).read('风祭'), 'LORE_LIMIT_EXCEEDED');
});

test('读取绑定时或条目期间 chat、chatId、character、group、avatar 变化均拒绝', async () => {
  const mutations = [
    context => { context.chat = []; },
    context => { context.chatId = 'chat-b'; },
    context => { context.characterId = 1; },
    context => { context.groupId = 'new-group'; },
    context => { context.characters[0].avatar = 'other.png'; },
  ];
  for (const mutate of mutations) {
    const f = fixture();
    f.worldbookRead = async () => { mutate(f.context); return [entry()]; };
    await rejected(f.read('风祭'), 'LORE_SOURCE_CONFLICT');
  }
  const f = fixture();
  f.bindingRead = async () => { f.context.chatId = 'chat-b'; return f.binding; };
  await rejected(f.read('风祭'), 'LORE_SOURCE_CONFLICT');
  assert.equal(f.calls.filter(call => call[0] === 'worldbook').length, 0);
});

test('使用当前 chat getter 且绑定结束时再次核对，不缓存旧 primary', async () => {
  const f = fixture();
  let id = 'live-chat'; f.context.getCurrentChatId = () => id;
  f.worldbookRead = async () => { id = 'other-chat'; return [entry()]; };
  await rejected(f.read('风祭'), 'LORE_SOURCE_CONFLICT');
  const changed = fixture();
  changed.worldbookRead = async () => { changed.binding = { primary: '另一主世界书' }; return [entry()]; };
  await rejected(changed.read('风祭'), 'LORE_BINDING_CHANGED');
  const stable = fixture();
  await stable.read('风祭'); stable.binding = { primary: '第二次的主世界书' };
  assert.equal((await stable.read('风祭')).worldbook, '第二次的主世界书');
});

test('无 primary 不回退附加书、格式异常与失去聊天上下文均拒绝', async () => {
  for (const binding of [null, [], { additional: ['有角色的书'] }, { primary: ' ' }]) {
    const f = fixture(); f.binding = binding;
    await rejected(f.read('风祭'), 'LORE_BINDING_MISSING');
    assert.equal(f.calls.filter(call => call[0] === 'worldbook').length, 0);
  }
  const f = fixture(); f.worldbookRead = async () => ({});
  await rejected(f.read('风祭'), 'LORE_FORMAT_INVALID');
  await rejected(fixture([null]).read('风祭'), 'LORE_FORMAT_INVALID');
  f.context = null;
  await rejected(f.read('风祭'), 'LORE_SCOPE_UNAVAILABLE');
});

test('读取器能力和姓名输入不完整时明确失败，不执行世界书操作', async () => {
  assert.throws(() => realm.createLimeWorldbookReader({}), error => error.code === 'LORE_API_UNAVAILABLE');
  for (const name of ['', ' ', '\u0000', null]) {
    const f = fixture(); await rejected(f.read(name), 'LORE_NAME_INVALID'); assert.equal(f.calls.length, 0);
  }
});
