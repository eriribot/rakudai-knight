import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createSchema, INITIAL_STATE, RAKUDAI_INITIAL_STATE } from '../../世界书规则/MVU/schema.mjs';
import { applyOpening } from '../../scripts/rakudai-state-core.mjs';

// ponytail: exercise the assembled page in memory; do not refresh delivery artifacts.
const work = new URL('./', import.meta.url), root = new URL('../../', work);
const outputPaths = ['第一卷-世界书整理/开局网页正则替换/index.html', '第一卷-世界书整理/开局网页正则替换/正则替换文本.txt', 'output/asterisk-opening/source-receipt.json'];
const before = outputPaths.map(path => fs.readFileSync(new URL(path, root)));
const built = spawnSync('python', [fileURLToPath(new URL('build-preview.py', work)), '--stdout'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
assert.equal(built.status, 0, built.stderr);
const html = built.stdout;
outputPaths.forEach((path, i) => assert.deepEqual(fs.readFileSync(new URL(path, root)), before[i], 'in-memory build must not change ' + path));
let scripts = 0;
for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
  if (/\bsrc\s*=/.test(attrs)) continue;
  const check = spawnSync(process.execPath, [...(/type="module"/.test(attrs) ? ['--input-type=module'] : []), '--check', '-'], { input: body, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr); scripts++;
}
function between(start, end) {
  const from = html.indexOf(start), to = html.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, start);
  return html.slice(from, to);
}
const functions = between('      function parseAbilityLines(', '      function validateAbilityInputs(') +
  between('      function buildOpeningMessage(', '      function archiveFeedback(') +
  between('      function validateScene(', '      function applyArchiveAvatar(');
const extension = fs.readFileSync(new URL('asterisk-mode.js', work), 'utf8');
const profile = { name: '测试学生', personality: '谨慎', conduct: '先核对', school: '星导馆学园', device: '测试武装',
  nobleArt: '试式｜能力描述｜需要集中', otherAbilities: '观察｜观察环境｜不可读心', category: '魔术师', desc: '既往经历原文',
  ability: '机制原文', limits: '限制原文', style: '风格原文' };
const draft = () => ({ format: 'tavern-opening-profile', schema_version: 6, world_id: 'asterisk', school_id: 'seidoukan', profile_key: 'user',
  profile: structuredClone(profile), asterisk: { rank_status: 'ranked', rank: 12, prana: '储量、控制、持续时间与负担原文', weapon_type: 'lux', weapon_notes: '资格与代价原文' },
  context: { 当前身体: '身体原文', 当前能力边界: '能力边界原文', 本局映射: '映射原文' },
  scene: { 当前章: '序章', 时间: '转学首日·清晨', 地点: '星导馆学园·接待处', 切入说明: '报到原文' }, greeting: '开场白原文', avatar: 'data:image/png;base64,AAAA' });
function fixture({ legacy = false, failure = '', existing = null, afterVerify = null, beforeCapture = null } = {}) {
  const current = draft(), calls = [], feedback = [], clipboardWrites = [], nodes = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, { checked: true, value: '', textContent: '', disabled: false, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, scrollIntoView() {}, focus() {}, select() {} }); return nodes.get(id); };
  const copyButtons = [node('copy-draft'), node('copy-preview')];
  let state = existing || { 系统: { 结构版本: 4, ...(legacy ? {} : { 作品: null }), 开局状态: '待建档', 主角模式: '未选择' },
    玩家: {}, 场景: { 当前卷: legacy ? 1 : null, 当前章: '待选择', 时间: '', 地点: '', 切入说明: '' }, 人际: {} };
  const token = {}, portrait = {};
  const controller = {
    async capture() { calls.push('capture'); if (beforeCapture) await beforeCapture(); return { state: structuredClone(state), token }; },
    async commitOpening(_token, payload) {
      calls.push('commit'); if (failure === 'commit') throw new Error('写入失败');
      state = { ...structuredClone(payload), 人际: {} }; state.系统.开局状态 = '已建档';
      if (failure === 'world') state.系统.作品 = 'rakudai';
      if (failure === 'record') delete state.玩家.学战;
      return { state: structuredClone(state) };
    },
    async replaceOpening(token, payload) { calls.push('replace'); return this.commitOpening(token, payload); },
    async verify() { calls.push('verify'); if (afterVerify) afterVerify(current); return { state: structuredClone(state) }; }
  };
  const realm = vm.createContext({ console, structuredClone, Object, Number, JSON, Array,
    ARCHIVE_FORMAT: 'tavern-opening-profile', ARCHIVE_VERSION: 6, ARCHIVE_LIMIT: 2 * 1024 * 1024,
    OPENING_CHAPTERS: ['待选择', '序章'], OPENING_FIELDS: Object.fromEntries(Object.keys(profile).map(key => [key, key])),
    FIELD_LIMITS: Object.fromEntries(Object.keys(profile).map(key => [key, 6000])),
    SCENE_FIELDS: { 当前章: '', 时间: '', 地点: '', 切入说明: '' }, CONTEXT_FIELDS: { 当前身体: '', 当前能力边界: '', 本局映射: '' },
    AXIS_LABELS: { attack: '攻击力' }, CHARACTER_SCOPE_PROMPT: '保留既往经历与当前能力边界。',
    openingCommitBusy: false, openingUiRevision: 0, openingReceipt: null, openingPendingAttempt: null,
    getCurrentMessageId: () => 0, readOpeningDraft: () => current, requireCompleteProfile: () => true,
    validateArchive: value => realm.validateAsteriskArchive(value), archiveFeedback: (...args) => feedback.push(args),
    document: { getElementById: node, querySelectorAll(selector) { assert.equal(selector, '[data-opening-copy]'); return copyButtons; } },
    navigator: { clipboard: { async writeText(value) { clipboardWrites.push(value); } } },
    window: { RakudaiStateController: controller, confirm: () => true, RakudaiPlayerDisplay: {
      capture() { calls.push('capture-avatar'); return portrait; },
      apply(expected, value) { assert.equal(expected, portrait); assert.equal(state.系统.开局状态, '已建档'); calls.push(['avatar', value]); if (failure === 'avatar') throw new Error('照片保存失败'); }
    } }, profileRating: () => ({ score: null, base: null, proposed: null, missing: [] })
  });
  vm.runInContext(functions + extension, realm); realm.activeOpeningWorld = 'asterisk';
  return { realm, current, calls, feedback, clipboardWrites, copyButtons, node, get state() { return state; } };
}
const plain = value => JSON.parse(JSON.stringify(value));
const f = fixture(), payload = plain(f.realm.buildOpeningVariables(f.current));
const require = createRequire(import.meta.url), { z } = require('../worldbook-calibration/dev/node_modules/zod');
const schema = createSchema(z);
assert.deepEqual(payload.系统, { 结构版本: 4, 作品: 'asterisk', 主角模式: '自定义角色', 开局状态: '待建档' });
assert.deepEqual(payload.玩家.学战, { 学园ID: 'seidoukan', 能力身份: '魔术师', 能力机制: '机制原文', 共通限制: '限制原文',
  招式: { 试式: { 说明: '能力描述', 条件与代价: '需要集中', 掌握状态: '已掌握' } }, 星辰力: { 说明: f.current.asterisk.prana },
  校内序列: { 状态: '已上榜', 名次: 12 }, 武装: { 类别: '煌式武装', 名称: '测试武装', 使用条件: '资格与代价原文' } });
