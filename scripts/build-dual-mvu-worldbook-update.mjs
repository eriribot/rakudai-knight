import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

// component only. TH 4.12.0: 5cbd089f1217d00e1f6851f50bf451223860a9c2.
// @types/iframe/script.d.ts:13/54: getButtonEvent / updateScriptButtonsWith.
// src/function/worldbook.ts:432 rewrites mapped entries, so it cannot preserve raw metadata.
// ST 1.19.0: 7e8663cd9c184a550b37238218bdd32c6efc68e9.
// public/scripts/st-context.js:278 exposes loadWorldInfo/saveWorldInfo/reloadWorldInfoEditor.
// world-info.js:2036/4177: raw load/save; save caches before HTTP and does not check status.
// Therefore use the host's same-origin raw read endpoint before/after its public save API.
const root = new URL('../', import.meta.url);
const sourceFiles = {
  list: '世界书规则/MVU/变量列表.txt', update: '世界书规则/MVU/变量更新规则.txt',
  format: '世界书规则/MVU/变量输出格式.txt', init: '世界书规则/MVU/[initvar]变量初始化.yaml',
};
const read = file => fs.readFileSync(new URL(file, root), 'utf8').replace(/\r\n/g, '\n');

export function createDualWorldbookPlan(book, payload) {
  if (!book?.entries || typeof book.entries !== 'object' || Array.isArray(book.entries)) throw new Error('主世界书不是原始 entries 对象，未修改。');
  const rows = Object.entries(book.entries), seen = new Set();
  for (const [, entry] of rows) {
    if (!Number.isInteger(entry?.uid) || seen.has(entry.uid) || typeof entry.comment !== 'string' || typeof entry.content !== 'string') throw new Error('世界书存在无效或重复 UID／正文，未修改。');
    seen.add(entry.uid);
  }
  function named(name, optional = false) {
    const matches = rows.filter(([, entry]) => entry.comment === name);
    if (matches.length > 1 || !matches.length && !optional) throw new Error('条目「' + name + '」必须唯一，实际为 ' + matches.length + ' 条。');
    return matches[0];
  }
  const header = '<% /* RK_AW_WORLDBOOK_V1 */ %>\n';
  const begin = '<% /* RK_AW_ORIGINAL_BEGIN */ %>\n', end = '\n<% /* RK_AW_ORIGINAL_END */ %>';
  // 联动设定来源：DLC/学战研究/01_世界观与核心规则/水上学园都市六花(Asterisk)地理论.md、
  // 星武祭(Festas)三大赛事与触武祭.md、星脉世代(Genestella)与魔女·魔术师.md。
  // 只在此处（世界设定）说明两作品同处一界；机制条文跟人物能力走，不按开局作品排除。
  const common = '【同一世界与两座舞台】\n两部作品的人物共处同一世界，保留原有身份、能力、所属与已确认关系。开局选择主线；能力、装备和学籍分别记录，取得方式与使用条件以本局事实为准。两套能力可以并存，持有煌武不等于有星辰力或六花学籍，成为伐刀者也不等于入学。星辰力与魔力不换算、不互供；学园排名与骑士登记等级分开记录，不互相换算。机制与制度按人物实际能力、身份和所属机构适用。人物资料不代表已登场或与玩家熟识；相遇或资料注入不自动启动、切换主线。\n';
  function original(content) {
    if (!content.includes('RK_AW_WORLDBOOK_')) {
      if (content.includes(begin) || content.includes(end)) throw new Error('原文含更新器保留标记，未修改。');
      return content;
    }
    if (!content.startsWith(header) || content.split(begin).length !== 2 || content.split(end).length !== 2) throw new Error('已有双作品包装无法识别，请保留备份并人工检查。');
    const first = content.indexOf(begin) + begin.length, last = content.indexOf(end);
    if (last < first) throw new Error('原文边界损坏，未修改。');
    return content.slice(first, last);
  }
  function wrapLore(content, worldSetting) {
    const source = original(content);
    return header + (worldSetting ? common : '') + begin + source + end;
  }
  const targets = [
    [named('[MVU]变量列表'), payload.templates.list],
    [named('[MVU]变量更新规则'), payload.templates.update],
  ];
  // The editor's old/new labels are both supported; never choose by numeric UID.
  const formats = ['[MVU]变量输出格式', '[MVU]变量更新格式'].map(name => named(name, true)).filter(Boolean);
  const activeFormats = formats.filter(([, entry]) => entry.disable !== true);
  const format = formats.length === 1 ? formats[0] : activeFormats.length === 1 ? activeFormats[0] : null;
  if (!format) throw new Error('变量输出格式新旧名称无法唯一定位，请只保留一个启用版本。');
  targets.push([format, payload.templates.format]);
  const changes = [];
  function add(row, content) {
    const [key, entry] = row;
    if (content !== entry.content) changes.push({ key, uid: entry.uid, comment: entry.comment, before: structuredClone(entry), content });
  }
  for (const [row, template] of targets) {
    original(row[1].content); // 识别旧包装；分支由当前模板负责，不再嵌入第二份正文。
    add(row, template);
  }
  add(named('[initvar]变量初始化'), payload.templates.init);
  const skipped = [];
  for (const name of ['世界设定', '魔力', '能力与招式', '伐刀者', '觉醒', '魔人', '能力系别']) {
    const row = named(name, true);
    if (row) add(row, wrapLore(row[1].content, name === '世界设定')); else skipped.push(name);
  }
  const style = named('文风', true);
  if (style) add(style, style[1].content.replace(
    '严禁正文出现任何数值、好感度、评级或设定集系统术语（如“S级羁绊”、“六维”、“判定”等）。',
    '正文不播报后台数值、好感度、羁绊阶段或变量术语；人物可以自然谈及已知的骑士等级、校内排名、时间与距离。',
  ));
  return { changes, skipped };
}

