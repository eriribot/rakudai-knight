import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { INITIAL_STATE } from '../世界书规则/MVU/schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'output/worldbook-calibration/dev/package.json'));
const YAML = require('yaml');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const target = '世界书规则/v0.3/导出/落第骑士英雄谭.json';
const original = read(target);
const book = JSON.parse(original);
const before = structuredClone(book);
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
for (const [id, file, type] of mappings) {
  if (!book.entries[id] || book.entries[id].uid !== id) throw new Error(`缺少预期 UID ${id}`);
  book.entries[id].content = body(file, type);
}
const yaml = YAML.stringify(INITIAL_STATE, { lineWidth: 0 });
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
// 仅纠正能力本质与招式被写成同一概念的短语，保留此条其他用户内容。
book.entries[0].content = book.entries[0].content.replace('并以此为媒介行使异能〈伐刀绝技（Noble Arts）〉', '运用魔力施展伐刀能力，并将其发展为各具条件的伐刀技（Noble Arts）');
const changed = Object.values(book.entries).filter(entry => JSON.stringify(entry) !== JSON.stringify(before.entries[entry.uid])).map(entry => ({ uid: entry.uid, name: entry.comment }));
const rendered = JSON.stringify(book, null, 2) + '\n';
const schemaSource = read('世界书规则/MVU/schema.mjs').replace(/^export /gm, '');
const stateSource = read('scripts/rakudai-state-core.mjs').replace(/^export /gm, '');
const guardSource = read('scripts/rakudai-mvu-guard.js');
const bridge = 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource@dee97e8c3e24e1e75efe21141743e4b5c0af776e/dist/util/mvu_zod.js';
const scriptContent = `${schemaSource}\n${stateSource}\n${guardSource}
// 注册字段校验与写入责任保护；不自动转换旧楼层。
$(async () => {
  let timer;
  try {
    if (typeof z === 'undefined' || typeof z.preprocess !== 'function' || typeof z.toJSONSchema !== 'function') throw new Error('需要酒馆助手提供的 Zod 4；约束尚未注册');
    if (typeof waitGlobalInitialized !== 'function') throw new Error('酒馆助手未就绪；约束尚未注册');
    await Promise.race([
      waitGlobalInitialized('Mvu'),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('等待 MVU 超时，请启用变量框架后重新启用本脚本')), 15000); }),
    ]);
    clearTimeout(timer);
    const { registerMvuSchema } = await import('${bridge}');
    const schema = createSchema(z);
    registerMvuSchema(schema);
    installRakudaiMvuGuard(schema);
    console.info('[落第 MVU v3] 已注册字段与第一卷范围约束（3.1.0，含框架元数据兼容与代码写入保护）；旧楼层须先迁移。');
  } catch (error) {
    console.error('[落第 MVU v3] 注册失败，字段或写入保护未完全生效：', error);
    if (typeof toastr !== 'undefined') toastr.error('落第 MVU 字段约束未完整注册，请查看脚本日志与安装说明。');
  } finally { clearTimeout(timer); }
});
`;
const script = {
  type: 'script', enabled: true, name: '落第骑士·MVU v3 字段与第一卷约束', id: '06117475-a08c-4d78-a886-3d26426c4b37', content: scriptContent,
  info: '修订 3.1.0：兼容 MVU 临时 $internal，业务字段仍严格校验；系统、初评及卷章状态由界面代码管理。普通多楼层；需 MVU 与 Zod 4 酒馆助手。世界书 JSON 不会自动安装本脚本。不验证剧情真伪、不迁移旧楼层。桥接器按命令校验，不承诺整轮原子回滚。',
  button: { enabled: false, buttons: [] }, data: {}, export_with: { data: false, button: false },
};
const outputs = new Map([
  [target, rendered], ['世界书规则/MVU/[initvar]变量初始化.yaml', yaml],
  ['世界书规则/MVU/落第骑士-MVU-v3字段约束.json', JSON.stringify(script, null, 2) + '\n'],
]);
if (process.argv.includes('--write')) {
  const backup = path.join(root, 'output/worldbook-calibration/落第骑士英雄谭-修改前.json');
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
  for (const [file, text] of outputs) fs.writeFileSync(path.join(root, file), text);
  console.log(JSON.stringify({ written: [...outputs.keys()], changed }, null, 2));
} else if (process.argv.includes('--check')) {
  const stale = [...outputs].filter(([file, text]) => !fs.existsSync(path.join(root, file)) || read(file) !== text).map(([file]) => file);
  if (stale.length) throw new Error(`产物不同步：${stale.join('、')}`);
  console.log('世界书、初始化、伴随脚本均与作者源一致。');
} else console.log(JSON.stringify({ mode: 'dry-run', changed, outputs: [...outputs.keys()] }, null, 2));
