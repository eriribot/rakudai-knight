import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('calendar-worldbook.js', import.meta.url), 'utf8');
const realm = vm.createContext({});
vm.runInContext(source, realm);
const plain = value => JSON.parse(JSON.stringify(value));
const entry = (uid, date, extra = {}) => ({ uid, name: '[剧情]测试' + uid, enabled: true,
  content: '【场景核心信息】\n- 时间：' + date + '\n- 地点：破军学园\n\n【剧情】\n完整剧情正文', ...extra });
function fixture(entries = [entry(1, '2013年4月5日')]) {
  let context = { chat: [], chatId: 'chat-a', characterId: 0, groupId: null, characters: [{ avatar: 'rakudai.png' }] };
  let primary = '角色主世界书';
  const calls = [];
  let bindingRead = async () => ({ primary });
  let worldbookRead = async () => entries;
  const reader = realm.createCalendarWorldbookReader({
    getContext: () => context,
    getCharWorldbookNames: async option => { calls.push(['binding', option]); return bindingRead(); },
    getWorldbook: async name => { calls.push(['worldbook', name]); return worldbookRead(name); },
  });
  return { read: () => reader.read(), calls,
    get context() { return context; }, set context(value) { context = value; },
    get primary() { return primary; }, set primary(value) { primary = value; },
    set bindingRead(value) { bindingRead = value; }, set worldbookRead(value) { worldbookRead = value; } };
}
const checks = [];
async function check(name, test) {
  try { await test(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.stack }); }
}

await check('真实最新世界书100条剧情保留全文，28条定位日期、72条诚实保留未定标签', async () => {
  const exported = JSON.parse(fs.readFileSync(new URL('../../落第骑士英雄谭v0.02.json', import.meta.url), 'utf8'));
  // 导出文件以 comment 命名；显式转换 fixture，读取器本身只认实际运行时 name 接口。
  const entries = Object.values(exported.entries).map(item => ({ ...item, name: item.comment }));
  const result = plain(await fixture(entries).read());
  assert.equal(result.entries.length, 100);
  assert.equal(result.undatedCount, 72);
  assert.equal(result.entries.filter(entry => entry.dates.length).length, 28);
  const find = uid => result.entries.find(item => item.uid === uid);
  assert.equal(find(13).dates[0].key, '2013-04-05');
  assert.equal(find(20).dates[0].key, '2013-04-21'); // XML标签与信息标题在同一行。
  assert.deepEqual(find(21).dates.map(date => date.key), ['2013-04-22', '2013-04-23']);
  assert.equal(find(76).dates.length, 9);
  assert.deepEqual(find(77).dates.map(date => date.key), ['2013-06-20', '2013-06-21']);
  assert.equal(find(83).dates.length, 7);
  assert.equal(find(87).dates.length, 10);
  assert.deepEqual(find(94).dates.map(date => date.key), ['2013-08-13', '2013-08-14']);
  assert.deepEqual(find(67).dates.map(date => date.key), ['2013-05-28']);
  assert.match(find(67).dateLabel, /前置追忆.*现实切入/);
  assert.deepEqual(find(69).dates.map(date => date.key), ['2013-05-31', '2013-06-01', '2013-06-02', '2013-06-03', '2013-06-04', '2013-06-05']);
  assert.deepEqual(find(70).dates.map(date => date.key), ['2013-06-05']);
  assert.deepEqual(find(71).dates.map(date => date.key), ['2013-06-05', '2013-06-06']);
  assert.deepEqual(find(72).dates.map(date => date.key), ['2013-06-07', '2013-06-08', '2013-06-09', '2013-06-10', '2013-06-11', '2013-06-12', '2013-06-13']);
  assert.deepEqual(find(25).dates, []); // 明确月日但没有年，禁止借其他章节补年。
  assert.deepEqual(find(142).dates, []);
  assert.match(find(142).dateLabel, /8月14日深夜~8月15日上午/);
  assert.equal(find(13).content, entries.find(item => item.uid === 13).content);
});

await check('ISO跨月区间、中文并列和同标签省略年月只采用明确字段', async () => {
  const result = plain(await fixture([
    entry(1, '2013-04-30至2013-05-02'), entry(2, '2013年4月5日、7日及5月2日'),
    entry(3, '2013年12月31日至2014年1月2日'), entry(4, '2013-04-05T23:00至2013-04-06T01:30'),
  ]).read());
  assert.deepEqual(result.entries[0].dates.map(date => date.key), ['2013-04-30', '2013-05-01', '2013-05-02']);
  assert.deepEqual(result.entries[1].dates.map(date => date.key), ['2013-04-05', '2013-04-07', '2013-05-02']);
  assert.deepEqual(result.entries[2].dates.map(date => date.key), ['2013-12-31', '2014-01-01', '2014-01-02']);
  assert.deepEqual(result.entries[3].dates.map(date => date.key), ['2013-04-05', '2013-04-06']);
});