assert.deepEqual(payload.场景, { 当前卷: null, 阶段: '进行中', 已发生事件: {}, ...f.current.scene });
for (const key of ['当前身体', '当前能力边界', '本局映射']) assert.equal(payload.玩家[key], f.current.context[key]);
for (const key of ['固有灵装', '伐刀能力', '六维', '登记等级', '魔人觉醒', '成长', '综合初评']) assert.equal(key in payload.玩家, false, key);
assert.equal(payload.玩家.其他能力.观察.说明, '观察环境');
for (const school of ['seidoukan', 'gallardworth', 'jielong', 'rewolf', 'arlequint']) {
  const sample = draft(); sample.school_id = school; sample.profile.school = f.realm.AST_SCHOOLS[school].name;
  assert.equal(f.realm.buildOpeningVariables(sample).玩家.学战.学园ID, school);
  for (const identity of f.realm.AST_CATEGORIES) {
    sample.profile.category = identity;
    const converted = plain(f.realm.buildOpeningVariables(sample));
    for (const initial of [INITIAL_STATE, RAKUDAI_INITIAL_STATE]) {
      const original = JSON.stringify(initial), saved = schema.parse(applyOpening(initial, converted));
      assert.equal(saved.系统.作品, 'asterisk'); assert.equal(saved.系统.开局状态, '已建档');
      assert.equal(saved.玩家.学战.星辰力.说明, sample.asterisk.prana);
      assert.equal(saved.玩家.学战.能力身份, identity.split('（')[0]);
      assert.equal(JSON.stringify(initial), original, 'converter/core keep the initial state immutable');
    }
  }
}
const originalScene = draft(); originalScene.scene.当前章 = '原创开场';
assert.equal(schema.parse(applyOpening(INITIAL_STATE, plain(f.realm.buildOpeningVariables(originalScene)))).场景.当前章, '原创开场');
assert.equal(schema.parse(applyOpening(INITIAL_STATE, plain(f.realm.buildOpeningVariables(originalScene)))).场景.时间, originalScene.scene.时间);
for (const [raw, mapped] of [['unknown', '未知'], ['unranked', '未上榜']]) {
  const sample = draft(); sample.asterisk.rank_status = raw;
  assert.deepEqual(plain(f.realm.buildOpeningVariables(sample).玩家.学战.校内序列), { 状态: mapped, 名次: null });
}
for (const mutate of [d => { d.asterisk.rank = 73; }, d => { d.school_id = 'queenvail'; }, d => { d.profile.nobleArt = '__proto__｜坏键｜条件'; }]) {
  const sample = draft(); mutate(sample); assert.throws(() => f.realm.buildOpeningVariables(sample));
}
const rk = { ...draft(), world_id: 'rakudai', profile: { ...profile, stats: { attack: 'C' } } };
assert.equal(f.realm.buildOpeningVariables(rk).系统.作品, 'rakudai');
assert.equal('学战' in f.realm.buildOpeningVariables(rk).玩家, false);
for (const legacy of [false, true]) {
  const fixtureValue = fixture({ legacy }), original = JSON.stringify(fixtureValue.current);
  await fixtureValue.realm.enterGame();
  assert.equal(fixtureValue.realm.openingReceipt.state.系统.作品, 'asterisk');
  assert.equal(JSON.stringify(fixtureValue.current), original, 'submission preserves draft and photo');
  assert.ok(fixtureValue.calls.findIndex(v => v === 'commit') < fixtureValue.calls.findIndex(Array.isArray));
  assert.equal(fixtureValue.calls.find(Array.isArray)[1].avatarUrl, fixtureValue.current.avatar);
  assert.match(fixtureValue.node('opening-message').value, /第一幕请求/);
  assert.match(fixtureValue.node('opening-preview-title').textContent, /已建档/);
}
for (const failure of ['commit', 'world', 'record']) {
  const bad = fixture({ failure }), original = JSON.stringify(bad.current); await bad.realm.enterGame();
  assert.equal(bad.realm.openingReceipt, null); assert.equal(bad.calls.some(Array.isArray), false);
  assert.equal(JSON.stringify(bad.current), original); assert.match(bad.node('opening-preview-title').textContent, /草稿/);
  assert.equal(bad.feedback.at(-1)[1], true);
}
const avatar = fixture({ failure: 'avatar' }); await avatar.realm.enterGame();
assert.equal(avatar.realm.openingReceipt.state.系统.开局状态, '已建档'); assert.match(avatar.feedback.at(-1)[0], /头像尚未同步/);
const wrongWorld = fixture({ existing: { 系统: { 作品: 'rakudai', 开局状态: '已建档' }, 玩家: { 姓名: '测试学生' }, 场景: {} } });
await wrongWorld.realm.enterGame(); await wrongWorld.realm.applyAvatarToCurrentChat();
assert.equal(wrongWorld.calls.includes('commit'), false); assert.equal(wrongWorld.calls.some(Array.isArray), false);
const stale = fixture({ afterVerify: current => { current.profile.name = '修改后'; } }); await stale.realm.enterGame();
stale.calls.length = 0; await stale.realm.enterGame();
assert.equal(stale.realm.openingReceipt, null); assert.equal(stale.calls.some(Array.isArray), false);

