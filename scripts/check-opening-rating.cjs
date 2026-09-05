// No dependencies. --sync-anchors updates only the generated worldbook anchor entry.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, '第一卷-世界书整理/开局页面/index.html'), 'utf8');
const engine = html.match(/<script id="opening-rating-engine">([\s\S]*?)<\/script>/)[1];
for (const [i, script] of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries()) new vm.Script(script[1], {filename: `inline-${i}.js`});
const ctx = vm.createContext({});
vm.runInContext(engine, ctx);
const stats = (s) => Object.fromEntries(ctx.RATING_AXES.map((k, i) => [k, s.split(' ')[i] || '']));
const samples = [
  ['史黛菈', 'A A A B B A', 'A'], ['宁音', 'A A A E A A', 'A'], ['黑乃', 'A B B A A A', 'A'],
  ['刀华', 'A C B B A D', 'B'], ['珠雫', 'D B C A E C', 'B'], ['彼方', 'B C B B D A', 'B'],
  ['碎城', 'A D D E C D', 'C'], ['桐原', 'E D D B D B', 'C'], ['藏人', 'B B D F B+ D', 'C'],
  ['兔丸', 'B F E D C C', 'D'], ['折木', 'B E D C C F', 'C'], ['有栖院', 'E D D C C D', 'D'],
  ['绚濑', 'C+ E E D D+ E', 'D'], ['泡沫', 'F A D D F E', 'C'], ['一辉', 'F F F E A F', 'F'],
  ['王马', 'A A B C A C', 'A'], ['雾子', 'D B C A E D', 'B'], ['诸星', 'C A C C A E', 'B'],
];
for (const [name, s, expected] of samples) assert.equal(ctx.calculateOpeningRating(stats(s)).base, expected, name);
assert.equal(ctx.calculateOpeningRating(stats('B B C F')).base, 'B', '4.666 rounds to B');
assert.equal(ctx.calculateOpeningRating(stats('B C C+ F')).base, 'B', '4.5 rounds upward');
assert.equal(ctx.calculateOpeningRating(stats('F F F F')).base, 'F');
assert.equal(ctx.calculateOpeningRating(stats('A A A A')).base, 'A');
assert.equal(ctx.calculateOpeningRating(stats('A A A')).base, null, 'unknown is not discarded as minimum');
assert.equal(ctx.calculateOpeningRating(stats('S A A A')).base, null);
assert.equal(ctx.calculateOpeningRating(stats('A+ A A A')).base, null);
assert.equal(ctx.ratingGradeValue('B+'), 5.5);
let combinations = 0;
for (const a of ctx.RATING_GRADES) for (const b of ctx.RATING_GRADES) for (const c of ctx.RATING_GRADES) for (const d of ctx.RATING_GRADES) {
  const input = {attack:a, defense:b, magic:c, control:d, physical:'F', luck:'A'};
  const result = ctx.calculateOpeningRating(input);
  assert.match(result.base, /^[A-F]$/);
  assert.equal(result.base, ctx.calculateOpeningRating({...input, physical:'A', luck:'F'}).base);
  combinations++;
}
const profile = {name:'测试 U', ability:'控制水流', limits:'近距离', stats:stats('D B C A E C')};
const review = {rule:ctx.RATING_RULE_VERSION, basis:ctx.assessmentBasis(profile), adjustment:0, reviewReason:'维持；六维已体现能力价值', reasons:Object.fromEntries(ctx.RATING_AXES.map(k => [k,'基于提供的设定']))};
assert.equal(ctx.profileRating(profile, false).status, 'awaiting_review');
profile.assessment = review;
assert.equal(ctx.profileRating(profile, false).proposed, 'B');
assert.throws(() => ctx.validateAssessment({...profile, ability:'新增无限距离'}, review));
assert.throws(() => ctx.validateAssessment(profile, {...review, adjustment:2}));
assert.throws(() => ctx.validateAssessment(profile, {...review, reviewReason:''}));
assert.throws(() => ctx.validateAssessment(profile, {...review, reasons:{}}));
const high = {...profile, stats:stats('A A A A')};
assert.throws(() => ctx.validateAssessment(high, {...review, basis:ctx.assessmentBasis(high), adjustment:1}));
const low = {...profile, stats:stats('F F F F')};
assert.throws(() => ctx.validateAssessment(low, {...review, basis:ctx.assessmentBasis(low), adjustment:-1}));
assert.equal(ctx.profileRating({...profile, stats:stats('A A A A')}, true).proposed, 'F', 'canon bypasses custom fitting');
assert.notEqual(ctx.assessmentRequestId(profile), ctx.assessmentRequestId({...profile, limits:'无条件'}));
assert.ok(ctx.makeAssessmentRequest(profile).includes(ctx.assessmentRequestId(profile)));
const anchorFile = path.join(root, '世界书规则/v0.3/02_六维参照.md');
const content = '# LK-AXIS-001 · 六维参照\n\n启用建议：建档、能力评定、明确重评时与 LK-RANK-001 一起启用。\n\n<!-- 正文开始 -->\n【六维参照 R05】\n以下是本卡以原作早期人物表校准的定性参照，不是官方统一物理阈值。比较同类能力的用途、条件和代价，不把某个代表人物的专属技能赠送给整档角色。无法判断就保留未知。\n\n' + ctx.ratingAnchorsText() + '\n<!-- 正文结束 -->\n\n生成源：开局页 opening-rating-engine 的 RATING_ANCHORS。来源与新增规则边界见 参照来源与采用说明.md。\n';
if (process.argv.includes('--sync-anchors')) fs.writeFileSync(anchorFile, content, 'utf8');
assert.equal(fs.readFileSync(anchorFile, 'utf8'), content, 'worldbook and assessment request must use identical anchors');
console.log(JSON.stringify({status:'PASS', historical_samples:18, grade_combinations:combinations, syntax:'all inline scripts', checks:['unknown','half-up','plus','physical/luck independence','review limits','stale basis','canon protection','anchor parity'], host_verified:false}, null, 2));
