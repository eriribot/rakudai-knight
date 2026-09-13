import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { INITIAL_STATE, createSchema, createLegacyV3Schema, migrateV3, prepareStateMigration } from '../世界书规则/MVU/schema.mjs';
import { createStateController, applyTransition, enforceStateOwnership } from './rakudai-state-core.mjs';
import { STORY_VOLUMES, firstStoryChapter, storyPosition } from './rakudai-story-catalog.mjs';

const require = createRequire(import.meta.url), { z } = require('../output/worldbook-calibration/dev/node_modules/zod');
const schema = createSchema(z), legacy = createLegacyV3Schema(z), clone = structuredClone, results = [];
const controllerSchema = createSchema(z, { normalizeRelationships: false });
const event = (volume, chapter) => ({ 卷号: volume, 章段: chapter, 结果: '本局实际完成的事件', 参与者: ['玩家'], 知情者: ['玩家'] });
function state(volume = 1, chapter = firstStoryChapter(volume).key, phase = '进行中') {
  const value = clone(INITIAL_STATE);
  value.系统 = { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' };
  value.玩家.姓名 = '测试玩家';
  value.场景 = { ...value.场景, 当前卷: volume, 当前章: chapter, 阶段: phase, 时间: '已确认时间', 地点: '已确认地点', 切入说明: '已确认切入' };
  return value;
}
function oldState() {
  const value = state(1, '终章', '已结束');
  value.系统.结构版本 = 3;
  // 当前初始值含 v4 觉醒开关；合法 v3 夹具只保留当时定义的字段。
  delete value.玩家.魔人觉醒;
  const record = event(1, '第四章'); delete record.卷号;
  value.场景.已发生事件.第一卷记录 = record;
  value.人际.同伴 = { 关系: '同伴', 态度印象: '实际相处记录', 性别: '女性', 好感: 502, 支援度: 181, 羁绊阶段: 'B', 恋爱阶段: '暧昧', 好感突破依据: '之前已成立的依据', 变化依据: '已经发生的协作' };
  value.$internal = { display_data: { retained: true }, delta_data: {} };
  return legacy.parse(value);
}
const destination = { time: '次日早晨', location: '已经确认的目标场所', entryNote: '从已确认情境切入，不补造中间卷事件' };
function fixture(initial = oldState()) {
  let data = { stat_data: clone(initial), display_data: { retained: true }, delta_data: {}, external: { retained: ['wrapper'] } };
  let scope = 1, writes = 0, responseFails = false, discardWrite = false;
  const adapter = {
    capture: () => ({ data: clone(data), scope }),
    current: snapshot => { if (snapshot.scope !== scope) throw new Error('聊天或 swipe 已变化'); return { data: clone(data) }; },
    validate: value => { controllerSchema.parse(value); return clone(value); },
    migrate: value => prepareStateMigration(value, z),
    write: (snapshot, expected, next) => {
      if (snapshot.scope !== scope) throw new Error('聊天或 swipe 已变化');
      assert.deepEqual(data, expected);
      if (!discardWrite) data = { ...clone(data), stat_data: clone(next) };
      writes++;
      if (responseFails) throw new Error('保存响应丢失');
    },
  };
  return { api: createStateController(adapter), get data() { return data; }, get writes() { return writes; },
    mutate: fn => fn(data), switch: () => { scope++; }, failResponse: () => { responseFails = true; }, discard: () => { discardWrite = true; } };
}
async function check(name, run) { try { await run(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.stack }); } }

