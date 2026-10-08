// Display-only context boundaries for dialogue lines; not a general HTML parser.
export function caseFoldLiteral(text) {
  return text.replace(/[A-Za-z]|[.*+?^${}()|[\]\\/]/g, character =>
    /[A-Za-z]/.test(character) ? '[' + character.toLowerCase() + character.toUpperCase() + ']' : '\\' + character);
}

export function buildContextGuard({excludedTags = [], opaqueDrivers = false} = {}) {
  const tags = ['options', 'selection', 'konatan_planning~', 'details', 'script', 'style', 'pre', 'code', 'textarea', 'think', 'thinking', 'reasoning',
    'analysis', 'UpdateVariable', 'update', 'JSONPatch', 'acg_think', 'combat_driver', 'story_driver',
    'parallel_line_drive', 'memory_log', 'wlog', 'status', 'affinity',
    'tucao', 'konatan_chat', 'special_status', 'secure_log'].filter(tag => !excludedTags.includes(tag));
  const attrGuard = `(?<!<(?:[^>"']|"[^"]*"|'[^']*')*(?:"[^"]*|'[^']*)?)`;
  const commentGuard = '(?<!<!--(?:(?!-->)[\\s\\S])*)';
  const protectedTags = tags.map(caseFoldLiteral).join('|');
  const noProtectedOpener = '(?<!<(?:' + protectedTags + ')(?=[\\s/>])[\\s\\S]*)';
  const noFence = '(?<!^[ ]{0,3}(?:`{3,}|~{3,})[\\s\\S]*)';
  // Plain story keeps the cheap path. Structured prefixes must parse whole
  // comments/tags/fences before interpreting any protected opener or closer.
  const fast = noProtectedOpener + noFence + attrGuard + commentGuard;
  return '(?:'+fast+'|'+prefixScope(tags, opaqueDrivers)+')';
}

