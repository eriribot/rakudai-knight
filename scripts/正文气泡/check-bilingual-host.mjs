// Execute the installed ST regex engine with neutral fixtures; no chat or config writes.
// --preset optionally supplies the current preset's regex list as data only.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildRules, formatRule } from './build.mjs';

const args = process.argv.slice(2);
const arg = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const stRoot = arg('--st-root') || process.env.ST_SOURCE_ROOT;
if (!stRoot) throw new Error('Required: --st-root <installed SillyTavern 1.19.0>');
const read = file => fs.readFileSync(file, 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const version = JSON.parse(read(path.join(stRoot, 'package.json'))).version;
assert.equal(version, '1.19.0', 'review the real engine before changing the pinned version');
const engineBytes = read(path.join(stRoot, 'public/scripts/extensions/regex/engine.js'));
const utilsBytes = read(path.join(stRoot, 'public/scripts/utils.js'));
const start = utilsBytes.indexOf('export function regexFromString(');
const end = utilsBytes.indexOf('\n}', start);
assert.ok(start >= 0 && end > start);
const regexSource = utilsBytes.slice(start, end + 2).replace(/^export /, '');
const engineSource = engineBytes.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
const presetPath = arg('--preset');
const preset = presetPath ? JSON.parse(read(presetPath)) : {};
const presetRules = preset.extensions?.regex_scripts || [];
const rules = buildRules(), avatar = 'neutral-bilingual-fixture.png';
const substitute = (value, _parameters, sanitize) => String(value).replaceAll('{{user}}', sanitize ? sanitize('中性玩家') : '中性玩家');
const realm = vm.createContext({
  console: { warn() {}, debug() {} },
  characters: [{ avatar, data: { extensions: { regex_scripts: rules } } }], this_chid: 0,
  extension_settings: { disabledExtensions: [], regex: [], character_allowed_regex: [avatar], preset_allowed_regex: { openai: ['fixture-preset'] } },
  getPresetManager: () => ({ apiId: 'openai', getSelectedPresetName: () => 'fixture-preset', readPresetExtensionField: () => presetRules }),
  substituteParams: substitute, substituteParamsExtended: substitute,
  saveSettingsDebounced() { throw new Error('read-only fixture'); },
  writeExtensionField() { throw new Error('read-only fixture'); }, lodash: {},
});
vm.runInContext(regexSource + '\n' + engineSource + '\nglobalThis.renderRegex = getRegexedString;', realm);
const render = input => realm.renderRegex(input, 2, { isMarkdown: true, depth: 0 });
const speakers = output => [...output.matchAll(/<div data-rkd="bubble" data-rkd-name="([^"]+)"/g)].map(match => match[1]);
const countStyles = output => (output.match(/<style>\/\* rkd-dialogue-style:/g) || []).length;
const cases = [];
function check(name, run) {
  try { run(); cases.push({ name, passed: true }); }
  catch (error) { cases.push({ name, passed: false, error: error.message }); }
}
const anonymous = '☆‹「こんにちは」›\n"你好。"';
const named = '☆‹「こちらへどうぞ」›\n克劳蒂雅:「请往这边走。」\n\n☆‹「ありがとうございます」›\n天雾绫斗:「谢谢。」';
check('匿名双语保持原文，不猜说话人，也不注入样式', () => {
  const output = render(anonymous);
  assert.equal(output, anonymous); assert.deepEqual(speakers(output), []); assert.equal(countStyles(output), 0);
});
check('明确中文姓名的克劳蒂雅与天雾绫斗各形成气泡，日文保留', () => {
  const output = render(named);
  assert.deepEqual(speakers(output), ['克劳蒂雅', '天雾绫斗']); assert.equal(countStyles(output), 1);
  for (const line of named.split('\n').filter(line => line.startsWith('☆‹'))) assert.ok(output.includes(line));
});
check('相邻旁白里出现姓名不会给匿名引号补说话人', () => {
  const input = '☆‹クローディアは綾斗を見た。›\n克劳蒂雅看向天雾绫斗。\n\n' + anonymous;
  assert.equal(render(input), input); assert.deepEqual(speakers(render(input)), []);
});
check('双语旁白与招牌独立保留，不生成气泡或候选', () => {
  const input = '☆‹廊下は静かだった。›\n走廊里很安静。\n\n☆‹『装備局』›\n『装备局』';
  assert.equal(render(input), input); assert.deepEqual(speakers(render(input)), []);
});
check('完整驱动内的姓名行不变成气泡，外部两个中文对白正常显示', () => {
  const input = '<story_driver>\n克劳蒂雅:这里只是驱动测试文本。\n天雾绫斗:这里也是驱动测试文本。\n</story_driver>\n\n' + named;
  const output = render(input);
  assert.deepEqual(speakers(output), ['克劳蒂雅', '天雾绫斗']); assert.equal(countStyles(output), 1);
  assert.ok(output.includes('克劳蒂雅:这里只是驱动测试文本。'));
  assert.ok(output.includes('天雾绫斗:这里也是驱动测试文本。'));
});
check('未闭驱动中的双语对白保持保护，不套气泡', () => {
  const input = '<story_driver>\n' + named;
  assert.equal(render(input), input); assert.deepEqual(speakers(render(input)), []);
});
check('思考和变量块中的姓名行保持原文', () => {
  const input = '<thinking>\n克劳蒂雅:思考测试文本。\n</thinking>\n<UpdateVariable>\n天雾绫斗:变量测试文本。\n</UpdateVariable>';
  assert.equal(render(input), input); assert.deepEqual(speakers(render(input)), []);
});
check('维护合同包含可渲染的双语示例与叙述边界', () => {
  assert.ok(formatRule.includes('中文对白必须独立写成“姓名:台词”'));
  assert.ok(formatRule.includes('不要从附近出现的人名推断匿名台词属于谁'));
  assert.ok(formatRule.includes(named));
});
const report = {
  schemaVersion: 1, passed: cases.filter(item => item.passed).length, total: cases.length,
  runtime: { version, engineSha256: hash(engineBytes), regexParserSha256: hash(regexSource),
    mode: 'actual installed regex engine in an isolated Node VM; neutral fixtures only',
    presetRegexCount: presetRules.length, presetRegexSha256: hash(JSON.stringify(presetRules)),
    numericPlacement: 2, destination: 'display', depth: 0,
    limitation: 'only the user macro is stubbed; no browser, Markdown, prompt generation or compliance proof' },
  cases,
};
const reportPath = arg('--report');
if (reportPath) { fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify(report, null, 2));
if (report.passed !== report.total) process.exitCode = 1;
