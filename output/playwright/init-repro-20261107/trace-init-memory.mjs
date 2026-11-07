// Diagnostic only: executes extracted opening functions in an isolated Node VM.
// No SillyTavern API calls, card writes, business-source edits, or network requests.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { RAKUDAI_INITIAL_STATE } from '../../../世界书规则/MVU/schema.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const directory = fileURLToPath(new URL('./', import.meta.url));
const require = createRequire(import.meta.url);
const { z } = require('../../worldbook-calibration/dev/node_modules/zod');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const clone = structuredClone;
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const holdMs = Number(process.argv.find(value => value.startsWith('--hold-ms='))?.split('=')[1] || 1500);
assert.ok(Number.isInteger(holdMs) && holdMs >= 1 && holdMs <= 30000);
const cardPath = process.argv.find(value => value.startsWith('--card='))?.slice(7) ||
  'F:/SillyTavern-Launcher/SillyTavern/data/default-user/characters/落第x学战v0.01.png';
const pagePath = path.join(root, '第一卷-世界书整理/开局网页正则替换/index.html');
const initialPath = path.join(root, '世界书规则/MVU/schema.mjs');
const checkedFiles = new Map([pagePath, cardPath, initialPath].map(file => [file, sha256(fs.readFileSync(file))]));

function readInstalledOpening(file) {
  const png = fs.readFileSync(file);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const entries = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    assert.ok(offset + length + 12 <= png.length, 'PNG chunk extends past file');
    const data = png.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type !== 'tEXt') continue;
    const separator = data.indexOf(0), keyword = data.toString('latin1', 0, separator);
    if (!['chara', 'ccv3'].includes(keyword)) continue;
    const card = JSON.parse(Buffer.from(data.toString('latin1', separator + 1), 'base64').toString('utf8'));
    const regexes = card.data?.extensions?.regex_scripts || card.extensions?.regex_scripts || [];
    const matches = regexes.filter(regex => regex.replaceString?.includes('async function enterGame()'));
    assert.equal(matches.length, 1, 'Expected one opening regex in each card payload');
    entries.push({ keyword, regex: matches[0], cardName: card.data?.name || card.name });
  }
  assert.ok(entries.length, 'No chara/ccv3 opening payload found');
  assert.equal(new Set(entries.map(entry => sha256(entry.regex.replaceString))).size, 1,
    'chara and ccv3 openings disagree; select the actual runtime payload before testing');
  const selected = entries.find(entry => entry.keyword === 'ccv3') || entries[0];
  return { html: selected.regex.replaceString, cardName: selected.cardName, regexName: selected.regex.scriptName,
    payloads: entries.map(entry => ({ keyword: entry.keyword, replaceStringSha256: sha256(entry.regex.replaceString) })) };
}

function extract(html) {
  const match = html.match(/<!-- RK_STATE_CONTROLLER_BEGIN -->\s*<script>([\s\S]*?)<\/script>\s*<!-- RK_STATE_CONTROLLER_END -->/);
  assert.ok(match, 'State-controller block missing');
  const section = (startText, endText) => {
    const start = html.indexOf(startText), end = html.indexOf(endText, start + startText.length);
    assert.ok(start >= 0 && end > start, 'Missing function boundary: ' + startText);
    return { text: html.slice(start, end), line: html.slice(0, start).split('\n').length };
  };
  const capture = section('      async function captureOpeningState()', '      function currentOpeningReceipt(');
  const submitAndCopy = section('      async function copyCardSummary()', '      function applyArchiveAvatar(');
  const commit = section('      async function enterGame()', '      function applyArchiveAvatar(');
  return { controller: match[1], ui: capture.text + submitAndCopy.text,
    identity: { controllerSha256: sha256(match[1]), captureSha256: sha256(capture.text),
      submitAndCopySha256: sha256(submitAndCopy.text), enterGameSha256: sha256(commit.text),
      captureLine: capture.line, copyLine: submitAndCopy.line, enterGameLine: commit.line } };
}