await check('19 卷所有真实目录节点均可通过 v4 组合校验', () => {
  assert.equal(STORY_VOLUMES.length, 19);
  let count = 0;
  for (const volume of STORY_VOLUMES) for (const chapter of volume.chapters) {
    const value = state(volume.volume, chapter.key);
    value.场景.已发生事件.本章事件 = event(volume.volume, chapter.key);
    assert.equal(schema.parse(value).场景.当前章, chapter.key);
    assert.equal(storyPosition(volume.volume, chapter.key), count++);
  }
  assert.equal(count, 100);
});
await check('拒绝错误卷号类型、目录不存在卷与不属于该卷的章节', () => {
  for (const volume of [0, 20, 2.5, '2', null]) { const value = state(); value.场景.当前卷 = volume; assert.equal(schema.safeParse(value).success, false); }
  for (const chapter of ['第五章', '第一章后半', 'chapter1', '']) { const value = state(); value.场景.当前章 = chapter; assert.equal(schema.safeParse(value).success, false); }
  assert.equal(schema.safeParse(state(16, '终章')).success, false);
});
await check('目录的明确别名可归一，其余近似章节不自动猜测', () => {
  const original = state(6, '间章');
  original.场景.已发生事件.开场 = event(6, '间章');
  const parsed = schema.parse(original);
  assert.equal(parsed.场景.当前章, '间章1'); assert.equal(parsed.场景.已发生事件.开场.章段, '间章1');
  assert.equal(original.场景.当前章, '间章');
  assert.equal(schema.safeParse(state(6, '间章 1')).success, false);
});
await check('跨卷保留历史事件，但未来卷与本卷未来节点都不得记为已发生', () => {
  const value = state(2, '序章'); value.场景.已发生事件.旧卷终章 = event(1, '终章');
  assert.equal(schema.safeParse(value).success, true);
  for (const record of [event(2, '第一章'), event(3, '序章'), event(6, '第五章')]) {
    value.场景.已发生事件.未来 = record; assert.equal(schema.safeParse(value).success, false);
  }
});
await check('第十六卷的终章Ⅱ按原文排列在序章之前，不按名称推断顺序', () => {
  const value = state(16, '序章'); value.场景.已发生事件.前一节点 = event(16, '终章Ⅱ');
  assert.equal(schema.safeParse(value).success, true);
  value.场景.当前章 = '终章Ⅱ'; value.场景.已发生事件.未来 = event(16, '序章');
  assert.equal(schema.safeParse(value).success, false);
});
await check('事件卷号必填，错误组合与未知业务字段不能混入 v4', () => {
  const value = state(19, '终章'); value.场景.已发生事件.错误 = event(1, '第五章');
  assert.equal(schema.safeParse(value).success, false);
  value.场景.已发生事件.错误 = event(1, '第一章'); delete value.场景.已发生事件.错误.卷号;
  assert.equal(schema.safeParse(value).success, false);
  value.场景.已发生事件.错误.卷号 = 1; value.场景.已发生事件.错误.未知字段 = true;
  assert.equal(schema.safeParse(value).success, false);
});
await check('合法 v3 候选只升级结构与为事件补卷一，保留人物和 $internal', () => {
  const before = oldState(), original = clone(before), preview = prepareStateMigration(before, z);
  assert.equal(preview.status, 'migration-required'); assert.equal(preview.state.系统.结构版本, 4);
  assert.deepEqual(preview.changes.map(change => change.path), ['/系统/结构版本', '/场景/已发生事件/第一卷记录/卷号']);
  assert.deepEqual(preview.state.玩家, before.玩家); assert.deepEqual(preview.state.人际, before.人际); assert.deepEqual(preview.state.$internal, before.$internal);
  assert.deepEqual(before, original); assert.deepEqual(migrateV3(preview.state, z), preview.state);
});
await check('版本仍为 v3 的布尔觉醒开关在迁移候选中原样保留，不改原档', () => {
  for (const awakened of [true, false]) {
    const before = oldState(); before.玩家.魔人觉醒 = awakened;
    const original = clone(before), preview = prepareStateMigration(before, z);
    assert.equal(preview.state.系统.结构版本, 4); assert.equal(preview.state.玩家.魔人觉醒, awakened);
    assert.deepEqual(before, original); assert.deepEqual(preview.state.玩家, before.玩家);
    assert.equal(preview.changes.some(change => change.path === '/玩家/魔人觉醒'), false);
    assert.equal(legacy.safeParse(before).success, false); // 兼容仅限迁移入口，旧 schema 仍严格。
  }
});
await check('混合旧档拒绝非布尔觉醒值与其他未知玩家字段', () => {
  for (const value of ['true', 'false', 0, 1, null, undefined]) {
    const before = oldState(); before.玩家.魔人觉醒 = value;
    const original = clone(before);
    assert.throws(() => prepareStateMigration(before, z), /魔人觉醒.*true 或 false/); assert.deepEqual(before, original);
  }
  const before = oldState(); before.玩家.魔人觉醒 = true; before.玩家.未知字段 = false;
  const original = clone(before);
  assert.throws(() => prepareStateMigration(before, z)); assert.deepEqual(before, original);
});
await check('v3 卷二、未知字段与非 v3/v4 来源不自动修复或迁移', () => {
  for (const mutate of [value => { value.场景.当前卷 = 2; }, value => { value.未知字段 = 1; }, value => { value.系统.结构版本 = 2; }, value => { value.系统.结构版本 = 99; }]) {
    const value = oldState(); mutate(value); const original = clone(value);
    assert.throws(() => prepareStateMigration(value, z)); assert.deepEqual(value, original);
  }
});
await check('合法旧人物阶段与缺省字段在迁移预览、实际提交及后续切章中原样保留', async () => {
  const before = oldState();
  before.人际.同伴.羁绊阶段 = 'C'; delete before.人际.同伴.恋爱阶段;
  delete before.玩家.性别; delete before.场景.切入说明;
  assert.equal(createLegacyV3Schema(z, { normalizeRelationships: false }).safeParse(before).success, true);
  const original = clone(before), preview = prepareStateMigration(before, z);
  assert.deepEqual(preview.changes.map(change => change.path), ['/系统/结构版本', '/场景/已发生事件/第一卷记录/卷号']);
  assert.deepEqual(preview.state.玩家, before.玩家); assert.deepEqual(preview.state.人际, before.人际);
  const f = fixture(before), candidate = await f.api.prepareMigration();
  assert.deepEqual(candidate.state, preview.state); assert.equal(f.writes, 0);
  await f.api.commitMigration(candidate.token); assert.deepEqual(f.data.stat_data, preview.state);
  const captured = await f.api.capture(); assert.deepEqual(captured.state.玩家, before.玩家); assert.deepEqual(captured.state.人际, before.人际);
  await f.api.transition(captured.token, { action: 'nextVolume', ...destination });
  assert.deepEqual(f.data.stat_data.玩家, before.玩家); assert.deepEqual(f.data.stat_data.人际, before.人际);
  assert.deepEqual(before, original); assert.equal(f.writes, 2);
});
await check('关闭关系归一仅供页面事务；默认 MVU schema 仍按当前计分规则派生', () => {
  const value = state(); value.人际.同伴 = { 关系: '同伴', 态度印象: '', 性别: '女性', 好感: 502, 支援度: 181, 羁绊阶段: 'C', 变化依据: '旧记录保留' };
  const original = clone(value), verified = controllerSchema.parse(value), normalized = schema.parse(value);
  assert.deepEqual(verified.人际, original.人际); assert.equal(normalized.人际.同伴.羁绊阶段, 'B'); assert.equal(normalized.人际.同伴.恋爱阶段, '暧昧'); assert.deepEqual(value, original);
});
await check('capture 对旧楼层明确要求迁移；预览不写入、不改变当前活动槽', async () => {
  const f = fixture(), original = clone(f.data);
  await assert.rejects(f.api.capture(), error => error.code === 'MIGRATION_REQUIRED');
  const preview = await f.api.prepareMigration();
  assert.equal(preview.state.系统.结构版本, 4); assert.equal(f.writes, 0); assert.deepEqual(f.data, original);
  preview.state.玩家.姓名 = '篡改预览副本';
  const result = await f.api.commitMigration(preview.token);
  assert.equal(result.state.玩家.姓名, original.stat_data.玩家.姓名); assert.equal(f.writes, 1);
  assert.deepEqual(f.data.external, original.external); assert.deepEqual(f.data.display_data, original.display_data);
});
await check('迁移凭据不能被剧情按钮偷偷提交，普通凭据不能用作迁移', async () => {
  const f = fixture(), preview = await f.api.prepareMigration();
  await assert.rejects(f.api.transition(preview.token, { action: 'next' }), /用途不符/); assert.equal(f.writes, 0);
  await f.api.commitMigration(preview.token); const capture = await f.api.capture();
  await assert.rejects(f.api.commitMigration(capture.token), /用途不符/); assert.equal(f.writes, 1);
});
await check('确认迁移后重复点击与响应丢失重试只落地一次', async () => {
  for (const fail of [false, true]) {
    const f = fixture(), preview = await f.api.prepareMigration();
    if (fail) { f.failResponse(); await assert.rejects(f.api.commitMigration(preview.token), /响应丢失/); }
    else await f.api.commitMigration(preview.token);
    assert.equal((await f.api.commitMigration(preview.token)).alreadyApplied, true); assert.equal(f.writes, 1);
  }
});
await check('迁移预览后切分支或包装被并发更新均拒绝覆盖', async () => {
  const f = fixture(), preview = await f.api.prepareMigration(); f.switch();
  await assert.rejects(f.api.commitMigration(preview.token), /swipe/); assert.equal(f.writes, 0);
  const g = fixture(), other = await g.api.prepareMigration(); g.mutate(value => { value.external.retained.push('新更新'); });
  await assert.rejects(g.api.commitMigration(other.token), /其他操作/); assert.equal(g.writes, 0);
});
await check('迁移写入未落地不能给成功回执', async () => {
  const f = fixture(), preview = await f.api.prepareMigration(); f.discard();
  await assert.rejects(f.api.commitMigration(preview.token)); assert.equal(f.data.stat_data.系统.结构版本, 3);
});
await check('全部 18 个卷边界按真实末章进入下一卷首节点，保留旧卷事件', () => {
  for (const volume of STORY_VOLUMES.slice(0, -1)) {
    const before = state(volume.volume, volume.chapters.at(-1).key, '已结束');
    before.场景.已发生事件.本卷结尾 = event(volume.volume, before.场景.当前章);
    assert.throws(() => applyTransition(before, { action: 'next' }), /当前卷末/);
    const after = applyTransition(before, { action: 'nextVolume', ...destination });
    assert.equal(after.场景.当前卷, volume.volume + 1); assert.equal(after.场景.当前章, firstStoryChapter(volume.volume + 1).key);
    assert.equal(after.场景.阶段, '未开始'); assert.deepEqual(after.场景.已发生事件, before.场景.已发生事件); schema.parse(after);
  }
});
await check('只有真实卷末且已结束才能换卷，第十九卷终章没有下一卷', () => {
  assert.throws(() => applyTransition(state(1, '第四章', '已结束'), { action: 'nextVolume', ...destination }), /最后章节/);
  assert.throws(() => applyTransition(state(1, '终章', '进行中'), { action: 'nextVolume', ...destination }), /最后章节/);
  assert.throws(() => applyTransition(state(19, '终章', '已结束'), { action: 'nextVolume', ...destination }), /最后一卷/);
});
await check('所有卷内下一章按目录前进，只重置阶段', () => {
  for (const volume of STORY_VOLUMES) for (let index = 0; index < volume.chapters.length - 1; index++) {
    const before = state(volume.volume, volume.chapters[index].key, '已结束');
    const after = applyTransition(before, { action: 'next' });
    assert.equal(after.场景.当前卷, volume.volume); assert.equal(after.场景.当前章, volume.chapters[index + 1].key);
    assert.equal(after.场景.阶段, '未开始'); assert.equal(after.场景.时间, before.场景.时间); assert.equal(after.场景.地点, before.场景.地点);
    assert.equal(applyTransition(after, { action: 'start' }).场景.阶段, '进行中');
  }
});
await check('手动向前切入只定位，不补造中间事件、人物或能力', () => {
  const before = state(1, '第二章'); before.场景.已发生事件.已经发生 = event(1, '第一章');
  const original = clone(before), after = applyTransition(before, { action: 'jump', volume: 16, chapter: '终章Ⅱ', ...destination });
  assert.equal(after.场景.当前卷, 16); assert.equal(after.场景.当前章, '终章Ⅱ'); assert.equal(after.场景.阶段, '未开始');
  assert.equal(after.场景.时间, destination.time); assert.equal(after.场景.地点, destination.location); assert.equal(after.场景.切入说明, destination.entryNote);
  assert.deepEqual(after.场景.已发生事件, before.场景.已发生事件); assert.deepEqual(after.玩家, before.玩家); assert.deepEqual(after.人际, before.人际); assert.deepEqual(before, original); schema.parse(after);
});
await check('手动切入拒绝后退、原节点、无效目标及未确认的时间地点说明', () => {
  const before = state(2, '第二章');
  for (const target of [{ volume: 1, chapter: '终章' }, { volume: 2, chapter: '第二章' }, { volume: 2, chapter: '第五章' }, { volume: 20, chapter: '序章' }]) {
    assert.throws(() => applyTransition(before, { action: 'jump', ...target, ...destination }));
  }
  for (const key of ['time', 'location', 'entryNote']) for (const value of ['', ' ', null]) {
    assert.throws(() => applyTransition(before, { action: 'jump', volume: 3, chapter: '序章', ...destination, [key]: value }), /确认目标/);
    assert.throws(() => applyTransition(state(1, '终章', '已结束'), { action: 'nextVolume', ...destination, [key]: value }), /确认目标/);
  }
});
await check('guard 保留页面写入责任，恢复的是原卷章而非固定卷一', () => {
  const previous = { stat_data: state(6, '第五章') }, variables = clone(previous);
  variables.stat_data.场景.当前卷 = 7; variables.stat_data.场景.当前章 = '第八章'; variables.stat_data.场景.地点 = '真实剧情更新地点';
  const paths = enforceStateOwnership(variables, previous);
  assert.ok(paths.includes('/场景/当前卷')); assert.equal(variables.stat_data.场景.当前卷, 6); assert.equal(variables.stat_data.场景.当前章, '第五章');
  assert.equal(variables.stat_data.场景.地点, '真实剧情更新地点');
});

const failed = results.filter(result => !result.passed);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