const copyMarkup = [...html.matchAll(/<button\b[^>]*\bdata-opening-copy\b[^>]*>/g)];
assert.equal(copyMarkup.length, 2, 'both copy actions participate in the commit busy state');
for (const [button] of copyMarkup) assert.match(button, /RakudaiOpening\.copyCardSummary\(\)/);
const draftCopy = fixture();
await draftCopy.realm.copyCardSummary();
assert.equal(draftCopy.clipboardWrites.length, 1);
assert.match(draftCopy.clipboardWrites[0], /上述资料是草稿，尚未写入游戏状态/);
assert.equal(draftCopy.calls.length, 0, 'copying a draft must not capture or write game state');

let finishCapture;
const captureGate = new Promise(resolve => { finishCapture = resolve; });
const slow = fixture({ beforeCapture: () => captureGate });
slow.copyButtons[1].disabled = true;
const slowCommit = slow.realm.enterGame(), commitRevision = slow.realm.openingUiRevision;
assert.equal(slow.realm.openingCommitBusy, true);
assert.equal(slow.node('opening-commit-button').disabled, true);
assert.equal(slow.node('opening-commit-button').attributes['aria-busy'], 'true');
assert.ok(slow.copyButtons.every(button => button.disabled));
assert.match(slow.feedback.at(-1)[0], /初始化最多等待 15 秒，失败后可重试/);
const busyFeedback = slow.feedback.length;
await slow.realm.copyCardSummary();
await slow.realm.copyCardSummary();
assert.equal(slow.realm.openingUiRevision, commitRevision, 'copy cannot invalidate an in-flight commit');
assert.equal(slow.feedback.length, busyFeedback, 'copy cannot replace the commit progress message');
assert.equal(slow.clipboardWrites.length, 0);
finishCapture(); await slowCommit;
assert.equal(slow.calls.filter(call => call === 'commit').length, 1);
assert.equal(slow.realm.openingReceipt.state.系统.开局状态, '已建档');
assert.equal(slow.realm.openingCommitBusy, false);
assert.equal(slow.node('opening-commit-button').disabled, false);
assert.equal(slow.node('opening-commit-button').attributes['aria-busy'], 'false');
assert.deepEqual(slow.copyButtons.map(button => button.disabled), [false, true], 'restore each pre-existing disabled state');
await slow.realm.copyCardSummary();
assert.equal(slow.clipboardWrites.length, 1);
assert.match(slow.clipboardWrites[0], /第一幕请求/);

