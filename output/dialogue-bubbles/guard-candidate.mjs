// Experimental v0.2 context guard. This file is not an importable component.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function buildContextGuard() {
  const tags = ['script', 'style', 'pre', 'code', 'textarea', 'details', 'think', 'thinking', 'reasoning',
    'analysis', 'UpdateVariable', 'update', 'JSONPatch', 'acg_think', 'combat_driver', 'story_driver',
    'parallel_line_drive', 'memory_log', 'wlog', 'status', 'affinity'];
  const attrs = `(?:[^<>"']|"[^"]*"|'[^']*')*`;
  const comment = '<!--(?:(?!-->)[\\s\\S])*-->';
  const literalLessThan = '<(?![a-z!/?])';
  const attrGuard = `(?<!<(?:[^>"']|"[^"]*"|'[^']*')*(?:"[^"]*|'[^']*)?)`;
  const commentGuard = '(?<!<!--(?:(?!-->)[\\s\\S])*)';
  const guards = [attrGuard, commentGuard];
  for (const tag of tags) {
    // The real host turns <parallel_line> into an event details wrapper.
    // Only visible summary text may select this exception, never an attribute/comment.
    const summaryPrefix = '(?:[^<]|' + comment + '|<(?=[a-z!/?])(?!!--|/summary\\s*>)' + attrs + '>)*';
    const eventException = tag === 'details'
      ? '(?!\\s*<summary' + attrs + '>' + summaryPrefix + '平行线事件)'
      : '';
    const rawOpen = '<' + tag + '(?=[\\s/>])' + attrs + '>';
    const open = rawOpen + eventException;
    // Quote-aware tag/comment tokens prevent a fake </tag> inside an attribute or
    // comment from closing the protected block in this approximation.
    const otherTag = '<(?=[a-z!/?])(?!!--|/' + tag + '\\s*>)' + attrs + '>';
    const body = '(?:[^<]|' + comment + '|' + otherTag + '|' + literalLessThan + ')*';
    guards.push('(?<!' + open + body + ')');

    // Repeated same-tag protected nesting fails closed from the inner opener onward.
    // This deliberately does not attempt arbitrary recursive HTML parsing.
    // An allowed event details opener does not count as a protected opener.
    const notOwnTag = '<(?=[a-z!/?])(?!!--|/?' + tag + '(?=[\\s/>]))' + attrs + '>';
    const untilNested = '(?:[^<]|' + comment + '|' + notOwnTag + '|' + literalLessThan + ')*';
    guards.push('(?<!' + open + untilNested + rawOpen + '[\\s\\S]*)');
  }
  return guards.join('');
}

export function runProbe() {
  // Put the guard after the candidate dialogue; ordinary narrative lines fail early.
  const regex = new RegExp('^[ ]{0,3}(一辉|史黛菈)[:：]([^<>&\\r\\n]+)' + buildContextGuard() + '(?=\\r?$)', 'gim');
  const cases = [
    ['plain', '一辉:好', ['一辉:好']],
    ['closed-prefix', '<acg_think>内部\n一辉:不能\n</acg_think>\n一辉:好', ['一辉:好']],
    ['content', '<content>\n一辉:好\n</content>', ['一辉:好']],
    ['story-scene', '<story_scene>\n一辉:好\n</story_scene>', ['一辉:好']],
    ['parallel-line', '<parallel_line>\n一辉:好\n</parallel_line>', ['一辉:好']],
    ['ordinary-div', '<div class="story">\n一辉:好\n</div>', ['一辉:好']],
    ['attribute', '<div title=">\n一辉:不能\n">x</div>', []],
    ['nested-fail-closed', '<details><details>x</details>\n一辉:不能\n</details>\n一辉:保守不转换', []],
    ['fake-close-in-opener-attribute', '<details title="</details>">\n一辉:不能\n</details>\n一辉:好', ['一辉:好']],
    ['fake-close-in-inner-attribute', '<details><div title="</details>">\n一辉:不能\n</div></details>\n一辉:好', ['一辉:好']],
    ['fake-close-in-comment', '<details><!-- </details> -->\n一辉:不能\n</details>\n一辉:好', ['一辉:好']],
    ['unclosed-stream', '<acg_think>internal\n一辉:不能', []],
    ['less-than-in-reasoning', '<think>1 < 3\n一辉:不能\n</think>\n一辉:好', ['一辉:好']],
    ['parallel-event-and-driver', '<details><summary>🐑<span>平行线事件 [点击查看]</span></summary><div>\n一辉:好\n</div><details><summary>⚙️平行线驱动</summary>\n一辉:不能\n</details>\n史黛菈:好\n</details>\n一辉:好', ['一辉:好', '史黛菈:好', '一辉:好']],
    ['parallel-unclosed-driver', '<details><summary>平行线事件</summary>\n一辉:好\n<details><summary>平行线驱动</summary>\n一辉:不能', ['一辉:好']],
    ['protected-outer-containing-event-fails-closed', '<details><summary>私有推理</summary><details><summary>平行线事件</summary>text</details>\n一辉:外层推理仍未闭合不转换\n</details>\n一辉:保守回退', []],
    ['event-phrase-in-attribute-not-an-exception', '<details><summary><span title="平行线事件">推理</span></summary>\n一辉:不能\n</details>', []],
    ['event-phrase-in-comment-not-an-exception', '<details><summary><!--平行线事件-->推理</summary>\n一辉:不能\n</details>', []],
    ['literal-less-than-repeats', '<3>'.repeat(100) + '\n一辉:好', ['一辉:好']],
  ];
  const results = [];
  for (const [name, input, expected] of cases) {
    const matches = [...input.matchAll(regex)].map(match => match[0]);
    try { assert.deepEqual(matches, expected); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, matches, error: error.message }); }
  }
  const measurements = [];
  for (const [name, input] of [
    ['100k narrative', '<acg_think>hidden</acg_think>\n' + '普通叙述。\n'.repeat(16667) + '一辉:好'],
    ['1200 dialogues', '<story_driver>hidden</story_driver>\n' + '一辉:这是正常的正文对白。\n'.repeat(1200)],
    ['10000 literal less-than tokens', '<3>'.repeat(10000) + '\n一辉:好'],
  ]) {
    const start = performance.now();
    const matches = [...input.matchAll(regex)].length;
    measurements.push({ name, chars: input.length, matches, elapsedMs: +(performance.now() - start).toFixed(2) });
  }
  const report = { experimental: true, node: process.version, regexCharacters: regex.source.length,
    limitation: 'Repeated protected same-tag nesting suppresses the remaining message; not a general HTML parser. Host acceptance remains required.',
    passed: results.filter(result => result.passed).length, total: results.length, measurements, results };
  console.log(JSON.stringify(report, null, 2));
  if (report.passed !== report.total) process.exitCode = 1;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runProbe();
