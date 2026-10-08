// Targeted live verification for the two captured floors. No model calls or chat writes.
// --apply persists only the three existing character-local bubble regexes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const applying = args.includes('--apply');
const moduleRoot = args.find(arg => !arg.startsWith('--'));
assert.ok(moduleRoot, 'Pass the bundled Node dependency directory');
assert.ok(args.every(arg => arg === moduleRoot || arg === '--apply'), 'Unknown argument');
const require = createRequire(path.join(path.resolve(moduleRoot), 'package.json'));
const { chromium } = require('playwright');
const capture = JSON.parse(fs.readFileSync(path.join(here, 'capture.json'), 'utf8'));
const components = path.resolve(here, '../../发布/components');
const names = ['dialogue-bubbles', 'dialogue-player-candidates', 'dialogue-bubble-style'];
const replacementRules = names.map(name => JSON.parse(fs.readFileSync(path.join(components, name + '.regex.json'), 'utf8')));
const componentSha256 = Object.fromEntries(names.map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(components, name + '.regex.json'))).digest('hex')]));
const browser = await chromium.connectOverCDP('ws://127.0.0.1:9222/devtools/browser', { timeout: 45000 });
const page = browser.contexts().flatMap(context => context.pages()).find(item => item.url() === capture.url);
assert.ok(page, 'Expected the already-open Tavern page');
const consoleErrors = [];
let phase = 'baseline';
page.on('pageerror', error => consoleErrors.push({ phase, message: String(error), stack: error.stack }));
await page.waitForTimeout(1500);
phase = 'replay';

const prepared = await page.evaluate(async ({ capture, replacementRules }) => {
  const re = await import('/scripts/extensions/regex/engine.js');
  const ctx = SillyTavern.getContext();
  if (ctx.characterId !== capture.characterId || ctx.chatId !== capture.chatId || ctx.chat.length !== capture.messageCount) {
    throw new Error('Character/chat changed since capture; refusing stale patch');
  }
  const scoped = re.getScriptsByType(re.SCRIPT_TYPES.SCOPED);
  const expected = capture.rules.filter(rule => /^0[123] 盾形对白/.test(rule.scriptName));
  if (expected.length !== 3) throw new Error('Expected exactly three captured bubble rules');
  for (const rule of expected) {
    const current = scoped.find(item => item.id === rule.id);
    if (JSON.stringify(current) !== JSON.stringify(rule)) throw new Error('Installed bubble rule changed: ' + rule.scriptName);
  }
  for (const sample of capture.samples) {
    if (ctx.chat[sample.id]?.mes !== sample.raw || ctx.chat[sample.id]?.swipe_id !== sample.swipeId) throw new Error('Sample changed: ' + sample.id);
    if (ctx.chat[sample.id]?.extra?.display_text && ctx.chat[sample.id].extra.display_text !== sample.raw) throw new Error('Unexpected display_text override');
  }
  const oldIds = new Set(expected.map(rule => rule.id));
  const patch = Object.fromEntries(expected.map(old => {
    const fresh = replacementRules.find(rule => rule.scriptName.slice(0, 2) === old.scriptName.slice(0, 2));
    if (!fresh) throw new Error('Missing replacement');
    // Preserve IDs, flags, unknown fields, custom CSS and image addresses.
    return [old.id, { ...old, findRegex: fresh.findRegex, scriptName: fresh.scriptName,
      replaceString: old.replaceString.replace('/* rkd-dialogue-style:v0.5 */', '/* rkd-dialogue-style:v0.6 */') }];
  }));
  const next = scoped.map(rule => patch[rule.id] || rule);
  // These three existing slots remain in place; only their internal 01/02/03 order changes.
  const bubbleSlots = next.map((rule, index) => oldIds.has(rule.id) ? index : -1).filter(index => index >= 0);
  const ordered = Object.values(patch).sort((a, b) => a.scriptName.localeCompare(b.scriptName));
  bubbleSlots.forEach((index, i) => { next[index] = ordered[i]; });
  const active = re.getRegexScripts({ allowedOnly: true });
  const coreSlots = active.map((rule, index) => oldIds.has(rule.id) ? index : -1).filter(index => index >= 0);
  if (coreSlots.length !== 3) throw new Error('Character bubble rules are not admitted');
  const proposed = active.map(rule => patch[rule.id] || rule);
  coreSlots.forEach((index, i) => { proposed[index] = ordered[i]; });
  const beforeChat = JSON.stringify(ctx.chat);
  const count = text => ({ bubbles: (text.match(/<div data-rkd="bubble"/g) || []).length, styles: (text.match(/rkd-dialogue-style:/g) || []).length });
  const cases = capture.samples.map(sample => {
    const message = ctx.chat[sample.id];
    const usable = ctx.chat.map((item, index) => ({ item, index })).filter(({ item }) => !item.is_system);
    const depth = usable.length - usable.findIndex(item => item.index === sample.id) - 1;
    const run = rules => rules.reduce((text, rule) => {
      if (!rule.markdownOnly || !rule.placement.includes(re.regex_placement.AI_OUTPUT)) return text;
      if (typeof rule.minDepth === 'number' && rule.minDepth >= -1 && depth < rule.minDepth) return text;
      if (typeof rule.maxDepth === 'number' && rule.maxDepth >= 0 && depth > rule.maxDepth) return text;
      return re.runRegexScript(rule, text, { characterOverride: message.name });
    }, message.mes);
    const before = count(run(active));
    const started = performance.now();
    const output = run(proposed);
    return { id: sample.id, depth, before, after: count(output), elapsedMs: performance.now() - started };
  });
  if (JSON.stringify(ctx.chat) !== beforeChat) throw new Error('Read-only replay unexpectedly changed chat');
  if (cases[0].before.bubbles !== 22 || cases[0].after.bubbles !== 22 || cases[1].before.bubbles !== 0 || cases[1].after.bubbles !== 13 || cases.some(item => item.after.styles !== 1)) {
    throw new Error('Unexpected replay: ' + JSON.stringify(cases));
  }
  const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return { beforeRules: scoped, nextRules: next, cases, chatSha256: await digest(beforeChat),
    otherRulesSha256: await digest(JSON.stringify(active.filter(rule => !oldIds.has(rule.id)))) };
}, { capture, replacementRules });