// Tags normally get independent state checks. Complete non-display driver
// envelopes are narrow lexical atoms: protocol names quoted inside their data
// cannot open or close a scope in the following narrative. Unknown/nested
// envelopes and incomplete lexical containers still fail closed.
function prefixScope(tags, enableOpaqueDrivers) {
  const end = '(?![\\s\\S])';
  const suffix = 'rkdContextTail';
  const boundary = '(?=\\k<'+suffix+'>'+end+')';
  const line = '[^\\r\\n\\u2028\\u2029]';
  const lineBreak = '(?:\\r\\n|\\r(?!\\n)|(?<!\\r)\\n|[\\u2028\\u2029])';
  const opening = '^[ ]{0,3}(?:`{3,}(?!`)[^`\\r\\n\\u2028\\u2029]*|~{3,}(?!~)'+line+'*)(?:'+lineBreak+'|'+end+')';
  const stop = '(?!'+boundary+')';
  const attrs = '(?:'+stop+`[^<>"']|"(?:`+stop+`[^"])*"|'(?:`+stop+`[^'])*')*`;
  const comment = '<!--(?:(?!'+boundary+'|-->)[\\s\\S])*-->';
  const literalLess = stop+'<(?![a-zA-Z!/?])';
  const text = '(?:(?!'+boundary+'|'+opening+')[^<])+';
  function fence(character, name, bounded = true) {
    const group = 'rkdContextFence'+name;
    const info = character==='`' ? '[^`\\r\\n\\u2028\\u2029]*' : line+'*';
    const close = '^[ ]{0,3}\\k<'+group+'>'+character+'*[ \\t]*(?='+lineBreak+'|'+end+')';
    return '^[ ]{0,3}(?<'+group+'>'+character+'{3,})(?!'+character+')'+info+lineBreak+
      '(?:(?!'+(bounded?boundary+'|':'')+close+')[\\s\\S])*'+close+(bounded?stop:'')+'(?:'+lineBreak+'|'+end+')';
  }
  const genericTag = '<(?=[a-zA-Z!/?])(?!!--)'+attrs+'>';
  // HTML raw-text elements do not parse apparent tags in their text. Preserve
  // their complete blocks as lexical atoms; an unclosed block still falls
  // through to its real opener and is rejected by that tag's scope branch.
  const rawText = excluding => ['script','style','textarea'].filter(name => name!==excluding).map(name => {
    const folded = caseFoldLiteral(name);
    const close = '<\\/'+folded+'\\s*>';
    return '<'+folded+'(?=[\\s/>])'+attrs+'>(?:(?!'+boundary+'|'+close+')[\\s\\S])*'+close;
  }).join('|');
  // A complete driver is consumed atomically; the surrounding prefix proof
  // cannot end midway through it. Its inner lexer therefore needs no repeated
  // candidate-suffix assertions (keeping generated regex compilation bounded).
  const driverAttrs = `(?:[^<>"']|"[^"]*"|'[^']*')*`;
  // These are known lowercase emitter signatures, not a new general HTML
  // admission rule. Other spellings keep the existing conservative fallback.
  const openTag = name => '<'+name+'(?=[\\s/>])'+driverAttrs+'>';
  const closeTag = name => '<\\/'+name+'\\s*>';
  function opaqueDrivers(scope) {
    // Mee's existing story-driver display shell, using structural anchors only
    // (no copied preset CSS). The sheep summary and exact orb-content slot must
    // be followed by the complete two-wrapper/progress-bar closing structure.
    const meeHead = openTag('details')+'\\s*'+openTag('summary')+'\\s*🐑\\s*'+closeTag('summary')+
      '\\s*'+openTag('div')+'\\s*'+openTag('div')+'\\s*<div\\s+class=(?:"orb-content"|\'orb-content\')\\s*>';
    const meeTail = closeTag('div')+'\\s*'+openTag('div')+'\\s*'+openTag('div')+'\\s*'+closeTag('div')+
      '\\s*'+closeTag('div')+'\\s*'+closeTag('div')+'\\s*'+closeTag('div')+'\\s*'+closeTag('details');
    const name = 'rkdDriver'+scope;
    // Share the sizeable body lexer between both envelopes. These branch gates
    // are checked only at closing markup: a captured nonempty opening can never
    // match there, while an unmatched JS backreference is empty and fails the
    // negative assertion. This avoids duplicating every fence/raw-text lexer.
    const rawBranch = '(?!\\k<'+name+'RawOpen>)';
    const meeBranch = '(?!\\k<'+name+'MeeOpen>)';
    const excludedOpeners = ['story_driver','details','script','style','textarea','pre','code'].map(caseFoldLiteral).join('|');
    const ownClose = '/'+caseFoldLiteral('story_driver')+'(?=[\\s/>])'+rawBranch+
      '|/'+caseFoldLiteral('details')+'(?=[\\s/>])'+meeBranch;
    // Other closing names are allowed as protocol text; they must not cancel a
    // protection scope opened *outside* this driver. Only its own close ends it.
    const safeTag = '<(?=[a-zA-Z!/?])(?!!--|(?:'+excludedOpeners+')(?=[\\s/>])|'+ownClose+')'+driverAttrs+'>';
    const driverComment = '<!--(?:(?!-->)[\\s\\S])*-->';
    const driverRawText = ['script','style','textarea'].map(tag => {
      const folded = caseFoldLiteral(tag), close = '<\\/'+folded+'\\s*>';
      return '<'+folded+'(?=[\\s/>])'+driverAttrs+'>(?:(?!'+close+')[\\s\\S])*'+close;
    }).join('|');
    const driverText = '(?:(?!'+opening+')[^<])+';
    const tokens = driverComment+'|'+fence('`','Driver'+scope+'Ticks',false)+'|'+fence('~','Driver'+scope+'Tildes',false)+
      '|'+driverRawText+'|'+safeTag+'|'+driverText+'|<(?![a-zA-Z!/?])';
    const body = '(?:(?=(?<'+name+'Token>'+tokens+'))\\k<'+name+'Token>)*';
    return '(?:(?<'+name+'RawOpen>'+openTag('story_driver')+')|(?<'+name+'MeeOpen>'+meeHead+'))'+body+
      '(?:'+rawBranch+closeTag('story_driver')+'|'+meeBranch+meeTail+')';
  }
  const token = comment+'|'+fence('`','Ticks')+'|'+fence('~','Tildes')+'|'+rawText(null)+'|'+
    (enableOpaqueDrivers?opaqueDrivers('Prefix')+'|':'')+genericTag+'|'+text+'|'+literalLess;
  const atom = '(?=(?<rkdContextToken>'+token+'))\\k<rkdContextToken>';
  const prefix = '(?:'+atom+')*?';
  const openStates = tags.map((tag,index) => {
    const folded = caseFoldLiteral(tag);
    const rawOpen = '<'+folded+'(?=[\\s/>])'+attrs+'>';
    const summary = caseFoldLiteral('summary');
    const summaryPrefix = '(?:[^<]|'+comment+'|<(?=[a-zA-Z!/?])(?!!--|/'+summary+'\\s*>)'+attrs+'>)*';
    const exception = tag==='details' ? '(?!\\s*<'+summary+attrs+'>'+summaryPrefix+'平行线事件)' : '';
    const otherTag = '<(?=[a-zA-Z!/?])(?!!--|/?'+folded+'(?=[\\s/>]))'+attrs+'>';
    const bodyTokens = comment+'|'+fence('`','BodyTicks'+index)+'|'+fence('~','BodyTildes'+index)+'|'+rawText(tag)+'|'+
      (enableOpaqueDrivers?opaqueDrivers('Body'+index)+'|':'')+otherTag+'|'+text+'|'+literalLess;
    const bodyGroup = 'rkdContextBodyToken'+index;
    const body = '(?:(?=(?<'+bodyGroup+'>'+bodyTokens+'))\\k<'+bodyGroup+'>)*';
    // A second same-tag opener before its closer remains conservative even
    // after closing markup. Different tags are checked independently here.
    return rawOpen+exception+body+'(?:\\k<'+suffix+'>'+end+'|'+rawOpen+exception+'[\\s\\S]*\\k<'+suffix+'>'+end+')';
  }).join('|');
  const absolute = '(?<![\\s\\S])';
  // A complete-prefix proof also ignores fake unclosed comments/attributes
  // inside a closed fence. Give its three token captures separate names;
  // both scans share the one suffix locating the candidate checkpoint.
  const lexicalPrefix = prefix.replace(/rkdContextToken/g,'rkdContextLexicalToken')
    .replace(/rkdContextFenceTicks/g,'rkdContextLexicalTicks')
    .replace(/rkdContextFenceTildes/g,'rkdContextLexicalTildes')
    .replace(/rkdDriverPrefix/g,'rkdDriverLexical')
    .replace(/rkdContextFenceDriverPrefix/g,'rkdContextFenceDriverLexical');
  const lexical = '(?<=(?='+absolute+lexicalPrefix+'\\k<'+suffix+'>'+end+')[\\s\\S]*)';
  const unclosed = '(?<!(?='+absolute+prefix+'(?:'+openStates+'))[\\s\\S]*)';
  return '(?=(?<'+suffix+'>[\\s\\S]*)'+end+')'+lexical+unclosed;
}

