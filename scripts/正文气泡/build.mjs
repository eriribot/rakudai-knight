import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildKnightAvatarCatalog } from '../黑白ADV轮盘终端/knight-avatars.mjs';
import { buildContextGuard } from './context-guard.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '../..');
export const output = path.join(here, '发布');
export const reports = path.join(here, '验证记录');
const manifestPath = path.join(root, 'resource/knightavatars/manifest.json');
const cssPath = path.join(here, 'bubble.css');
const formatRulePath = path.join(here, 'format-rule.txt');
export const formatRule = fs.readFileSync(formatRulePath, 'utf8').trim();
export const artifactNames = ['dialogue-bubbles', 'dialogue-player-candidates', 'dialogue-bubble-style'];
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
  // The same remaining suffix pins the end of the name exactly, including for
  // malformed multiline personas. Only the safe single-line name is rendered.
  // Regex escaping alone does not make a macro value HTML-safe.
  const playerName = '(?={{user}}(?<rkdPersonaTail>[\\s\\S]*)(?![\\s\\S]))[^\\x00-\\x1f\\x7f<>"&{}:：\\u2028\\u2029]+(?=\\k<rkdPersonaTail>(?![\\s\\S]))';
  // Check context only after a candidate dialogue has matched. Closed reasoning
  // blocks and story wrappers must not disable all subsequent dialogue.
  const beforeGuard = '(?<!(?:```|~~~)[\\s\\S]*)';
  const afterGuard = '(?![\\s\\S]*(?:```|~~~))';
  const safetyTail = beforeGuard + afterGuard + buildContextGuard();
  const speech = '(?![^\\r\\n\\u2028\\u2029]*\\{\\{)[ \\t]*(?<rkdSpeech>[^<>&\\r\\n\\u2028\\u2029]*[^<>&\\s])[ \\t]*(?=\\r?$)';
  const pattern = '^[ ]{0,3}(?<rkdName>(?<rkdPlayer>' + playerName + '|玩家|player|user|OC)|' + alternatives + ')[ \\t]*[:：]' + speech + safetyTail;
  // Candidate names are inert display text. Only the terminal's shared identity
  // resolver may promote one to a player bubble; never guess from a substring.
  // A named whole-line capture keeps indentation and separator spaces. The
  // pinned host expands numeric/named captures itself and does not expand $&.
  const candidateName = '[^ \\t\\x00-\\x1f\\x7f<>"&{}:：\\u2028\\u2029][^\\x00-\\x1f\\x7f<>"&{}:：\\u2028\\u2029]{0,63}?';
  const candidate = '(?<rkdCandidateSource>^[ ]{0,3}(?<rkdCandidateName>' + candidateName + ')[ \\t]*[:：]' + speech + ')' + safetyTail;
  const shared = {trimStrings: [], placement: [2], disabled: false, markdownOnly: true, promptOnly: false,
    runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null};
  const css = fs.readFileSync(cssPath, 'utf8') + '\n' + imageRules.join('\n');
  return [
    {...shared, id: 'cf3083f8-42e4-4e2e-8e70-a65817a2c881', scriptName: '01 盾形对白 · 姓名与台词 v0.4', substituteRegex: 2,
      findRegex: '/' + pattern + '/gim',
      replaceString: '<div data-rkd="bubble" data-rkd-name="$<rkdName>" data-rkd-player="$<rkdPlayer>"><span data-rkd-avatar aria-hidden="true"></span><div data-rkd-body><span data-rkd-speaker>$<rkdName></span><div data-rkd-line>$<rkdSpeech></div></div></div>'},
    {...shared, id: 'bea21af8-9a41-4b0c-9009-1811e54bb8e4', scriptName: '02 盾形对白 · OC 姓名候选 v0.4',
      findRegex: '/' + candidate + '/gim',
      replaceString: '<span data-rkd="candidate" data-rkd-name="$<rkdCandidateName>"><span data-rkd-source>$<rkdCandidateSource></span></span>'},
    {...shared, id: 'cf3083f8-42e4-4e2e-8e70-a65817a2c882', scriptName: '03 盾形对白 · 共享样式 v0.4',
      // ST 1.18.0 encodeStyleTags only preserves a bare <style> opener.
      // Keep the deduplication marker in CSS, never on the style element.
      findRegex: '/^(?![\\s\\S]*\/\\* rkd-dialogue-style:)(?=[\\s\\S]*<(?:div|span) data-rkd="(?:bubble|candidate)")/',
      replaceString: '<style>/* rkd-dialogue-style:v0.4 */\n' + css + '</style>\n\n'},
  ];
}