await check('逗号后的明确至/到可串联区间，纯列举或模糊端点不会扩成区间', async () => {
  const result = plain(await fixture([
    entry(1, '2013年5月31日至6月1日，至6月5日'),
    entry(2, '2013年6月7日清晨，到6月13日隔周傍晚17:00'),
    entry(3, '2013年5月31日，6月5日'), entry(4, '2013年5月31日、6月5日'),
    entry(5, '2013年5月31日至6月1日，6月5日'),
    entry(6, '2013年5月31日至6月1日，至数日后'),
    entry(7, '2013年5月31日，至6月上旬'),
  ]).read());
  assert.deepEqual(result.entries[0].dates.map(date => date.key), ['2013-05-31', '2013-06-01', '2013-06-02', '2013-06-03', '2013-06-04', '2013-06-05']);
  assert.equal(result.entries[1].dates.length, 7);
  assert.equal(result.entries[1].dates.at(-1).key, '2013-06-13');
  assert.deepEqual(result.entries[2].dates.map(date => date.key), ['2013-05-31', '2013-06-05']);
  assert.deepEqual(result.entries[3].dates.map(date => date.key), ['2013-05-31', '2013-06-05']);
  assert.deepEqual(result.entries[4].dates.map(date => date.key), ['2013-05-31', '2013-06-01', '2013-06-05']);
  assert.deepEqual(result.entries[5].dates.map(date => date.key), ['2013-05-31', '2013-06-01']);
  assert.deepEqual(result.entries[6].dates.map(date => date.key), ['2013-05-31']);
});

await check('日期校验使用UTC完整年月日，闰日有效而错日和倒置区间不落格', async () => {
  const result = plain(await fixture([
    entry(1, '2016年2月29日'), entry(2, '2013年2月29日'), entry(3, '2013-04-31'),
    entry(4, '2013年12月31日至1月2日'), entry(5, '2013年4月3日至4月1日'),
    entry(6, '2013年4月5日至4月31日'), entry(7, '0000-01-01'), entry(8, '2013-13-01'),
  ]).read());
  assert.equal(result.entries[0].dates[0].key, '2016-02-29');
  assert.equal(result.undatedCount, 7);
});

await check('约、回忆、未知日期保留原标签；明确现实切入不把追忆定位到日历', async () => {
  const labels = ['约2013年4月5日', '2013年4月5日前后', '回忆【2011年4月5日】',
    '日期不明', '2013年4月下旬', '4月5日', '2013年4月5日左右', '2013年4月5日（约）', '2013年4月5日（回忆）',
    '前置追忆【2011年4月5日】 → 现实切入【2013年4月5日·上午】'];
  const result = plain(await fixture(labels.map((date, index) => entry(index, date))).read());
  assert.equal(result.undatedCount, 9);
  assert.deepEqual(result.entries.map(item => item.dateLabel), labels);
  assert.deepEqual(result.entries.at(-1).dates.map(date => date.key), ['2013-04-05']);
});

await check('正文日期、对话时间字段、历史注释日期和后置伪信息块均不进入日历', async () => {
  const result = plain(await fixture([
    entry(1, '2013年4月5日（历史日期2012年5月6日）', {
      content: '【场景核心信息】\n时间：2013年4月5日（回忆发生在2012年5月6日）\n【剧情】\n时间：2018-01-02\n他说2017年5月6日。',
    }),
    entry(2, '', { content: '【场景核心信息】\n地点：学园\n【剧情】\n日期：2013年4月5日' }),
    entry(3, '', { content: '她想起2013年4月5日。\n【场景核心信息】\n时间：2014年5月6日' }),
    entry(4, '', { content: '<剧情>\n日期：2013-04-05\n【正文】\n日期：2013-04-06' }),
  ]).read());
  assert.deepEqual(result.entries[0].dates.map(date => date.key), ['2013-04-05']);
  assert.equal(result.entries[1].dateLabel, '未标注日期');
  assert.deepEqual(result.entries[2].dates, []);
  assert.deepEqual(result.entries[3].dates.map(date => date.key), ['2013-04-05']);
});

await check('同一天多条剧情和enabled=true均可查看，不去重剧情或过滤触发状态', async () => {
  const result = plain(await fixture([entry(1, '2013年4月5日'), entry(2, '2013年4月5日', { enabled: false }),
    { uid: 3, name: '[规则]不进入日历', content: '规则' }]).read());
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].dates[0].key, result.entries[1].dates[0].key);
});

