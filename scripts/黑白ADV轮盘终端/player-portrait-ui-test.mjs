import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';

const source = fs.readFileSync(new URL('terminal-app.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const elements = new Map(), calls = [];
  const imageUrl = 'https://example.test/oc.png';
  let snapshot = { version: 1, scope: 'chat-a', avatarUrl: imageUrl, aliases: ['黎恩'],
    primaryName: '黎恩·舒华泽', personaName: '玩家人物', revision: '1' };
  function element(id) {
    if (!elements.has(id)) elements.set(id, { _html: '', writes: 0, textContent: '', value: '', disabled: false,
      style: {}, classList: { add() {}, remove() {}, toggle() {} },
      set innerHTML(value) { this._html = value; this.writes++; }, get innerHTML() { return this._html; } });
    return elements.get(id);
  }
  const service = {
    get: () => structuredClone(snapshot),
    resolve: name => ['玩家', snapshot.primaryName, ...snapshot.aliases].includes(name)
      ? { src: snapshot.profileMismatch ? '' : snapshot.avatarUrl, hasShieldFrame: false, prepared: false, portraitScale: 1, player: true } : null,
    saveAliases(expected, value) {
      assert.deepEqual(plain(expected), snapshot);
      calls.push(['saveAliases', plain(value)]);
      assert.deepEqual(Object.keys(value), ['aliases']);
      snapshot = { ...snapshot, ...plain(value), revision: String(Number(snapshot.revision) + 1) };
      return structuredClone(snapshot);
    },
    clearAliases(expected) {
      assert.deepEqual(plain(expected), snapshot);
      calls.push(['clearAliases']);
      snapshot = { ...snapshot, aliases: [], revision: String(Number(snapshot.revision) + 1) };
      return structuredClone(snapshot);
    },
  };
  const ui = vm.createContext({ URL, console, structuredClone,
    setTimeout: () => 1, clearTimeout() {}, addEventListener() {},
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} },
  });
  ui.window = ui;
  vm.runInContext(source, ui);
  ui.RK_KNIGHT_AVATARS = { byName: { '史黛菈': 'stella' }, entries: {
    stella: { src: 'https://example.test/stella.png', hasShieldFrame: true, prepared: false, portraitScale: 1 },
  }, shield: null };
  ui.bridge = { playerPortrait: service };
  ui.stat = { 玩家: { 姓名: snapshot.primaryName }, 场景: {}, 系统: {}, 人际: {} };
  ui.currentStack = ['scr-home', 'scr-settings'];
  ui.renderSettings();
  return { ui, service, elements, element, calls, imageUrl,
    get snapshot() { return snapshot; }, set snapshot(value) { snapshot = value; } };
}
function imageSources(html) {
  const found = [];
  function visit(node) {
    if (node.tagName === 'img') found.push(Object.fromEntries(node.attrs.map(attribute => [attribute.name, attribute.value])).src);
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parseFragment(html)); return found;
}

