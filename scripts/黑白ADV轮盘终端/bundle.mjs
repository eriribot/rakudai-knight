import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import sourceMap from 'source-map-js';
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
  const appModules = ['terminal-app.js', 'terminal-controls.js'];
  const cssModules = ['terminal-app.css', 'terminal-theme.css', 'terminal-status.css'];
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
    return '<script>' + builder.finish().code + '</script>';
  });
  for (const file of [...appModules, ...cssModules]) if (!seen.has(file)) throw new Error('页面未引入模块：' + file);
  const parsed = extractScripts(html);
  if (parsed.length !== appModules.length || parsed.some(script => script.attrs.src)) throw new Error('页面打包后脚本数量或来源不符');
  parsed.forEach((script, index) => new vm.Script(script.content, { filename: appModules[index] }));
  return html;
}

export function buildTerminal() {
  const version = JSON.parse(read('package.json')).version;
  const html = buildApp(version);
  const jsModules = { STATE_CONTROLLER: '../rakudai-state-controller.js', STATE_READER: 'state-reader.js', LAYOUT: 'layout.js', WHEEL: 'wheel.js', STATE_PANEL: 'state-panel.js', CORRECTION: 'correction.js' };
  const literals = { VERSION: jsString(version), STYLES: jsString(read('styles.css')), APP_HTML: jsString(html),
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
    if (jsModules[name]) builder.append(read(jsModules[name]), jsModules[name]);
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
  const artifact = {
    type: 'script', enabled: true, name: '落第骑士·黑白ADV轮盘终端 v' + version,
    id: 'ee190b2f-d2ba-44b4-9f1b-0695c07fefc5', content: built.code,
    info: 'v' + version + '：成长每目标每条完整回复上限' + GROWTH_RULES.perReplyCap + '，保留晋级余量；好感按普通/中度/重度实际回应判断。F01副API通用业务校正：能力/人物/场景父对象合并、数组更新、动态条目删除、评级/经验终值与关系数字修正；取消80项限制，程序维护项略过不中断。E01事件父对象兼容保留；S01副API可校正场景卷章、阶段与切入说明，同轮主副结算不重复切章。MVU01副API只跟踪本轮MVU标签和变量保存，正文/生图刷新不取消，写入保留其它插件元数据。保留布尔魔人觉醒、G03三项成长与A+/S；副API支持拉取模型、自动读取本轮正文与事件、编辑内置提示词，自动校正与手动预览。处理提示位于酒馆右上角，支持重试和取消；密钥本机持久保存、重载恢复。按绑定世界书完成标识自动顺序推进，卷末进入下一卷；终端按钮及折叠向前切入作为手动兜底。支持MVU v3→v4迁移预览与确认、聊天级剧情注入开关、世界书原文预览及实际条目/order来源。本次需同时替换说明含F01的v4约束。R10关系计分按回复分项保存收据，失败项可重试，数值上限保持；P02副API可校正已有好感和支援；替换旧终端，只启用一个版本。',
    button: { enabled: true, buttons: [] }, data: {},
  };
  return { artifact, html, map: built.map, version };
}
