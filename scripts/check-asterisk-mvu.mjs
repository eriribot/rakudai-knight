import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { INITIAL_STATE, RAKUDAI_INITIAL_STATE, createSchema, enforceRelationshipScores } from '../世界书规则/MVU/schema.mjs';
import { applyOpening, applyOpeningReplacement, applyTransition, acceptAutomaticStoryProgress, enforceStateOwnership, enforceGrowthProgress, createStateController, editOcPlayerProfile } from './rakudai-state-core.mjs';
import { resolveMvuWorld, repairRakudaiMvuStructure, hasBlazerAbility, hasBlazerGrowth } from './rakudai-mvu-structure.mjs';
import { installRakudaiNativeMvu } from './rakudai-mvu-native.mjs';

const require = createRequire(import.meta.url), { z } = require('../output/worldbook-calibration/dev/node_modules/zod');
const schema = createSchema(z), copy = structuredClone, results = [];
const person = { 关系: '已建立直接联系', 态度印象: '本局实际认识', 性别: '女性', 好感: 10, 支援度: 0, 羁绊阶段: '未建立', 变化依据: '双方已经交谈' };
const draft = () => ({
  系统: { 结构版本: 4, 作品: 'asterisk', 主角模式: '自定义角色' },
  场景: { 当前卷: null, 当前章: '入学报到', 时间: '报到日早晨', 地点: '星导馆学园', 切入说明: '来到接待处' },
  玩家: { ...copy(INITIAL_STATE.玩家), 姓名: '测试学生', 所属: '星导馆学园', 当前身体: '本局确认的身体', 当前能力边界: '不预授原作能力', 本局映射: '',
    学战: { 学园ID: 'seidoukan', 能力身份: '星脉世代', 能力机制: '以已掌握技术战斗', 共通限制: '尚无额外异能', 招式: {},
      星辰力: { 说明: '本局已确认的文字描述' }, 校内序列: { 状态: '未上榜', 名次: null }, 武装: { 类别: '不使用武装', 名称: '', 使用条件: '' } } },
});
const state = () => schema.parse(applyOpening(copy(INITIAL_STATE), draft()));
async function check(name, run) { try { await run(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.stack }); } }