let failCapture, captureAttempts = 0;
const timeoutGate = new Promise((_, reject) => { failCapture = reject; });
const timedOut = fixture({ beforeCapture: () => ++captureAttempts === 1 ? timeoutGate : undefined });
const originalTimedOutDraft = JSON.stringify(timedOut.current), timedOutCommit = timedOut.realm.enterGame();
failCapture(new Error('等待 MVU 初始化超时（15 秒），请稍后重试。'));
await timedOutCommit;
assert.equal(timedOut.realm.openingCommitBusy, false);
assert.equal(timedOut.node('opening-commit-button').disabled, false);
assert.equal(timedOut.node('opening-commit-button').attributes['aria-busy'], 'false');
assert.ok(timedOut.copyButtons.every(button => !button.disabled));
assert.equal(timedOut.realm.openingReceipt, null);
assert.equal(timedOut.calls.includes('commit'), false);
assert.equal(JSON.stringify(timedOut.current), originalTimedOutDraft);
assert.match(timedOut.feedback.at(-1)[0], /初始化超时.*重试/);
assert.equal(timedOut.feedback.at(-1)[1], true);
await timedOut.realm.enterGame();
assert.equal(timedOut.realm.openingReceipt.state.系统.开局状态, '已建档');
assert.equal(timedOut.calls.filter(call => call === 'commit').length, 1, 'retry after timeout writes exactly once');

console.log(JSON.stringify({ passed: true, inlineScripts: scripts, inMemoryBuild: true, schools: 5, actualSchemaCoreCombinations: 30, sharedSubmit: true, failurePreservesDraft: true, readbackReceipt: true, avatarAfterCommit: true, busyCopyPreservesCommit: true, busyControlsRestored: true, initializationTimeoutUiRetry: true, noGeneratedFilesChanged: true }));
