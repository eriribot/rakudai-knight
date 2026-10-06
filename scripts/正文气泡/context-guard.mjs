// Display-only context boundaries for dialogue lines; not a general HTML parser.
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

