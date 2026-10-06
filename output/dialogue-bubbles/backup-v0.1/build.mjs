import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildKnightAvatarCatalog } from '../黑白ADV轮盘终端/knight-avatars.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '../..');
export const output = path.join(root, 'output/dialogue-bubbles');
const manifestPath = path.join(root, 'resource/knightavatars/manifest.json');
const cssPath = path.join(here, 'bubble.css');
export const formatRule = '对白独占一行，写作姓名:台词，不加外层引号；同人固定用名，换人换行，动作与旁白另起段。';
const regexEscape = text => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// CSS string escaping also keeps </style> and JS replacement dollars out of generated CSS.
const cssString = text => '"' + text.replace(/["\\<>$\u0000-\u001f\u007f]/g, ch => '\\' + ch.codePointAt(0).toString(16) + ' ') + '"';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const readManifest = () => JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

export function buildRules() {
  const manifest = readManifest();
  const catalog = buildKnightAvatarCatalog();
  const names = new Map();
  const imageRules = [];
  for (const character of manifest.characters) {
    if (!character.hasShieldFrame && !character.displayFile) throw new Error('气泡需要完整盾图：' + character.id);
    const aliases = [...new Set([character.name, ...character.aliases])];
    for (const name of aliases) {
      if (/[<>"&\r\n\t:：]/.test(name)) throw new Error('别名不能安全进入 HTML 属性：' + name);
      if (names.has(name) && names.get(name) !== character.id) throw new Error('重名：' + name);
      names.set(name, character.id);
    }
    const selectors = aliases.map(name => '[data-rkd="bubble"][data-rkd-name=' + cssString(name) + ' i]');
    imageRules.push(selectors.join(',') + '{--rkd-image:url(' + cssString(catalog.entries[character.id].src) + ')}');
  }
  const alternatives = [...names.keys()].sort((a, b) => b.length - a.length).map(regexEscape).join('|');
  // Fail closed for fenced messages. After a structured block opener we deliberately
  // leave the rest untouched, including unfinished streaming blocks and their contents.
  const protectedOpener = '<';
  const beforeGuard = '(?<!(?:```|~~~|' + protectedOpener + ')[\\s\\S]*)';
  const afterGuard = '(?![\\s\\S]*(?:```|~~~))';
  const pattern = '^' + beforeGuard + afterGuard + '[ ]{0,3}(' + alternatives + ')[ \\t]*[:：](?![^\\r\\n\\u2028\\u2029]*\\{\\{)[ \\t]*([^<>&\\r\\n\\u2028\\u2029]*[^<>&\\s])[ \\t]*(?=\\r?$)';
  const shared = {trimStrings: [], placement: [2], disabled: false, markdownOnly: true, promptOnly: false,
    runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null};
  const css = fs.readFileSync(cssPath, 'utf8') + '\n' + imageRules.join('\n');
  return [
    {...shared, id: 'cf3083f8-42e4-4e2e-8e70-a65817a2c881', scriptName: '01 盾形对白 · 姓名与台词 v0.1',
      findRegex: '/' + pattern + '/gim',
      replaceString: '<div data-rkd="bubble" data-rkd-name="$1"><span data-rkd-avatar aria-hidden="true"></span><div data-rkd-body><span data-rkd-speaker>$1</span><div data-rkd-line>$2</div></div></div>'},
    {...shared, id: 'cf3083f8-42e4-4e2e-8e70-a65817a2c882', scriptName: '02 盾形对白 · 共享样式 v0.1',
      findRegex: '/^(?![\\s\\S]*<style data-rkd-style)(?=[\\s\\S]*<div data-rkd="bubble")/',
      replaceString: '<style data-rkd-style="v0.1">' + css + '</style>\n\n'},
  ];
}

export function applyRules(text, rules = buildRules()) {
  return rules.reduce((value, rule) => {
    const end = rule.findRegex.lastIndexOf('/');
    return value.replace(new RegExp(rule.findRegex.slice(1, end), rule.findRegex.slice(end + 1)), rule.replaceString);
  }, text);
}

function previewPage(rules) {
  const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Exact generated rules; only asset addresses are mapped to the same local images
  // for the portable preview. The import artifacts retain the configured HTTPS URLs.
  let demo = applyRules('放学后的走廊渐渐安静下来。\n\n史黛菈:别误会，我只是顺路。\n一辉:那就一起走吧。\n\n窗外落下一阵细雨，珠雫停在楼梯口。\n\n珠雫：哥哥，伞在这里。\n东堂刀华:训练可以等雨停再开始。路面很滑，走慢一点。\n\n两人对视一眼，谁也没有先接过那把伞。', rules);
  for (const item of readManifest().characters) {
    if (item.imageUrl) demo = demo.split(item.imageUrl).join('../../resource/knightavatars/' + (item.displayFile || item.file));
  }
  const parts = demo.match(/^(<style[\s\S]*?<\/style>)([\s\S]*)$/);
  demo = parts[1] + parts[2].split('\n').filter(line => line.trim()).map(line =>
    line.startsWith('<div') ? line : '<p>' + line + '</p>').join('\n');
  const examples = '史黛菈:别误会，我只是顺路。\n一辉:那就一起走吧。';
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>盾形对白 · 第一版预览</title><style>' +
    '*{box-sizing:border-box}body{margin:0;background:#14171d;color:#e8e6e1;font:16px/1.8 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1100px;margin:auto;padding:36px 22px}h1{font-size:28px;line-height:1.35;margin:0 0 12px}header p{color:#a8abb3;margin:0 0 22px}nav{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px}button,a{font:inherit}button{border:1px solid #74777e;border-radius:6px;background:transparent;color:inherit;padding:8px 14px;cursor:pointer}button:focus-visible{outline:2px solid #e1c282;outline-offset:3px}.stage{max-width:760px;padding:24px;border:1px solid #53565b;border-radius:9px;transition:none;--SmartThemeBodyColor:#e8e6e1;--SmartThemeBlurTintColor:#252933}.stage.light{background:#f7f4ee;color:#2c3038;--SmartThemeBodyColor:#2c3038;--SmartThemeBlurTintColor:#fffdf8}.stage.narrow{width:320px;max-width:100%;padding:14px;font-size:15px}.story{white-space:normal}.story>p{margin:18px 0}.stage.narrow [data-rkd="bubble"]{gap:8px}.stage.narrow [data-rkd-avatar]{flex-basis:43px;width:43px;height:61px}.note{color:#a8abb3;font-size:13px}details{margin:22px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;background:#20242c;border-radius:6px}a{color:#dfc58f}@media(max-width:500px){main{padding:22px 12px}.stage{padding:14px}}' +
    '</style><main><header><p>RAKUDAI KNIGHT / DIALOGUE 01</p><h1>盾形对白</h1><p>盾形头像、轻边框气泡，旁白保留阅读节奏。</p></header><nav><button id="theme" aria-pressed="false">浅色背景</button><button id="width" aria-pressed="false">320px 窄屏</button></nav><section class="stage" aria-label="正文气泡预览"><div class="story">' + demo +
    '</div></section><details><summary>模型输出格式</summary><p>' + formatRule + '</p><pre>' + escapeHtml(examples) + '</pre></details><p class="note">本页使用本地同源头像，是离线视觉预览；酒馆导入后的样式处理与远程图片加载需另行验证。</p>' +
    '<p><a href="components/dialogue-bubbles.regex.json">下载 01 对白正则</a>　<a href="components/dialogue-bubble-style.regex.json">下载 02 样式正则</a>　<a href="format-rule.txt">格式规则</a></p></main><script>const stage=document.querySelector(".stage");for(const [id,name] of [["theme","light"],["width","narrow"]]){document.getElementById(id).addEventListener("click",function(){const on=stage.classList.toggle(name);this.setAttribute("aria-pressed",String(on))})}</script></html>';
}

export function build() {
  const rules = buildRules();
  fs.mkdirSync(output, {recursive: true});
  fs.writeFileSync(path.join(output, 'update-spec.json'), JSON.stringify({schemaVersion: 1, deliveryMode: 'component', kind: 'regex',
    items: rules.map((value, i) => ({artifactName: i ? 'dialogue-bubble-style' : 'dialogue-bubbles', value}))}, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'format-rule.txt'), formatRule + '\n\n示例：\n史黛菈:别误会，我只是顺路。\n一辉:那就一起走吧。\n');
  fs.writeFileSync(path.join(output, 'preview.html'), previewPage(rules));
  fs.writeFileSync(path.join(output, 'source-receipt.json'), JSON.stringify({version: '0.1', deliveryMode: 'component',
    scope: '两条角色局部显示正则、短格式规则、离线预览；不修改现有角色卡、世界书、终端或聊天',
    sourceHashes: Object.fromEntries([manifestPath, cssPath, fileURLToPath(import.meta.url)].map(p => [path.relative(root,p).replaceAll('\\','/'),digest(fs.readFileSync(p))])),
    library: {snapshot: '2026-08-18', routes: ['sillytavern-render-regex-pipeline','sillytavern-embedded-ui','sillytavern-component-update','sillytavern-api-reference'], guides: ['A0','A5','A6','C3','D7'], adoptedDesignCandidates: []},
    dependencies: {host: 'SillyTavern Regex + message HTML/CSS sanitization', image: '现有 manifest HTTPS 图片（远程加载）', helper: '不需要 Tavern Helper'},
    apiEvidence: {referenceVersion:'SillyTavern 1.18.0', source:'https://raw.githubusercontent.com/SillyTavern/SillyTavern/1.18.0/public/scripts/extensions/regex/engine.js', fields:'AI_OUTPUT=2; substitute_find_regex.NONE=0; markdownOnly display gate', runtimeVerified:false},
    realSillyTavern: 'not run', modelCompliance: 'not run; 尚未指定生成模型，不宣称绝对最少 token 或保证遵守率'},null,2)+'\n');
  console.log(JSON.stringify({output,characters:readManifest().characters.length,rules:rules.length}));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build();