// Offline fixture support for the one read-only macro used by these rules.
// This is not an emulator for the host's complete macro/render pipeline.
export function applyRules(text, rules = buildRules(), {user} = {}) {
  return rules.reduce((value, rule) => {
    const find = rule.findRegex.split('{{user}}').join(user ? regexEscape(user) : '(?!)');
    const end = find.lastIndexOf('/');
    return value.replace(new RegExp(find.slice(1, end), find.slice(end + 1)), rule.replaceString);
  }, text);
}

function previewPage(rules) {
  const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Exact generated rules; only asset addresses are mapped to the same local images
  // for the portable preview. The import artifacts retain the configured HTTPS URLs.
  let demo = applyRules('放学后的走廊渐渐安静下来。\n\n史黛菈:别误会，我只是顺路。\n一辉:那就一起走吧。\n\n窗外落下一阵细雨，珠雫停在楼梯口。\n\n珠雫：哥哥，伞在这里。\n东堂刀华:训练可以等雨停再开始。路面很滑，走慢一点。\n\n两人对视一眼，谁也没有先接过那把伞。', rules);
  for (const item of readManifest().characters) {
    if (item.imageUrl) demo = demo.split(item.imageUrl).join('../../../resource/knightavatars/' + (item.displayFile || item.file));
  }
  const parts = demo.match(/^(<style[\s\S]*?<\/style>)([\s\S]*)$/);
  demo = parts[1] + parts[2].split('\n').filter(line => line.trim()).map(line =>
    line.startsWith('<div') ? line : '<p>' + line + '</p>').join('\n');
  const examples = '史黛菈:别误会，我只是顺路。\n一辉:那就一起走吧。';
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>盾形对白 · 第一版预览</title><style>' +
    '*{box-sizing:border-box}body{margin:0;background:#14171d;color:#e8e6e1;font:16px/1.8 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1100px;margin:auto;padding:36px 22px}h1{font-size:28px;line-height:1.35;margin:0 0 12px}header p{color:#a8abb3;margin:0 0 22px}nav{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px}button,a{font:inherit}button{border:1px solid #74777e;border-radius:6px;background:transparent;color:inherit;padding:8px 14px;cursor:pointer}button:focus-visible{outline:2px solid #e1c282;outline-offset:3px}.stage{max-width:760px;padding:24px;border:1px solid #53565b;border-radius:9px;transition:none;--SmartThemeBodyColor:#e8e6e1;--SmartThemeBlurTintColor:#252933}.stage.light{background:#f7f4ee;color:#2c3038;--SmartThemeBodyColor:#2c3038;--SmartThemeBlurTintColor:#fffdf8}.stage.narrow{width:320px;max-width:100%;padding:14px;font-size:15px}.story{white-space:normal}.story>p{margin:18px 0}.stage.narrow [data-rkd="bubble"]{gap:8px}.stage.narrow [data-rkd-avatar]{flex-basis:43px;width:43px;height:61px}.note{color:#a8abb3;font-size:13px}details{margin:22px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;background:#20242c;border-radius:6px}a{color:#dfc58f}@media(max-width:500px){main{padding:22px 12px}.stage{padding:14px}}' +
    '</style><main><header><p>RAKUDAI KNIGHT / DIALOGUE 01</p><h1>盾形对白</h1><p>盾形头像、轻边框气泡，旁白保留阅读节奏。</p></header><nav><button id="theme" aria-pressed="false">浅色背景</button><button id="width" aria-pressed="false">320px 窄屏</button></nav><section class="stage" aria-label="正文气泡预览"><div class="story">' + demo +
    '</div></section><details><summary>模型输出格式</summary><p>' + formatRule + '</p><pre>' + escapeHtml(examples) + '</pre></details><p class="note">本页使用本地同源头像，是离线视觉预览；酒馆导入后的样式处理与远程图片加载需另行验证。</p>' +
    '<p><a href="components/dialogue-bubbles.regex.json">下载 01 对白正则</a>　<a href="components/dialogue-player-candidates.regex.json">下载 02 OC 候选正则</a>　<a href="components/dialogue-bubble-style.regex.json">下载 03 样式正则</a>　<a href="format-rule.txt">格式规则</a></p></main><script>const stage=document.querySelector(".stage");for(const [id,name] of [["theme","light"],["width","narrow"]]){document.getElementById(id).addEventListener("click",function(){const on=stage.classList.toggle(name);this.setAttribute("aria-pressed",String(on))})}</script></html>';
}

