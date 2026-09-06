// Exercise the real page converter without browser or MVU side effects.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, '第一卷-世界书整理/开局页面/index.html'), 'utf8');
const engine = html.match(/<script id="opening-rating-engine">([\s\S]*?)\/\/ opening-rating-engine:end/)[1];
const labels = html.match(/var AXIS_LABELS = (\{[^;]+\});/)[0];
const functions = html.slice(html.indexOf('      function buildOpeningMessage('), html.indexOf('      function archiveFeedback('));
const ctx = vm.createContext({});
vm.runInContext(engine + '\n' + labels + '\n' + functions, ctx);
const convert = draft => JSON.parse(JSON.stringify(ctx.buildOpeningVariables(draft)));
const draft = {
  profile_key: 'user', greeting: '在校门等候。',
  profile: {
    name: '测试人物', personality: '冷静', conduct: '先观察', school: '破军学园',
    device: '长剑', nobleArt: '试验绝技', category: '自然干涉系', desc: '由玩家填写的背景。',
    ability: '控制水流', limits: '需要水源', style: '防守反击',
    stats: {attack:'B+', defense:'C', magic:'B', control:'F', physical:'A', luck:'E'},
    rating: {score:999, base:'A', proposed:'A'}, rank:'A',
  },
};
const before = JSON.stringify(draft);
const result = convert(draft);
assert.deepEqual(Object.keys(result), ['系统', '玩家'], 'opening must not reset scene');
assert.deepEqual(result.系统, {结构版本:2, 开局状态:'已建档', 主角模式:'自定义角色'});
assert.equal(result.玩家.姓名, draft.profile.name);
assert.equal(result.玩家.角色简介, draft.profile.desc);
assert.deepEqual(result.玩家.六维, {攻击力:'B+', 防御力:'C', 魔力量:'B', 魔力控制:'F', 体能:'A', 运气:'E'});
assert.equal(result.玩家.综合初评.分数, (5.5 + 4 + 5) / 3);
assert.equal(result.玩家.综合初评.等级, 'B', 'recompute instead of trusting cached rating');
assert.equal(result.玩家.综合初评.拟定登记等级, null);
assert.equal(result.玩家.登记等级, null, 'ignore custom archive rank');
assert.equal(result.玩家.综合初评.评定状态, '已计算');
assert.equal(JSON.stringify(draft), before, 'conversion must not mutate old-format draft');
function assertChineseKeys(value) {
  if (!value || typeof value !== 'object') return;
  if (!Array.isArray(value)) for (const key of Object.keys(value)) assert.match(key, /^[\u3400-\u9fff]+$/, key);
  Object.values(value).forEach(assertChineseKeys);
}
assertChineseKeys(result);
const incomplete = structuredClone(draft);
incomplete.profile.stats.magic = '';
const pending = convert(incomplete);
assert.equal(pending.系统.开局状态, '待建档');
assert.equal(pending.玩家.六维.魔力量, '');
assert.equal(pending.玩家.综合初评.分数, null);
assert.equal(pending.玩家.综合初评.等级, null);
assert.deepEqual(pending.玩家.综合初评.待填写项, ['魔力量']);
assert.equal(pending.玩家.综合初评.评定状态, '待填写六维');
const noName = structuredClone(draft);
noName.profile.name = ' ';
assert.equal(convert(noName).系统.开局状态, '待建档', 'six grades alone are not a full profile');
const noPhysical = structuredClone(draft);
noPhysical.profile.stats.physical = '';
assert.equal(convert(noPhysical).系统.开局状态, '待建档');
assert.equal(convert(noPhysical).玩家.综合初评.等级, 'B', 'physical is required for profile, excluded from rating');
const canon = structuredClone(draft);
canon.profile_key = 'kurogane';
canon.profile.name = '黑铁一辉';
canon.profile.stats = {attack:'F', defense:'F', magic:'F', control:'E', physical:'A', luck:'F'};
const canonical = convert(canon);
assert.equal(canonical.系统.主角模式, '黑铁一辉');
assert.equal(canonical.玩家.登记等级, 'F');
assert.deepEqual(canonical.玩家.综合初评, {规则版本:'原作第一卷', 分数:null, 等级:'F', 拟定登记等级:'F', 评定状态:'原作档案', 待填写项:[]});
assertChineseKeys(canonical);
const message = ctx.buildOpeningMessage(draft);
const payload = message.split('【已确认的开局变量】\n')[1].split('\n\n请将上述')[0];
assert.deepEqual(JSON.parse(payload), result, 'copied opening must carry the converter output');
assert.match(message, /黑铁一辉继续作为独立 NPC/);
assert.match(ctx.buildOpeningMessage(canon), /不另生成一个同名的一辉/);
assert.match(html, /var ARCHIVE_VERSION = 3;/);
assert.match(html, /\[2, 3\]\.includes\(data.schema_version\)/);
console.log(JSON.stringify({status:'PASS', checks:['Chinese variable keys', 'incomplete profile', 'unknown grades', 'computed rating', 'canon F', 'draft immutability', 'scene preservation', 'opening payload', 'v2/v3 archive compatibility'], host_verified:false}, null, 2));
