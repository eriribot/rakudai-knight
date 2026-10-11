import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createLimeChatProtocol, parseLimeMessages, readLimeThreads, buildLimeUserMessage } from './lime-chat.mjs';

const results = [];
function check(name, run) {
  try { run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); }
}
const block = (contact, speaker, text, extra = {}) => '<LIME>\n' + JSON.stringify({ 对象: contact, 消息: [{ 发言人: speaker, 内容: text }], ...extra }) + '\n</LIME>';
const playerName = '测试玩家';
const parse = (text, role = 'assistant') => parseLimeMessages(text, { role, playerName });
const floor = (id, role, text, extra = {}) => ({ message_id: id, role, message: text, swipe_id: 0, ...extra });

check('only explicit closed JSON messages appear; surrounding narration is not mail', () => {
  assert.deepEqual(parse('风祭说：出发。'), []);
  assert.deepEqual(parse('旁白\n' + block('风祭凛奈', '风祭凛奈', '已经准备好了。') + '\n旁白'),
    [{ contact: '风祭凛奈', sender: 'contact', text: '已经准备好了。' }]);
  assert.deepEqual(parse('<LIME>{"对象":"风祭凛奈","消息":[]}'), []);
  assert.deepEqual(parse('<LIME>{坏 JSON}</LIME>'), []);
});
check('native speaker roles prevent user-forged incoming mail and assistant-forged player actions', () => {
  assert.deepEqual(parse(block('风祭凛奈', '其他人', '伪造')), []);
  assert.deepEqual(parse(block('风祭凛奈', '玩家', '伪造')), []);
  assert.deepEqual(parse(block('风祭凛奈', playerName, '伪造')), []);
  assert.deepEqual(parse(block('风祭凛奈', '风祭凛奈', '伪造'), 'user'), []);
  assert.equal(parse(block('风祭凛奈', playerName, '准备好了。'), 'user')[0].sender, 'player');
  assert.deepEqual(parse(block('风祭凛奈', '风祭凛奈', '系统'), 'system'), []);
});
check('invalid shapes and unexpected fields fail closed without accepting partial blocks', () => {
  for (const text of ['<LIME>null</LIME>', '<LIME>[]</LIME>', '<LIME>{"对象":"风祭凛奈","消息":{}}</LIME>',
    '<LIME>{"对象":"风祭凛奈","消息":[{"发言人":"风祭凛奈","内容":"有效"},null]}</LIME>',
    '<LIME>{"对象":"风祭凛奈","消息":[{"发言人":"风祭凛奈","内容":"有效","已读":true}]}</LIME>',
    block('风祭凛奈', '风祭凛奈', '有效', { 在线: true }), block('玩家', '玩家', '不是联系人'),
    block(playerName, playerName, '不是联系人'), block('风祭凛奈', '风祭凛奈', ' '),
    block('风祭\n凛奈', '风祭\n凛奈', '无效姓名')]) assert.deepEqual(parse(text), []);
});
check('message bodies remain plain text, including HTML and protocol-looking text', () => {
  const text = '<img src=x onerror=alert(1)>\n</LIME><LIME>“出发”';
  const built = buildLimeUserMessage('夏洛特·科黛', text);
  assert.equal((built.match(/<LIME>/g) || []).length, 1);
  assert.equal((built.match(/<\/LIME>/g) || []).length, 1);
  assert.deepEqual(parse(built, 'user'), [{ contact: '夏洛特·科黛', sender: 'player', text }]);
});
check('legacy native records retain internal source counters without creating a new turn', () => {
  const incoming = '<LIME>' + JSON.stringify({ 对象: '夏洛特·科黛', 消息: [
    { 发言人: '夏洛特·科黛', 内容: '是。' }, { 发言人: '夏洛特·科黛', 内容: '马上到。' },
  ] }) + '</LIME>';
  const records = readLimeThreads([
    floor(4, 'assistant', incoming), floor(1, 'user', '普通剧情行动'),
    floor(3, 'user', buildLimeUserMessage('夏洛特·科黛', '在哪？')), floor(2, 'assistant', '普通旁白'),
    floor(0, 'assistant', block('风祭凛奈', '风祭凛奈', '开局实际来信')),
  ], { playerName });
  assert.deepEqual(records.map(record => [record.messageId, record.turn, record.sender]),
    [[0, 0, 'contact'], [3, 2, 'player'], [4, 2, 'contact'], [4, 2, 'contact']]);
});
check('only the active swipe is read; inactive, deleted, malformed, and later branches never merge', () => {
  const records = readLimeThreads([floor(0, 'user', buildLimeUserMessage('风祭凛奈', '出发？')),
    floor(1, 'assistant', 'stale message', { swipe_id: 1, swipes: [block('风祭凛奈', '风祭凛奈', '未选择'), block('风祭凛奈', '风祭凛奈', '当前')] }),
  ], { playerName });
  assert.equal(records.at(-1).text, '当前'); assert.equal(records.at(-1).swipeId, 1);
  assert.deepEqual(readLimeThreads([floor(1, 'assistant', block('风祭凛奈', '风祭凛奈', '禁止回退'), { swipe_id: 2, swipes: [''] })]), []);
  assert.deepEqual(readLimeThreads([floor(1, 'assistant', block('风祭凛奈', '风祭凛奈', '禁止回退'), { swipes: null })]), []);
  assert.equal(readLimeThreads([]).length, 0);
});
check('streaming and maxMessageId boundaries retain only completed native floors', () => {
  const messages = [floor(0, 'assistant', block('风祭凛奈', '风祭凛奈', '旧来信')),
    floor(1, 'user', buildLimeUserMessage('风祭凛奈', '准备好了。')),
    floor(2, 'assistant', block('风祭凛奈', '风祭凛奈', '流式已闭合但仍生成'))];
  assert.deepEqual(readLimeThreads(messages, { generating: true }).map(record => record.messageId), [0, 1]);
  assert.deepEqual(readLimeThreads(messages, { maxMessageId: 1 }).map(record => record.messageId), [0, 1]);
  assert.deepEqual(readLimeThreads(messages, { generating: true, maxMessageId: 0 }).map(record => record.messageId), [0]);
  assert.deepEqual(readLimeThreads(messages, { maxMessageId: -1 }), []);
  assert.deepEqual(readLimeThreads(messages, { maxMessageId: '1' }), []);
  // Before a new assistant floor exists, generating must not hide a completed older assistant.
  assert.deepEqual(readLimeThreads(messages.slice(0, 2), { generating: true }).map(record => record.messageId), [0, 1]);
});
check('separate calls contain no cross-chat or old-swipe cache and leave their inputs unchanged', () => {
  const service = createLimeChatProtocol();
  const messages = [floor(1, 'assistant', block('风祭凛奈', '风祭凛奈', '当前')), floor(2, 'system', block('风祭凛奈', '风祭凛奈', '系统'))];
  const before = structuredClone(messages);
  assert.equal(service.readLimeThreads(messages).length, 1);
  assert.deepEqual(service.readLimeThreads([floor(0, 'assistant', '另一个聊天')]), []);
  assert.deepEqual(messages, before);
  assert.deepEqual(service.readLimeThreads([messages[0], { ...messages[0] }]), []);
});
check('strict size limits bound JSON parsing, block count, contacts, and outgoing messages', () => {
  const { limits } = createLimeChatProtocol();
  assert.deepEqual(parse(block('风祭凛奈', '风祭凛奈', '字'.repeat(limits.messageLength + 1))), []);
  assert.deepEqual(parse(block('字'.repeat(limits.contactLength + 1), '字'.repeat(limits.contactLength + 1), '内容')), []);
  assert.deepEqual(parse(' '.repeat(limits.sourceLength + 1)), []);
  assert.equal(parse(block('风祭凛奈', '风祭凛奈', '内容').repeat(limits.blocksPerFloor + 3)).length, limits.blocksPerFloor);
  assert.throws(() => buildLimeUserMessage('风祭凛奈', ''), /非空/);
  assert.throws(() => buildLimeUserMessage('风祭凛奈', '字'.repeat(limits.messageLength + 1)), /不超过/);
  assert.throws(() => buildLimeUserMessage('玩家', '内容'), /收信者/);
});
check('tag matching refuses nested protocol blocks and does not treat lower-case tags as protocol', () => {
  assert.deepEqual(parse('<LIME>{"对象":"风祭凛奈","消息":[]}\n' + block('风祭凛奈', '风祭凛奈', '嵌套') + '\n</LIME>'), []);
  assert.deepEqual(parse(block('风祭凛奈', '风祭凛奈', '错误标记').replaceAll('LIME', 'lime')), []);
});
check('the module can be injected as plain script without host or Node dependencies', () => {
  const source = fs.readFileSync(new URL('lime-chat.mjs', import.meta.url), 'utf8').replace(/^export /gm, '');
  const realm = vm.createContext({});
  vm.runInContext(source + '\nthis.service = createLimeChatProtocol();', realm);
  const nativeText = realm.service.buildLimeUserMessage('风祭凛奈', '出发。');
  assert.equal(realm.service.parseLimeMessages(nativeText, { role: 'user' })[0].text, '出发。');
});

