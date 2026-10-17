import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import sourceMap from 'source-map-js';
import { buildKnightAvatarCatalog } from './knight-avatars.mjs';
import { buildTournamentPanel } from './build-tournament-panel.mjs';
import { GROWTH_RULES, RELATIONSHIP_SCORING, supportStage, romanceStage } from '../../世界书规则/MVU/schema.mjs';

export const directory = path.dirname(fileURLToPath(import.meta.url));
const { SourceMapGenerator, SourceMapConsumer } = sourceMap;
const read = file => fs.readFileSync(path.resolve(directory, file), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

// JSON 字符串仍可能包含 HTML 的终止标签。只转义数据字面量，不改 JS 运算符。
export const jsString = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function extractScripts(html) {
  const scripts = [];
  function visit(node) {
    if (node.tagName === 'script') scripts.push({
      attrs: Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value])),
      content: node.childNodes.map(child => child.value || '').join(''),
    });
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(html));
  return scripts;
}

function checkMappedScript(code, map) {
  try { new vm.Script(code, { filename: 'terminal.js' }); }
  catch (error) {
    const location = error.stack && error.stack.match(/^terminal\.js:(\d+)/);
    if (location) {
      const caret = (error.stack.split('\n')[2] || '').indexOf('^');
      const original = new SourceMapConsumer(map).originalPositionFor({ line: Number(location[1]), column: Math.max(caret, 0) });
      if (original.source) throw new SyntaxError(original.source + ':' + original.line + ' — ' + error.message);
    }
    throw error;
  }
}

function mappedSource(filename, version) {
  const map = new SourceMapGenerator({ file: filename, sourceRoot: 'rakudai-terminal://v' + version + '/' });
  let code = '', line = 1, column = 0;
  function append(text, file, offset = 0) {
    let originalLine = 1, originalColumn = 0;
    if (file) {
      const source = read(file);
      map.setSourceContent(file, source);
      const before = source.slice(0, offset).split('\n');
      originalLine = before.length;
      originalColumn = before.at(-1).length;
    }
    const chunks = text.split('\n');
    chunks.forEach((chunk, index) => {
      if (file && chunk.length) map.addMapping({
        generated: { line, column }, source: file,
        original: { line: originalLine, column: originalColumn },
      });
      code += chunk;
      column += chunk.length;
      if (index < chunks.length - 1) { code += '\n'; line++; column = 0; originalLine++; originalColumn = 0; }
    });
  }
  function finish() {
    const json = map.toJSON();
    code += '\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,' + Buffer.from(JSON.stringify(json)).toString('base64');
    code += '\n//# sourceURL=rakudai-terminal/v' + version + '/' + filename + '\n';
    return { code, map: json };
  }
  return { append, finish };
}

function buildApp(version) {
  let html = read('terminal-app.html');
  const knightAvatars = buildKnightAvatarCatalog();
  const tournamentPanel = buildTournamentPanel(knightAvatars);
  const appModules = ['terminal-app.js', 'terminal-controls.js'];
  const cssModules = ['terminal-app.css', 'terminal-theme.css', 'terminal-status.css', 'terminal-lime.css'];
  const seen = new Set();
  html = html.replace(/<link rel="stylesheet" href="\.\/([^"<>]+)"([^>]*)>/g, (tag, file, attrs) => {
    if (!cssModules.includes(file) || seen.has(file)) throw new Error('未知或重复的样式模块：' + file);
    seen.add(file);
    const css = read(file);
    if (/<\/style(?:\s|\/|>)/i.test(css)) throw new Error(file + ' 含会截断 style 的文本');
    return '<style' + attrs + '>\n' + css + '</style>';
  });
  html = html.replace(/<script src="\.\/([^"<>]+)"><\/script>/g, (tag, file) => {
    if (!appModules.includes(file) || seen.has(file)) throw new Error('未知或重复的页面模块：' + file);
    seen.add(file);
    const raw = read(file);
    new vm.Script(raw, { filename: file });
    // 模块里若引入了危险的 HTML raw-text 序列，必须在源字面量处理，不能悄悄改动代码。
    if (/<\/script(?:\s|\/|>)|<!--|<script(?:\s|\/|>)/i.test(raw)) throw new Error(file + ' 含会改变 HTML script 解析状态的文本');
    const builder = mappedSource(file, version);
    builder.append(raw, file);
    if (file === 'terminal-app.js') {
      builder.append('\n' + read('lime-chat.mjs').replace(/^export /gm, ''), 'lime-chat.mjs');
      builder.append('\n' + read('terminal-lime.js'), 'terminal-lime.js');
      builder.append('\nvar RK_TOURNAMENT_PANEL_HTML = ' + jsString(tournamentPanel) + ';\n');
      builder.append('\n' + read('terminal-tournament.js'), 'terminal-tournament.js');
    }
    if (file === 'terminal-app.js') builder.append('\nvar RK_KNIGHT_AVATARS = ' + jsString(knightAvatars) + ';\n');
    return '<script>' + builder.finish().code + '</script>';
  });
  for (const file of [...appModules, ...cssModules]) if (!seen.has(file)) throw new Error('页面未引入模块：' + file);
  html = html.replaceAll('../../resource/dorm/B-entrance-to-balcony.webp', 'data:image/webp;base64,' + fs.readFileSync(path.resolve(directory, '../../resource/dorm/B-entrance-to-balcony.webp')).toString('base64'));
  const parsed = extractScripts(html);
  if (parsed.length !== appModules.length || parsed.some(script => script.attrs.src)) throw new Error('页面打包后脚本数量或来源不符');
  parsed.forEach((script, index) => new vm.Script(script.content, { filename: appModules[index] }));
  return html;
}

