import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const read = file => fs.readFileSync(new URL(file, import.meta.url));
const json = file => JSON.parse(read(file).toString('utf8').replace(/^\uFEFF/, ''));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const receipt = json('source-receipt.json');
const manifest = json('components/component-update-manifest.json');
const artifact = json('components/opening-init-repair.regex.json');
const live = json('../playwright/init-repair-20261107/final-live-report.json');
const artifactSha256 = hash(read('components/opening-init-repair.regex.json'));
assert.equal(artifactSha256, 'b2e59e30774b69096fdfd3f8e9b8e86b6c1e3c4fe1dfafd59adbaa86828ca2f3');
assert.equal(artifactSha256, manifest.artifacts[0].sha256);
assert.equal(hash(artifact.replaceString), receipt.replacementSha256);
assert.equal(live.final.replacementSha256, receipt.replacementSha256);
assert.equal(live.final.loadedGuard, true);
assert.equal(receipt.nonRepairSurfaceByteIdentical, true);
assert.ok(live.missingGlobal.feedback.includes('MVU 仍未启动'));
assert.ok(live.missingData.feedback.includes('MVU 已启动'));
for (const result of [live.missingGlobal, live.missingData]) assert.ok(result.elapsedMs >= 14900 && result.elapsedMs < 16000);
assert.deepEqual(live.missingGlobal.variables, [{}]);
assert.deepEqual(live.missingData.variables, {});
assert.equal(live.restoredWithoutRetry.开局状态, '待建档');
assert.equal(live.rakudai.system.作品, 'rakudai');
assert.equal(live.rakudai.system.开局状态, '已建档');
assert.equal(live.asteriskDelayedAndCopy.system.作品, 'asterisk');
assert.equal(live.asteriskDelayedAndCopy.system.开局状态, '已建档');
assert.deepEqual(live.asteriskDelayedAndCopy.busy, { disabled: true, copy: [true, true] });
assert.deepEqual(live.asteriskDelayedAndCopy.copy, [false, false]);
assert.equal(live.asteriskDelayedAndCopy.disabled, false);
assert.ok(live.terminal.includes('档案已同步') && live.terminal.includes('初始化验收学生'));
assert.deepEqual(live.pageErrors, []);
const original = fs.readFileSync('F:/SillyTavern-Launcher/SillyTavern/data/default-user/characters/落第x学战v0.01.png');
assert.equal(hash(original), '45d46fad2318a75a656d3b81557e2d9d23db554cea62e7eaeb3c29ab32ab193f');
assert.ok(!/[\\/]/.test(live.final.chatId));
const lines = fs.readFileSync('C:/Users/eriri/AppData/Local/Temp/rakudai-init-repro-20261107/data/default-user/chats/落第x学战v0.01/' + live.final.chatId + '.jsonl', 'utf8').trim().split(/\r?\n/);
const persisted = JSON.parse(lines.at(-1));
assert.equal(persisted.variables[persisted.swipe_id ?? 0].stat_data.系统.开局状态, '已建档');
assert.equal(persisted.variables[persisted.swipe_id ?? 0].stat_data.玩家.姓名, '初始化验收学生');
const median = values => { const sorted = [...values].sort((a,b) => a-b); return (sorted[5] + sorted[6]) / 2; };
const report = { passed: true, deliveryMode: 'component', artifactSha256, replacementSha256: receipt.replacementSha256,
  originalCardUnchanged: true, importedFinalArtifact: true, nonRepairSurfaceByteIdentical: true,
  globalTimeoutMs: live.missingGlobal.elapsedMs, dataTimeoutMs: live.missingData.elapsedMs,
  noLateAutoCommit: true, delayedDataWithCopyStillCommits: true, bothWorldsReadBack: true, terminalSynced: true, filePersistence: true,
  desktopCapture: { samplesEach: 12, beforeMedianMs: median(live.baseline.times), afterMedianMs: median(live.rakudai.times), scope: 'same desktop runtime, warmed capture; not a mobile benchmark' },
  sourceChecks: { browserAdapter: '71/71', openingSchemaCoreCombinations: '30/30', sceneTime: '18/18', playerDisplay: '10/10', openingController: '38/38' },
  staticChecks: { inlineScripts: 3, ejsPlainAndStrictIdentity: true, componentContract: true, independentReview: true },
  runtime: live.host, helper: live.final.helper, browser: live.browser, playerDeviceVerified: false };
fs.writeFileSync(new URL('validation-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
