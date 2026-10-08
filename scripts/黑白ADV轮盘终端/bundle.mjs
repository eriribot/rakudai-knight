import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import sourceMap from 'source-map-js';
import { buildKnightAvatarCatalog } from './knight-avatars.mjs';
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
    if (file === 'terminal-app.js') builder.append('\nvar RK_KNIGHT_AVATARS = ' + jsString(knightAvatars) + ';\n');
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
  const jsModules = { STATE_CONTROLLER: '../rakudai-state-controller.js', STATE_READER: 'state-reader.js', CALENDAR_WORLDBOOK: 'calendar-worldbook.js', PLAYER_DISPLAY_STORE: 'player-display-store.js', PLAYER_PORTRAIT: 'player-portrait.js', LAYOUT: 'layout.js', WHEEL: 'wheel.js', STATE_PANEL: 'state-panel.js', CORRECTION: 'correction.js' };
  const portraitManifest = JSON.parse(read('../../resource/knightavatars/manifest.json'));
  const portraitReservedNames = [...portraitManifest.characters, ...(portraitManifest.missingPortraits || [])]
    .flatMap(person => [person.name, ...(person.aliases || [])])
    .concat((portraitManifest.ambiguousAliases || []).flatMap(item => item.aliases));
  const literals = { VERSION: jsString(version), STYLES: jsString(read('styles.css')), APP_HTML: jsString(html),
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
    info: 'v' + version + ' / N04 / MVU02 / final-values-v1 / T02 / R01：主API直接提交经验与六维终值，不再提交成长申请。原生模式由模型计算门槛和余量；可选v4字段约束提供准确门槛校正，旧申请原样留档不兑现。升级后关闭旧独立成长G04，保留历史文件和收据。内置N04在更新前补缺失成长、经验与历史申请父容器，经验缺轴补0，保留已有值及坏类型；配套独立N04在小手机关闭时仍工作，不请求模型。主MVU保存独立于副API，确认当前活动回复页回读后显示已保存。副API仅校正最新助手楼层的活动回复页，有约束走当前终值校验，无约束走原生MVU解析；切换聊天、回复页、模式或实际变量后旧候选失效。约束加载或失败保持诊断，不绕过已启用约束。页面建档、名册和赛程事务仍本地验证并回读；保留T02选拔赛、日历、轮盘和头像功能。副API配置及密钥本机保存，支持排除请求参数和输出上限30000。每种组件保留一份，安装文件统一位于世界书规则/MVU，配套更新开局正则、三份MVU文本及初始化YAML，不重打整卡或整本世界书。',
    button: { enabled: true, buttons: [] }, data: {}, export_with: { data: false, button: false },
  };
  artifact.info += ' N04开局页沿用原有上传/载入照片，建档成功后按本机当前聊天保存显示头像；旧聊天核对姓名后可单独应用头像，不重建人物或改MVU。首页、玩家档案和正文气泡共用，终端设置仅登记明确别名，不再重复上传照片。气泡v0.5兼容正文旁的选项代码块，样式避开思考前缀清理；终端在流式、完成与历史重绘后核对头像节点，缺失时补回，图片失败保留首字回退。固定玩家标记、完整名和已登记唯一别名可显示玩家头像；NPC/歧义名称不抢占，关闭终端脚本会回退候选原文。配套三条气泡正则与格式规则位于scripts/正文气泡/发布。';
  artifact.info += ' N05首楼辅助隔离：配套开局建议使用带请求ID的静默生成；终端仅跟踪原生START/AFTER成对的正式剧情请求，忽略首楼辅助请求的定向停止，不改变自动全面校正或手动校验。';
  artifact.info += ' N06保存确认与补丁修复：主MVU以本轮保存收据在当前回复页落地确认主保存，渲染先到、漏发或业务值未变都不替代保存证明。N04整合安全的缺失父对象补丁，MVU02允许已绑定真实回复的缺失或损坏主补丁进入副校正，始终保留业务约束、来源冲突检查和回读。自动模式全面核验，关闭自动仍可手动预览保存。副请求120秒超时后停止自动重试，不连等三轮；输入仅去重只读程序战况和内部自动历史，保留真实业务变量。';
  artifact.info += ' N07已有坏人物修复：副校正先在内存组装人际修改，保留未改人物，整个人际一次交给MVU校验，避免逐字段修复互相阻塞；错误别名仅按明确删除操作清理，缺失派生阶段按最终有效分数恢复，保存前完整校验。剧情面板区分正在保存和已保存数据不合法，手动切章不要求开启可选字段约束。本次只替换小手机，沿用N04原生、N06开局与MVU02约束。';
  return { artifact, html, map: built.map, version };
}
