import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseFragment } from '../黑白ADV轮盘终端/node_modules/parse5/dist/index.js';
import { buildRules, applyRules, output } from './build.mjs';

const filenames = ['dialogue-bubbles.regex.json', 'dialogue-bubble-style.regex.json'];
const contents = filenames.map(name => fs.readFileSync(output + '/components/' + name));
const rules = contents.map(bytes => JSON.parse(bytes.toString('utf8')));
assert.deepEqual(rules, buildRules(), '导入文件必须与当前维护源码完全一致');
const html = applyRules('史黛菈:一起走吧。\n一辉:好。', rules);
const counts = {scripts: 0, bubbles: 0, styles: 0};
function visit(node) {
  if (node.tagName === 'script') counts.scripts++;
  if (node.tagName === 'style') counts.styles++;
  if (node.tagName === 'div' && node.attrs?.some(a => a.name === 'data-rkd' && a.value === 'bubble')) counts.bubbles++;
  for (const child of node.childNodes || []) visit(child);
}
visit(parseFragment(html));
assert.deepEqual(counts, {scripts: 0, bubbles: 2, styles: 1});
// Same style-tag acceptance boundary as ST 1.18.0 chats.js encodeStyleTags.
assert.equal([...html.matchAll(/<style>(.+?)<\/style>/gims)].length, 1,
  '真实酒馆只保护无属性的 <style>；不能把幂等标记放在标签属性上');
const legacyEntityPrefix = (html.match(/&(?:curren|not|copy|reg)(?![a-z])/gi) || []).length;
const currencySign = (html.match(/\u00a4/g) || []).length;
const replacementChar = (html.match(/\ufffd/g) || []).length;
const replacementSpecial = (html.match(/\$(?:\d+|[&'`])/g) || []).length;
assert.equal(legacyEntityPrefix + currencySign + replacementChar + replacementSpecial, 0);
assert.ok(!/<script\b|\bon\w+\s*=|javascript:/i.test(html));
const report = {status:'passed', exactArtifactParity:'passed', htmlParse:counts,
  inlineBundle:{legacyEntityPrefix,currencySign,replacementChar,replacementSpecial,syntaxErrors:0,
    note:'导入规则生成纯 HTML/CSS，无内联脚本；样本无 HTML 实体，实体解码前后相同。普通台词中的美元文本不是生成代码。'},
  artifacts:filenames.map((name,i)=>({file:'components/'+name,sha256:createHash('sha256').update(contents[i]).digest('hex'),bytes:contents[i].length})),
  realSillyTavern:'not run'};
fs.writeFileSync(output + '/artifact-check.json', JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
