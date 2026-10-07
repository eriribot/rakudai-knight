// Read-only host replay. --write saves a report only beside this file, never in output/.
// Prerequisites: Node 22+, an official ST 1.18.0 checkout (--st-root), jsdom 29.1.1
// (--jsdom-root points to its package directory), and access to the three pinned npm
// dependency URLs below. This executes no preset/option scripts or real ST state.
// --artifact-ref HEAD captures the published baseline; omission reads working-tree artifacts.
// --izumi-preset <JSON> --izumi-local-dir <components> adds original preset ->
// character-local compatibility -> core host cases. Attachment content is data only.
// --serve exposes only neutral fixtures on 127.0.0.1; Ctrl+C stops it.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const stRoot = arg('--st-root') || process.env.ST_SOURCE_ROOT;
const jsdomRoot = arg('--jsdom-root') || process.env.JSDOM_PACKAGE_ROOT;
if (!stRoot || !jsdomRoot) throw new Error('Required: --st-root <ST1.18.0 checkout> --jsdom-root <jsdom package directory>');
if (JSON.parse(fs.readFileSync(path.join(stRoot, 'package.json'))).version !== '1.18.0') throw new Error('Replay is pinned to ST 1.18.0');
const require = createRequire(path.join(path.resolve(jsdomRoot), 'package.json'));
const { JSDOM } = require('jsdom');
if (require('jsdom/package.json').version !== '29.1.1') throw new Error('Replay DOM is pinned to jsdom 29.1.1');
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceFiles = ['public/script.js', 'public/scripts/chats.js', 'public/scripts/extensions/regex/engine.js',
  'public/scripts/showdown-underscore.js', 'public/scripts/util/stream-fadein.js', 'public/scripts/utils.js'];