await check('只读取当前primary，每次重新读取，无secondary/其他卡回退', async () => {
  const f = fixture();
  f.bindingRead = () => ({ primary: f.primary, additional: ['额外世界书'] });
  f.worldbookRead = name => [entry(1, name === '角色主世界书' ? '2013年4月5日' : '2014年5月6日')];
  assert.equal((await f.read()).worldbook, '角色主世界书');
  f.primary = '另一本主世界书';
  const result = await f.read();
  assert.equal(result.worldbook, '另一本主世界书');
  assert.equal(result.entries[0].dates[0].key, '2014-05-06');
  assert.deepEqual(f.calls.filter(call => call[0] === 'worldbook'), [['worldbook', '角色主世界书'], ['worldbook', '另一本主世界书']]);
  assert.ok(f.calls.filter(call => call[0] === 'binding').every(call => call[1] === 'current'));
});

await check('能力缺失或上下文不可识别明确拒绝', async () => {
  assert.throws(() => realm.createCalendarWorldbookReader({}), /读取接口/);
  assert.throws(() => realm.createCalendarWorldbookReader({ getCharWorldbookNames() {}, getWorldbook() {} }), /getContext/);
  const f = fixture(); f.context = {};
  await assert.rejects(f.read(), /缺少.*标识/);
  f.context = null;
  await assert.rejects(f.read(), /上下文不可读取/);
});

await check('错误绑定和非运行时格式均拒绝，不猜comment、uid或空正文', async () => {
  const f = fixture();
  for (const binding of [null, [], {}, { primary: '' }, { primary: 3 }]) {
    f.bindingRead = () => binding;
    await assert.rejects(f.read(), /绑定/);
  }
  f.bindingRead = () => ({ primary: '世界书' });
  for (const malformed of [{}, [null], [{ comment: '[剧情]导出名', uid: 1, content: '正文' }],
    [entry(-1, '2013年4月5日')], [entry(1, '2013年4月5日', { uid: '1' })],
    [entry(1, '2013年4月5日', { content: '' })], [entry(1, '2013年4月5日', { content: {} })],
    [entry(1, '2013年4月5日'), entry(1, '2013年4月6日')]]) {
    f.worldbookRead = () => malformed;
    await assert.rejects(f.read(), /格式错误|正文为空/);
  }
});

await check('读取期间主世界书绑定变化拒绝，不能显示旧primary结果', async () => {
  const f = fixture();
  f.worldbookRead = () => { f.primary = '另一世界书'; return [entry(1, '2013年4月5日')]; };
  await assert.rejects(f.read(), /主世界书绑定已变化/);
});

await check('读取期间同primary切角色、聊天、group、avatar或chat引用均拒绝', async () => {
  const changes = [context => { context.characterId = 1; }, context => { context.chatId = 'chat-b'; },
    context => { context.groupId = 'group-b'; }, context => { context.characters[0].avatar = 'another.png'; },
    context => { context.chat = []; }];
  for (const change of changes) {
    const f = fixture();
    f.worldbookRead = () => { change(f.context); return [entry(1, '2013年4月5日')]; };
    await assert.rejects(f.read(), /角色或聊天已变化/);
  }
});

await check('首次和第二次绑定的异步等待期间也检查聊天身份', async () => {
  for (const changeAt of [1, 2]) {
    const f = fixture(); let reads = 0;
    f.bindingRead = async () => {
      await Promise.resolve();
      if (++reads === changeAt) f.context.chatId = 'chat-b';
      return { primary: f.primary };
    };
    await assert.rejects(f.read(), /角色或聊天已变化/);
  }
});

await check('getCurrentChatId身份变化可检测；同聊天新消息不误当角色切换', async () => {
  const f = fixture(); let chatId = 'chat-a';
  f.context.getCurrentChatId = () => chatId;
  f.worldbookRead = () => { f.context.chat.push({ mes: '新消息' }); return [entry(1, '2013年4月5日')]; };
  assert.equal((await f.read()).entries.length, 1);
  f.worldbookRead = () => { chatId = 'chat-b'; return [entry(1, '2013年4月5日')]; };
  await assert.rejects(f.read(), /角色或聊天已变化/);
});

await check('返回显示副本和读取过程都不改正文、世界书或上下文', async () => {
  const raw = [entry(1, '2013年4月5日')], original = structuredClone(raw), f = fixture(raw);
  const context = structuredClone(f.context);
  const result = await f.read();
  result.entries[0].content = '仅显示副本'; result.entries[0].dates[0].key = '2099-01-01';
  assert.deepEqual(raw, original);
  assert.deepEqual(f.context, context);
  assert.equal((await f.read()).entries[0].dates[0].key, '2013-04-05');
});

console.log(JSON.stringify({ evidence: '离线 VM 执行真实只读模块及当前世界书 fixture；未运行真实酒馆',
  passed: checks.filter(check => check.passed).length, total: checks.length, checks }, null, 2));
if (checks.some(check => !check.passed)) process.exitCode = 1;
