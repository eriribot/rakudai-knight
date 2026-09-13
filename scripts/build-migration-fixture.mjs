// Derive a synthetic v3 chat from a native v4 export. No browser/API access and no original-file writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createSchema, createLegacyV3Schema, migrateV3, migrationChanges } from '../世界书规则/MVU/schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(new URL('../output/worldbook-calibration/dev/package.json', import.meta.url));
const { z } = require('zod');
const INPUT = 'output/chapter-v4/runtime-fixture-v4-initial.jsonl';
const OUTPUT = 'output/chapter-v4/迁移验收-v3.jsonl';
const REPORT = 'output/chapter-v4/migration-fixture-check.json';
const clone = structuredClone;
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const semanticHash = value => sha256(JSON.stringify(canonical(value)));
const jsonPatch = changes => changes.map(change => ({ op: change.after === undefined ? 'remove' : change.before === undefined ? 'add' : 'replace', path: change.path, ...(change.after === undefined ? {} : { value: change.after }) }));

export function convertMigrationFixture(input, { messageId = 0 } = {}) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const text = bytes.toString('utf8');
  assert.ok(Buffer.from(text, 'utf8').equals(bytes), '只接收完整 UTF-8 JSONL，不修复损坏编码');
  const chunks = text.split(/(\r\n|\n|\r)/), records = [];
  for (let index = 0; index < chunks.length; index += 2) {
    const line = index === 0 ? chunks[index].replace(/^\uFEFF/, '') : chunks[index];
    if (line.trim()) records.push({ chunk: index, line: index / 2 + 1, value: JSON.parse(line) });
  }
  assert.ok(records.length >= 2, '需要原生导出的聊天元数据行和助手消息');
  const header = records[0].value;
  assert.ok(header && typeof header.chat_metadata === 'object' && Object.hasOwn(header, 'user_name') && Object.hasOwn(header, 'character_name'), '不猜测非原生聊天格式');
  const messages = records.slice(1).map(record => record.value);
  assert.ok(Number.isInteger(messageId) && messageId >= 0 && messageId < messages.length, '目标消息不存在');
  const lastAssistant = messages.findLastIndex(message => message.is_user === false && message.is_system === false);
  assert.equal(messageId, lastAssistant, '仅允许明确选定的最新助手楼层');
  const selected = messages[messageId], swipeId = selected.swipe_id;
  assert.ok(Array.isArray(selected.swipes) && Array.isArray(selected.variables), '缺少实机导出中的 swipes/variables 数组');
  assert.ok(Number.isInteger(swipeId) && swipeId >= 0 && swipeId < selected.swipes.length && swipeId < selected.variables.length, '活动 swipe 无效，不能猜槽位');
  assert.equal(selected.mes, selected.swipes[swipeId], '当前消息正文与活动 swipe 不一致');
  const beforeWrapper = selected.variables[swipeId], before = beforeWrapper?.stat_data;
  assert.ok(before && typeof before === 'object', '活动回复页没有 stat_data');
  createSchema(z, { normalizeRelationships: false }).parse(before);
  assert.equal(before.系统.结构版本, 4);
  assert.equal(before.场景.当前卷, 1, '已经跨卷的状态不能伪装为 v3；请导出第一卷快照');
  assert.equal(before.场景.当前章, '终章', '本验收档须从第一卷终章开始');
  assert.equal(before.场景.阶段, '已结束', '本验收档须已结束第一卷');
  assert.equal(before.玩家.姓名, '验收员', '只转换指定合成验收档，不处理真实玩家存档');
  const events = Object.entries(before.场景.已发生事件);
  assert.ok(events.length > 0, '至少保留一条原有合成事件以验收卷号迁移');
  for (const [name, event] of events) assert.equal(event.卷号, 1, '事件不属于第一卷：' + name);

  const candidate = clone(before);
  candidate.系统.结构版本 = 3;
  for (const event of Object.values(candidate.场景.已发生事件)) delete event.卷号;
  // 校验结果不能作为输出：Zod 的 default 不得补写人物字段。
  createLegacyV3Schema(z, { normalizeRelationships: false }).parse(candidate);
  const migrated = migrateV3(candidate, z);
  assert.deepEqual(migrated, before, 'v3→v4 往返必须恢复原状态，不能改写人物或进度');

  const beforeValues = records.map(record => record.value), afterValues = clone(beforeValues);
  afterValues[messageId + 1].variables[swipeId].stat_data = candidate;
  const prefix = '/' + (messageId + 1) + '/variables/' + swipeId + '/stat_data';
  const localChanges = migrationChanges(before, candidate);
  const expectedPaths = ['/系统/结构版本', ...events.map(([name]) => '/场景/已发生事件/' + name.replace(/~/g, '~0').replace(/\//g, '~1') + '/卷号')];
  assert.deepEqual(localChanges.map(change => change.path), expectedPaths);
  const restored = clone(afterValues); restored[messageId + 1].variables[swipeId].stat_data = clone(before);
  assert.deepEqual(restored, beforeValues, '不得修改聊天元数据、人物、包装或其他回复页');
  const changedRecord = records[messageId + 1];
  const outputChunks = [...chunks]; outputChunks[changedRecord.chunk] = JSON.stringify(afterValues[messageId + 1]);
  const output = Buffer.from(outputChunks.join(''), 'utf8');
  for (let index = 0; index < chunks.length; index++) if (index !== changedRecord.chunk) assert.equal(outputChunks[index], chunks[index], '除目标消息行外必须逐字节保留');
  const expectedWrapper = clone(beforeWrapper); expectedWrapper.stat_data = migrated;
  const report = {
    status: 'passed', mode: 'offline-synthetic-fixture',
    source: { path: INPUT, bytes: bytes.length, sha256: sha256(bytes) },
    output: { path: OUTPUT, bytes: output.length, sha256: sha256(output) },
    target: { messageId, swipeId, jsonlLine: changedRecord.line, statDataPointer: prefix, volume: 1, chapter: '终章', phase: '已结束', events: events.length },
    changes: jsonPatch(localChanges).map(change => ({ ...change, path: prefix + change.path })),
    expectedMigrationChanges: jsonPatch(migrationChanges(candidate, migrated)),
    hashes: {
      algorithm: 'sha256 of JSON with recursively sorted object keys; array order preserved',
      beforeV4State: semanticHash(before), fixtureV3State: semanticHash(candidate), expectedAfterMigrationState: semanticHash(migrated),
      beforeActiveWrapper: semanticHash(beforeWrapper), fixtureActiveWrapper: semanticHash(afterValues[messageId + 1].variables[swipeId]), expectedAfterMigrationWrapper: semanticHash(expectedWrapper),
    },
    preserved: {
      headerBytes: true, chatMetadata: true, playerAndRelationships: true, otherMessagesAndSwipes: true,
      activeWrapperKeys: Object.keys(beforeWrapper), wrapperFieldsOutsideStatData: true,
      explanation: '保留 display_data、delta_data、schema、initialized_lorebooks 及其他原包装；不手造或重置 MVU 元数据。',
    },
    chatIdentity: { metadataChanged: false, explanation: '只使用新的输出文件名区分验收聊天，不改 chat_metadata.integrity、角色名或原生元数据；由原生导入流程创建独立聊天，导入后核对当前聊天。' },
    acceptance: { runtimeChecked: false, steps: ['原生导入为独立聊天后先确认活动状态仍是 v3', '终端展示迁移差异；下载备份并核对 v3 状态哈希，刷新预览不写入', '明确点击确认升级当前楼层', '原生导出迁移后聊天，对照预期活动状态及完整包装哈希', '人物、历史事件内容及其他回复页保持原样'] },
  };
  return { output, report };
}

function selfTest(input) {
  const valid = convertMigrationFixture(input);
  const values = input.toString('utf8').trim().split(/\r?\n/).map(JSON.parse);
  const encode = rows => Buffer.from(rows.map(value => JSON.stringify(value)).join('\n') + '\n');
  const changedVolume = clone(values); changedVolume[1].variables[0].stat_data.场景.当前卷 = 2;
  assert.throws(() => convertMigrationFixture(encode(changedVolume)));
  const invalidSwipe = clone(values); invalidSwipe[1].swipe_id = 4;
  assert.throws(() => convertMigrationFixture(encode(invalidSwipe)));
  const twoSwipes = clone(values);
  twoSwipes[1].swipes.push('另一回复页'); twoSwipes[1].variables.push(clone(twoSwipes[1].variables[0]));
  twoSwipes[1].variables[1].untouched_test = { marker: 'other-swipe' };
  const converted = convertMigrationFixture(encode(twoSwipes));
  const after = converted.output.toString('utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(after[1].variables[1], twoSwipes[1].variables[1]);
  assert.equal(valid.report.hashes.beforeV4State, valid.report.hashes.expectedAfterMigrationState);
  console.log(JSON.stringify({ passed: 4, total: 4, cases: ['合法第一卷快照与迁移往返', '跨卷输入拒绝', '无效活动页拒绝', '另一回复页保持原样'], writes: 0 }));
}

function main() {
  const args = process.argv.slice(2);
  assert.ok(args.every(arg => ['--check', '--self-test'].includes(arg)), '仅支持 --check 或 --self-test');
  const inputPath = path.join(root, INPUT), input = fs.readFileSync(inputPath);
  if (args.includes('--self-test')) return selfTest(input);
  const { output, report } = convertMigrationFixture(input);
  const outputs = [[OUTPUT, output], [REPORT, Buffer.from(JSON.stringify(report, null, 2) + '\n')]];
  for (const [file, content] of outputs) {
    const target = path.resolve(root, file);
    assert.ok(target.startsWith(root + path.sep) && target !== inputPath, '输出必须是项目内独立文件');
    if (fs.existsSync(target)) assert.ok(fs.readFileSync(target).equals(content), '已有文件内容不同，拒绝覆盖：' + file);
    else assert.equal(args.includes('--check'), false, '缺少输出文件：' + file);
  }
  for (const [file, content] of outputs) if (!fs.existsSync(path.join(root, file))) fs.writeFileSync(path.join(root, file), content, { flag: 'wx' });
  assert.ok(fs.readFileSync(inputPath).equals(input), '原始导出文件必须保持不变');
  console.log(JSON.stringify({ status: 'passed', mode: args.includes('--check') ? 'checked' : 'built-or-verified', output: OUTPUT, report: REPORT, changes: report.changes, expectedMigrationChanges: report.expectedMigrationChanges, runtimeChecked: false }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