export function installDualMvuWorldbookUpdater(W, payload) {
  const slot = '__RK_AW_WORLDBOOK_UPDATER_V1__';
  W[slot]?.destroy();
  const host = W.parent, context = host?.SillyTavern?.getContext;
  if (typeof context !== 'function') throw new Error('需要酒馆助手脚本 iframe 与 SillyTavern 宿主。');
  const api = () => host.SillyTavern.getContext();
  for (const method of ['getCharWorldbookNames', 'getButtonEvent', 'eventOn']) if (typeof W[method] !== 'function') throw new Error('酒馆助手缺少 ' + method);
  for (const method of ['getRequestHeaders', 'saveWorldInfo', 'reloadWorldInfoEditor']) if (typeof api()[method] !== 'function') throw new Error('SillyTavern 缺少 ' + method);
  if (typeof host.fetch !== 'function') throw new Error('宿主不提供同源读取。');
  let pending = null, busy = false, disposed = false;
  const subscriptions = [];
  const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' ?
    Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
  const canonical = value => JSON.stringify(sorted(value));
  const primary = () => {
    const binding = W.getCharWorldbookNames('current');
    if (typeof binding?.primary !== 'string' || !binding.primary.trim()) throw new Error('当前角色没有绑定主世界书。');
    return binding.primary;
  };
  const owner = () => { const current = api(); return { characterId: current.characterId, groupId: current.groupId, chatId: current.chatId, chat: current.chat }; };
  const owned = (name, savedOwner) => {
    const current = owner();
    if (disposed || primary() !== name || Object.keys(savedOwner).some(key => savedOwner[key] !== current[key])) throw new Error('当前聊天或角色主世界书已变化，请重新预览。');
  };
  async function rawRead(name) {
    const response = await host.fetch('/api/worldinfo/get', { method: 'POST', headers: api().getRequestHeaders(),
      body: JSON.stringify({ name }), cache: 'no-store' });
    if (!response.ok) throw new Error('世界书读取失败：HTTP ' + response.status);
    return response.json();
  }
  function download(name, value) {
    const url = W.URL.createObjectURL(new W.Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
    const anchor = W.document.createElement('a'); anchor.href = url; anchor.download = name;
    W.document.body.append(anchor); anchor.click(); anchor.remove();
    W.setTimeout(() => W.URL.revokeObjectURL(url), 30000);
  }
  async function preview() {
    pending = null;
    const name = primary(), savedOwner = owner(), book = await rawRead(name); owned(name, savedOwner);
    const plan = createDualWorldbookPlan(book, payload);
    download(name.replace(/[<>:"/\\|?*]/g, '_') + '-双作品更新前完整备份.json', book);
    pending = { name, plan, savedOwner };
    W.alert('已准备「' + name + '」：' + plan.changes.length + ' 条正文差异。\n' +
      plan.changes.map(change => change.comment + '（UID ' + change.uid + '）').join('\n') +
      '\n请保留下载的完整原世界书备份。当前聊天楼层不会修改。\n确认后点击「' + payload.buttons[1] + '」。' +
      (plan.skipped.length ? '\n本书未找到的可选机制条目：' + plan.skipped.join('、') : ''));
    return plan;
  }
  async function apply() {
    if (!pending) throw new Error('请先点击「预览差异并下载备份」。');
    const { name, plan, savedOwner } = pending; owned(name, savedOwner);
    if (!plan.changes.length) { W.alert('当前正文已是本版，无需写入。'); return; }
    const current = await rawRead(name); owned(name, savedOwner);
    // Re-resolve comments as well as UIDs immediately before writing; duplicates added after preview also fail.
    createDualWorldbookPlan(current, payload);
    for (const change of plan.changes) if (canonical(current.entries?.[change.key]) !== canonical(change.before)) throw new Error('条目「' + change.comment + '」在预览后被修改，请重新预览并备份。');
    const next = structuredClone(current);
    for (const change of plan.changes) next.entries[change.key].content = change.content;
    owned(name, savedOwner);
    await api().saveWorldInfo(name, next, true);
    const saved = await rawRead(name);
    if (canonical(saved) !== canonical(next)) throw new Error('服务器回读与提交内容不一致，不能确认更新成功；请保留备份并检查世界书。');
    pending = null;
    await api().reloadWorldInfoEditor(name);
    W.alert('已核对服务器保存：「' + name + '」的 ' + plan.changes.length + ' 条正文已更新；其他条目与设置保持原值。当前聊天变量没有改动。');
  }
  async function run(action) {
    if (busy || disposed) return;
    busy = true;
    try { return await action(); }
    catch (error) { W.alert('双作品世界书更新未完成：' + (error?.message || String(error))); }
    finally { busy = false; }
  }
  for (const [name, action] of [[payload.buttons[0], preview], [payload.buttons[1], apply]]) subscriptions.push(W.eventOn(W.getButtonEvent(name), () => run(action)));
  const destroy = () => { disposed = true; pending = null; subscriptions.forEach(subscription => subscription.stop()); W.removeEventListener('pagehide', destroy); if (W[slot] === marker) delete W[slot]; };
  const marker = { destroy }; W[slot] = marker; W.addEventListener('pagehide', destroy, { once: true });
  return marker;
}

export function buildDualMvuWorldbookUpdate() {
  const templates = Object.fromEntries(Object.entries(sourceFiles).map(([key, file]) => [key, read(file)]));
  const payload = { version: '20261109.1', templates, buttons: ['预览差异并下载备份', '应用双作品世界书更新'] };
  const content = '// GENERATED by scripts/build-dual-mvu-worldbook-update.mjs --write\n(function () {\n"use strict";\n' +
    createDualWorldbookPlan.toString() + '\n' + installDualMvuWorldbookUpdater.toString() + '\n' +
    'installDualMvuWorldbookUpdater(window, ' + JSON.stringify(payload) + ');\n})();\n';
  new vm.Script(content);
  const artifact = { type: 'script', enabled: true, name: '双作品·世界书差异更新器 v1（学战两卷 20261109.1）', id: 'f8d76282-7789-4e31-b901-99a7dd88d95b', content,
    info: '仅组件更新。导入只注册两个按钮，不读写世界书；先预览并下载完整原世界书备份，再明确点击应用。按当前角色主世界书唯一comment匹配三条MVU规则与initvar，直接同步当前模板并保留全部原始metadata；作品分支由模板负责。七个可选机制条目保留原文，融合与适用范围说明只放世界设定一次；文风仅将全面禁止数值的原句改为不播报后台数值。人物与剧情条目不改，不写历史楼层。重跑不重复包装。依赖宿主TH脚本按钮/getCharWorldbookNames、ST getContext().saveWorldInfo/getRequestHeaders/reloadWorldInfoEditor、同源worldinfo/get及EJS提示词模板扩展。已核TH4.12.0 commit5cbd089f、ST1.19.0 commit7e8663cd源码；真实宿主按钮/下载/保存仍待验收。TH updateWorldbookWith会重建raw元数据，故此处用ST公开raw保存接口，并读服务器核对。',
    button: { enabled: true, buttons: payload.buttons.map(name => ({ name, visible: true })) }, data: {}, export_with: { data: false, button: true } };
  return { artifact, payload, sourceHashes: Object.fromEntries(Object.values(sourceFiles).map(file => [file, createHash('sha256').update(fs.readFileSync(new URL(file, root))).digest('hex')])) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { artifact, sourceHashes } = buildDualMvuWorldbookUpdate();
  const output = new URL('世界书规则/MVU/双作品-世界书差异更新器-v1.json', root), text = JSON.stringify(artifact, null, 2) + '\n';
  if (process.argv.includes('--write')) fs.writeFileSync(output, text);
  else if (process.argv.includes('--check') && fs.readFileSync(output, 'utf8') !== text) throw new Error('世界书更新器产物不同步。');
  console.log(JSON.stringify({ mode: process.argv.includes('--write') ? 'written' : process.argv.includes('--check') ? 'checked' : 'dry-run', output: fileURLToPath(output), sourceHashes }, null, 2));
}
