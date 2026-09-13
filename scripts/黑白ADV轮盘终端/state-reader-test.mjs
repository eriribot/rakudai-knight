import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code = fs.readFileSync(new URL('state-reader.js', import.meta.url), 'utf8');
const checks = [];
const saved = name => ({ stat_data: { 系统: {}, 场景: {}, 玩家: { 姓名: name }, 人际: { [name]: { 关系: '已结识' } } } });
const assistant = (pages, swipe = 0) => ({ role: 'assistant', swipe, pages });
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
  let context = { chatId: 'chat-a', chat: [assistant([saved('旧楼')])] };
  const realm = vm.createContext({ structuredClone });
  vm.runInContext(code, realm);
  let readCount = 0;
  let mapMessage = message => message;
  const read = realm.createTerminalStateReader((id, options) => {
    assert.equal(options.role, 'assistant');
    assert.equal(options.include_swipes, true);
    readCount++;
    const message = context.chat[id];
    if (!message || message.role !== 'assistant') return [];
    return [mapMessage({
      message_id: id, role: 'assistant', swipe_id: message.swipe,
      swipes: message.pages.map((_, index) => '回复 ' + index),
      swipes_data: structuredClone(message.pages),
    })];
  }, () => context);
  return {
    read, get context() { return context; }, set context(value) { context = value; },
    get readCount() { return readCount; }, set mapMessage(value) { mapMessage = value; },
  };
}
function check(name, fn) {
  try { fn(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.stack }); }
}

check('删除后续楼层后读取被恢复楼层的当前回复槽', () => {
  const f = fixture();
  f.context.chat[0] = assistant([saved('旧楼第一页'), saved('旧楼当前页')], 1);
  f.context.chat.push({ role: 'user' }, assistant([saved('未来人物')]));
  assert.equal(f.read().state.玩家.姓名, '未来人物');
  f.context.chat.splice(1);
  const snapshot = f.read();
  assert.equal(snapshot.state.玩家.姓名, '旧楼当前页');
  assert.deepEqual(plain(snapshot.source), { messageId: 0, swipeId: 1, swipeCount: 2, chatId: 'chat-a' });
});

check('当前页为空不借同楼其他页或旧楼，并保留空槽来源', () => {
  const f = fixture();
  f.context.chat.push(assistant([saved('未选中的秘密'), {}], 1));
  assert.throws(f.read, error => {
    assert.match(error.message, /尚无 MVU/);
    assert.deepEqual(plain(error.source), { messageId: 1, swipeId: 1, swipeCount: 2, chatId: 'chat-a' });
    return true;
  });
});

check('MVU 延迟写入当前空槽后，下一次读取即可取得', () => {
  const f = fixture(); f.context.chat[0] = assistant([{}]);
  assert.throws(f.read, /尚无 MVU/);
  f.context.chat[0].pages[0] = saved('延迟初始化');
  assert.equal(f.read().state.玩家.姓名, '延迟初始化');
});

check('最新用户消息后仍读取最新助手楼层', () => {
  const f = fixture(); f.context.chat.push({ role: 'user' });
  const snapshot = f.read();
  assert.equal(snapshot.source.messageId, 0);
  assert.equal(snapshot.state.玩家.姓名, '旧楼');
});

check('编辑旧楼不会把独立终端切成历史预览', () => {
  const f = fixture(); f.context.chat.push(assistant([saved('当前楼')]));
  f.context.chat[0].pages[0] = saved('旧楼编辑');
  assert.equal(f.read().state.玩家.姓名, '当前楼');
  assert.equal(f.read().source.messageId, 1);
});

check('回复页标识缺失或越界时拒绝猜测第一个槽', () => {
  const f = fixture();
  f.mapMessage = message => { delete message.swipe_id; return message; };
  assert.throws(f.read, /无法确认 MVU 槽/);
  f.mapMessage = message => ({ ...message, swipe_id: 3 });
  assert.throws(f.read, /无法确认 MVU 槽/);
});

check('复用同一个读取函数时，每次取得当前上下文，不缓存旧聊天', () => {
  const f = fixture(), old = f.context;
  assert.equal(f.read().source.chatId, 'chat-a');
  f.context = { chatId: 'chat-b', chat: [assistant([saved('另一聊天')])] };
  old.chat[0].pages[0] = saved('已离开的聊天');
  const snapshot = f.read();
  assert.equal(snapshot.source.chatId, 'chat-b');
  assert.equal(snapshot.state.玩家.姓名, '另一聊天');
});

check('来源和变量由一次读取取得，切换回复后同步改变', () => {
  const f = fixture(); f.context.chat[0] = assistant([saved('第一回复'), saved('第二回复')]);
  const first = f.read(); assert.equal(f.readCount, 1);
  f.context.chat[0].swipe = 1;
  const second = f.read(); assert.equal(f.readCount, 2);
  assert.equal(first.source.swipeId, 0); assert.equal(first.state.玩家.姓名, '第一回复');
  assert.equal(second.source.swipeId, 1); assert.equal(second.state.玩家.姓名, '第二回复');
});

check('读取及修改返回快照均不会写入楼层槽，且不暴露 MVU 临时包装', () => {
  const f = fixture();
  f.context.chat[0].pages[0].stat_data.$internal = { display_data: saved('缓存') };
  const original = structuredClone(f.context);
  const snapshot = f.read();
  snapshot.state.玩家.姓名 = '仅修改显示副本';
  snapshot.source.swipeId = 99;
  assert.deepEqual(f.context, original);
  assert.equal(Object.hasOwn(snapshot.state, '$internal'), false);
  assert.equal(f.read().state.玩家.姓名, '旧楼');
});

console.log(JSON.stringify({ evidence: '离线 VM 执行真实读取模块；未运行真实酒馆', passed: checks.filter(x => x.passed).length, total: checks.length, checks }, null, 2));
if (checks.some(x => !x.passed)) process.exitCode = 1;