if (applying) {
  phase = 'apply';
  // Backup is saved before any live mutation. Never replace the original backup.
  const backupPath = path.join(here, 'scoped-regex-before.json');
  if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, JSON.stringify(prepared.beforeRules, null, 2) + '\n');
  const applied = await page.evaluate(async ({ prepared, capture }) => {
    const re = await import('/scripts/extensions/regex/engine.js');
    const app = await import('/script.js');
    const ctx = SillyTavern.getContext();
    const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (ctx.characterId !== capture.characterId || ctx.chatId !== capture.chatId || JSON.stringify(re.getScriptsByType(re.SCRIPT_TYPES.SCOPED)) !== JSON.stringify(prepared.beforeRules)) throw new Error('Concurrent context/regex change');
    if (await digest(JSON.stringify(ctx.chat)) !== prepared.chatSha256) throw new Error('Chat changed before apply');
    const current = SillyTavern.getContext();
    if (current.characterId !== capture.characterId || current.chatId !== capture.chatId || JSON.stringify(re.getScriptsByType(re.SCRIPT_TYPES.SCOPED)) !== JSON.stringify(prepared.beforeRules)) throw new Error('Context/regex changed during asynchronous check');
    await re.saveScriptsByType(prepared.nextRules, re.SCRIPT_TYPES.SCOPED);
    if (JSON.stringify(re.getScriptsByType(re.SCRIPT_TYPES.SCOPED)) !== JSON.stringify(prepared.nextRules)) throw new Error('Saved rules differ');
    for (const sample of capture.samples) app.updateMessageBlock(sample.id, ctx.chat[sample.id]);
    return { persisted: true, renderedIds: capture.samples.map(sample => sample.id) };
  }, { prepared, capture });
  await page.waitForTimeout(1500);
  const observed = await page.evaluate(async ({ prepared, capture }) => {
    const ctx = SillyTavern.getContext();
    const re = await import('/scripts/extensions/regex/engine.js');
    const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const ids = new Set(prepared.nextRules.filter(rule => /^0[123] 盾形对白/.test(rule.scriptName)).map(rule => rule.id));
    return { chatUnchanged: await digest(JSON.stringify(ctx.chat)) === prepared.chatSha256,
      otherRulesUnchanged: await digest(JSON.stringify(re.getRegexScripts({ allowedOnly: true }).filter(rule => !ids.has(rule.id)))) === prepared.otherRulesSha256,
      savedRulesMatch: JSON.stringify(re.getScriptsByType(re.SCRIPT_TYPES.SCOPED)) === JSON.stringify(prepared.nextRules),
      samples: capture.samples.map(sample => {
        const el = document.querySelector('.mes[mesid="' + sample.id + '"] .mes_text');
        const bubbles = [...el.querySelectorAll('[data-rkd="bubble"]')];
        const styles = [...el.querySelectorAll('style')].filter(style => style.textContent.includes('rkd-dialogue-style:'));
        return { id: sample.id, bubbles: bubbles.length, styles: styles.length, styleRules: styles.map(style => style.sheet?.cssRules.length || 0),
          displays: [...new Set(bubbles.map(node => getComputedStyle(node).display))],
          emptyBubbles: bubbles.filter(node => !node.querySelector('[data-rkd-line]')?.textContent.trim()).length };
      }) };
  }, { prepared, capture });
  const report = { capturedAt: new Date().toISOString(), browser: browser.version(), componentSha256, ...applied, ...observed, replay: prepared.cases, consoleErrors };
  fs.writeFileSync(path.join(here, 'live-applied.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  assert.equal(observed.chatUnchanged, true);
  assert.equal(observed.otherRulesUnchanged, true);
  assert.equal(observed.savedRulesMatch, true);
  assert.deepEqual(observed.samples.map(sample => sample.bubbles), [22, 13]);
  assert.ok(observed.samples.every(sample => sample.styles === 1 && sample.displays.length === 1 && sample.displays[0] === 'flex' && sample.emptyBubbles === 0));
  const baselineStacks = new Set(consoleErrors.filter(error => error.phase !== 'apply').map(error => error.stack));
  assert.deepEqual(consoleErrors.filter(error => error.phase === 'apply' && !baselineStacks.has(error.stack)), [], 'New console error after applying the bubble rules');
} else {
  const report = { checkedAt: new Date().toISOString(), browser: browser.version(), componentSha256, mode: 'read-only-replay', cases: prepared.cases, chatSha256: prepared.chatSha256, consoleErrors };
  fs.writeFileSync(path.join(here, 'live-preview.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
// Disconnect the client without closing the user's browser or any tabs.
process.exit(0);
