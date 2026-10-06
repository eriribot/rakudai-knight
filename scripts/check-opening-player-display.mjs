import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const page = fs.readFileSync(new URL('../第一卷-世界书整理/开局页面/index.html', import.meta.url), 'utf8');
function between(start, end) {
  const from = page.indexOf(start), to = page.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, '缺少真实开局代码：' + start);
  return page.slice(from, to);
}
const functions = between('      function openingPlayerDisplay()', '      async function captureOpeningState()') + '\n' +
  between('      async function enterGame()', '      function applyArchiveAvatar(');
const bitmap = 'data:image/jpeg;base64,/9j/2Q==';
function fixture({ canon = false, replacing = false, commitFailure = false, avatarFailure = false, captureFailure = false } = {}) {
  let draft = { profile_key: canon ? 'kurogane' : 'user', profile: { name: canon ? '黑铁一辉' : '有马风月' },
    avatar: canon ? null : bitmap, scene: {}, greeting: '' };
  let committed = replacing;
  const calls = [], feedback = [], token = {}, captured = { revision: 'old', token: {} };
  const oldState = { 系统: { 开局状态: replacing ? '已建档' : '待建档' }, 玩家: { 姓名: replacing ? '旧人物' : '' } };
  const button = { disabled: false, setAttribute() {} }, input = { scrollIntoView() {}, focus() {} };
  const display = {
    capture() { calls.push('capture-display'); if (captureFailure) throw new Error('存储不可用'); return captured; },
    apply(expected, values) {
      calls.push(['apply-display', values]); assert.equal(expected, captured); assert.ok(committed, '头像必须等人物成功回读');
      if (avatarFailure) throw new Error('头像回读失败'); return { revision: 'new' };
    },
  };
  const controller = {
    async commitOpening() { calls.push('commit'); if (commitFailure) throw new Error('建档失败'); committed = true; return { state: { 系统: { 开局状态: '已建档' }, 玩家: { 姓名: draft.profile.name } } }; },
    async replaceOpening() { calls.push('replace'); committed = true; return { state: { 系统: { 开局状态: '已建档' }, 玩家: { 姓名: draft.profile.name } } }; },
    async verify() { calls.push('verify'); return { state: oldState }; },
  };
  const realm = vm.createContext({
    window: { RakudaiPlayerDisplay: display, confirm: () => true }, document: { getElementById: () => button },
    defaultCanonAvatarSrc: 'https://eriribot.github.io/rakudai-knight/default-avatar.jpeg',
    openingCommitBusy: false, openingUiRevision: 0, openingReceipt: null, openingPendingAttempt: null,
    requireCompleteProfile: () => true, readOpeningDraft: () => draft, validateArchive: value => value,
    validateScene() {}, assertSceneMatches() {}, currentOpeningReceipt: () => null,
    openingDraftKey: JSON.stringify, stableOpeningJson: JSON.stringify, buildOpeningVariables: value => value,
    openingController: () => controller, captureOpeningState: async () => ({ state: oldState, token }),
    showOpeningPreview: () => input, updateOpeningPreview() {}, archiveFeedback: (...args) => feedback.push(args),
  });
  vm.runInContext(functions, realm);
  return { realm, calls, feedback, get draft() { return draft; }, set draft(value) { draft = value; }, set committed(value) { committed = value; } };
}

test('开局原有照片在人物提交成功之后自动共用，不提前写显示', async () => {
  const f = fixture(); await f.realm.enterGame();
  assert.deepEqual(f.calls.map(item => Array.isArray(item) ? item[0] : item), ['capture-display', 'commit', 'apply-display']);
  assert.equal(f.calls[2][1].avatarUrl, bitmap); assert.equal(f.calls[2][1].profileName, '有马风月');
  assert.equal(f.realm.openingReceipt.state.系统.开局状态, '已建档');
});
test('原作一辉沿用开局默认头像，无需另上传', async () => {
  const f = fixture({ canon: true }); await f.realm.enterGame();
  assert.equal(f.calls.at(-1)[1].avatarUrl, f.realm.defaultCanonAvatarSrc);
});
test('替换成未选照片的人物提交空显示头像，避免继承旧人物照片', async () => {
  const f = fixture({ replacing: true }); f.draft.avatar = null; await f.realm.enterGame();
  assert.equal(f.calls[1], 'replace'); assert.equal(f.calls.at(-1)[1].avatarUrl, '');
});
test('人物建档失败不应用照片', async () => {
  const f = fixture({ commitFailure: true }); await f.realm.enterGame();
  assert.equal(f.calls.some(item => Array.isArray(item)), false); assert.equal(f.realm.openingReceipt, null);
  assert.equal(f.feedback.at(-1)[0], '建档失败');
});
for (const fault of ['avatarFailure', 'captureFailure']) test(`${fault} 保留已成功建档凭据并提供单独重试指引`, async () => {
  const f = fixture({ [fault]: true }); await f.realm.enterGame();
  assert.equal(f.realm.openingReceipt.state.系统.开局状态, '已建档');
  assert.match(f.feedback.at(-1)[0], /头像尚未同步.*应用头像到本局.*第一幕请求/);
  assert.equal(f.feedback.at(-1)[1], true); assert.equal(f.realm.openingCommitBusy, false);
});
test('旧聊天独立应用照片只走显示接口，不调用人物建档或替换', () => {
  const f = fixture({ replacing: true }); f.realm.applyAvatarToCurrentChat();
  assert.deepEqual(f.calls.map(item => Array.isArray(item) ? item[0] : item), ['capture-display', 'apply-display']);
  assert.match(f.feedback.at(-1)[0], /本局头像已应用/); assert.equal(f.realm.openingReceipt, null);
});
test('旧聊天未选照片不创建空头像记录，并指出原有上传入口', () => {
  const f = fixture({ replacing: true }); f.draft.avatar = null; f.realm.applyAvatarToCurrentChat();
  assert.deepEqual(f.calls, []); assert.match(f.feedback.at(-1)[0], /载入.*档案卡头像上传/);
});
test('建档正在提交时不能并发覆盖显示', () => {
  const f = fixture(); f.realm.openingCommitBusy = true; f.realm.applyAvatarToCurrentChat();
  assert.deepEqual(f.calls, []);
});
test('维护页面明确暴露原入口与独立显示操作，未新增另一套照片表单', () => {
  assert.match(page, /id="avatar-file-input"/); assert.match(page, /id="apply-player-avatar-button"/);
  assert.match(page, /applyAvatarToCurrentChat: applyAvatarToCurrentChat/);
  assert.equal((page.match(/type="file"/g) || []).length, 2, '只有原有照片输入与档案JSON输入');
});
