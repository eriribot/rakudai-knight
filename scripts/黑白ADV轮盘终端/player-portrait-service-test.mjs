import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('player-portrait.js', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('player-display-store.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const imageUrl = 'https://images.example.test/player.png';
const bitmap = 'data:image/png;base64,iVBORw0KGgo=';
function fixture() {
  const records = new Map(), writes = [], changes = [];
  let ctx = { characterId: 1, groupId: null, chatId: 'chat-a', name1: '自定人物' }, snapshotSource;
  const state = { 玩家: { 姓名: '黎恩·舒华泽', 自定义字段: '保留' }, 人际: { 史黛菈: {} } };
  const storage = { getItem: key => records.has(key) ? records.get(key) : null,
    setItem(key, value) { writes.push(['set', key, value]); records.set(key, value); },
    removeItem(key) { writes.push(['remove', key]); records.delete(key); } };
  const realm = vm.createContext({ URL, console }); vm.runInContext(storeSource, realm); vm.runInContext(source, realm);
  const displayStore = realm.createPlayerDisplayStore({ storage, getContext: () => ctx });
  const service = realm.createPlayerPortraitService({ storage, getContext: () => ctx,
    getSnapshot: () => ({ state, source: snapshotSource }), reservedNames: ['史黛菈', '黑铁一辉'], onChange: value => changes.push(plain(value)) });
  return { realm, service, displayStore, state, storage, records, writes, changes,
    get ctx() { return ctx; }, set ctx(value) { ctx = value; }, set snapshotSource(value) { snapshotSource = value; } };
}

test('存储 scope 含聊天、角色、群组，切换后头像与别名隔离', () => {
  const f = fixture(), before = plain(f.state), scopeA = f.service.get().scope;
  f.service.save(f.service.get(), { avatarUrl: imageUrl, aliases: ['黎恩'] });
  f.ctx = { ...f.ctx, chatId: 'chat-b' };
  assert.equal(f.service.get().avatarUrl, ''); assert.deepEqual(plain(f.service.get().aliases), []);
  assert.notEqual(f.service.get().scope, scopeA);
  f.service.save(f.service.get(), { avatarUrl: '', aliases: ['另一称呼'] });
  f.ctx = { ...f.ctx, chatId: 'chat-a' };
  assert.equal(f.service.get().avatarUrl, imageUrl); assert.deepEqual(plain(f.service.get().aliases), ['黎恩']);
  for (const field of ['characterId', 'groupId']) {
    const old = f.ctx[field]; f.ctx = { ...f.ctx, [field]: 'different' };
    assert.equal(f.service.get().avatarUrl, ''); f.ctx = { ...f.ctx, [field]: old };
  }
  assert.deepEqual(plain(f.state), before);
});

for (const chatId of [undefined, null, '', '   ']) test(`未就绪聊天 ${String(chatId)} 不读取或写入默认槽`, () => {
  const f = fixture(); f.ctx = { ...f.ctx, chatId };
  assert.throws(() => f.service.get(), /聊天标识/); assert.deepEqual(f.writes, []);
});

test('全名规范化、显式玩家标记、用户别名均可识别，未登记简称不猜测', () => {
  const f = fixture(); f.service.save(f.service.get(), { avatarUrl: imageUrl, aliases: ['黎恩', '教官', 'Rean'] });
  for (const name of ['黎恩·舒华泽', '黎恩 舒华泽', '自定人物', '黎恩', '教官', ' REAN ', '玩家', 'player', 'PLAYER', 'user', 'OC']) {
    assert.equal(f.service.resolve(name)?.src, imageUrl, name);
  }
  for (const name of ['舒华', '我', '你', '旁白', '史黛菈', '黑铁一辉', '<img>', '玩家：', '', null]) {
    assert.equal(f.service.resolve(name), null, String(name));
  }
});

test('别名会规范化去重，NPC 与人际同名拒绝保存，后来出现歧义也不绑定', () => {
  const f = fixture();
  assert.throws(() => f.service.save(f.service.get(), { avatarUrl: imageUrl, aliases: ['史黛菈'] }), /重名/);
  f.service.save(f.service.get(), { avatarUrl: imageUrl, aliases: ['黎恩', ' 黎恩 ', 'REAN', 'rean', '教官'] });
  assert.deepEqual(plain(f.service.get().aliases), ['黎恩', 'REAN', '教官']);
  f.state.人际.教官 = {};
  assert.equal(f.service.resolve('教官'), null); assert.equal(f.service.resolve('黎恩')?.src, imageUrl);
  f.state.玩家.姓名 = '史黛菈'; assert.equal(f.service.resolve('史黛菈'), null);
  assert.equal(f.service.resolve('player')?.src, imageUrl);
});

for (const aliases of [['bad:name'], ['bad：name'], ['<img>'], ['line\nbreak'], ['"name"'], ['&amp;'], ['{玩家}'], ['a'.repeat(65)], Array(21).fill('name'), 'name']) {
  test(`拒绝不合约别名 ${JSON.stringify(aliases).slice(0, 40)}`, () => {
    const f = fixture(); assert.throws(() => f.service.save(f.service.get(), { avatarUrl: imageUrl, aliases }), /别名/);
    assert.deepEqual(f.writes, []);
  });
}

test('仅接受空地址、无凭据 HTTPS 或受限位图 data URI', () => {
  const f = fixture();
  for (const value of ['', imageUrl, bitmap, ' data:image/jpeg;base64,/9j/AA== ']) {
    f.service.save(f.service.get(), { avatarUrl: value, aliases: [] });
    assert.equal(f.service.get().avatarUrl, value.trim());
  }
  for (const value of ['http://example.test/image.png', 'javascript:alert(1)', 'file:///image.png', '//example.test/a.png',
    'https://user:secret@example.test/a.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,AAAA',
    'data:image/png;base64,AAA', 'data:image/png;base64,A===', 'data:image/png;base64,' + 'A'.repeat(1398104)]) {
    assert.throws(() => f.service.save(f.service.get(), { avatarUrl: value, aliases: [] }), /头像|HTTPS|图片/);
  }
});

for (const kind of ['chat', 'player', 'persona', 'revision']) test(`expected snapshot 拒绝过时 ${kind} 的保存和清除`, () => {
  const f = fixture(); f.service.save(f.service.get(), { avatarUrl: imageUrl, aliases: ['黎恩'] });
  const expected = f.service.get(), count = f.writes.length;
  if (kind === 'chat') f.ctx = { ...f.ctx, chatId: 'chat-b' };
  if (kind === 'player') f.state.玩家.姓名 = '另一姓名';
  if (kind === 'persona') f.ctx.name1 = '另一 Persona';
  if (kind === 'revision') f.service.save(f.service.get(), { avatarUrl: bitmap, aliases: [] });
  const afterChange = f.writes.length;
  assert.throws(() => f.service.save(expected, { avatarUrl: imageUrl, aliases: [] }), /已变化/);
  assert.throws(() => f.service.clear(expected), /已变化/);
  assert.equal(f.writes.length, afterChange); assert.ok(count <= afterChange);
});

test('存储写失败和回读不一致均不宣告保存成功', () => {
  for (const mode of ['throw', 'mismatch']) {
    const f = fixture(), expected = f.service.get();
    f.storage.setItem = () => { if (mode === 'throw') throw new Error('quota'); };
    assert.throws(() => f.service.save(expected, { avatarUrl: imageUrl, aliases: ['黎恩'] }), /未能保存|回读不一致/);
    assert.deepEqual(f.changes, []);
  }
});

test('写入时切换聊天会报错，不在新聊天继续写入', () => {
  const f = fixture(), expected = f.service.get();
  const set = f.storage.setItem.bind(f.storage);
  f.storage.setItem = (key, value) => { set(key, value); f.ctx = { ...f.ctx, chatId: 'chat-b' }; };
  assert.throws(() => f.service.save(expected, { avatarUrl: imageUrl, aliases: ['黎恩'] }), /已切换|变化/);
  assert.equal(f.service.get().avatarUrl, ''); assert.equal(f.writes.length, 1); assert.deepEqual(f.changes, []);
});

test('清除回读通过后触发一次更新，清除失败不宣告成功', () => {
  const f = fixture(); f.service.save(f.service.get(), { avatarUrl: imageUrl, aliases: ['黎恩'] });
  f.service.clear(f.service.get()); assert.equal(f.service.get().avatarUrl, ''); assert.equal(f.changes.length, 2);
  f.service.save(f.service.get(), { avatarUrl: imageUrl, aliases: [] });
  f.storage.setItem = () => {};
  assert.throws(() => f.service.clear(f.service.get()), /回读不一致/); assert.equal(f.changes.length, 3);
});

test('带 source 的 MVU 状态须匹配当前聊天、角色、群组，旧状态不借入玩家名或人际', () => {
  const f = fixture(), current = { characterId: 1, groupId: null, chatId: 'chat-a' };
  f.snapshotSource = current; assert.equal(f.service.get().primaryName, '黎恩·舒华泽');
  for (const change of [{ chatId: 'other-chat' }, { characterId: 2 }, { groupId: 'other-group' }]) {
    f.snapshotSource = { ...current, ...change };
    assert.equal(f.service.get().primaryName, ''); assert.deepEqual(plain(f.service.get().otherNames), []);
    assert.equal(f.service.resolve('黎恩·舒华泽'), null);
    assert.ok(f.service.resolve('自定人物')); assert.ok(f.service.resolve('player'));
  }
});

test('最终回读若遭其他窗口新 revision 覆盖，不宣告本次保存成功', () => {
  const f = fixture(), expected = f.service.get(), read = f.storage.getItem.bind(f.storage);
  let afterWrite = -1; const set = f.storage.setItem.bind(f.storage);
  f.storage.setItem = (key, raw) => { set(key, raw); afterWrite = 0; };
  f.storage.getItem = key => {
    if (afterWrite >= 0 && afterWrite++ === 1) {
      const record = JSON.parse(read(key)); f.records.set(key, JSON.stringify({ ...record, revision: 'other-window', avatarUrl: bitmap }));
    }
    return read(key);
  };
  assert.throws(() => f.service.save(expected, { avatarUrl: imageUrl, aliases: ['黎恩'] }), /回读|变化|覆盖/);
  assert.deepEqual(f.changes, []);
});

test('共用存储不依赖 MVU，开局登记只局部更新头像/姓名/来源并保留别名与未知字段', () => {
  const f = fixture(), key = 'rk:oc:portrait:v1:' + f.displayStore.get().scope;
  f.records.set(key, JSON.stringify({ version: 1, avatarUrl: bitmap, aliases: ['旧简称'], revision: 'v18', extra: { retained: true } }));
  const legacy = f.displayStore.get(); assert.equal(legacy.profileName, ''); assert.equal(legacy.source, '');
  const saved = f.displayStore.save(legacy, { avatarUrl: imageUrl, profileName: '黎恩·舒华泽', source: 'opening' });
  assert.equal(saved.avatarUrl, imageUrl); assert.equal(saved.profileName, '黎恩·舒华泽'); assert.equal(saved.source, 'opening');
  assert.deepEqual(plain(saved.aliases), ['旧简称']);
  assert.deepEqual(JSON.parse(f.records.get(key)).extra, { retained: true });
  assert.equal(f.service.get().avatarUrl, imageUrl); assert.equal(f.service.get().profileMismatch, false);
  assert.deepEqual(f.changes, []);
});

test('登记姓名不符时隐藏旧头像/别名，恢复姓名后重新显示且实际记录未被抹掉', () => {
  const f = fixture(); f.displayStore.save(f.displayStore.get(), {
    avatarUrl: imageUrl, profileName: '黎恩·舒华泽', source: 'opening', aliases: ['黎恩'],
  });
  f.state.玩家.姓名 = '另一姓名';
  assert.equal(f.service.get().profileMismatch, true); assert.equal(f.service.get().avatarUrl, '');
  assert.deepEqual(plain(f.service.get().aliases), []); assert.equal(f.service.resolve('黎恩'), null);
  assert.equal(f.service.resolve('player')?.src, '');
  assert.equal(f.displayStore.get().avatarUrl, imageUrl); assert.deepEqual(plain(f.displayStore.get().aliases), ['黎恩']);
  f.state.玩家.姓名 = '黎恩·舒华泽'; assert.equal(f.service.get().avatarUrl, imageUrl); assert.ok(f.service.resolve('黎恩'));
  f.state.玩家.姓名 = ''; assert.equal(f.service.get().avatarUrl, '');
});

test('旧 version1 未登记姓名的头像继续兼容，不凭空添加身份限制', () => {
  const f = fixture(), key = 'rk:oc:portrait:v1:' + f.displayStore.get().scope;
  f.records.set(key, JSON.stringify({ version: 1, avatarUrl: imageUrl, aliases: ['黎恩'], revision: 'legacy' }));
  assert.equal(f.service.get().profileName, ''); assert.equal(f.service.get().profileMismatch, false);
  assert.equal(f.service.get().avatarUrl, imageUrl); assert.equal(f.service.resolve('黎恩')?.src, imageUrl);
});

test('终端仅更新或清除别名，保留开局最新头像、登记姓名/来源与未知字段', () => {
  const f = fixture(), key = 'rk:oc:portrait:v1:' + f.displayStore.get().scope;
  f.records.set(key, JSON.stringify({ version: 1, avatarUrl: bitmap, aliases: [], revision: 'old', extra: 'keep' }));
  f.displayStore.save(f.displayStore.get(), { avatarUrl: imageUrl, profileName: '黎恩·舒华泽', source: 'opening' });
  f.service.saveAliases(f.service.get(), { aliases: ['教官', '黎恩'], avatarUrl: bitmap, profileName: '试图覆盖姓名', source: '' });
  const changed = f.displayStore.get();
  assert.equal(changed.avatarUrl, imageUrl); assert.equal(changed.profileName, '黎恩·舒华泽'); assert.equal(changed.source, 'opening');
  assert.deepEqual(plain(changed.aliases), ['教官', '黎恩']); assert.equal(JSON.parse(f.records.get(key)).extra, 'keep');
  f.service.clearAliases(f.service.get());
  assert.equal(f.displayStore.get().avatarUrl, imageUrl); assert.equal(f.displayStore.get().profileName, '黎恩·舒华泽');
  assert.deepEqual(plain(f.displayStore.get().aliases), []); assert.equal(f.changes.length, 2);
});

test('开局页更新头像后拒绝终端旧别名草稿，重读后别名写入保留新头像', () => {
  const f = fixture(); f.displayStore.save(f.displayStore.get(), { avatarUrl: bitmap, profileName: '黎恩·舒华泽', source: 'opening' });
  const stale = f.service.get(); f.displayStore.save(f.displayStore.get(), { avatarUrl: imageUrl });
  assert.throws(() => f.service.saveAliases(stale, { aliases: ['黎恩'] }), /变化/);
  assert.throws(() => f.service.clearAliases(stale), /变化/);
  f.service.saveAliases(f.service.get(), { aliases: ['黎恩'] }); assert.equal(f.displayStore.get().avatarUrl, imageUrl);
  assert.throws(() => f.service.saveAliases(f.service.get(), { aliases: ['史黛菈'] }), /重名/);
});

test('共用存储 CAS、开局字段验证、unknown输入字段与快照 mutation 均受约束', () => {
  const f = fixture(), before = f.displayStore.get();
  f.displayStore.save(before, { avatarUrl: imageUrl, aliases: ['黎恩'], ignored: 'do not write' });
  assert.throws(() => f.displayStore.save(before, { avatarUrl: bitmap }), /变化/);
  for (const values of [{ profileName: '<bad>' }, { profileName: 7 }, { source: 'terminal' }, { source: null }, []]) {
    assert.throws(() => f.displayStore.save(f.displayStore.get(), values));
  }
  const key = 'rk:oc:portrait:v1:' + f.displayStore.get().scope;
  assert.equal(JSON.parse(f.records.get(key)).ignored, undefined);
  const mutable = f.displayStore.get(); mutable.aliases.push('外部改动');
  assert.deepEqual(plain(f.displayStore.get().aliases), ['黎恩']);
  f.ctx = { ...f.ctx, chatId: 'other' }; assert.throws(() => f.displayStore.save(mutable, { aliases: [] }), /变化/);
});

test('共用存储写入前再次核对原 raw，防止验证间发生新 revision 覆盖', () => {
  const f = fixture(), expected = f.displayStore.get(), read = f.storage.getItem.bind(f.storage);
  let reads = 0;
  f.storage.getItem = key => {
    if (++reads === 2) f.records.set(key, JSON.stringify({ version: 1, avatarUrl: bitmap, aliases: [], revision: 'another' }));
    return read(key);
  };
  assert.throws(() => f.displayStore.save(expected, { avatarUrl: imageUrl }), /变化/);
  assert.deepEqual(f.writes, []);
});

test('共用存储在完整回读成功后才发布一次本聊天更新，不读取 MVU', () => {
  const f = fixture(), updates = [], before = plain(f.state);
  const store = f.realm.createPlayerDisplayStore({ storage: f.storage, getContext: () => f.ctx, onChange: value => updates.push(plain(value)) });
  const saved = store.save(store.get(), { avatarUrl: imageUrl, profileName: '开局未写入 MVU 的名字', source: 'opening' });
  assert.deepEqual(updates, [plain(saved)]); assert.deepEqual(plain(f.state), before);
  f.storage.setItem = () => {}; assert.throws(() => store.save(store.get(), { avatarUrl: bitmap }), /回读/);
  assert.equal(updates.length, 1);
});

test('共用 scope 使用宿主当前 chatId 函数，缺失才读取 ctx.chatId', () => {
  const f = fixture(); f.ctx = { ...f.ctx, chatId: 'stale', getCurrentChatId: () => 'active' };
  assert.equal(f.displayStore.get().scope, JSON.stringify([1, null, 'active']));
  f.ctx = { ...f.ctx, getCurrentChatId: () => null }; assert.equal(f.displayStore.get().scope, JSON.stringify([1, null, 'stale']));
});

for (const raw of ['{', 'null', '[]', '{"version":2}', '{"version":1,"avatarUrl":"javascript:alert(1)","aliases":[]}']) {
  test(`损坏配置不静默覆盖 ${raw.slice(0, 35)}`, () => {
    const f = fixture(), key = 'rk:oc:portrait:v1:' + f.service.get().scope;
    f.records.set(key, raw); assert.throws(() => f.service.get()); assert.equal(f.records.get(key), raw);
    assert.deepEqual(f.writes, []);
  });
}
