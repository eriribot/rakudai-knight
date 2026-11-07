// Isolated diagnostics for the actual enabled scripts embedded in the installed PNG.
// No imports from remote URLs are executed; no real browser/chat is touched.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { RAKUDAI_INITIAL_STATE, INITIAL_STATE } from '../../../世界书规则/MVU/schema.mjs';

const cardPath = 'F:/SillyTavern-Launcher/SillyTavern/data/default-user/characters/落第x学战v0.01.png';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const png = fs.readFileSync(cardPath), beforeHash = hash(png);
let card;
for (let offset = 8; offset < png.length;) {
  const size = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
  const bytes = png.subarray(offset + 8, offset + 8 + size); offset += size + 12;
  if (type === 'tEXt' && bytes.toString('latin1', 0, bytes.indexOf(0)) === 'ccv3') {
    card = JSON.parse(Buffer.from(bytes.toString('latin1', bytes.indexOf(0) + 1), 'base64').toString('utf8'));
  }
}
assert.ok(card);
const scripts = card.data.extensions.tavern_helper.scripts;
const standalone = scripts.find(script => script.id === '485c4bcb-4090-4c72-bc09-6339ce5b27a6');
const terminal = scripts.find(script => script.id === '26d1c1d2-2531-4034-8a88-0f26a1c8fbc5');
const guard = scripts.find(script => script.id === 'ccebb634-335d-4659-8c3b-afae946d3d5c');
assert.equal(standalone.enabled, true); assert.equal(terminal.enabled, true); assert.equal(guard.enabled, false);
const extractInstall = script => {
  const start = script.content.indexOf('async function installRakudaiNativeMvu(');
  const end = script.content.indexOf('\n}\n', start) + 3;
  assert.ok(start >= 0 && end > start);
  return script.content.slice(start, end).trim();
};
const nativeFunctionIdentical = extractInstall(standalone) === extractInstall(terminal);
const nativeInstaller = extractInstall(standalone), terminalInstaller = extractInstall(terminal);
const installerDifferences = nativeInstaller.split('\n').flatMap((text, index) =>
  text === terminalInstaller.split('\n')[index] ? [] : [{ relativeLine: index + 1, native: text, terminal: terminalInstaller.split('\n')[index] }]);

async function runInstaller(content, scriptId) {
let waitCalls = 0, release;
const gate = new Promise(resolve => { release = resolve; });
const handlers = new Map();
const context = { characterId: 1, groupId: null, chat: [{ is_user: false, mes: '诊断开场' }] };
const events = { VARIABLE_UPDATE_STARTED: 'mag_variable_update_started', COMMAND_PARSED: 'mag_command_parsed',
  VARIABLE_UPDATE_ENDED: 'mag_variable_update_ended', VARIABLE_INITIALIZED: 'mag_variable_initialized' };
const host = { SillyTavern: { getContext: () => context } };
const window = { parent: host, top: host, Mvu: { events }, addEventListener() {}, removeEventListener() {},
  async waitGlobalInitialized(name) { assert.equal(name, 'Mvu'); waitCalls++; await gate; },
  eventOn(name, callback) { handlers.set(name, callback); return { stop() { handlers.delete(name); } }; },
};
vm.runInNewContext(content, { window, console, structuredClone }, { filename: scriptId + '.js' });
assert.equal(waitCalls, 1); assert.equal(handlers.size, 0);
const beforeReady = { waitCalls, listeners: handlers.size, markerState: window.__RK_MVU_NATIVE_N01__.state };
release();
await window.RakudaiMvuNative.install(window);
// Reuse of a loading marker resolves before the original install continuation; drain it explicitly.
await Promise.resolve(); await Promise.resolve();
assert.equal(window.__RK_MVU_NATIVE_N01__.state, 'ready');
assert.equal(handlers.size, 3); assert.equal(handlers.has(events.VARIABLE_INITIALIZED), false);
const callbackResults = [];
for (const [sampleName, state] of [['neutral', INITIAL_STATE], ['rakudai', RAKUDAI_INITIAL_STATE]]) {
  for (const [name, callback] of handlers) {
    const variables = { stat_data: structuredClone(state) };
    const previous = { stat_data: structuredClone(state) };
    const result = name === events.COMMAND_PARSED ? callback(variables, [], '诊断开场') : callback(variables, previous);
    const returnedPromise = Boolean(result && typeof result.then === 'function');
    assert.equal(returnedPromise, false); assert.equal(waitCalls, 1);
    callbackResults.push({ sampleName, event: name, returnedPromise, waitCallsAfterCallback: waitCalls });
  }
}
return { scriptId, beforeReady,
  afterReady: { waitCalls, listeners: [...handlers.keys()], markerState: window.__RK_MVU_NATIVE_N01__.state }, callbackResults };
}
const probes = [
  await runInstaller(standalone.content, standalone.id),
  // Execute the actual terminal installer using the standalone native utility scaffolding.
  // Only the function body is substituted; neither source file is changed.
  await runInstaller(standalone.content.replace(nativeInstaller, () => terminalInstaller), terminal.id),
];
const manifest = scripts.map(script => ({ id: script.id, name: script.name, enabled: script.enabled,
  sha256: hash(script.content), lines: script.content.split('\n').flatMap((text, index) =>
    /VARIABLE_INITIALIZED|VARIABLE_UPDATE_STARTED|VARIABLE_UPDATE_ENDED|waitGlobalInitialized|waitMvu|mag_variable_initialized/.test(text)
      ? [{ line: index + 1, text: text.slice(0, 340) }] : []) }));
const report = { generatedAt: new Date().toISOString(), mode: 'isolated-vm-with-host-and-event-doubles', passed: true,
  cardPath, cardSha256: beforeHash, nativeFunctionIdentical, installerDifferences, probes, scripts: manifest,
  conclusion: 'The two actual native installers wait before registering listeners; their STARTED/COMMAND_PARSED/ENDED callbacks tested here return synchronously and do not call waitGlobalInitialized again.',
  limits: ['Does not simulate the player device or establish its failure cause.',
    'The standalone native script and actual terminal native installer are executed. Other enabled scripts are inventoried and reviewed statically.',
    'The terminal native installer is executed using standalone native utilities; this is not full terminal execution.',
    'No claim about globally installed scripts or extensions on the player device.'] };
assert.equal(hash(fs.readFileSync(cardPath)), beforeHash);
fs.writeFileSync(new URL('./enabled-script-listener-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, actualCallbacksInvoked: probes.reduce((sum, probe) => sum + probe.callbackResults.length, 0),
  waitCallsPerInstaller: probes.map(probe => probe.afterReady.waitCalls), nativeFunctionIdentical,
  installerDifferenceLines: installerDifferences.length, initializedListeners: 0 }));
