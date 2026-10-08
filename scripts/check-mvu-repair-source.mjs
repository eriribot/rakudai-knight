import test from 'node:test';
import assert from 'node:assert/strict';
import { createRakudaiMvuReplySource, repairReplyText } from './rakudai-mvu-reply-source.mjs';
import { INITIAL_STATE, enforceRelationshipScores } from '../世界书规则/MVU/schema.mjs';
import { enforceGrowthProgress } from './rakudai-state-core.mjs';

// Real source binding and business guards; only host reads and MVU parsing are
// memory doubles. No network, real chat, build output or persistence is touched.
const wrap = operations => '<UpdateVariable><JSONPatch>' + JSON.stringify(operations) + '</JSONPatch></UpdateVariable>';
const broken = '共同训练已经完成。\n<UpdateVariable><JSONPatch>[broken]';
function fixture(texts = [broken]) {
  const ctx = { characterId: 4, groupId: null, chatId: 'repair-source-test',
    chat: texts.map(mes => ({ mes, swipe_id: 0, is_user: false })) };
  const host = { SillyTavern: { getContext: () => ctx } };
  const observations = [], parses = [];
  const W = { top: host, parent: host, getChatMessages(query, options) {
    const ids = String(query).includes('-') ? ctx.chat.map((_, id) => id) : [Number(query)];
    return ids.flatMap(id => {
      const item = ctx.chat[id];
      if (!item || options?.role === 'assistant' && item.is_user) return [];
      return [{ message_id: id, role: item.is_user ? 'user' : 'assistant', message: item.mes, swipe_id: item.swipe_id }];
    });
  } };
  const f = { ctx, W, observations, parses, mutate() {}, async duringParse() {}, afterTake() {} };
  const mvu = { async parseMessage(content, data) {
    parses.push(content);
    const variables = structuredClone(data);
    f.mutate(variables);
    sources.capture(variables, content);
    await f.duringParse();
    const observed = sources.take(variables);
    observations.push(observed);
    f.afterTake(variables, data, observed);
    return variables;
  } };
  const sources = createRakudaiMvuReplySource(W, { mvu });
  function identity(id = ctx.chat.length - 1) {
    return { chatId: ctx.chatId, characterId: ctx.characterId, groupId: ctx.groupId,
      chatRef: ctx.chat, messageId: id, messageRef: ctx.chat[id], swipeId: ctx.chat[id]?.swipe_id };
  }
  return Object.assign(f, { sources, identity });
}
function data() {
  const state = structuredClone(INITIAL_STATE);
  state.系统 = { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' };
  state.玩家.六维.体能 = 'F';
  state.玩家.成长 = { 经验: { 体能: 90, 魔力控制: 0, 魔力量: 0 } };
  state.人际.同窗 = { 好感: 100, 支援度: 0 };
  return { stat_data: state };
}

test('repair source normalization keeps valid blocks and ignores only trailing MVU placeholders', () => {
  const block = wrap([]);
  assert.equal(repairReplyText('正文\r\n' + block + '\r\n<StatusPlaceHolderImpl/>'), block);
  assert.equal(repairReplyText(' 已完成\r\n训练。\r\n<StatusPlaceHolderImpl/> '), '已完成\n训练。');
  assert.equal(repairReplyText('已完成<StatusPlaceHolderImpl/>后续正文'), '已完成<StatusPlaceHolderImpl/>后续正文');
  assert.equal(repairReplyText('<StatusPlaceHolderImpl/>'), '');
  assert.equal(repairReplyText(null), '');
});

for (const content of ['双方完成巡查。', broken, '结果。' + wrap([]) + wrap([])]) {
  test('explicit repair binds an assistant reply without a unique valid primary patch: ' + content.slice(0, 12), async () => {
    const f = fixture([content]), before = data(), snapshot = structuredClone(before);
    assert.equal(f.sources.locateReply(content), null, 'ordinary primary matching remains strict');
    const unbound = structuredClone(before);
    f.sources.capture(unbound, content);
    assert.equal(f.sources.take(unbound).replyKey, '', 'malformed primary text cannot claim a reply by itself');
    await f.sources.parseRepair('[]', before, repairReplyText(content), f.identity());
    assert.equal(f.observations[0].replyKey, JSON.stringify([4, null, 'repair-source-test', 0, 0]));
    assert.deepEqual(f.observations[0].source.repairEventKeys, []);
    assert.equal(f.ctx.chat[0].mes, content);
    assert.deepEqual(before, snapshot);
  });
}

test('identical text on different floors needs exact message identity and keeps distinct round keys', async () => {
  const content = wrap([]), f = fixture([content, content]);
  assert.equal(f.sources.locateReply(content), null, 'ordinary matching still rejects ambiguous blocks');
  await assert.rejects(f.sources.parseRepair('[]', data(), content,
    { ...f.identity(1), messageRef: f.ctx.chat[0] }), /无法唯一确认/);
  assert.equal(f.parses.length, 0);
  await f.sources.parseRepair('[]', data(), content, f.identity(0));
  await f.sources.parseRepair('[]', data(), content, f.identity(1));
  assert.notEqual(f.observations[0].replyKey, f.observations[1].replyKey);
});

test('different source text, unsafe IDs, wrong owner, stale refs and non-assistant floors never parse', async () => {
  const f = fixture();
  const variants = [null, [], { ...f.identity(), messageId: '0' }, { ...f.identity(), messageId: -1 },
    { ...f.identity(), messageId: Number.MAX_SAFE_INTEGER + 1 }, { ...f.identity(), swipeId: -1 },
    { ...f.identity(), swipeId: '0' }, { ...f.identity(), swipeId: 1 },
    { ...f.identity(), chatId: 'another-chat' }, { ...f.identity(), characterId: 5 },
    { ...f.identity(), groupId: 8 }, { ...f.identity(), chatRef: [...f.ctx.chat] },
    { ...f.identity(), messageRef: { ...f.ctx.chat[0] } }];
  for (const identity of variants) await assert.rejects(f.sources.parseRepair('[]', data(), broken, identity), /无法唯一确认/);
  await assert.rejects(f.sources.parseRepair('[]', data(), '另一份结果正文', f.identity()), /无法唯一确认/);
  f.ctx.chat[0].is_user = true;
  await assert.rejects(f.sources.parseRepair('[]', data(), broken, f.identity()), /无法唯一确认/);
  assert.equal(f.parses.length, 0);
});

for (const change of ['swipe', 'text', 'chatRef', 'messageRef', 'owner']) {
  test('repair revalidates ' + change + ' in take and after parsing', async () => {
    const f = fixture(), identity = f.identity();
    f.duringParse = async () => {
      if (change === 'swipe') f.ctx.chat[0].swipe_id++;
      if (change === 'text') f.ctx.chat[0].mes += '实际剧情已经修改。';
      if (change === 'chatRef') f.ctx.chat = [...f.ctx.chat];
      if (change === 'messageRef') f.ctx.chat[0] = { ...f.ctx.chat[0] };
      if (change === 'owner') f.ctx.characterId++;
    };
    await assert.rejects(f.sources.parseRepair('[]', data(), broken, identity), /来源已变化/);
    assert.equal(f.observations[0].replyKey, '', 'stale repair cannot get guard permissions during ENDED');
  });
}

test('automatic trailing placeholder does not invalidate repair while parsing', async () => {
  const f = fixture();
  f.duringParse = async () => { f.ctx.chat[0].mes += '\r\n<StatusPlaceHolderImpl/>'; };
  await f.sources.parseRepair('[]', data(), broken, f.identity());
  assert.ok(f.observations[0].replyKey);
});

test('repair source keeps same round receipts across patches and repeated final values', async () => {
  const f = fixture(), operations = [
    { op: 'replace', path: '/玩家/成长/经验/体能', value: 120 },
    { op: 'replace', path: '/人际/同窗/好感', value: 108 },
  ];
  f.mutate = variables => { variables.stat_data.玩家.成长.经验.体能 = 120; variables.stat_data.人际.同窗.好感 = 108; };
  f.afterTake = (variables, previous, { source, replyKey }) => {
    enforceRelationshipScores(variables, previous, { replyKey, submittedFields: source.submittedFields });
    enforceGrowthProgress(variables, previous, { replyKey, mode: 'final', growthFinalAxes: source.growthFinalAxes,
      growthGradeAxes: source.growthGradeAxes });
  };
  const first = await f.sources.parseRepair(JSON.stringify(operations), data(), broken, f.identity());
  assert.equal(first.stat_data.人际.同窗.好感, 108);
  assert.equal(first.stat_data.玩家.六维.体能, 'F+');
  assert.equal(first.stat_data.玩家.成长.经验.体能, 20);
  const repeated = await f.sources.parseRepair(JSON.stringify(operations), first, broken, f.identity());
  assert.equal(f.observations[0].replyKey, f.observations[1].replyKey);
  assert.equal(repeated.stat_data.玩家.六维.体能, 'F+');
  assert.equal(repeated.stat_data.玩家.成长.经验.体能, 20);
  assert.equal(repeated.stat_data.人际.同窗.好感, 108);
});

test('failed parsing releases the repair session and never falls back to unbound primary matching', async () => {
  const f = fixture();
  f.duringParse = async () => { throw new Error('模拟解析失败'); };
  await assert.rejects(f.sources.parseRepair('[]', data(), broken, f.identity()), /模拟解析失败/);
  f.duringParse = async () => {};
  await f.sources.parseRepair('[]', data(), broken, f.identity());
  assert.ok(f.observations.at(-1).replyKey);
  await assert.rejects(f.sources.parseRepair('{}', data(), broken, f.identity()), /完整的 JSON 数组/);
  assert.equal(f.parses.length, 2);
});