export function buildTerminal() {
  const version = JSON.parse(read('package.json')).version;
  const html = buildApp(version);
  const jsModules = { STATE_CONTROLLER: '../rakudai-state-controller.js', STATE_READER: 'state-reader.js', LIME_PROTOCOL: 'lime-chat.mjs', LIME_HOST: 'lime-host.js', LIME_WORLDBOOK: 'lime-worldbook.js', LIME_STORY: 'lime-story.js', CALENDAR_WORLDBOOK: 'calendar-worldbook.js', PLAYER_DISPLAY_STORE: 'player-display-store.js', PLAYER_PORTRAIT: 'player-portrait.js', LAYOUT: 'layout.js', WHEEL: 'wheel.js', STATE_PANEL: 'state-panel.js', CORRECTION: 'correction.js' };
  const portraitManifest = JSON.parse(read('../../resource/knightavatars/manifest.json'));
  const portraitReservedNames = [...portraitManifest.characters, ...(portraitManifest.missingPortraits || [])]
    .flatMap(person => [person.name, ...(person.aliases || [])])
    .concat((portraitManifest.ambiguousAliases || []).flatMap(item => item.aliases));
  const literals = { VERSION: jsString(version), STYLES: jsString(read('styles.css')), APP_HTML: jsString(html),
    LIME_CHARACTER_ALIASES: jsString(portraitManifest.characters.map(person => ({ name: person.name, aliases: person.aliases || [] }))),
    PORTRAIT_RESERVED_NAMES: jsString(portraitReservedNames), PLAYER_BUBBLE_CSS: jsString(read('../正文气泡/bubble.css')),
    CORRECTION_RULES: jsString(read('../../世界书规则/MVU/变量更新规则.txt')), CORRECTION_FORMAT: jsString(read('../../世界书规则/MVU/变量输出格式.txt')),
    // 函数源码保留原文件换行；与文件模块一样归一化，避免 HTML 解析把 CRLF 改成 LF 后误报。
    RELATIONSHIP_SCORING: jsString(RELATIONSHIP_SCORING), SUPPORT_STAGE: supportStage.toString().replace(/\r\n?/g, '\n'), ROMANCE_STAGE: romanceStage.toString().replace(/\r\n?/g, '\n') };
  const main = read('main.js'), builder = mappedSource('terminal.js', version), seen = new Set();
  let previous = 0;
  for (const match of main.matchAll(/\/\*__INJECT_([A-Z_]+)__\*\//g)) {
    const name = match[1];
    if (seen.has(name)) throw new Error('重复的注入标记：' + name);
    seen.add(name);
    builder.append(main.slice(previous, match.index), 'main.js', previous);
    if (jsModules[name]) builder.append(read(jsModules[name]).replace(/^export /gm, ''), jsModules[name]);
    else if (Object.hasOwn(literals, name)) builder.append(literals[name], 'main.js', match.index);
    else throw new Error('未知注入标记：' + name);
    previous = match.index + match[0].length;
  }
  builder.append(main.slice(previous), 'main.js', previous);
  for (const name of [...Object.keys(jsModules), ...Object.keys(literals)]) if (!seen.has(name)) throw new Error('缺少注入标记：' + name);
  const built = builder.finish();
  checkMappedScript(built.code, built.map);
  // 宿主会先解析 HTML，再解析 JS。检查完整交付物经这条链后没有截断或增生脚本。
  const hostScripts = extractScripts('<!doctype html><script type="module">\n' + built.code + '</script>');
  if (hostScripts.length !== 1 || hostScripts[0].content !== '\n' + built.code) throw new Error('宿主 HTML 解析改变了脚本内容，已阻止导出');
  new vm.Script(hostScripts[0].content, { filename: 'host-terminal.js' });
  // B1 基线保留脚本身份与其他元数据，运行内容统一来自当前维护源码。
  const baseline = JSON.parse(read('../../世界书规则/MVU/落第骑士-小手机-v' + version + '-B1.json'));
  const filename = '落第骑士-小手机-v' + version + '-B1-头像更新.json';
  const artifact = { ...baseline, content: built.code };
  artifact.info += ' 同版号头像同步：共用清单现有40人，包含四名赛事角色与三名家人；终端、LIME及正文气泡共用。';
  artifact.info += ' 同版号调整：已保存的选拔赛状态为已结束后正式开放赛事面板；此前保留主动预览入口与持续预览标识，不推进赛程或写入赛果。';
  artifact.info += ' 同版号修复：支持补录截至某轮的累计战绩，保留已完成明细且不重复计分，后续比赛继续累加；已启用可选v4字段约束时需同步替换该组件。手动切卷预填当前时间、地点及可编辑切入说明，一次提交即开始目标章节。';
  artifact.info += ' 手动操作按需校验：切卷、补录、名册与宿舍仅检查操作相关字段，其他已有资料原样保留；不开字段约束也可使用。切卷不改成长记录，切入提示已简化。';
  return { artifact, html, map: built.map, version, filename };
}