function fixture(source) {
  const chat = [{ role: 'assistant', swipe: 0, text: ['诊断开局'], variables: [{ stat_data: clone(RAKUDAI_INITIAL_STATE) }] }];
  const context = { chat, chatId: 'offline-diagnostic-only', characterId: 1, groupId: null };
  let writes = 0, release;
  const ready = new Promise(resolve => { release = resolve; });
  const events = [], copied = [], nodes = new Map();
  const host = { SillyTavern: { getContext: () => context } };
  const window = {
    parent: host, top: host, z, confirm: () => true,
    getTavernHelperVersion: () => '4.8.19',
    async waitGlobalInitialized(name) {
      assert.equal(name, 'Mvu');
      if (!host.Mvu) await ready;
      Object.defineProperty(window, 'Mvu', { configurable: true, get: () => host.Mvu });
    },
    getChatMessages: () => context.chat.map((message, index) => ({ message_id: index, role: message.role,
      swipe_id: message.swipe, swipes: message.text })).filter(message => message.role === 'assistant'),
    updateVariablesWith(updater, option) {
      assert.equal(option.type, 'message');
      const message = chat[option.message_id];
      const result = updater(clone(message.variables[message.swipe]));
      assert.equal(typeof result?.then, 'undefined');
      message.variables[message.swipe] = result;
      writes++;
      return clone(result);
    },
  };
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { disabled: false, checked: true, value: '诊断草稿',
      setAttribute(key, value) { this[key] = value; }, scrollIntoView() {}, focus() {}, select() {} });
    return nodes.get(id);
  };
  const payload = { 系统: { 结构版本: 4, 作品: 'rakudai', 主角模式: '自定义角色' },
    玩家: { ...clone(RAKUDAI_INITIAL_STATE.玩家), 姓名: '诊断角色' },
    场景: { 当前章: '第一章', 时间: '春假早晨', 地点: '理事长室', 切入说明: '' } };
  const draft = { world_id: 'rakudai', profile: { name: '诊断角色' }, scene: payload.场景, greeting: '' };
  const realm = vm.createContext({ window, structuredClone, console, URL,
    openingCommitBusy: false, openingUiRevision: 0, openingReceipt: null, openingPendingAttempt: null,
    document: { getElementById: node }, requireCompleteProfile: () => true, readOpeningDraft: () => draft,
    validateArchive: value => value, validateScene() {}, openingDraftKey: () => 'stable', currentOpeningReceipt: () => null,
    archiveFeedback: (...args) => events.push(args), openingController: () => window.RakudaiStateController,
    getCurrentMessageId: () => 0, assertOpeningWorld() {}, openingPlayerDisplay: () => ({ capture: () => ({}), apply() {} }),
    assertSceneMatches() {}, buildOpeningVariables: () => payload, openingAvatarSource: () => '',
    showOpeningPreview: () => node('preview'), updateOpeningPreview() {},
    navigator: { clipboard: { async writeText(value) { copied.push(value); } } },
  });
  vm.runInContext(source.controller, realm, { filename: 'extracted-state-controller.js' });
  vm.runInContext(source.ui, realm, { filename: 'extracted-opening-ui.js' });
  return { realm, chat, events,
    initializeMvu() {
      host.Mvu = { getMvuData: option => clone(chat[option.message_id].variables[chat[option.message_id].swipe]) };
      release();
    },
    snapshot() { return { feedback: clone(events), busy: realm.openingCommitBusy,
      buttonDisabled: node('opening-commit-button').disabled, writes,
      receiptPresent: realm.openingReceipt !== null, copiedCount: copied.length,
      system: clone(chat[0].variables[0].stat_data?.系统 ?? null) }; },
  };
}