await check('中性初始化、旧已建档回退和未知作品各自独立', () => {
  schema.parse(INITIAL_STATE); assert.equal(resolveMvuWorld(INITIAL_STATE), null);
  assert.equal(repairRakudaiMvuStructure(INITIAL_STATE), INITIAL_STATE);
  const legacy = copy(RAKUDAI_INITIAL_STATE); legacy.系统.开局状态 = '已建档';
  assert.equal(resolveMvuWorld(legacy), 'rakudai'); legacy.系统.作品 = 'unknown'; assert.equal(resolveMvuWorld(legacy), null);
  assert.equal(schema.safeParse(legacy).success, false);
});
await check('AW建档事务保留人际、系统metadata和包装，回读只写一次', async () => {
  let data = { stat_data: copy(INITIAL_STATE), external: { retained: true } }, writes = 0;
  data.stat_data.系统.已删除人物 = ['旧档移除者']; data.stat_data.人际.尤莉丝 = copy(person);
  const controller = createStateController({
    capture: () => ({ data: copy(data) }), current: () => ({ data: copy(data) }), validate: value => schema.parse(value),
    write: (_saved, expected, next) => { assert.deepEqual(data, expected); data = { ...data, stat_data: copy(next) }; writes++; },
  });
  const { token } = await controller.capture(), payload = draft(), original = copy(payload);
  await controller.commitOpening(token, payload); await controller.commitOpening(token, payload); await controller.verify(token);
  assert.equal(writes, 1); assert.deepEqual(payload, original); assert.deepEqual(data.external, { retained: true });
  assert.equal(data.stat_data.系统.作品, 'asterisk'); assert.deepEqual(data.stat_data.系统.已删除人物, ['旧档移除者']);
  assert.equal(data.stat_data.人际.尤莉丝.好感, 10); assert.equal(data.stat_data.场景.当前卷, null);
  for (const key of ['魔人觉醒', '伐刀能力', '六维', '综合初评', '登记等级', '成长']) assert.equal(Object.hasOwn(data.stat_data.玩家, key), false, key);
});
await check('AW序列严格校验，技能沿用共用结构，额外能力字段按声明校验', () => {
  const current = state(); current.玩家.学战.招式.基础步法 = '已确认的练习';
  assert.equal(schema.parse(current).玩家.学战.招式.基础步法.掌握状态, '待确认');
  for (const rank of [{ 状态: '已上榜', 名次: null }, { 状态: '未上榜', 名次: 1 }, { 状态: '已上榜', 名次: 73 }]) {
    const bad = state(); bad.玩家.学战.校内序列 = rank;
    const parsed = schema.safeParse(bad); assert.equal(parsed.success, false);
    assert.ok(parsed.error.issues.some(issue => issue.path.slice(0, 3).join('/') === '玩家/学战/校内序列'));
    assert.ok(parsed.error.issues.every(issue => issue.code !== 'invalid_union'));
  }
  for (const id of ['seidoukan', 'gallardworth', 'jielong', 'rewolf', 'arlequint']) { const valid = state(); valid.玩家.学战.学园ID = id; assert.equal(schema.safeParse(valid).success, true); }
  current.玩家.六维 = copy(RAKUDAI_INITIAL_STATE.玩家.六维); assert.equal(schema.safeParse(current).success, true);
  current.玩家.伐刀能カ = {}; assert.equal(schema.safeParse(current).success, false);
});
await check('作品不可借补丁或替换人物改写，AW自由阶段与人际仍正常保存', () => {
  const before = { stat_data: state() }; before.stat_data.人际.尤莉丝 = copy(person);
  const after = copy(before); after.stat_data.系统.作品 = 'rakudai';
  after.stat_data.场景.当前章 = '学园日常'; after.stat_data.场景.当前卷 = 1;
  after.stat_data.场景.已发生事件.约见 = { 卷号: null, 章段: '入学报到', 结果: '双方约好见面', 参与者: ['测试学生', '尤莉丝'], 知情者: ['测试学生', '尤莉丝'] };
  after.stat_data.玩家.综合初评 = copy(RAKUDAI_INITIAL_STATE.玩家.综合初评); after.stat_data.场景.选拔赛 = {};
  after.stat_data.玩家.学战.能力机制 = '本轮核实后的描述'; after.stat_data.人际.尤莉丝.好感 = 15;
  after.stat_data.人际.尤莉丝.变化依据 = '本轮友好交谈，10→15';
  enforceStateOwnership(after, before, { replyKey: 'aw:1' });
  enforceRelationshipScores(after, before, { replyKey: 'aw:1', submittedFields: [[JSON.stringify(['尤莉丝', '好感']), 15], [JSON.stringify(['尤莉丝', '变化依据']), after.stat_data.人际.尤莉丝.变化依据]] });
  schema.parse(after.stat_data);
  assert.equal(after.stat_data.系统.作品, 'asterisk'); assert.equal(after.stat_data.场景.当前章, '学园日常'); assert.equal(after.stat_data.场景.当前卷, null);
  assert.equal(after.stat_data.玩家.成长, undefined); assert.equal(after.stat_data.场景.选拔赛, undefined); assert.equal(after.stat_data.人际.尤莉丝.好感, 15);
  assert.equal(after.stat_data.玩家.学战.能力机制, '本轮核实后的描述');
  const wrong = draft(); wrong.系统.作品 = 'rakudai'; assert.throws(() => applyOpeningReplacement(before.stat_data, wrong), /切换作品/);
});
await check('纯AW不生成伐刀成长，AW主线不接落第卷章和赛事', async () => {
  const before = { stat_data: state() }, after = copy(before);
  assert.deepEqual(enforceGrowthProgress(after, before), []); assert.deepEqual(after, before);
  assert.equal(acceptAutomaticStoryProgress(before.stat_data, after.stat_data), false); assert.deepEqual(after, before);
  assert.throws(() => applyTransition(before.stat_data, { action: 'end' }), /未启用落第/);
  const controller = createStateController({ capture: () => ({ data: copy(before) }), current: () => ({ data: copy(before) }), validate: value => schema.parse(value), write: () => assert.fail('AW赛事不可写入') });
  await assert.rejects(controller.tournamentAction((await controller.capture()).token, { action: 'initialize' }), /未启用落第/);
});
await check('N04接受AW原生补丁并保护作品，绝不补落第经验或拦截普通休息叙事', async () => {
  const hooks = new Map(), context = { characterId: 1, groupId: null, chat: [{ is_user: true, mes: '休息' }, { is_user: false, mes: '本轮正文' }] };
  const H = { SillyTavern: { getContext: () => context } };
  const W = { top: H, parent: H, Mvu: { events: { VARIABLE_UPDATE_STARTED: 'started', COMMAND_PARSED: 'parsed' } },
    waitGlobalInitialized: async () => {}, eventOn: (name, callback) => { hooks.set(name, callback); return { stop: () => hooks.delete(name) }; }, addEventListener() {}, removeEventListener() {} };
  const marker = await installRakudaiNativeMvu(W), data = { stat_data: state() };
  hooks.get('started')(data); assert.equal(data.schema.strictSet, true); assert.equal(data.stat_data.玩家.成长, undefined);
  const command = (path, value) => ({ type: 'set', reason: 'json_patch', full_match: JSON.stringify({ op: 'replace', path, value }), args: [path.slice(1).split('/').map(key => '[' + JSON.stringify(key) + ']').join(''), JSON.stringify(value)] });
  const commands = [command('/系统/作品', 'rakudai'), command('/场景/选拔赛', {}), command('/玩家/学战/星辰力/说明', '休息后状态恢复'), command('/人际/新同学/关系', '同学')];
  hooks.get('parsed')(data, commands, '本轮正文');
  assert.deepEqual(commands.map(row => JSON.parse(row.full_match).path), ['/玩家/学战/星辰力/说明', '/人际/新同学']);
  assert.equal(data.stat_data.系统.作品, 'asterisk'); assert.equal(data.stat_data.玩家.成长, undefined); marker.destroy();
});
await check('AW保存伐刀能力与煌武，能力编辑明确选体系，主线保持学战', () => {
  const before = { stat_data: state() }, after = copy(before);
  Object.assign(after.stat_data.玩家, { 伐刀能力: copy(RAKUDAI_INITIAL_STATE.玩家.伐刀能力), 固有灵装: '本局已觉醒灵装', 登记等级: null });
  after.stat_data.玩家.学战.武装 = { 类别: '煌式武装', 名称: '借用训练剑', 使用条件: '本局已确认可使用' };
  enforceStateOwnership(after, before, { replyKey: 'aw:hybrid' });
  let saved = schema.parse(after.stat_data);
  assert.equal(hasBlazerAbility(saved), true); assert.equal(hasBlazerGrowth(saved), false);
  assert.equal(saved.系统.作品, 'asterisk'); assert.equal(saved.玩家.固有灵装, '本局已觉醒灵装');
  assert.equal(saved.玩家.学战.武装.名称, '借用训练剑');
  assert.equal(Object.hasOwn(saved.玩家, '魔人觉醒'), false); assert.equal(Object.hasOwn(saved.玩家, '成长'), false);
  const awMechanism = saved.玩家.学战.能力机制;
  saved = schema.parse(editOcPlayerProfile(saved, { action: 'ability', abilitySystem: 'blazer', mechanism: '已确认伐刀能力', cost: '使用后疲劳' }));
  assert.equal(saved.玩家.伐刀能力.能力本质, '已确认伐刀能力'); assert.equal(saved.玩家.学战.能力机制, awMechanism);
  assert.throws(() => editOcPlayerProfile(saved, { action: 'ability', abilitySystem: 'wrong' }), /能力体系/);
});
await check('落第保存煌武不生成六花学籍或星辰力，武装模块可独立存在', () => {
  const current = copy(RAKUDAI_INITIAL_STATE);
  current.系统 = { ...current.系统, 作品: 'rakudai', 开局状态: '已建档', 主角模式: '自定义角色' }; current.玩家.姓名 = '测试伐刀者';
  const before = { stat_data: schema.parse(current) }, after = copy(before);
  after.stat_data.玩家.学战 = { 武装: { 类别: '煌式武装', 名称: '训练用煌武', 使用条件: '已取得并确认适配' } };
  enforceStateOwnership(after, before, { replyKey: 'rk:hybrid' });
  const saved = schema.parse(after.stat_data);
  assert.equal(saved.系统.作品, 'rakudai'); assert.equal(saved.玩家.学战.武装.名称, '训练用煌武');
  assert.equal(Object.hasOwn(saved.玩家.学战, '学园ID'), false); assert.equal(Object.hasOwn(saved.玩家.学战, '星辰力'), false);
  assert.deepEqual(saved.玩家.伐刀能力, before.stat_data.玩家.伐刀能力);
});
await check('AW伐刀成长按终值晋级且重放不重复计算，原有武装和主线不变', () => {
  const current = state();
  Object.assign(current.玩家, { 伐刀能力: copy(RAKUDAI_INITIAL_STATE.玩家.伐刀能力), 六维: copy(RAKUDAI_INITIAL_STATE.玩家.六维), 魔人觉醒: false,
    成长: { 经验: { 魔力控制: 90, 体能: 0, 魔力量: 0 }, 申请: { 历史: { 保留: true } } } });
  current.玩家.六维.魔力控制 = 'F';
  const before = { stat_data: schema.parse(current) }, after = copy(before);
  after.stat_data.玩家.成长.经验.魔力控制 = 130;
  const context = { replyKey: 'aw:growth', growthFinalAxes: ['魔力控制'] };
  enforceStateOwnership(after, before, context); enforceGrowthProgress(after, before, context);
  schema.parse(after.stat_data);
  assert.equal(after.stat_data.玩家.六维.魔力控制, 'F+'); assert.equal(after.stat_data.玩家.成长.经验.魔力控制, 30);
  assert.deepEqual(after.stat_data.玩家.成长.申请, current.玩家.成长.申请); assert.equal(after.stat_data.玩家.成长.记录, undefined);
  const replay = copy(after); replay.stat_data.玩家.成长.经验.魔力控制 = 130;
  enforceGrowthProgress(replay, after, context);
  assert.equal(replay.stat_data.玩家.成长.经验.魔力控制, 30); assert.equal(replay.stat_data.玩家.六维.魔力控制, 'F+');
  assert.equal(replay.stat_data.系统.作品, 'asterisk'); assert.deepEqual(replay.stat_data.玩家.学战, before.stat_data.玩家.学战);
});
console.log(JSON.stringify({ passed: results.filter(result => result.passed).length, total: results.length, results }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