export function build() {
  const rules = buildRules();
  fs.mkdirSync(output, {recursive: true});
  fs.writeFileSync(path.join(output, 'update-spec.json'), JSON.stringify({schemaVersion: 1, deliveryMode: 'component', kind: 'regex',
    items: rules.map((value, i) => ({artifactName: artifactNames[i], value}))}, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'format-rule.txt'), formatRule + '\n');
  fs.writeFileSync(path.join(output, 'preview.html'), previewPage(rules));
  fs.writeFileSync(path.join(output, 'source-receipt.json'), JSON.stringify({version: '0.4', deliveryMode: 'component',
    scope: '三条角色局部显示正则、格式规则、离线预览；只更新对应组件，不重打整卡或修改聊天原文',
    sourceHashes: Object.fromEntries([manifestPath, cssPath, formatRulePath, path.join(here,'context-guard.mjs'), fileURLToPath(import.meta.url)].map(p => [path.relative(root,p).replaceAll('\\','/'),digest(fs.readFileSync(p))])),
    library: {snapshot: '2026-08-18', routes: ['sillytavern-render-regex-pipeline','sillytavern-embedded-ui','sillytavern-component-update','sillytavern-api-reference'], guides: ['A0','A5','A6','C3','D7'], adoptedDesignCandidates: []},
    dependencies: {host: 'SillyTavern Regex + message HTML/CSS sanitization', image: '现有 manifest HTTPS 图片（远程加载）', helper: 'NPC、固定玩家标记及完整 persona 名不需要 Tavern Helper；OC 候选提升与玩家自选头像由新版终端运行时提供'},
    apiEvidence: {referenceVersion:'SillyTavern 1.18.0', source:'https://raw.githubusercontent.com/SillyTavern/SillyTavern/1.18.0/public/scripts/extensions/regex/engine.js', fields:'AI_OUTPUT=2; dialogue substitute_find_regex.ESCAPED=2; style NONE=0; markdownOnly display gate', userMacro:'当前 persona name1；只替换查找模式，安全字符捕获后输出', runtimeVerified:false},
    candidateContract: {selector:'span[data-rkd="candidate"]', name:'data-rkd-name', source:'span[data-rkd-source].textContent 保留完整原行', promotion:'仅共享身份解析器唯一命中玩家时提升；未知或歧义保持原文', playerMarker:'非空 data-rkd-player 表示玩家或固定标记；NPC 为 ""'},
    realSillyTavern: 'not run；当前产物需要重新导入及验收，旧 output 中的实机记录不能证明 v0.4', modelCompliance: 'not run; 不宣称绝对最少 token 或保证遵守率'},null,2)+'\n');
  console.log(JSON.stringify({output,characters:readManifest().characters.length,rules:rules.length}));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build();