// Parse only the prefix ending at the candidate position. A forward lookahead
// captures the opener run before comparing its closer; the candidate suffix
// pins the stopping position without consuming or rewriting the message.
// This is a bounded fence lexer, not a Markdown/HTML renderer; callers use /m.
export function buildFenceGuard() {
  const line = '[^\\r\\n\\u2028\\u2029]';
  // CRLF is one token; accepting CR + LF as two alternative tokens creates
  // exponential backtracking when an in-fence candidate must be rejected.
  const lineBreak = '(?:\\r\\n|\\r(?!\\n)|(?<!\\r)\\n|[\\u2028\\u2029])';
  const end = '(?![\\s\\S])';
  const boundary = '(?=\\k<rkdFenceTail>' + end + ')';
  const opening = '[ ]{0,3}(?:`{3,}(?!`)[^`\\r\\n\\u2028\\u2029]*|~{3,}(?!~)' + line + '*)';
  const ordinary = '^(?!' + opening + '(?:' + lineBreak + '|' + end + '))(?:(?!' + boundary + ')' + line + ')*';
  function closedBlock(character, group) {
    const info = character === '`' ? '[^`\\r\\n\\u2028\\u2029]*' : line + '*';
    const close = '^[ ]{0,3}\\k<' + group + '>' + character + '*[ \\t]*(?=' + lineBreak + '|' + end + ')';
    return '^[ ]{0,3}(?<' + group + '>' + character + '{3,})(?!' + character + ')' + info + lineBreak +
      '(?:(?!' + close + '|' + boundary + ')[\\s\\S])*' + close + '(?!' + boundary + ')(?:' + lineBreak + '|' + end + ')';
  }
  const token = '(?:' + ordinary + '(?!' + boundary + ')' + lineBreak + ')|(?:' + closedBlock('`', 'rkdFenceTicks') +
    ')|(?:' + closedBlock('~', 'rkdFenceTildes') + ')';
  const noFenceStart = '(?<!^[ ]{0,3}(?:`{3,}|~{3,})[\\s\\S]*)';
  const prefix = '(?:(?=(?<rkdFencePrefixToken>' + token + '))\\k<rkdFencePrefixToken>)*' + ordinary;
  // The absolute-start assertion belongs inside the forward lookahead. Outside
  // it, RTL evaluation would retry the expensive lexer at every earlier line
  // before finally checking the start assertion.
  const scan = '(?=(?<rkdFenceTail>[\\s\\S]*)' + end + ')(?<=(?=(?<![\\s\\S])' + prefix +
    '\\k<rkdFenceTail>' + end + ')[\\s\\S]*)';
  return '(?:' + noFenceStart + '|' + scan + ')';
}