check('unsolicited narrative mail uses its own active floor MVU time, never the latest shared clock', () => {
  const messages = [floor(0, 'assistant', block('夏洛特·科黛', '夏洛特·科黛', '集合改到校门。'),
    { data: { stat_data: { 场景: { 时间: '2013-05-15 16:20' } } } }),
    floor(1, 'assistant', block('风祭凛奈', '风祭凛奈', '快到了。'),
      { data: { stat_data: { 场景: { 时间: '2013-05-15 16:25' } } } }),
    floor(2, 'assistant', block('风祭凛奈', '风祭凛奈', '时间没记录。'))];
  const before = structuredClone(messages), records = readLimeThreads(messages);
  assert.deepEqual(records.map(item => item.time), ['2013-05-15 16:20', '2013-05-15 16:25', '']);
  assert.equal(records[0].origin, 'narrative'); assert.deepEqual(messages, before);
});

const attachment = (id, messageId, swipeId = 0, time = '2013-05-15 16:20') => ({ version: 1,
  owner: { messageId, swipeId }, exchanges: [{ id, contact: '风祭凛奈', time, player: '在哪？', reply: ['训练场。'] }] });
check('attachments stay on their owning story page with captured MVU time and no native user floor', () => {
  const messages = [floor(0, 'assistant', '本轮正文', { data: { rk_lime: attachment('exchange-1', 0),
    stat_data: { 场景: { 时间: '2013-05-15 17:00' } } } })];
  const records = readLimeThreads(messages);
  assert.equal(messages.length, 1); assert.equal(records.length, 2);
  assert.deepEqual(records.map(item => [item.sender, item.time, item.origin]), [
    ['player', '2013-05-15 16:20', 'attachment'], ['contact', '2013-05-15 16:20', 'attachment']]);
});
check('MVU-copied attachment namespaces cannot duplicate history on another floor or swipe', () => {
  const store = attachment('exchange-1', 0), messages = [floor(0, 'assistant', '拥有者', { data: { rk_lime: store } }),
    floor(1, 'assistant', '下一楼继承的数据', { data: { rk_lime: structuredClone(store) } }),
    floor(2, 'assistant', '另一页', { swipe_id: 1, swipes: ['旧页', '新页'], swipes_data: [{}, { rk_lime: attachment('exchange-2', 2, 0) }] })];
  assert.deepEqual(readLimeThreads(messages).map(item => item.messageId), [0, 0]);
});
check('explicit active swipe metadata is authoritative for narrative time and attachments', () => {
  const message = floor(1, 'assistant', 'stale', { swipe_id: 1,
    swipes: [block('风祭凛奈', '风祭凛奈', '旧页'), block('风祭凛奈', '风祭凛奈', '当前页')],
    swipes_data: [{ stat_data: { 场景: { 时间: '旧时间' } } }, {}],
    data: { stat_data: { 场景: { 时间: '不能借用' } }, rk_lime: attachment('bad', 1, 1) } });
  assert.equal(readLimeThreads([message]).length, 1); assert.equal(readLimeThreads([message])[0].time, '');
});
check('native continuation excludes streaming mail but retains previously saved owned attachments', () => {
  const messages = [floor(0, 'assistant', block('风祭凛奈', '风祭凛奈', '尚未完成的新来信'),
    { data: { rk_lime: attachment('saved-before-continuation', 0) } })];
  const records = readLimeThreads(messages, { generating: true });
  assert.equal(records.length, 2); assert.ok(records.every(record => record.origin === 'attachment'));
  assert.match(createLimeChatProtocol().buildAttachmentContext(messages, { generating: true }), /训练场/);
});
check('same-page continuation keeps original incoming time and places the saved exchange before later mail', () => {
  const service = createLimeChatProtocol(), oldText = block('风祭凛奈', '风祭凛奈', '原来信。');
  const data = { stat_data: { 场景: { 时间: '2013-05-15 16:20' } }, rk_lime: attachment('first', 0) };
  data.rk_lime.narrative = service.captureNarrative(data, 0, 0, oldText);
  data.rk_lime.exchanges[0].narrativeCount = data.rk_lime.narrative.length;
  data.stat_data.场景.时间 = '2013-05-15 16:30';
  const text = oldText + '\n继续正文\n' + block('风祭凛奈', '风祭凛奈', '续写来信。');
  const messages = [floor(0, 'assistant', text, { data })], before = structuredClone(messages);
  assert.deepEqual(service.readLimeThreads(messages).map(item => [item.text, item.time]), [
    ['原来信。', '2013-05-15 16:20'], ['在哪？', '2013-05-15 16:20'],
    ['训练场。', '2013-05-15 16:20'], ['续写来信。', '2013-05-15 16:30'],
  ]);
  assert.deepEqual(messages, before);
});
check('a later exchange extends the narrative snapshot without retiming the original incoming mail', () => {
  const service = createLimeChatProtocol(), first = block('风祭凛奈', '风祭凛奈', '第一封。');
  const data = { stat_data: { 场景: { 时间: '2013-05-15 16:20' } }, rk_lime: attachment('first', 0) };
  data.rk_lime.narrative = service.captureNarrative(data, 0, 0, first); data.rk_lime.exchanges[0].narrativeCount = 1;
  data.stat_data.场景.时间 = '2013-05-15 16:30';
  const second = first + block('夏洛特·科黛', '夏洛特·科黛', '第二封。');
  data.rk_lime.narrative = service.captureNarrative(data, 0, 0, second);
  data.rk_lime.exchanges.push({ id: 'second', contact: '夏洛特·科黛', time: '2013-05-15 16:30',
    player: '收到。', reply: ['请准时到场。'], narrativeCount: 2 });
  assert.deepEqual(data.rk_lime.narrative.map(item => item.time), ['2013-05-15 16:20', '2013-05-15 16:30']);
  data.stat_data.场景.时间 = '2013-05-15 16:40';
  const records = service.readLimeThreads([floor(0, 'assistant', second + block('风祭凛奈', '风祭凛奈', '第三封。'), { data })]);
  assert.deepEqual(records.map(item => item.text), ['第一封。', '在哪？', '训练场。', '第二封。', '收到。', '请准时到场。', '第三封。']);
  assert.deepEqual(records.map(item => item.time), ['2013-05-15 16:20', '2013-05-15 16:20', '2013-05-15 16:20',
    '2013-05-15 16:30', '2013-05-15 16:30', '2013-05-15 16:30', '2013-05-15 16:40']);
});
check('streaming continuation shows verified earlier incoming and attachments while suppressing new blocks', () => {
  const service = createLimeChatProtocol(), original = block('风祭凛奈', '风祭凛奈', '已保存来信。');
  const data = { stat_data: { 场景: { 时间: '2013-05-15 16:20' } }, rk_lime: attachment('first', 0) };
  data.rk_lime.narrative = service.captureNarrative(data, 0, 0, original); data.rk_lime.exchanges[0].narrativeCount = 1;
  const text = original + block('风祭凛奈', '风祭凛奈', '生成中新来信。');
  const records = service.readLimeThreads([floor(0, 'assistant', text, { data })], { generating: true });
  assert.deepEqual(records.map(item => item.text), ['已保存来信。', '在哪？', '训练场。']);
  const unfinished = service.readLimeThreads([floor(0, 'assistant', '<LIME>{', { data })], { generating: true });
  assert.deepEqual(unfinished.map(item => item.text), ['在哪？', '训练场。']);
});
check('snapshot time never borrows another owner or mismatched edited content and index', () => {
  const service = createLimeChatProtocol(), original = block('风祭凛奈', '风祭凛奈', '原来信。');
  const data = { stat_data: { 场景: { 时间: '旧时间' } }, rk_lime: attachment('first', 0) };
  data.rk_lime.narrative = service.captureNarrative(data, 0, 0, original);
  data.stat_data.场景.时间 = '当前时间';
  assert.equal(service.captureNarrative(data, 1, 0, original)[0].time, '当前时间');
  assert.equal(service.captureNarrative(data, 0, 1, original)[0].time, '当前时间');
  assert.equal(service.captureNarrative(data, 0, 0, block('风祭凛奈', '风祭凛奈', '编辑后的内容。'))[0].time, '当前时间');
  assert.equal(service.captureNarrative(data, 0, 0, block('夏洛特·科黛', '夏洛特·科黛', '原来信。'))[0].time, '当前时间');
  const inserted = block('风祭凛奈', '风祭凛奈', '插入更早来信。') + original;
  assert.deepEqual(service.captureNarrative(data, 0, 0, inserted).map(item => item.time), ['当前时间', '当前时间']);
});
check('unknown narrative time stays unknown after snapshotting instead of acquiring a later clock', () => {
  const service = createLimeChatProtocol(), original = block('风祭凛奈', '风祭凛奈', '未知时刻来信。');
  const data = { rk_lime: attachment('first', 0) };
  data.rk_lime.narrative = service.captureNarrative(data, 0, 0, original);
  assert.equal(data.rk_lime.narrative[0].time, '');
  data.stat_data = { 场景: { 时间: '2013-05-15 16:30' } };
  assert.equal(service.captureNarrative(data, 0, 0, original)[0].time, '');
  const records = service.readLimeThreads([floor(0, 'assistant', original, { data })]);
  assert.equal(records[0].time, '');
});
check('exchange boundaries are preserved, zero comes first, legacy stays last, and invalid boundaries fail closed', () => {
  const service = createLimeChatProtocol(), store = attachment('first', 0);
  store.exchanges[0].narrativeCount = 0;
  const text = block('风祭凛奈', '风祭凛奈', '正文来信。');
  assert.deepEqual(service.readLimeThreads([floor(0, 'assistant', text, { data: { rk_lime: store } })]).map(item => item.origin),
    ['attachment', 'attachment', 'narrative']);
  assert.equal(service.attachmentExchanges({ rk_lime: store }, 0, 0)[0].narrativeCount, 0);
  delete store.exchanges[0].narrativeCount;
  assert.deepEqual(service.readLimeThreads([floor(0, 'assistant', text, { data: { rk_lime: store } })]).map(item => item.origin),
    ['narrative', 'attachment', 'attachment']);
  for (const count of [-1, 0.5, '1', 769]) {
    store.exchanges[0].narrativeCount = count;
    assert.deepEqual(service.attachmentExchanges({ rk_lime: store }, 0, 0), []);
  }
});
check('invalid snapshots cannot overwrite old history and read fallback does not hide live narrative rows', () => {
  const service = createLimeChatProtocol(), text = block('风祭凛奈', '风祭凛奈', '真实正文。');
  const store = attachment('first', 0), data = { rk_lime: store, stat_data: { 场景: { 时间: '当前时间' } } };
  for (const snapshot of [null, {}, [{ contact: '风祭凛奈', text: '真实正文。', time: 123 }],
    [{ contact: '风祭凛奈', text: '', time: '伪造时间' }]]) {
    store.narrative = snapshot;
    assert.throws(() => service.captureNarrative(data, 0, 0, text), /损坏或超限/);
    const records = service.readLimeThreads([floor(0, 'assistant', text, { data })]);
    assert.equal(records.length, 3); assert.equal(records[0].time, '当前时间');
  }
});
check('snapshot capture rejects source and block overflow rather than silently truncating saved narrative rows', () => {
  const service = createLimeChatProtocol(), text = block('风祭凛奈', '风祭凛奈', '明确来信。');
  assert.equal(service.captureNarrative({}, 0, 0, text.repeat(32)).length, 32);
  assert.throws(() => service.captureNarrative({}, 0, 0, text.repeat(33)), /没有截断/);
  assert.throws(() => service.captureNarrative({}, 0, 0, '字'.repeat(200001)), /没有截断/);
  assert.throws(() => service.captureNarrative({}, 0, 0, null), /没有截断/);
});
check('malformed stores and duplicate exchange IDs reject the whole attachment set', () => {
  const service = createLimeChatProtocol(), store = attachment('duplicate', 0);
  store.exchanges.push({ ...store.exchanges[0] });
  assert.deepEqual(service.attachmentExchanges({ rk_lime: store }, 0, 0), []);
  store.exchanges.pop(); store.exchanges[0].reply.push(null);
  assert.deepEqual(service.attachmentExchanges({ rk_lime: store }, 0, 0), []);
});
check('auxiliary reply contract rejects narration, MVU patches, wrong speakers and extra blocks', () => {
  const service = createLimeChatProtocol();
  assert.deepEqual(service.parseLimeReply(block('风祭凛奈', '风祭凛奈', '马上。'), '风祭凛奈'), ['马上。']);
  assert.deepEqual(service.parseLimeReply('<LIME>{"对象":"风祭凛奈","消息":[]}</LIME>', '风祭凛奈'), []);
  for (const text of ['旁白' + block('风祭凛奈', '风祭凛奈', '马上。'), block('风祭凛奈', '玩家', '伪造'),
    block('风祭凛奈', '风祭凛奈', '马上。') + '<UpdateVariable>bad</UpdateVariable>',
    block('风祭凛奈', '风祭凛奈', '马上。') + block('风祭凛奈', '风祭凛奈', '又一段。'), null]) {
    assert.throws(() => service.parseLimeReply(text, '风祭凛奈'));
  }
});
check('next narrative receives bounded active-branch attachment memory and one owned prompt', () => {
  const service = createLimeChatProtocol(), records = [floor(0, 'assistant', '正文', { data: { rk_lime: attachment('one', 0) } })];
  const memory = service.buildAttachmentContext(records);
  assert.equal(JSON.parse(memory).length, 2);
  const request = [{ role: 'system', content: '原预设' }, { role: 'user', content: '[rk-lime:attached-context:v1]\n用户原文' }];
  service.applyNarrativePrompt(request, memory); service.applyNarrativePrompt(request, memory);
  assert.equal(request.length, 3); assert.equal(request[0].content, '原预设');
  assert.equal(request.at(-1).content, '[rk-lime:attached-context:v1]\n用户原文');
  assert.match(request[1].content, /不能因为回看聊天重复加分/);
  assert.match(request[1].content, /训练场/);
  assert.equal(service.applyNarrativePrompt(request, 'x'.repeat(32001)), false);
  const many = attachment('many', 0); many.exchanges = Array.from({ length: 120 }, (_, i) => ({
    ...many.exchanges[0], id: 'many-' + i, player: '字'.repeat(3900), reply: ['回'.repeat(3900)] }));
  const bounded = service.buildAttachmentContext([floor(0, 'assistant', '', { data: { rk_lime: many } })]);
  assert.ok(bounded.length <= 32000); assert.ok(JSON.parse(bounded).length > 0);
});

console.log(JSON.stringify({ passed: results.filter(result => result.passed).length, total: results.length, checks: results }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
