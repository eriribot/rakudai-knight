import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { parse } from 'parse5';
import sourceMap from 'source-map-js';
import { buildTerminal, jsString } from './bundle.mjs';

const { SourceMapConsumer } = sourceMap;
const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const old = JSON.parse(read('../酒馆助手脚本-小手机-黑白ADV轮盘版-v1.3.1.json'));
const built = buildTerminal(), results = [];
function check(name, run) {
  try { run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: String(error.stack).slice(0, 1800) }); }
}
// 独立解析完整HTML产物；不使用源码正则或build里的extractScripts代替HTML解析。
function scripts(html) {
  const found = [];
  function walk(node) {
    if (node.tagName === 'script') found.push(node.childNodes.map(child => child.value || '').join(''));
    for (const child of node.childNodes || []) walk(child);
  }
  walk(parse(html));
  return found;
}
function unpack(code) {
  const match = code.match(/function embeddedPhoneHtml\(\) \{ return (.*); \}/);
  assert.ok(match, '真实交付物中缺少内嵌页面入口');
  return vm.runInNewContext(match[0] + '\nembeddedPhoneHtml()');
}
function position(text, needle) {
  const offset = text.indexOf(needle);
  assert.ok(offset >= 0, '定位标记缺失：' + needle);
  const prefix = text.slice(0, offset).split('\n');
  return { line: prefix.length, column: prefix.at(-1).length };
}
function inlineMap(script) {
  const match = script.match(/^\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,([A-Za-z0-9+/=]+)$/m);
  assert.ok(match, '缺少内联源映射');
  return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
}