test('首页和玩家档案共用已保存头像，不修改正式 MVU', () => {
  const f = fixture(), stateBefore = plain(f.ui.stat);
  f.ui.updateHomeScreen(); f.ui.blazerSubTab = 'overview'; f.ui.renderBlazer();
  assert.deepEqual(imageSources(f.element('home-ava').innerHTML), [f.imageUrl]);
  assert.deepEqual(imageSources(f.element('blazer-body').innerHTML), [f.imageUrl]);
  assert.deepEqual(plain(f.ui.stat), stateBefore);
});
test('显式玩家可覆盖同名，普通正典人物不被 OC 别名覆盖', () => {
  const f = fixture(); f.snapshot = { ...f.snapshot, primaryName: '史黛菈', aliases: ['史黛菈'] };
  assert.equal(f.ui.resolveKnightAvatar('史黛菈').src, 'https://example.test/stella.png');
  assert.equal(f.ui.resolveKnightAvatar('史黛菈', { player: true }).src, f.imageUrl);
  assert.equal(f.ui.resolveKnightAvatar('不知名人物'), null);
});
test('空头像玩家身份仍可识别，渲染回退首字而不请求空地址', () => {
  const f = fixture(); f.snapshot = { ...f.snapshot, avatarUrl: '' };
  const html = f.ui.renderKnightAvatar('黎恩', false, { player: true, square: true });
  assert.deepEqual(imageSources(html), []); assert.match(html, />黎<\/span>/);
  assert.deepEqual(imageSources(f.ui.renderCompanionAvatar('黎恩')), []);
});
test('轮询和头像事件保留未保存输入与其他设置区，事件即时刷新首页', async () => {
  const f = fixture();
  f.ui.editPlayerPortraitDraft({ name: 'aliasesText', value: '教官，黎恩\n黎恩' });
  const section = f.element('rk-player-portrait-settings'), writes = section.writes;
  f.element('settings-body').sentinel = '副 API 未保存输入';
  f.ui.refreshTerminalView();
  assert.equal(f.ui.playerPortraitDraft.aliasesText, '教官，黎恩\n黎恩');
  assert.equal(section.writes, writes);
  f.snapshot = { ...f.snapshot, avatarUrl: 'https://example.test/new.png', revision: '2' };
  await f.ui.refreshTerminalState({ type: 'player-portrait' });
  assert.deepEqual(imageSources(f.element('home-ava').innerHTML), ['https://example.test/new.png']);
  assert.equal(f.ui.playerPortraitDraft.aliasesText, '教官，黎恩\n黎恩');
  assert.equal(f.element('settings-body').sentinel, '副 API 未保存输入');
  assert.equal(f.element('rk-player-portrait-save').disabled, true);
});
for (const [field, nextValue] of [['scope', 'chat-b'], ['primaryName', '另一人物'], ['personaName', '另一Persona'], ['revision', '2']]) {
  test(`${field} 变化阻止旧草稿保存/清除，重新读取恢复新身份`, () => {
    const f = fixture(); f.ui.editPlayerPortraitDraft({ name: 'aliasesText', value: '待保存的称呼' });
    f.snapshot = { ...f.snapshot, [field]: nextValue };
    f.ui.savePlayerAliases(); f.ui.clearPlayerAliases();
    assert.deepEqual(f.calls, []); assert.equal(f.element('rk-player-portrait-save').disabled, true);
    assert.match(f.element('rk-player-portrait-message').textContent, /已变化/);
    f.ui.reloadPlayerPortraitSettings();
    assert.equal(f.ui.playerPortraitDraft.snapshot[field], nextValue);
    assert.equal(f.ui.playerPortraitDraft.dirty, false);
    assert.equal(f.element('rk-player-portrait-save').disabled, false);
  });
}
test('保存分隔与去重别名，清除别名保留开局页头像', () => {
  const f = fixture(); f.ui.editPlayerPortraitDraft({ name: 'aliasesText', value: '教官，黎恩\n黎恩' });
  f.ui.savePlayerAliases();
  assert.deepEqual(f.calls[0], ['saveAliases', { aliases: ['教官', '黎恩'] }]);
  assert.equal(f.ui.playerPortraitDraft.dirty, false);
  f.ui.clearPlayerAliases();
  assert.deepEqual(imageSources(f.element('home-ava').innerHTML), [f.imageUrl]);
  assert.deepEqual(f.snapshot.aliases, []); assert.equal(f.snapshot.avatarUrl, f.imageUrl);
});
test('设置页只有称呼和只读头像预览，不存在重复 URL、文件上传或头像修改', () => {
  const f = fixture();
  const html = f.element('rk-player-portrait-settings').innerHTML;
  assert.match(html, /玩家称呼 \/ 别名/); assert.match(html, /开局页/); assert.match(html, /应用头像到本局/);
  assert.doesNotMatch(html, /type="(?:url|file)"|player-portrait-(?:url|file)|HTTPS 图片地址|保存头像/);
  assert.deepEqual(imageSources(f.element('rk-player-portrait-preview').innerHTML), [f.imageUrl]);
  assert.equal(f.ui.uploadPlayerPortrait, undefined); assert.equal(f.ui.playerPortraitPreviewUrl, undefined);
  assert.equal(Object.hasOwn(f.ui.playerPortraitDraft, 'avatarUrl'), false);
  f.ui.editPlayerPortraitDraft({ name: 'avatarUrl', value: 'javascript:alert(1)' });
  assert.equal(Object.hasOwn(f.ui.playerPortraitDraft, 'avatarUrl'), false); assert.deepEqual(f.calls, []);
});
test('开局应用新照片后只读预览即时更新，未保存别名保留并按新版本失效', async () => {
  const f = fixture();
  f.ui.editPlayerPortraitDraft({ name: 'aliasesText', value: '我的未保存称呼' });
  f.snapshot = { ...f.snapshot, avatarUrl: 'https://example.test/from-opening.png', revision: '2' };
  await f.ui.refreshTerminalState({ type: 'player-portrait' });
  assert.deepEqual(imageSources(f.element('rk-player-portrait-preview').innerHTML), ['https://example.test/from-opening.png']);
  assert.equal(f.ui.playerPortraitDraft.aliasesText, '我的未保存称呼');
  f.ui.savePlayerAliases(); assert.deepEqual(f.calls, []);
});
test('照片所属姓名与当前玩家不符时禁止保存别名，提示返回开局应用当前人物照片', () => {
  const f = fixture(); f.snapshot = { ...f.snapshot, profileName: '另一人物', profileMismatch: true };
  f.ui.refreshTerminalView();
  assert.equal(f.element('rk-player-portrait-save').disabled, true);
  assert.equal(f.element('rk-player-portrait-clear').disabled, true);
  assert.match(f.element('rk-player-portrait-message').textContent, /开局页/);
  assert.match(f.element('rk-player-portrait-message').textContent, /玩家:台词/);
  assert.deepEqual(imageSources(f.element('rk-player-portrait-preview').innerHTML), []);
  f.ui.editPlayerPortraitDraft({ name: 'aliasesText', value: '新称呼' }); f.ui.savePlayerAliases();
  assert.deepEqual(f.calls, []);
  f.snapshot = { ...f.snapshot, profileName: f.snapshot.primaryName, profileMismatch: false, revision: '2' };
  f.ui.reloadPlayerPortraitSettings();
  assert.equal(f.element('rk-player-portrait-save').disabled, false);
});
test('头像服务失败时保留可见错误并阻止保存', () => {
  const f = fixture(); f.service.get = () => { throw new Error('浏览器存储不可用'); };
  f.ui.refreshTerminalView();
  assert.match(f.element('rk-player-portrait-message').textContent, /浏览器存储不可用/);
  assert.equal(f.element('rk-player-portrait-save').disabled, true);
});
