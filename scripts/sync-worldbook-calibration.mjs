import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { INITIAL_STATE, RELATIONSHIP_SCORING } from '../世界书规则/MVU/schema.mjs';
import { inlineStoryCatalog, inlineTournamentSource, stripModuleSyntax } from './story-build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'output/worldbook-calibration/dev/package.json'));
const YAML = require('yaml');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const target = '世界书规则/v0.3/导出/落第骑士英雄谭.json';
// 组件模式仅构建字段约束；不读取、同步或导出整本世界书。
const scriptOnly = process.argv.includes('--script-only');
const original = scriptOnly ? '' : read(target);
const book = scriptOnly ? null : JSON.parse(original);
const before = scriptOnly ? null : structuredClone(book);
const mvuOnly = process.argv.includes('--mvu-only');
const withInit = process.argv.includes('--with-init');
if (scriptOnly && (mvuOnly || withInit)) throw new Error('--script-only 不能与世界书/初始化同步选项合用');
if (withInit && !mvuOnly) throw new Error('--with-init 仅能配合 --mvu-only，用于只同步规则与初始化');
const mappings = [
  [9, '第一卷-世界书整理/人物条目/黑铁一辉.md', 'xml'],
  [11, '第一卷-世界书整理/人物条目/史黛菈·法米利昂.md', 'xml'],
  [12, '第一卷-世界书整理/人物条目/新宫寺黑乃.md', 'xml'],
  [10, '世界书规则/MVU/变量更新规则.txt', 'text'],
  [13, '世界书规则/v0.3/10_序章场景.md', 'body'],
  [15, '世界书规则/v0.3/09_第一章场景.md', 'body'],
];
function body(file, type) {
  const source = read(file);
  if (type === 'text') return source.trim();
  const matches = [...source.matchAll(type === 'xml' ? /```xml\n([\s\S]*?)\n```/g : /<!-- 正文开始 -->\n([\s\S]*?)\n<!-- 正文结束 -->/g)];
  if (matches.length !== 1) throw new Error(`${file} 正文边界不唯一`);
  return matches[0][1].trim();
}
let yaml;
if (!scriptOnly) {
if (mvuOnly) {
  if (!book.entries[10] || book.entries[10].uid !== 10) throw new Error('缺少预期 MVU 更新规则 UID 10');
  book.entries[10].content = body('世界书规则/MVU/变量更新规则.txt', 'text');
  if (withInit) {
    if (!book.entries[3] || book.entries[3].uid !== 3) throw new Error('缺少预期初始化 UID 3');
    yaml = YAML.stringify(INITIAL_STATE, { lineWidth: 0 });
    book.entries[3].content = yaml.trim();
  }
} else {
for (const [id, file, type] of mappings) {
  if (!book.entries[id] || book.entries[id].uid !== id) throw new Error(`缺少预期 UID ${id}`);
  book.entries[id].content = body(file, type);
}
// 卷章概要由统一目录注入；旧场景正文留存，仅停用关键字触发。
for (const id of [13, 15]) {
  book.entries[id].disable = true;
  book.entries[id].key = [];
  book.entries[id].keysecondary = [];
}
yaml = YAML.stringify(INITIAL_STATE, { lineWidth: 0 });
book.entries[3].content = yaml.trim();
// 初始化条目的 disable 等宿主约定保持原值，不把禁用状态误改成常驻提示词。
const additions = [
  ['能力与招式', '世界书规则/v0.3/07_能力与招式.md', 107],
  ['第一卷文风', '世界书规则/v0.3/06_第一卷文风.md', 109],
];
for (const [uid, entry] of Object.entries(book.entries)) {
  if (entry.comment === '第一卷剧情控制') {
    delete book.entries[uid];
  }
}
for (const [name, file, order] of additions) {
  let entry = Object.values(book.entries).find(entry => entry.comment === name);
  if (!entry) {
    const uid = Math.max(...Object.values(book.entries).map(entry => entry.uid)) + 1;
    entry = { ...structuredClone(book.entries[0]), uid, displayIndex: uid, comment: name, key: [], keysecondary: [], constant: true, disable: false, order };
    book.entries[uid] = entry;
  }
  entry.content = body(file, 'body');
}
const plotAdditions = [
  ['[剧情]第一卷.第二章', '世界书规则/v0.3/08_第二章场景.md', 102],
  ['[剧情]第一卷.第三章', '世界书规则/v0.3/11_第三章场景.md', 103],
  ['[剧情]第一卷.第四章', '世界书规则/v0.3/12_第四章场景.md', 104],
  ['[剧情]第一卷.终章', '世界书规则/v0.3/13_终章场景.md', 105],
];
for (const [name, file, order] of plotAdditions) {
  let entry = Object.values(book.entries).find(entry => entry.comment === name);
  if (!entry) {
    const uid = Math.max(...Object.values(book.entries).map(entry => entry.uid)) + 1;
    entry = { ...structuredClone(book.entries[13]), uid, displayIndex: uid, comment: name, key: [], keysecondary: [], constant: false, disable: true, order };
    book.entries[uid] = entry;
  }
  entry.content = body(file, 'body');
  entry.disable = true;
  entry.order = order;
  entry.key = [];
  entry.keysecondary = [];
}
// 仅纠正能力本质与招式被写成同一概念的短语，保留此条其他用户内容。
book.entries[0].content = book.entries[0].content.replace('并以此为媒介行使异能〈伐刀绝技（Noble Arts）〉', '运用魔力施展伐刀能力，并将其发展为各具条件的伐刀技（Noble Arts）');
}
// 提示词只发状态副本，不把事件正文及结算记录常驻重放；条目配置与ID保持。
if (book.entries[8]?.comment !== '[MVU]变量列表') throw new Error('变量列表 UID 8 不符，未同步');
book.entries[8].content = body('世界书规则/MVU/变量列表.txt', 'text');
// 旧命名条目仍常驻会同时喂入相反的 G02 规则；保留原文归档，仅停用旧条目。
const legacyFormats = Object.values(book.entries).filter(entry => entry.comment === '[MVU]变量更新格式');
for (const entry of legacyFormats) entry.disable = true;
const outputFormatName = '[MVU]变量输出格式';
const outputFormatMatches = Object.entries(book.entries).filter(([, entry]) => entry.comment === outputFormatName);
if (outputFormatMatches.length > 1) throw new Error('MVU 变量输出格式条目不唯一');
let outputFormatKey, outputFormatEntry;
if (outputFormatMatches.length) {
  [outputFormatKey, outputFormatEntry] = outputFormatMatches[0];
} else {
  if (!book.entries[10] || book.entries[10].uid !== 10) throw new Error('缺少可复制配置的 MVU 更新规则 UID 10');
  const uid = Math.max(...Object.values(book.entries).map(entry => entry.uid)) + 1;
  outputFormatKey = String(uid);
  outputFormatEntry = { ...structuredClone(book.entries[10]), uid, displayIndex: uid, comment: outputFormatName };
  book.entries[outputFormatKey] = outputFormatEntry;
}
Object.assign(outputFormatEntry, {
  content: body('世界书规则/MVU/变量输出格式.txt', 'text'),
  order: 397, constant: true, disable: false,
});
if (mvuOnly) {
  const unchanged = structuredClone(book);
  unchanged.entries[10].content = before.entries[10].content;
  unchanged.entries[8].content = before.entries[8].content;
  for (const entry of legacyFormats) unchanged.entries[entry.uid].disable = before.entries[entry.uid].disable;
  if (Object.hasOwn(before.entries, outputFormatKey)) unchanged.entries[outputFormatKey] = structuredClone(before.entries[outputFormatKey]);
  else delete unchanged.entries[outputFormatKey];
  if (withInit) unchanged.entries[3].content = before.entries[3].content;
  assert.deepEqual(unchanged, before, withInit ? '--mvu-only --with-init 只允许改变 UID 3、UID 8、UID 10 的正文、停用旧格式条目及 MVU 输出格式条目' : '--mvu-only 只允许改变 UID 8、UID 10 的正文、停用旧格式条目及 MVU 输出格式条目');
}
}
const changed = scriptOnly ? [] : Object.values(book.entries).filter(entry => JSON.stringify(entry) !== JSON.stringify(before.entries[entry.uid])).map(entry => ({ uid: entry.uid, name: entry.comment }));
const rendered = scriptOnly ? '' : JSON.stringify(book, null, 2) + '\n';
const tournamentSource = inlineTournamentSource();
const schemaSource = stripModuleSyntax(read('世界书规则/MVU/schema.mjs'));
const stateSource = stripModuleSyntax(read('scripts/rakudai-state-core.mjs'));
const structureSource = stripModuleSyntax(read('scripts/rakudai-mvu-structure.mjs'));
const replySource = stripModuleSyntax(read('scripts/rakudai-mvu-reply-source.mjs'));
const guardSource = read('scripts/rakudai-mvu-guard.js');
const bootstrapSource = read('scripts/rakudai-mvu-bootstrap.js');
const scriptContent = `${inlineStoryCatalog()}\n${tournamentSource}\n${structureSource}\n${schemaSource}\n${stateSource}\n${replySource}\n${guardSource}
// 注册字段校验与写入责任保护；不自动转换旧楼层。
${bootstrapSource}
void bootRakudaiMvuGuard();
`;
const generatedScript = {
  type: 'script', enabled: true, name: '落第骑士·MVU v4 字段与卷章约束 [G04/T02/R01]', id: '06117475-a08c-4d78-a886-3d26426c4b37', content: scriptContent,
  info: '终值成长 final-values-v1：主副API直接提交玩家.成长.经验与六维终值，新奖励不写成长申请。此约束可选，开启后核对字段并按准确门槛校正连续晋级与余量，经验终值不按旧申请9999上限截断，S档保留余额；旧申请原样留档不兑现，旧收据与成长历史保留，终值重放不二次晋级。关闭约束时由主API计算经验、评级与余量。升级后关闭旧独立成长G04。启动诊断R01有限等待依赖并明确失败原因。选拔赛T02兼容T01账本，依据2013年剧情日期与实际赛果重算；实际OC获胜覆盖正典走势，玩家历史缺场不补胜；程序摘要、退赛及结束日期只读，坏比赛局部处理。主副API共用业务字段写入权，人际终值按事实校正；系统及历史结算字段由代码保护。觉醒仅用true/false。保留G04/G03/P02等兼容能力；MVU02按当前真实回复身份接手缺失或损坏的主补丁，保持同轮结算收据，S01维护本轮剧情推进，F01支持业务校正。依赖MVU、酒馆助手Zod4与固定mvu_zod桥接。只启用一份v4约束，不迁移历史楼层。',
  button: { enabled: false, buttons: [] }, data: {}, export_with: { data: false, button: false },
};
const scriptTarget = '世界书规则/MVU/落第骑士-MVU-v4字段约束.json';
// 独立更新保留已导入脚本的身份、按钮、数据与未知字段，更新生成名称、内容和说明。
const script = scriptOnly ? { ...JSON.parse(read(scriptTarget)), name: generatedScript.name, content: generatedScript.content, info: generatedScript.info } : generatedScript;
if (script.id !== generatedScript.id) throw new Error('字段约束脚本 ID 不符，未生成');
const outputs = new Map([
  ...(!scriptOnly ? [[target, rendered], ...(!mvuOnly || withInit ? [['世界书规则/MVU/[initvar]变量初始化.yaml', yaml]] : [])] : []),
  [scriptTarget, JSON.stringify(script, null, 2) + '\n'],
]);
if (process.argv.includes('--write')) {
  if (!scriptOnly && !mvuOnly) {
  const backup = path.join(root, 'output/worldbook-calibration/落第骑士英雄谭-修改前.json');
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
  }
  for (const [file, text] of outputs) fs.writeFileSync(path.join(root, file), text);
  console.log(JSON.stringify({ written: [...outputs.keys()], changed }, null, 2));
} else if (process.argv.includes('--check')) {
  const stale = [...outputs].filter(([file, text]) => !fs.existsSync(path.join(root, file)) || read(file) !== text).map(([file]) => file);
  if (stale.length) throw new Error(`产物不同步：${stale.join('、')}`);
  console.log(scriptOnly ? '字段约束脚本与源文件一致；未读写世界书、三份 TXT 或初始化。' : mvuOnly ? 'MVU 更新规则、输出格式与伴随脚本均与作者源一致；' + (withInit ? '初始化已核对，其余条目未改写。' : '其余条目及初始化未改写。') : '世界书、初始化、伴随脚本均与作者源一致。');
} else console.log(JSON.stringify({ mode: 'dry-run', changed, outputs: [...outputs.keys()] }, null, 2));