const sources = Object.fromEntries(sourceFiles.map(file => [file, fs.readFileSync(path.join(stRoot, file), 'utf8').replace(/\r\n/g, '\n')]));
const functionSource = (file, name, exported = true) => {
  const source = sources[file], start = source.indexOf((exported ? 'export ' : '') + 'function ' + name + '('), end = source.indexOf('\n}', start);
  if (start < 0 || end < 0) throw new Error('Pinned function not found: ' + name);
  return source.slice(start, end + 2).replace(/^export /, '');
};
const dependencies = [
  ['@adobe/css-tools', '4.4.4', 'https://unpkg.com/@adobe/css-tools@4.4.4/dist/cjs/adobe-css-tools.cjs'],
  ['dompurify', '3.4.2', 'https://unpkg.com/dompurify@3.4.2/dist/purify.cjs.js'],
  ['showdown', '2.1.0', 'https://unpkg.com/showdown@2.1.0/dist/showdown.js'],
];
const code = await Promise.all(dependencies.map(async ([, , url]) => {
  const response = await fetch(url); if (!response.ok) throw new Error(url + ': ' + response.status); return response.text();
}));
function loadCjs(source) {
  const module = { exports: {} }, env = vm.createContext({ module, exports: module.exports, require, console, setTimeout, clearTimeout });
  vm.runInContext(source, env);
  // Keep Showdown's RegExp static captures and extension instanceof in its own realm.
  module.exports.replayRegExp = vm.runInContext('RegExp', env);
  return module.exports;
}
const [css, purifier, showdown] = code.map(loadCjs);
const artifactRef = arg('--artifact-ref');
const artifactNames = ['dialogue-bubbles', 'dialogue-player-candidates', 'dialogue-bubble-style'];
const artifactTexts = artifactNames.map(name => {
  const file = 'scripts/正文气泡/发布/components/' + name + '.regex.json';
  if (!artifactRef) return fs.readFileSync(path.join(root, file), 'utf8');
  const result = spawnSync('git', ['show', artifactRef + ':' + file], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Cannot read artifact from Git: ' + file);
  return result.stdout;
});
const rules = artifactTexts.map(text => JSON.parse(text));
const artifactStyleReplacement = rules[2].replaceString;
const styleMatch = rules[2].replaceString.match(/<style>[\s\S]*?<\/style>/);
if (!styleMatch) throw new Error('Expected a bare style opener in shared-style artifact');
const bareStyle = styleMatch[0];
let mediaAllowed = true;
const dom = new JSDOM('<div class="mes_text"></div>', { url: 'http://127.0.0.1:8000' }), w = dom.window;
const escapeRegex = text => text.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
const context = {
  RegExp: showdown.replayRegExp, css, DOMPurify: purifier(w), isExternalMediaAllowed: () => mediaAllowed,
  document: w.document, window: w, HTMLUnknownElement: w.HTMLUnknownElement, NodeFilter: w.NodeFilter,
  Element: w.Element, HTMLMediaElement: w.HTMLMediaElement, HTMLElement: w.HTMLElement,
  console: { ...console, debug() {} }, Intl,
  getCurrentEntityId: () => null, accountStorage: { getItem: () => true },
  power_user: { reasoning: { prefix: '', suffix: '' }, allow_name2_display: true, encode_tags: false,
    user_prompt_bias: '', show_user_prompt_bias: false, auto_fix_generated_markdown: false },
  chat: [{ is_system: false, extra: {} }, { is_system: false, extra: {} }], regex_placement: { AI_OUTPUT: 2 },
  COMMENT_NAME_DEFAULT: 'Comment', systemUserName: 'System', canUseNegativeLookbehind: () => true,
  escapeRegex, escapeHtml: text => text.replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  substituteParams: text => text.replaceAll('{{user}}', '中性玩家'),
  substituteParamsExtended: (text, params, sanitize) => text.replaceAll('{{user}}', sanitize ? sanitize('中性玩家') : '中性玩家'),
  sanitizeRegexMacro: escapeRegex, substitute_find_regex: { NONE: 0, RAW: 1, ESCAPED: 2 },
  RegexProvider: { instance: { get(text) { return context.regexFromString(text); } } },
  filterString: text => text, isSegmenterSupported: () => true,
  SCRIPT_TYPES: { GLOBAL: 0, PRESET: 2, SCOPED: 1 }, SCRIPT_TYPE_UNKNOWN: -1,
  DEFAULT_GET_REGEX_SCRIPTS_OPTIONS: { allowedOnly: false },
  extension_settings: { regex: [], disabledExtensions: [], character_allowed_regex: ['neutral.png'],
    preset_allowed_regex: { neutral: ['neutral'] } },
  characters: [{ avatar: 'neutral.png', data: { extensions: { regex_scripts: [] } } }], this_chid: 0,
  getCurrentPresetAPI: () => 'neutral', getCurrentPresetName: () => 'neutral',
  getPresetManager: () => ({ readPresetExtensionField: () => [] }),
};
vm.createContext(context);
for (const [file, name] of [['public/scripts/chats.js', 'encodeStyleTags'], ['public/scripts/chats.js', 'decodeStyleTags'],
  ['public/scripts/utils.js', 'regexFromString'],
  ['public/scripts/chats.js', 'addDOMPurifyHooks'], ['public/scripts/extensions/regex/engine.js', 'runRegexScript'],
  ['public/script.js', 'messageFormatting'], ['public/scripts/util/stream-fadein.js', 'segmentTextInElement']]) {
  vm.runInContext(functionSource(file, name), context);
}
for (const name of ['getRegexScripts', 'getScriptsByType', 'getRegexedString']) {
  vm.runInContext(functionSource('public/scripts/extensions/regex/engine.js', name), context);
}
vm.runInContext(functionSource('public/scripts/extensions/regex/engine.js', 'filterString', false), context);
const registryGetRegexedString = context.getRegexedString;
context.getRegexedString = text => rules.reduce((value, rule) => context.runRegexScript(rule, value), text);
vm.runInContext(sources['public/scripts/showdown-underscore.js'].replace('export const ', 'const ') +
  '\nthis.markdownUnderscoreExt = markdownUnderscoreExt;', context);
context.converter = new showdown.Converter({ emoji: true, literalMidWordUnderscores: true, parseImgDimensions: true,
  tables: true, underline: true, simpleLineBreaks: true, strikethrough: true, disableForced4SpacesIndentedSublists: true,
  extensions: [context.markdownUnderscoreExt()] });
context.addDOMPurifyHooks();
// jsdom has no native innerText setter. Only this browser-equivalent setter is supplied.
Object.defineProperty(w.HTMLElement.prototype, 'innerText', { configurable: true,
  get() { return this.textContent; }, set(value) { this.textContent = value; } });
const body = w.document.querySelector('.mes_text'), message = '史黛菈:中性验证。', browserFixtures = [];
function probe() {
  const style = body.querySelector('style');
  const konataRules = [...body.querySelectorAll('style')].flatMap(node => [...(node.sheet?.cssRules ?? [])])
    .filter(rule => rule.selectorText?.includes('konata-thinking')).length;
  const neutralText = [], walker = w.document.createTreeWalker(body, w.NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('style,script')) continue;
    neutralText.push(node.data);
  }
  const neutralOrder = neutralText.join('').match(/中性(?:思考|计划|正文)/g) ?? [];
  return { bubbles: body.querySelectorAll('[data-rkd="bubble"]').length, styleCount: body.querySelectorAll('style').length,
    styleRules: style?.sheet?.cssRules?.length ?? null, styleChildren: style?.children.length ?? null,
    hiddenContainers: body.querySelectorAll('pre[hidden],code[hidden]').length,
    imageMapping: /--rkd-image:\s*url\(/.test(style?.textContent ?? ''), cssError: body.textContent.includes('CSS ERROR'),
    konataRules, neutralOrder, scripts: body.querySelectorAll('script').length };
}
function scopeStyleProbe() {
  const styles = [...body.querySelectorAll('style')];
  const bubbleStyles = styles.filter(style => style.textContent.includes('[data-rkd'));
  const thinkingStyles = styles.filter(style => style.textContent.includes('konata-thinking'));
  const counts = items => items.map(style => style.sheet?.cssRules.length ?? null);
  const children = items => items.reduce((sum, style) => sum + style.children.length, 0);
  const hidden = items => items.filter(style => style.closest('pre[hidden],code[hidden]')).length;
  const bubbles = [...body.querySelectorAll('[data-rkd="bubble"]')];
  return { styleRuleCounts: counts(styles), styleChildrenTotal: children(styles),
    bubbleStyleRules: counts(bubbleStyles), thinkingStyleRules: counts(thinkingStyles),
    bubbleStyleChildren: children(bubbleStyles), thinkingStyleChildren: children(thinkingStyles),
    bubbleStylesHidden: hidden(bubbleStyles), thinkingStylesHidden: hidden(thinkingStyles),
    allImageMapping: styles.some(style => /--rkd-image:\s*url\(/.test(style.textContent)),
    bodyBubbles: bubbles.filter(bubble => !bubble.closest('.custom-konata-thinking-content')).length,
    planningBubbles: bubbles.filter(bubble => bubble.closest('.custom-konata-thinking-content')).length,
    literalMacroPreserved: body.textContent.includes('宏字面量{{user}}') };
}
const cases = [];
const validationFailures = [];
const localCheck = (condition, detail) => {
  if (condition) return;
  validationFailures.push(detail);
  if (!args.includes('--collect-failures')) throw new Error(detail);
};
const fence = String.fromCharCode(96).repeat(3);
// These cases use all three delivered rules verbatim, including 03's exact
// zero-length insertion/replacement. The forced bare/wrapper cases are comparisons.
for (const [name, text, allowed, expectedPrefix] of [
  ['artifact-current', message, true, ''],
  ['artifact-current-media-blocked', message, false, ''],
  ['artifact-current-closed-fence-prefix', fence + '\n中性代码\n' + fence + '\n\n' + message, true, '中性代码'],
  ['artifact-current-unclosed-fence', fence + '\n' + message, true, ''],
  ['artifact-current-think-prefix', '<think>\n中性思考\n</think>\n\n' + message, true, '中性思考'],
  ['artifact-current-user-macro-prefix', '<think>\n宏字面量{{user}}\n</think>\n\n' + message, true, '宏字面量{{user}}'],
]) {
  rules[2].replaceString = artifactStyleReplacement; mediaAllowed = allowed;
  const html = context.messageFormatting(text, 'Neutral', false, false, 1);
  body.innerHTML = html; const before = probe(), prefixRetained = !expectedPrefix || body.textContent.includes(expectedPrefix);
  context.segmentTextInElement(body, html); const after = probe();
  cases.push({ name, before, after, prefixRetained }); browserFixtures.push({ name, html });
}
for (const [name, replacement, allowed] of [['bare-allowed', bareStyle, true],
  ['pre-hidden-allowed', '<pre hidden>' + bareStyle + '</pre>', true],
  ['pre-hidden-media-blocked', '<pre hidden>' + bareStyle + '</pre>', false],
  ['code-hidden-allowed', '<div><code hidden>' + bareStyle + '</code></div>', true]]) {
  rules[2].replaceString = replacement + '\n\n'; mediaAllowed = allowed;
  const html = context.messageFormatting(message, 'Neutral', false, false, 1);
  body.innerHTML = html; const before = probe(); context.segmentTextInElement(body, html); const after = probe();
  cases.push({ name, before, after }); browserFixtures.push({ name, html });
}
rules[2].replaceString = bareStyle + '\n\n'; mediaAllowed = true;
for (const [name, text] of [['closed-fence-elsewhere', message + '\n\n' + fence + '\n中性代码\n' + fence],
  ['ordinary-details', '<details><summary>选项</summary>\n' + message + '\n</details>'],
  ['parallel-details', '<details><summary>平行线事件</summary>\n' + message + '\n</details>'],
  ['div-context', '<div>\n' + message + '\n</div>'], ['span-context', '<span>\n' + message + '\n</span>']]) {
  body.innerHTML = context.messageFormatting(text, 'Neutral', false, false, 1); cases.push({ name, formatted: probe() });
}
for (const [name, text] of [['bare-style-in-div', '<div><style>.foo{color:red}</style><span class="foo" style="color:blue">OK</span></div>'],
  ['bare-style-in-span', '<span><style>.foo{color:red}</style><span class="foo" style="color:blue">OK</span></span>'],
  ['attribute-style-in-div', '<div><style data-test="neutral">.foo{color:red}</style><span class="foo" style="color:blue">OK</span></div>'],
  ['bare-style-at-root', '<style>.foo{color:red}</style><span class="foo">OK</span>'],
  ['attribute-style-at-root', '<style data-test="neutral">.foo{color:red}</style><span class="foo">OK</span>']]) {
  const html = context.messageFormatting(text, 'Neutral', false, false, 1); body.innerHTML = html;
  cases.push({ name, formatted: probe(), neutralHtml: html });
}
let izumiEvidence;
if (arg('--izumi-rule')) {
  const bytes = fs.readFileSync(arg('--izumi-rule')), rule = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  if (rule.id !== 'a1a57b61-8f66-4956-bd0c-386c0356e232') throw new Error('Unexpected Izumi rule ID');
  const neutral = '<think>中性思考。</think>\n<konatan_planning~>中性计划。</konatan_planning~>\n史黛菈:中性正文。';
  const getRegexedString = context.getRegexedString;
  // Only a pure text replacement from the supplied rule; no preset prompts or
  // HTML scripts are executed. Host sanitization explicitly forbids scripts.
  context.getRegexedString = text => text;
  mediaAllowed = true;
  const derivedBareReplacement = rule.replaceString.replaceAll(/<pre\b(?=[^>]*\bhidden\b)[^>]*>\s*(<style>[\s\S]*?<\/style>)\s*<\/pre>/gi, '$1');
  for (const [name, replacement] of [
    ['izumi-artifact-current', rule.replaceString],
    ['izumi-original-bare-style', derivedBareReplacement],
    ['izumi-pre-hidden-style', derivedBareReplacement.replaceAll(/(<style>[\s\S]*?<\/style>)/gi, '<pre hidden>$1</pre>')],
  ]) {
    const text = context.runRegexScript({ ...rule, replaceString: replacement }, neutral);
    const html = context.messageFormatting(text, 'Neutral', false, false, 1, { FORBID_TAGS: ['script', 'iframe'] });
    body.innerHTML = html; const before = probe(); context.segmentTextInElement(body, html); const after = probe();
    if (before.scripts || after.scripts) throw new Error('Untrusted HTML script survived fixture sanitization');
    cases.push({ name, before, after, textReplacementScriptCount: (text.match(/<script\b/gi) ?? []).length });
    browserFixtures.push({ name, html });
  }
  context.getRegexedString = getRegexedString;
  const original = cases.find(item => item.name === 'izumi-original-bare-style');
  const wrapped = cases.find(item => item.name === 'izumi-pre-hidden-style');
  if (!(original.before.konataRules > 0 && original.after.konataRules === 0 && wrapped.after.konataRules === wrapped.before.konataRules &&
    wrapped.after.styleChildren === 0 && JSON.stringify(original.before.neutralOrder) === JSON.stringify(wrapped.before.neutralOrder))) {
    throw new Error('Izumi style/protected neutral content replay changed');
  }
  const current = cases.find(item => item.name === 'izumi-artifact-current');
  if (!artifactRef && !(current.before.konataRules > 0 && current.after.konataRules === current.before.konataRules &&
    current.after.styleChildren === 0 && current.before.hiddenContainers === 1 &&
    JSON.stringify(current.before.neutralOrder) === JSON.stringify(current.after.neutralOrder))) {
    throw new Error('Delivered Izumi addon failed style/fade rendering');
  }
  izumiEvidence = { id: rule.id, ruleSha256: hash(bytes), replacementSha256: hash(rule.replaceString),
    derivedBareReplacementSha256: hash(derivedBareReplacement),
    fixture: neutral, executedPresetScripts: false, scriptsExplicitlyForbiddenBeforeBrowserInsertion: true };
}
let izumiLocalEvidence;
if (arg('--izumi-preset') || arg('--izumi-local-dir')) {
  if (!arg('--izumi-preset') || !arg('--izumi-local-dir') || artifactRef) {
    throw new Error('Local Izumi replay requires both --izumi-preset and --izumi-local-dir, with working-tree core artifacts');
  }
  const presetBytes = fs.readFileSync(arg('--izumi-preset'));
  const preset = JSON.parse(presetBytes.toString('utf8').replace(/^\uFEFF/, ''));
  const originalRules = preset.extensions?.regex_scripts ?? preset.data?.extensions?.regex_scripts;
  if (!Array.isArray(originalRules) || !originalRules.some(rule => rule.id === 'a1a57b61-8f66-4956-bd0c-386c0356e232')) {
    throw new Error('Expected original Izumi regex data');
  }
  const originalCanonical = JSON.stringify(originalRules);
  const localNames = ['izumi-local-prefix', 'izumi-local-style', 'izumi-local-planning-close'];
  const localBytes = localNames.map(name => fs.readFileSync(path.join(arg('--izumi-local-dir'), name + '.regex.json')));
  const localRules = localBytes.map(bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')));
  const coreRules = artifactTexts.map(text => JSON.parse(text));
  const simpleGetRegexedString = context.getRegexedString;
  context.getRegexedString = registryGetRegexedString;
  context.getPresetManager = () => ({ readPresetExtensionField: () => originalRules });
  const scope = scripts => { context.characters[0].data.extensions.regex_scripts = scripts; };
  const format = (text, local, duplicateLocal = false) => {
    scope(local ? [...localRules, ...(duplicateLocal ? localRules : []), ...coreRules] : coreRules);
    return context.messageFormatting(text, 'Neutral', false, false, 1, { FORBID_TAGS: ['script', 'iframe'] });
  };
  const chainProbe = () => ({ ...probe(), ...scopeStyleProbe() });
  const npc = '史黛菈:中性正文。', plan = '<konatan_planning~>中性计划。</konatan_planning~>';
  const fixtures = [
    ['izumi-chain-without-local', plan + '\n\n' + npc, false, true, false, null],
    ['izumi-chain-planning', plan + '\n\n' + npc, true, true, false, 1],
    ['izumi-chain-think-planning', '<think>中性思考。</think>\n' + plan + '\n\n' + npc, true, true, false, 1],
    ['izumi-chain-options', plan + '\n\n<options>\n1. 中性选项一\n2. 中性选项二\n</options>\n\n' + npc, true, true, false, 1],
    ['izumi-chain-literal-macro', plan + '\n\n<details><summary>中性说明</summary>宏字面量{{user}}</details>\n\n' + npc, true, true, false, 1],
    ['izumi-chain-unclosed-raw-planning', '<konatan_planning~>中性计划。\n' + npc, true, true, false, 0],
    ['izumi-chain-repeat-local', plan + '\n\n' + npc, true, true, true, 1],
    ['izumi-chain-media-blocked', plan + '\n\n' + npc, true, false, false, 1],
  ];
  for (const [name, neutral, local, allowed, duplicateLocal, expectedBubbles] of fixtures) {
    mediaAllowed = allowed;
    const html = format(neutral, local, duplicateLocal);
    const htmlAgain = format(neutral, local, duplicateLocal);
    const duplicateLocalIdentical = !duplicateLocal || html === format(neutral, true, false);
    body.innerHTML = html; const before = chainProbe();
    context.segmentTextInElement(body, html); const after = chainProbe();
    const item = { name, fixture: neutral, localEnabled: local, duplicateLocal, before, after,
      repeatedRenderIdentical: html === htmlAgain, duplicateLocalIdentical, sanitizedHtmlSha256: hash(html) };
    if (before.scripts || after.scripts) throw new Error('Preset script survived local-chain sanitization');
    localCheck(!(expectedBubbles !== null && (before.bodyBubbles !== expectedBubbles || after.bodyBubbles !== expectedBubbles ||
      before.planningBubbles || after.planningBubbles || !item.repeatedRenderIdentical || !duplicateLocalIdentical ||
      JSON.stringify(before.neutralOrder) !== JSON.stringify(after.neutralOrder))),
      'Local Izumi body/protected planning/repeat regression: ' + JSON.stringify(item));
    localCheck(!(local && expectedBubbles > 0 && (before.konataRules === 0 || before.konataRules !== after.konataRules ||
      JSON.stringify(before.styleRuleCounts) !== JSON.stringify(after.styleRuleCounts) || after.styleChildrenTotal !== 0 ||
      before.bubbleStyleRules.length !== 1 || before.thinkingStyleRules.length !== 1 ||
      before.bubbleStylesHidden !== 1 || before.thinkingStylesHidden !== 1 ||
      before.bubbleStyleRules[0] !== (allowed ? 40 : 9) || before.thinkingStyleRules[0] <= 0)),
      'Local Izumi style/fade regression: ' + name);
    localCheck(name !== 'izumi-chain-literal-macro' || after.literalMacroPreserved, 'Local addon expanded literal body macro');
    localCheck(allowed || !(before.allImageMapping || after.allImageMapping), 'Local addon bypassed media policy');
    cases.push(item); browserFixtures.push({ name, html });
  }
  // The same public preset remains selected for another character. Its scoped
  // scripts are ineligible, so adding our local rules must not change its output.
  context.characters[0].avatar = 'other-card.png'; mediaAllowed = true;
  scope([...localRules, ...coreRules]);
  const activeOtherRules = context.getRegexScripts({ allowedOnly: true });
  const activeAddonCount = activeOtherRules.filter(rule => localRules.some(localRule => localRule.id === rule.id)).length;
  if (activeAddonCount !== 0) throw new Error('Current-card addon eligible on another card');
  const otherInput = plan + '\n\n' + npc;
  const otherWithLocal = context.messageFormatting(otherInput, 'Neutral', false, false, 1, { FORBID_TAGS: ['script', 'iframe'] });
  scope([]);
  const otherWithoutLocal = context.messageFormatting(otherInput, 'Neutral', false, false, 1, { FORBID_TAGS: ['script', 'iframe'] });
  if (otherWithLocal !== otherWithoutLocal) throw new Error('Current-card addon changed another card');
  body.innerHTML = otherWithLocal; const otherBefore = chainProbe();
  context.segmentTextInElement(body, otherWithLocal); const otherAfter = chainProbe();
  if (otherBefore.scripts || otherAfter.scripts) throw new Error('Preset script survived other-card sanitization');
  cases.push({ name: 'izumi-chain-other-card', fixture: otherInput, localEligible: false,
    activeAddonCount, outputIdenticalWithAndWithoutLocal: true, before: otherBefore, after: otherAfter });
  browserFixtures.push({ name: 'izumi-chain-other-card', html: otherWithLocal });
  context.characters[0].avatar = 'neutral.png';
  context.getPresetManager = () => ({ readPresetExtensionField: () => [] });
  scope(coreRules);
  for (const [name, neutral, expectedBubbles] of [
    ['core-closed-fence-options-literal', fence + 'html\n<options>\n' + fence + '\n\n' + npc, 1],
    ['core-real-unclosed-options-across-fence', '<options>\n' + fence + 'html\n中性代码\n' + fence + '\n\n' + npc, 0],
  ]) {
    const html = context.messageFormatting(neutral, 'Neutral', false, false, 1, { FORBID_TAGS: ['script', 'iframe'] });
    body.innerHTML = html; const before = chainProbe();
    context.segmentTextInElement(body, html); const after = chainProbe();
    localCheck(before.bodyBubbles === expectedBubbles && after.bodyBubbles === expectedBubbles &&
      (expectedBubbles === 0 || (before.bubbleStyleRules[0] === 40 && after.bubbleStyleRules[0] === 40 && after.styleChildrenTotal === 0)),
      'Independent core fence/context regression: ' + name);
    cases.push({ name, fixture: neutral, thirdPartyRegex: false, expectedBodyBubbles: expectedBubbles, before, after });
    browserFixtures.push({ name, html });
  }
  scope([]); context.getRegexedString = simpleGetRegexedString;
  if (JSON.stringify(originalRules) !== originalCanonical) throw new Error('Original preset rules changed during replay');
  izumiLocalEvidence = { presetSha256: hash(presetBytes), originalRulesSha256: hash(originalCanonical),
    originalRulesCanonicalUnchanged: true,
    templateScope: { supportedRuleId: 'a1a57b61-8f66-4956-bd0c-386c0356e232',
      supportedReplacementSha256: '36a1ab14368980692e15879b9cd06bb22ed1c004266fdc745700ae572956d062',
      unknownSourceTemplateRejectedByBuilder: true, arbitraryPresetRevisionsAccepted: false,
      runtimeRepair: 'Only known fixed template bytes and owned boundaries; unknown runtime revisions remain unchanged/fail closed' },
    originalRuleCount: originalRules.length, originalRules: originalRules.map(rule => ({ id: rule.id,
      disabled: !!rule.disabled, markdownOnly: !!rule.markdownOnly, promptOnly: !!rule.promptOnly,
      placement: rule.placement, minDepth: rule.minDepth, maxDepth: rule.maxDepth,
      ruleSha256: hash(JSON.stringify(rule)) })),
    localArtifacts: Object.fromEntries(localNames.map((name, i) => [name, { id: localRules[i].id, sha256: hash(localBytes[i]) }])),
    chain: ['original preset regex data (PRESET, unchanged)', 'local compatibility 01/02/03 (SCOPED)', 'core 01/02/03 (SCOPED)'],
    registryAndEligibility: 'Actual pinned getRegexScripts/getScriptsByType/getRegexedString; Markdown display, placement=2, depth=0 (latest assistant floor), both scopes allowed',
    executedPresetScripts: false, scriptsExplicitlyForbiddenBeforeBrowserInsertion: true };
}
const bare = cases.find(item => item.name === 'bare-allowed');
const protectedStyle = cases.find(item => item.name === 'pre-hidden-allowed');
const blocked = cases.find(item => item.name === 'pre-hidden-media-blocked');
if (!(bare.before.styleRules > 0 && bare.after.styleRules === 0 && protectedStyle.before.styleRules > 0 &&
  protectedStyle.before.styleRules === protectedStyle.after.styleRules && protectedStyle.after.styleChildren === 0 &&
  !blocked.before.imageMapping && !blocked.after.imageMapping)) throw new Error('Pinned style/fade/media replay changed');
if (!artifactRef) {
  for (const name of ['artifact-current', 'artifact-current-closed-fence-prefix', 'artifact-current-think-prefix', 'artifact-current-user-macro-prefix']) {
    const item = cases.find(candidate => candidate.name === name);
    if (!(item.before.bubbles === 1 && item.before.styleRules > 0 && item.after.styleRules === item.before.styleRules &&
      item.after.styleChildren === 0 && item.after.hiddenContainers === 1 && item.prefixRetained)) {
      throw new Error('Delivered artifact failed host rendering/fade: ' + name);
    }
  }
  const insideFence = cases.find(item => item.name === 'artifact-current-unclosed-fence');
  const currentBlocked = cases.find(item => item.name === 'artifact-current-media-blocked');
  if (insideFence.before.bubbles !== 0 || insideFence.before.styleCount !== 0 || currentBlocked.before.bubbles !== 1 ||
    currentBlocked.before.imageMapping || currentBlocked.after.imageMapping || currentBlocked.after.styleChildren !== 0) {
    throw new Error('Delivered artifact failed fence/media policy');
  }
}
const report = { schemaVersion: 1, date: new Date().toISOString(), hostVersion: '1.18.0', artifactRef: artifactRef ?? 'working-tree',
  replayProgramSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
  ...(izumiEvidence ? { izumiEvidence } : {}),
  ...(izumiLocalEvidence ? { izumiLocalEvidence } : {}),
  sources: Object.fromEntries(sourceFiles.map(file => [file, { sha256LF: hash(sources[file]) }])),
  dependencies: dependencies.map(([name, version, url], i) => ({ name, version, url, sha256: hash(code[i]) })),
  jsdomVersion: '29.1.1', artifacts: Object.fromEntries(artifactNames.map((name, i) => [name, { id: rules[i].id, sha256: hash(artifactTexts[i]) }])),
  neutralMessage: message, cases, validationFailures,
  limits: ['Not a complete ST runtime: arbitrary macros and other extensions are outside this replay. Local Izumi cases replay actual registry ordering and display/depth eligibility; legacy comparison cases directly run supplied rules.',
    'Actual pinned host functions are used; settings and read-only user macro are supplied by the fixture.',
    'jsdom CSSOM replay is distinct from browser verification; isolated browser results are recorded separately.',
    'Original options HTML remains inert fenced code in the host replay; Tavern Helper iframe/option interactions and scripts are not exercised.',
    'Character-local Izumi compatibility is limited to the known template hash, not permanent compatibility with all preset revisions.',
    'No third-party preset/option scripts are executed; no host-head injection or media-policy bypass is applied.'] };
if (args.includes('--write')) {
  const name = arg('--report-name') ?? 'host-render-replay.json';
  if (path.basename(name) !== name || !name.endsWith('.json')) throw new Error('--report-name must be a JSON filename');
  fs.writeFileSync(path.join(here, '验证记录', name), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
if (validationFailures.length) process.exitCode = 1;
if (args.includes('--serve')) {
  const browserCode = functionSource('public/scripts/util/stream-fadein.js', 'segmentTextInElement');
  const parserCode = functionSource('public/scripts/utils.js', 'regexFromString');
  const neutralNpc = '史黛菈:中性正文。';
  const coldFixtures = [
    { name: 'cold-ordinary', text: neutralNpc, expectedCount: 1 },
    { name: 'cold-closed-fence-options-literal', text: fence + 'html\n<options>\n' + fence + '\n\n' + neutralNpc, expectedCount: 1 },
    { name: 'cold-real-unclosed-options-across-fence', text: '<options>\n' + fence + 'html\n中性代码\n' + fence + '\n\n' + neutralNpc, expectedCount: 0 },
  ];
  const coreData = artifactTexts.map(text => JSON.parse(text));
  const coldEvidence = { ruleId: coreData[0].id, parserSourceSha256LF: hash(sources['public/scripts/utils.js']),
    artifacts: Object.fromEntries(artifactNames.map((name, i) => [name, { id: coreData[i].id, sha256: hash(artifactTexts[i]),
      findRegexSha256: hash(coreData[i].findRegex) }])),
    neutralFindRegexSha256: hash(coreData[0].findRegex.replaceAll('{{user}}', '(?!)')),
    userMacro: 'Replaced literally by (?!) for a neutral no-persona probe; no macro engine or preset scripts run',
    sourceDataContainsThreeFinalCoreFindAndReplace: true, firstCorePatternExecutionInPage: true };
  const html = '<!doctype html><meta charset="UTF-8"><title>ST 1.18 pipeline CSS proof</title><div class="mes_text"></div><pre id="results"></pre><script>' +
    'const fixtures=' + JSON.stringify(browserFixtures).replaceAll('<', '\\u003c') +
    ',coreData=' + JSON.stringify(coreData).replaceAll('<', '\\u003c') +
    ',coldFixtures=' + JSON.stringify(coldFixtures).replaceAll('<', '\\u003c') +
    ',coldEvidence=' + JSON.stringify(coldEvidence).replaceAll('<', '\\u003c') + ';' + parserCode +
    ';const coldRegex={...coldEvidence,cases:coldFixtures.map(f=>{const start=performance.now(),regex=regexFromString(coreData[0].findRegex.replaceAll("{{user}}","(?!)")),actualCount=regex?[...f.text.matchAll(regex)].length:0;return {name:f.name,expectedCount:f.expectedCount,actualCount,passed:actualCount===f.expectedCount,parsed:!!regex,coldMs:performance.now()-start};})};' +
    ';function isSegmenterSupported(){return typeof Intl.Segmenter==="function";}' + browserCode +
    ';const body=document.querySelector(".mes_text"),w=window;' + probe.toString() + scopeStyleProbe.toString() +
    ';function browserProbe(){const base=probe(),s=body.querySelector("style"),b=body.querySelector("[data-rkd=bubble]"),a=body.querySelector("[data-rkd-avatar]"),k=body.querySelector(".custom-konata-thinking-wrapper"),c=body.querySelector(".custom-konata-thinking-content");return {...base,...scopeStyleProbe(),firstChildType:s?.firstChild.nodeType??null,hiddenContainerDisplay:getComputedStyle(body.querySelector("pre[hidden],code[hidden]")||document.getElementById("results")).display,styleHiddenContainerDisplays:[...body.querySelectorAll("style")].map(style=>{const parent=style.closest("pre[hidden],code[hidden]");return parent?getComputedStyle(parent).display:null;}),image:a?getComputedStyle(a,"::after").backgroundImage:null,bubbleDisplay:b?getComputedStyle(b).display:null,thinkingWrapperTop:k?.getBoundingClientRect().y??null,thinkingContentTop:c?.getBoundingClientRect().y??null,thinkingContentDisplay:c?getComputedStyle(c).display:null};}' +
    'const cases=fixtures.map(f=>{body.innerHTML=f.html;for(const d of body.querySelectorAll("details.custom-konata-thinking-details"))d.open=true;const prepared=body.innerHTML;const before=browserProbe();segmentTextInElement(body,prepared);const after=browserProbe();return {name:f.name,before,after};});body.innerHTML="";document.getElementById("results").textContent=JSON.stringify({userAgent:navigator.userAgent,coldRegex,cases},null,2);</script>';
  const port = Number(arg('--port') ?? 18976);
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(html); });
  server.listen(port, '127.0.0.1', () => console.log('Memory-only browser fixture: http://127.0.0.1:' + port + '/'));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}
