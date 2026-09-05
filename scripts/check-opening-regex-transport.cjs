// Reproduce SillyTavern 1.18.0 quote formatting before Markdown/JSRunner.
// The installed host's #chat pre code contained <q>""</q> inside the old script.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../第一卷-世界书整理/开局页面/index.html'), 'utf8');
const fence = String.fromCharCode(96).repeat(3);
function quoteFormat(text, encodeTags) {
  if (!encodeTags) text = text.replace(/<([^>]+)>/g, (_, contents) => '<' + contents.replace(/"/g, '\ufffe') + '>');
  text = text.replace(/<style>[\s\S]*?<\/style>|```[\s\S]*?```|~~~[\s\S]*?~~~|``[\s\S]*?``|`[\s\S]*?`|(".*?")|(\u201C.*?\u201D)|(\u00AB.*?\u00BB)|(\u300C.*?\u300D)|(\u300E.*?\u300F)|(\uFF02.*?\uFF02)/gim,
    (match, ...groups) => groups.slice(0, 6).some(Boolean) ? '<q>' + match + '</q>' : match);
  return encodeTags ? text : text.replace(/\ufffe/g, '"');
}
function transport(html, encodeTags) {
  const replacement = fence + '\n' + html + '\n' + fence;
  return quoteFormat('[开局]'.replace(/\[开局\]/, replacement), encodeTags);
}
function scripts(text) {
  return [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
}
assert.equal(source.includes(fence), false, 'no nested Markdown fence inside HTML');
const broken = '<script>var raw = ""; raw = raw.replace(/^' + fence + '(?:json)?\\s*/i, "").replace(/\\s*' + fence + '$/, "");</script>';
for (const encodeTags of [false, true]) {
  const oldOutput = transport(broken, encodeTags);
  assert.match(oldOutput, /<q>""<\/q>/, 'reproduce the exact corruption observed in the host');
  assert.throws(() => scripts(oldOutput).forEach(s => new vm.Script(s)), SyntaxError);
  const output = transport(source, encodeTags);
  assert.equal(output, fence + '\n' + source + '\n' + fence, 'HTML survives quote formatting byte-for-byte');
  scripts(output).forEach(s => new vm.Script(s));
}
console.log(JSON.stringify({ status:'PASS', oldHostCorruptionReproduced:true, quoteModes:2, nestedFences:false }, null, 2));