async function runCases(source) {
  const results = [];
  const delayed = fixture(source), pending = delayed.realm.enterGame();
  await pause(holdMs);
  const beforeReady = delayed.snapshot();
  assert.equal(beforeReady.busy, true); assert.equal(beforeReady.buttonDisabled, true); assert.equal(beforeReady.writes, 0);
  assert.match(beforeReady.feedback.at(-1)[0], /正在核对本局状态并提交档案/);
  delayed.initializeMvu(); await pending;
  const afterReady = delayed.snapshot();
  assert.equal(afterReady.writes, 1); assert.equal(afterReady.system.开局状态, '已建档');
  assert.equal(afterReady.busy, false); assert.equal(afterReady.receiptPresent, true);
  results.push({ id: 'missing-global-then-late-ready', passed: true, heldMs: holdMs, beforeReady, afterReady });

  const missing = fixture(source); missing.chat[0].variables[0] = {}; missing.initializeMvu();
  await missing.realm.enterGame(); const missingResult = missing.snapshot();
  assert.equal(missingResult.writes, 0); assert.equal(missingResult.busy, false);
  assert.match(missingResult.feedback.at(-1)[0], /当前楼层没有 MVU 初始化数据/);
  results.push({ id: 'missing-stat-data-explicit-error', passed: true, result: missingResult });

  const copied = fixture(source), copyPending = copied.realm.enterGame();
  await Promise.resolve(); await copied.realm.copyCardSummary();
  copied.initializeMvu(); await copyPending; const copiedResult = copied.snapshot();
  assert.equal(copiedResult.writes, 0); assert.equal(copiedResult.receiptPresent, false);
  assert.equal(copiedResult.busy, false); assert.equal(copiedResult.copiedCount, 1);
  assert.equal(copiedResult.system.开局状态, '待建档');
  assert.match(copiedResult.feedback.at(-1)[0], /档案草稿已复制/);
  results.push({ id: 'copy-during-wait-cancels-submit', passed: true, result: copiedResult });

  const advanced = fixture(source), advancePending = advanced.realm.enterGame();
  await Promise.resolve(); advanced.chat.push(clone(advanced.chat[0])); advanced.initializeMvu();
  await advancePending; const advancedResult = advanced.snapshot();
  assert.equal(advancedResult.writes, 0); assert.equal(advancedResult.busy, false);
  assert.match(advancedResult.feedback.at(-1)[0], /该开局页已是历史楼层/);
  results.push({ id: 'later-assistant-floor-protection', passed: true, result: advancedResult });
  return results;
}

const installed = readInstalledOpening(cardPath);
const inputs = [
  { id: 'workspace-opening', path: pagePath, html: fs.readFileSync(pagePath, 'utf8') },
  { id: 'installed-card-opening', path: cardPath, html: installed.html,
    cardName: installed.cardName, regexName: installed.regexName, payloads: installed.payloads },
];
const sources = [];
for (const input of inputs) {
  const source = extract(input.html);
  sources.push({ id: input.id, path: input.path, fileSha256: checkedFiles.get(input.path),
    extractedOpeningSha256: sha256(input.html), cardName: input.cardName, regexName: input.regexName,
    payloads: input.payloads, ...source.identity, cases: await runCases(source) });
}
const unchanged = [...checkedFiles].map(([file, before]) => ({ path: file, sha256: before,
  unchanged: sha256(fs.readFileSync(file)) === before }));
assert.ok(unchanged.every(file => file.unchanged), 'An input changed during the diagnostic');
const report = {
  task: 'Opening initialization diagnostic; no fix', generatedAt: new Date().toISOString(),
  node: process.version, mode: 'isolated-node-vm', passed: true,
  actualCode: ['embedded state controller including local schema and state transitions', 'captureOpeningState', 'copyCardSummary', 'enterGame'],
  simulatedBoundaries: ['TavernHelper global registration and message storage', 'DOM nodes', 'clipboard',
    'validated synthetic rakudai draft', 'preview and portrait presentation'],
  limits: ['Does not reproduce a real phone/browser or network failure.',
    'Does not establish which dependency or interaction failed on the player device.',
    'The global remains pending for the recorded hold period; source inspection identifies the lack of a timeout.',
    'No generated story or real chat is used.'],
  criticalLogicIdentical: ['controllerSha256', 'captureSha256', 'submitAndCopySha256', 'enterGameSha256']
    .every(key => sources[0][key] === sources[1][key]),
  sources, unchangedInputs: unchanged,
};
const reportPath = path.join(directory, 'trace-init-memory-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, cases: sources.reduce((sum, source) => sum + source.cases.length, 0),
  criticalLogicIdentical: report.criticalLogicIdentical, reportPath,
  sources: sources.map(source => ({ id: source.id, openingSha256: source.extractedOpeningSha256 })) }));
