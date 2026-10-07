import {createHash} from 'node:crypto';
import {buildContextGuard} from './context-guard.mjs';

// Three character-scoped display adapters run AFTER the unchanged Izumi preset
// and BEFORE the three bubble rules. IDs never replace a global/preset rule.
export const localArtifactNames = Object.freeze([
  'izumi-local-prefix', 'izumi-local-style', 'izumi-local-planning-close',
]);
export const localIzumiSource = Object.freeze({
  id:'a1a57b61-8f66-4956-bd0c-386c0356e232',
  findRegex:'/([\\s\\S]*)<\\/konatan_planning~>/g',
  replacementSha256:'36a1ab14368980692e15879b9cd06bb22ed1c004266fdc745700ae572956d062',
});
const ids = [
  'f426b5a6-56a3-48dc-96c2-0e4d6208e6e2',
  'ace941a3-9609-4a8d-a9da-a42981401db8',
  '72f31f2b-ba16-4653-9fbc-5b52389c1129',
];
// ST's regexFromString parser is not dotAll. A findRegex field must contain
// escaped line terminators, even when its constant template spans many lines.
// Replacement bytes remain unchanged.
const escape = text => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  .replace(/\r/g,'\\r').replace(/\n/g,'\\n')
  .replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const digest = text => createHash('sha256').update(text).digest('hex');

// The known content lives inside details/planning intentionally. Every other
// protected scope still rejects insertion, using the core's quote-aware tokens.
function planningInsertionGuard() {
  return buildContextGuard({excludedTags:['details','konatan_planning~']});
}

export function buildLocalIzumiRules(preset) {
  const source = preset?.extensions?.regex_scripts?.find(rule => rule.id === localIzumiSource.id);
  if (!source || source.findRegex !== localIzumiSource.findRegex ||
      typeof source.replaceString !== 'string' || digest(source.replaceString) !== localIzumiSource.replacementSha256) {
    throw new Error('未知 Izumi planning 版本：本卡适配只接受已验证的原始查找/模板，不覆盖未知修订');
  }
  const replacement = source.replaceString;
  const css = replacement.match(/^<style>[\s\S]*?<\/style>/)?.[0];
  const capture = replacement.indexOf('$1');
  if (!css || capture < css.length || replacement.indexOf('$1', capture + 2) >= 0) {
    throw new Error('已验证 Izumi 模板的首段 style / 单一内容插槽结构不符');
  }
  const head = replacement.slice(css.length, capture);
  const tail = replacement.slice(capture + 2);
  const contentOpen = '<div class="konata-thinking-content">';
  if (!head.endsWith(contentOpen) || !tail.startsWith('</div>') ||
      /\{\{|\$(?:\d|<)/.test(css + head)) {
    throw new Error('固定样式/前缀包含未知结构或动态宏，不能回填');
  }
  const hiddenCss = '<pre hidden>' + css + '</pre>';
  const context = buildContextGuard();
  const unclosedPlanBody = '(?:(?!<\\/konatan_planning~>)[\\s\\S])*';

  // The cleanup rule can delete the known wrapper opener and stylesheet while
  // leaving a message-head foreign planning opener + the exact template footer.
  // Rebuild only constant template bytes; all surviving source text stays put.
  const recoverAt = '(?=<konatan_planning~>' + unclosedPlanBody + escape(tail) + ')' +
    '(?<=(?<![\\s\\S])\\s*)' + context;

  // Exact CSS only, checked at its start. Copies in attributes/comments/fences,
  // protected blocks, or an already-hidden pre must remain untouched.
  const protectStyle = '(?=' + escape(css) + ')' + context + escape(css);

  // Fix only the foreign opener inside this exact generated template. The
  // complete footer is required, not a generic </div> or arbitrary raw planner.
  // A close is inserted without capturing/refilling the planning/user content.
  const ownedUnclosedPlan = '(?<=' + escape(head) +
    '(?:(?!<\\/div>|<\\/konatan_planning~>)[\\s\\S])*<konatan_planning~>' + unclosedPlanBody + ')';
  const closeAt = '(?=' + escape(tail) + ')' + ownedUnclosedPlan + planningInsertionGuard();
  const shared = {trimStrings:[],placement:[2],disabled:false,markdownOnly:true,promptOnly:false,
    runOnEdit:true,substituteRegex:0,minDepth:null,maxDepth:2};
  return [
    {...shared,id:ids[0],scriptName:'Izumi 本卡兼容 01 · 已知前缀恢复 v0.1',
      findRegex:'/' + recoverAt + '/m',replaceString:hiddenCss + head},
    {...shared,id:ids[1],scriptName:'Izumi 本卡兼容 02 · 固定样式保护 v0.1',
      findRegex:'/' + protectStyle + '/gm',replaceString:hiddenCss},
    {...shared,id:ids[2],scriptName:'Izumi 本卡兼容 03 · 已知规划边界 v0.1',
      findRegex:'/' + closeAt + '/m',replaceString:'</konatan_planning~>'},
  ];
}