check('旧包直接编译通过，但完整宿主HTML解析后稳定复现两段SyntaxError', () => {
  new vm.Script(old.content);
  const pieces = scripts('<!doctype html><script type="module">' + old.content + '</script>');
  assert.equal(pieces.length, 2);
  for (const piece of pieces) assert.throws(() => new vm.Script(piece), /Invalid or unexpected token/);
  assert.equal(old.content.slice(0, old.content.indexOf('</script>')).split('\n').length, 792);
});
check('新包在HTML宿主中只产生一个未截断的完整脚本', () => {
  const pieces = scripts('<!doctype html><html><head></head><body><script type="module">' + built.artifact.content + '</script></body></html>');
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0], built.artifact.content);
  assert.doesNotMatch(built.artifact.content, /<\/script/i);
  new vm.Script(pieces[0]);
});
check('实际JSON交付物经反序列化、宿主HTML及内页入口仍还原完整页面', () => {
  const artifact = JSON.parse(read('../酒馆助手脚本-小手机-黑白ADV轮盘版-v' + built.version + '.json'));
  assert.deepEqual(artifact, built.artifact);
  const outer = scripts('<script type="module">' + artifact.content + '</script>')[0];
  const html = unpack(outer);
  assert.equal(html, built.html);
  const inner = scripts(html); assert.equal(inner.length, 2);
  inner.forEach(script => new vm.Script(script));
  assert.doesNotMatch(html, /<script\s+src=|<link[^>]+href="\.\//i);
});
check('HTML闭合标签、大小写、注释、中文、反斜杠及行分隔符往返保持原值', () => {
  for (const text of ['</script>', '</ScRiPt >', '<!--<script>内容</script>-->', '中文\\n\\路径\n第二行', '\u2028\u2029', '<svg>&"\'']) {
    const literal = jsString(text);
    assert.ok(!literal.includes('<'));
    const code = 'globalThis.testValue = ' + literal + ';';
    const parsed = scripts('<script>' + code + '</script>'); assert.equal(parsed.length, 1);
    assert.equal(parsed[0], code);
    const realm = vm.createContext({}); vm.runInContext(parsed[0], realm);
    assert.equal(realm.testValue, text);
  }
});
check('打包页面包含当前维护的全部 JS 与 CSS 模块，没有滞留旧版源码', () => {
  const template = read('terminal-app.html'), inner = scripts(built.html);
  const jsFiles = [...template.matchAll(/<script src="\.\/([^"<>]+)"><\/script>/g)].map(match => match[1]);
  assert.equal(inner.length, jsFiles.length);
  jsFiles.forEach((file, index) => assert.ok(inner[index].startsWith(read(file)), file));
  const cssFiles = [...template.matchAll(/<link rel="stylesheet" href="\.\/([^"<>]+)"/g)].map(match => match[1]);
  const styles = [...built.html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
  assert.equal(styles.length, cssFiles.length);
  cssFiles.forEach((file, index) => assert.equal(styles[index][1], '\n' + read(file), file));
});
check('交付脚本中注入的关系函数可独立执行，共享新上限且不缺闭包依赖', () => {
  const content = built.artifact.content;
  const start = content.indexOf('  const RELATIONSHIP_SCORING = ');
  const end = content.indexOf('\n\n  function hostWindow()', start);
  assert.ok(start >= 0 && end > start, '主壳共享关系规则注入块缺失');
  const realm = vm.createContext({});
  vm.runInContext(content.slice(start, end) + '\nglobalThis.scoring = { config: RELATIONSHIP_SCORING, supportStage, romanceStage };', realm);
  assert.equal(realm.scoring.config.affection.max, 1000);
  assert.equal(realm.scoring.config.affection.initial, 0);
  assert.equal(realm.scoring.supportStage(320), 'S');
  assert.equal(realm.scoring.romanceStage({ 性别: '女性', 好感: 100 }), '路人');
  assert.equal(realm.scoring.romanceStage({ 性别: '女性', 好感: 1000 }), '生死相随');
  assert.equal(realm.scoring.romanceStage({ 性别: '男性', 好感: 1000 }), null);
  assert.equal(realm.scoring.romanceStage({ 好感: 1000 }), null);
});
check('主壳与注入模块的真实生成位置可映射回原文件行', () => {
  const consumer = new SourceMapConsumer(built.map);
  const probes = [
    ['main.js', 'async function mountVia'], ['state-reader.js', 'function readTerminalState'],
    ['correction.js', 'function wireAutomaticCorrection'],
    ['layout.js', 'function '], ['wheel.js', 'function '], ['state-panel.js', 'function '],
    ['../rakudai-state-controller.js', 'function createSchema'],
  ];
  for (const [file, needle] of probes) {
    const source = read(file), sourcePos = position(source, needle);
    // 选该源文件中的一整行，避开不同模块同名的短函数前缀。
    const line = source.split('\n')[sourcePos.line - 1];
    const generated = position(built.artifact.content, line);
    const original = consumer.originalPositionFor({ ...generated, column: generated.column + line.search(/\S/) });
    assert.ok(original.source.endsWith(file.replace('../', '')), original.source + ' != ' + file);
    assert.equal(original.line, sourcePos.line);
    assert.equal(consumer.sourceContentFor(original.source), source);
  }
  assert.deepEqual(inlineMap(built.artifact.content), built.map);
});
check('内页真实script文本不trim：源映射与原文件行一致且来源名明确', () => {
  const inner = scripts(built.html);
  for (const [index, file, needle] of [[0, 'terminal-app.js', 'function renderBlazer()'], [1, 'terminal-controls.js', 'var originalUpdate = updateHomeScreen;']]) {
    const source = read(file), code = inner[index], consumer = new SourceMapConsumer(inlineMap(code));
    assert.ok(code.startsWith(source));
    const mapped = consumer.originalPositionFor(position(code, needle));
    assert.equal(mapped.line, position(source, needle).line);
    assert.ok(mapped.source.endsWith('/' + file));
    assert.ok(code.includes('//# sourceURL=rakudai-terminal/v' + built.version + '/' + file));
  }
});
check('打包保留原脚本身份与按钮数据，不另建第二个运行实例', () => {
  for (const key of ['type', 'enabled', 'id', 'button', 'data']) assert.deepEqual(built.artifact[key], old[key]);
});
console.log(JSON.stringify({ evidence: 'parse5 HTML解析 → 实际完整脚本V8编译；独立源映射消费；未连接真实酒馆', passed: results.filter(r => r.passed).length, total: results.length, results }, null, 2));
if (results.some(r => !r.passed)) process.exitCode = 1;
