import { createTournamentSchema } from '../../scripts/rakudai-tournament.mjs';
import { getStoryVolume, resolveStoryChapter, storyPosition } from '../../scripts/rakudai-story-catalog.mjs';

// 本卡 stat_data v4。纯 schema 工厂；不访问聊天、不自动迁移旧楼层。
// CHAPTERS 仅为旧 v3 第一卷验证与开局兼容枚举；运行中卷章以共享目录为准。
export const CHAPTERS = ['待选择', '序章', '第一章', '第二章', '第三章', '第四章', '终章'];
export const GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E', 'F+', 'F'];
// A+、S 只扩展实际六维的成长尺度，联盟登记与开局综合初评仍使用原量表。
export const ATTRIBUTE_GRADES = ['S', 'A+', ...GRADES];
export const GROWTH_AXES = ['魔力控制', '体能', '魔力量'];
export const AXES = ['攻击力', '防御力', '魔力量', '魔力控制', '体能', '运气'];
// 只转换含义明确的卷号写法，保存结果仍为数字；未知文本留给严格校验拒绝。
export function normalizeStoryVolume(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  const numeric = text.match(/^(?:([1-9]|1[0-9])|第([1-9]|1[0-9])卷)$/);
  if (numeric) return Number(numeric[1] || numeric[2]);
  const names = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九'];
  const index = names.findIndex(name => text === '第' + name + '卷');
  return index < 0 ? value : index + 1;
}
// 描述兼容只补结构，不从说明文字推断掌握程度；有旧条目时保留已知资料。
export function normalizeSkillEntry(value, previous) {
  if (typeof value === 'string') value = { 说明: value };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const next = { ...value };
  const old = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
  for (const field of ['说明', '条件与代价']) {
    const missing = next[field] === undefined;
    const blank = typeof next[field] === 'string' && !next[field].trim();
    if (missing || blank) {
      if (typeof old[field] === 'string' && old[field].trim()) next[field] = old[field];
      else if (missing) next[field] = '';
    }
  }
  const known = ['学习中', '已掌握'].includes(old.掌握状态);
  if (next.掌握状态 === undefined || (next.掌握状态 === '待确认' && known)) {
    next.掌握状态 = known ? old.掌握状态 : '待确认';
  }
  return next;
}
// 多目标只是一种输入写法；拆出的稳定键与原来源事件共同用于去重。
// 单个经验数是总量：先去重目标，再均分；除不尽的余数按目标顺序分配。
export function normalizeGrowthRequests(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const result = {};
  for (const [id, original] of Object.entries(value)) {
    if (!original || typeof original !== 'object' || Array.isArray(original) || !Object.hasOwn(original, '经验')) { result[id] = original; continue; }
    const rawTargets = Array.isArray(original.目标) ? original.目标 : typeof original.目标 === 'string' ? original.目标.split(/[、,，]/).map(axis => axis.trim()) : [];
    const targets = [...new Set(rawTargets)];
    const paired = Array.isArray(original.经验);
    const valid = targets.length > 0 && targets.every(axis => GROWTH_AXES.includes(axis)) &&
      (paired ? original.经验.length === rawTargets.length && original.经验.every(number => Number.isSafeInteger(number) && number >= 0) : Number.isSafeInteger(original.经验) && original.经验 >= 0);
    if (!valid) { result[id] = original; continue; }
    const base = paired ? 0 : Math.floor(original.经验 / targets.length), rest = paired ? 0 : original.经验 % targets.length;
    const multiple = rawTargets.length > 1;
    for (let i = 0; i < targets.length; i++) {
      const axis = targets[i], derived = multiple ? id + '·' + axis : id;
      // 遇到同名显式申请不覆盖它；两条最终仍按来源事件与目标去重。
      if (derived !== id && Object.hasOwn(value, derived)) continue;
      result[derived] = { ...original, 目标: axis,
        经验: paired ? original.经验[rawTargets.indexOf(axis)] : base + (i < rest ? 1 : 0),
        类型: original.类型 ?? '', 方式: original.方式 ?? '' };
    }
  }
  return result;
}

// 本卡成长尺度，不是原作公布的经验公式。
export const GROWTH_RULES = {
  version: 'G03', costs: { F: 100, 'F+': 100, E: 150, 'E+': 150, D: 250, 'D+': 250, C: 400, 'C+': 400, B: 600, 'B+': 900, A: 1200, 'A+': 1600 },
  perReplyCap: 9999,
  // 类型说明成果性质；经验按本轮实际成长核定，不再用类型压低单次奖励。
  awards: { 基础训练: { min: 1, max: 9999 }, 纠正训练: { min: 1, max: 9999 }, 重大突破: { min: 1, max: 9999 } },
};
// 本卡关系计分配置；并非《火焰纹章》任一作品的官方公式。终端构建读取同一份配置。
export const RELATIONSHIP_SCORING = {
  version: 'R10-按回复分项结算',
  affection: {
    min: 0, max: 1000, initial: 0,
    ordinaryMin: 2, ordinaryMax: 10, mediumMin: 11, mediumMax: 20, majorMin: 21, majorMax: 40,
    decrease: { ordinaryMin: 1, ordinaryMax: 5, mediumMin: 6, mediumMax: 10, majorMin: 11, majorMax: 20 },
    backgroundMin: 70, backgroundMax: 200,
  },
  support: {
    min: 0, max: 320, initial: 0, ordinaryMin: 1, ordinaryMax: 5, mediumMin: 6, mediumMax: 10, majorMin: 10, majorMax: 15,
    stages: [{ stage: 'C', min: 80 }, { stage: 'B', min: 160 }, { stage: 'A', min: 240 }, { stage: 'S', min: 320 }],
  },
  romance: {
    stages: [{ stage: '路人', min: 0 }, { stage: '在意', min: 200 }, { stage: '暧昧', min: 500 }, { stage: '交往', min: 800 }, { stage: '生死相随', min: 1000 }],
  },
};
export function supportStage(value) {
  const config = RELATIONSHIP_SCORING.support;
  if (!Number.isInteger(value) || value < config.min || value > config.max) return '未定';
  let stage = '未建立';
  for (const threshold of config.stages) if (value >= threshold.min) stage = threshold.stage;
  return stage;
}
export function romanceStage(relation) {
  const value = relation?.好感, config = RELATIONSHIP_SCORING.affection;
  if (relation?.性别 !== '女性' || typeof value !== 'number' || !Number.isFinite(value) || value < config.min || value > config.max) return null;
  let stage = null;
  for (const threshold of RELATIONSHIP_SCORING.romance.stages) if (value >= threshold.min) stage = threshold.stage;
  return stage;
}

// 主副 API 共用事实写入权：只检查数值、真实回复来源和最终值收据，不审核叙事强度。
export function enforceRelationshipScores(variables, previous, { replyKey = '', submittedFields = [] } = {}) {
  const before = previous?.stat_data?.人际 || {}, after = variables?.stat_data?.人际;
  const notices = [];
  if (!after || typeof after !== 'object' || Array.isArray(after)) return notices;
  const submitted = new Map(Array.isArray(submittedFields) ? submittedFields : []);
  const oldReceipt = previous?.stat_data?.系统?.关系计分;
  const receipt = replyKey && oldReceipt?.回合 === replyKey ? structuredClone(oldReceipt) : { 回合: replyKey, 人物: {} };
  for (const [name, relation] of Object.entries(after)) {
    if (!relation || typeof relation !== 'object' || Array.isArray(relation)) continue;
    const old = before[name];
    for (const [field, config] of [['好感', RELATIONSHIP_SCORING.affection], ['支援度', RELATIONSHIP_SCORING.support]]) {
      const value = relation[field], prior = old?.[field];
      if (value === prior || (value == null && prior == null)) continue;
      let reason = '';
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < config.min || value > config.max || field === '支援度' && !Number.isInteger(value))) {
        reason = field + '须为 ' + config.min + '—' + config.max + ' 的数字' + (field === '支援度' ? '整数' : '') + '，或 null 待核定';
      } else if (!replyKey || !variables.stat_data?.系统) reason = '尚不能确认真实回复来源';
      // 明确提交的是最终值，允许本轮纠错；不把补丁重放理解成再加一次分。
      else if (receipt.人物?.[name]?.[field] && submitted.get(JSON.stringify([name, field])) !== value) reason = '本回复已计分；如需纠错请明确提交最终值';
      if (reason) {
        if (old && Object.hasOwn(old, field)) relation[field] = prior;
        else relation[field] = field === '好感' ? null : 0;
        notices.push({ path: '/人际/' + name + '/' + field, message: reason + '，已保留原分数。' });
        continue;
      }
      receipt.人物[name] ??= {};
      const done = receipt.人物[name][field];
      receipt.人物[name][field] = { 旧值: done ? done.旧值 : typeof prior === 'number' && Number.isFinite(prior) ? prior : null, 新值: value };
      variables.stat_data.系统.关系计分 = structuredClone(receipt);
    }
    if (relation.支援度 === null) relation.羁绊阶段 = '未定';
    else if (typeof relation.支援度 === 'number') relation.羁绊阶段 = supportStage(relation.支援度);
    const romance = romanceStage(relation);
    if (romance !== null) relation.恋爱阶段 = romance;
    else delete relation.恋爱阶段;
  }
  return notices;
}
// 联系记录只维护互动状态和关系标签，不派生好感或作为计分前置条件。
// 普通首次的0起点与实际变化由计分器处理，既定背景仍独立核定。
export function enforceRelationshipContact(variables, previous, { replyKey = '', flexibleRepair = false } = {}) {
  // 主副回复均可纠正联系事实，已确认内容无需另走人工审批。
  if (replyKey) return [];
  const state = variables?.stat_data;
  const before = previous?.stat_data?.人际 || {};
  if (state?.系统?.结构版本 !== 4 || !state.人际 || typeof state.人际 !== 'object' || Array.isArray(state.人际)) return [];
  const changed = [];
  const text = value => typeof value === 'string' ? value.trim() : '';
  const initialLabel = value => ['', '初见', '尚未交谈', '初见／尚未交谈'].includes(text(value).replace(/\s+/g, '').replace(/\//g, '／'));
  for (const [name, relation] of Object.entries(state.人际)) {
    if (!relation || typeof relation !== 'object' || Array.isArray(relation)) continue;
    if ((state.系统.已删除人物 || []).includes(name)) continue;
    const old = Object.hasOwn(before, name) ? before[name] : undefined;
    function set(field, value) {
      if (relation[field] === value) return;
      relation[field] = value;
      changed.push('/人际/' + name + '/' + field);
    }
    // 当前分支内已确认的联系不会因离场、漏字段或重写最简对象退回“仅识别”。
    if (old?.联系状态 === '已建立联系' && text(old.联系依据)) {
      set('联系状态', '已建立联系');
      if (!text(relation.联系依据)) set('联系依据', old.联系依据);
    }
    if (relation.联系状态 !== '已建立联系' || !text(relation.联系依据)) continue;
    if (initialLabel(relation.关系)) {
      set('关系', old && !initialLabel(old.关系) ? old.关系 : '已建立直接联系');
    }
  }
  return changed;
}
export const INITIAL_STATE = {
  系统: { 结构版本: 4, 开局状态: '待建档', 主角模式: '未选择' },
  场景: { 当前卷: 1, 当前章: '待选择', 阶段: '未开始', 时间: '', 地点: '', 切入说明: '', 已发生事件: {} },
  玩家: {
    性别: '男性',
    魔人觉醒: false,
    姓名: '', 性格关键词: '', 处事风格: '', 所属: '', 固有灵装: '', 角色简介: '', 战斗风格: '',
    伐刀能力: { 能力系别: '', 能力本质: '', 共通限制: '', 招式: {} },
    其他能力: {},
    六维: Object.fromEntries(AXES.map(key => [key, ''])),
    综合初评: { 规则版本: 'R05-第一版', 分数: null, 等级: null, 拟定登记等级: null, 评定状态: '待填写六维', 待填写项: AXES.slice(0, 4) },
    登记等级: null,
  },
  人际: {},
};

export function createSchema(z, options = {}) {
  return createStateSchema(z, 4, options);
}

export function createLegacyV3Schema(z, options = {}) {
  return createStateSchema(z, 3, options);
}

function createStateSchema(z, version, { normalizeRelationships = true } = {}) {
  const text = z.string();
  // 动态记录允许有名条目；固定对象全部 strict，禁止拼错路径后另造字段。
  const key = z.string().min(1).refine(value => !/[~/]/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value), '名称不能包含 /、~ 或保留键');
  const record = value => z.record(key, value);
  // 字段级转换也覆盖框架逐字段、逐条事件应用 JSONPatch 的校验入口。
  const volumeNumber = z.preprocess(normalizeStoryVolume, z.number().int().min(1).max(19));
  // 单条申请由结算器局部检查；未知/缺失数据保留待修正，不拖累其它状态更新。
  const growthRequests = z.preprocess(normalizeGrowthRequests, record(z.unknown()));
  const growth = z.object({
    版本: z.enum(['G01', 'G02', 'G03']).optional(),
    // 经验允许保留晋级后的溢出，不能拿最高单档门槛当累计上限；旧档经验原样读取。
    经验: z.object({ 魔力控制: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), 体能: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), 魔力量: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional() }).strict().optional(),
    申请: growthRequests.optional(),
    记录: record(z.object({
      来源事件: key, 日期: text.optional(), 目标: z.enum(GROWTH_AXES), 类型: text,
      环境: text.optional(), 现实分钟: z.number().int().min(0).max(1440).optional(), 有效分钟: z.number().int().min(0).max(1440000).optional(),
      加速: z.boolean().optional(), 获得: z.number().int().min(0).max(Math.max(70, GROWTH_RULES.perReplyCap)), 活动指纹: text, 说明: text,
      方式: text.optional(), 成果: text.optional(), 回合: text.optional(),
    }).strict()).optional(),
    回合结算: z.object({
      标识: text,
      获得: z.object({ 魔力控制: z.number().int().min(0).max(GROWTH_RULES.perReplyCap), 体能: z.number().int().min(0).max(GROWTH_RULES.perReplyCap), 魔力量: z.number().int().min(0).max(GROWTH_RULES.perReplyCap).optional() }).strict(),
      已晋级: z.array(z.enum(GROWTH_AXES)).max(GROWTH_AXES.length),
      // 终值重放也不能把同一份档内经验按晋级后的新档位再算一遍。
      终值收据: z.partialRecord(z.enum(GROWTH_AXES), z.object({ 提交: text, 经验: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), 评级: z.enum(ATTRIBUTE_GRADES) }).strict()).optional(),
    }).strict().optional(),
    // 旧境界、环境与复核记录仅保留历史；绝不用于推断 /玩家/魔人觉醒。
    境界: z.enum(['未确认', '普通', '魔人']).optional(), 境界依据: text.optional(),
    训练环境: record(z.object({
      能力路径: text, 模式: z.enum(['意识模拟', '真实时间加速']), 倍率: z.number().min(1).max(1000),
      魔力参与: z.boolean(), 肉身参与: z.boolean(), 依据: text,
    }).strict()).optional(),
    复核记录: z.array(text).max(30).optional(), 最近提示: text.optional(), 结算起点: text.optional(),
  }).strict();
  const skillObject = z.object({ 说明: text, 条件与代价: text, 掌握状态: z.enum(['待确认', '学习中', '已掌握']) }).strict();
  const skill = version === 4 ? z.preprocess(value => normalizeSkillEntry(value), skillObject) : skillObject;
  const knownProfile = z.object({ 身份: text.optional(), 登记等级: text.optional(), 灵装: text.optional(), 已知能力: text.optional() }).strict();
  const scheduleDate = text.refine(value => {
    if (value === '') return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }, '日程日期使用真实的 YYYY-MM-DD；尚未确定时留空');
  const schedule = z.object({
    类型: z.enum(['比赛', '训练', '约定', '其他']), 日期: scheduleDate,
    时间: text, 地点: text, 参与者: z.array(text.min(1)),
    状态: z.enum(['待定', '已安排', '进行中', '已完成', '已取消']), 说明: text,
  }).strict();
  // 代码专属的当前回复收据：可选以兼容旧档，不要求模型提交，也不发给模型。
  // 旧值保留纠错前的真实数字，允许记录曾经越界的坏账；修正后的新值仍须合法。
  const scoreReceipt = z.object({ 旧值: z.number().nullable(), 新值: z.number().min(0).max(1000).nullable() }).strict();
  const relationshipReceipt = z.object({
    回合: text.min(1), 人物: record(z.object({ 好感: scoreReceipt.optional(), 支援度: scoreReceipt.optional() }).strict()),
  }).strict();
  const root = z.object({
    // MVU 更新过程临时注入的框架元数据；保留原值，不作为本卡业务结构校验。
    $internal: z.unknown().optional(),
    系统: z.object({
      结构版本: z.literal(version), 开局状态: z.enum(['待建档', '已建档']), 主角模式: z.enum(['未选择', '黑铁一辉', '自定义角色']),
      // 随当前楼层和活动 swipe 保存；回退读取旧快照，不使用聊天级或本地存储黑名单。
      ...(version === 4 ? { 已删除人物: z.array(key).optional(), 关系计分: relationshipReceipt.optional() } : {}),
    }).strict(),
    场景: z.object({
      当前卷: version === 3 ? z.literal(1) : volumeNumber,
      当前章: version === 3 ? z.enum(CHAPTERS) : text.min(1),
      阶段: z.enum(['未开始', '进行中', '已结束']),
      时间: text, 地点: text, 切入说明: text.default(''),
      已发生事件: record(z.object({ ...(version === 4 ? { 卷号: volumeNumber } : {}), 章段: version === 3 ? z.enum(CHAPTERS.slice(1)) : text.min(1), 结果: text.min(1), 参与者: z.array(text.min(1)), 知情者: z.array(text.min(1)) }).strict()),
      // 可选字段兼容现有 v4 存档；未来约定不占用已发生事件。
      ...(version === 4 ? { 日程: record(schedule).optional(), 选拔赛: createTournamentSchema(z).optional() } : {}),
    }).strict(),
    玩家: z.object({
      性别: z.literal('男性').default('男性'),
      // 唯一觉醒开关；不接受字符串或 0/1。旧档未保存时按未觉醒读取，不推断旧境界。
      ...(version === 4 ? { 魔人觉醒: z.boolean().default(false) } : {}),
      姓名: text, 性格关键词: text, 处事风格: text, 所属: text, 固有灵装: text, 角色简介: text, 战斗风格: text,
      伐刀能力: z.object({ 能力系别: z.enum(['', '体能强化系', '自然干涉系', '概念干涉系', '因果干涉系']), 能力本质: text, 共通限制: text, 招式: record(skill) }).strict(),
      其他能力: record(skill),
      六维: z.object(Object.fromEntries(AXES.map(axis => [axis, z.enum(['', ...(version === 4 ? ATTRIBUTE_GRADES : GRADES)])]))).strict(),
      综合初评: z.object({
        规则版本: text, 分数: z.number().min(1).max(6).nullable(), 等级: z.enum(GRADES).nullable(), 拟定登记等级: z.enum(GRADES).nullable(),
        评定状态: z.enum(['待填写六维', '已计算', '原作档案']), 待填写项: z.array(z.enum(AXES.slice(0, 4))),
      }).strict(),
      登记等级: z.enum(GRADES).nullable(),
      ...(version === 4 ? { 成长: growth.optional() } : {}),
    }).strict(),
    人际: record(z.object({ 关系: text, 态度印象: text, 性别: z.enum(['未知', '男性', '女性']).optional(), 已加联系方式: z.boolean().optional(), ...(version === 4 ? { 名册隐藏: z.boolean().optional(), 联系状态: z.enum(['仅识别', '已建立联系']).optional(), 联系依据: text.optional() } : {}), 好感: z.number().min(RELATIONSHIP_SCORING.affection.min).max(RELATIONSHIP_SCORING.affection.max).nullable(), 支援度: z.number().int().min(RELATIONSHIP_SCORING.support.min).max(RELATIONSHIP_SCORING.support.max).nullable().optional(), 羁绊阶段: z.enum(['未定', '未建立', 'C', 'B', 'A', 'S']), 恋爱阶段: z.enum(RELATIONSHIP_SCORING.romance.stages.map(item => item.stage)).optional(), 好感突破依据: text.optional(), 变化依据: text, 已知资料: knownProfile.optional() }).strict()),
  }).strict().superRefine((state, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path, message });
    if (state.系统.开局状态 === '已建档' && (state.系统.主角模式 === '未选择' || !state.玩家.姓名.trim())) issue(['系统', '开局状态'], '已建档需要已选身份和非空姓名');
    if (state.场景.阶段 !== '未开始' && state.系统.开局状态 !== '已建档') issue(['场景', '阶段'], '先完成建档，再开始剧情');
    if (state.场景.当前章 === '待选择' && state.场景.阶段 !== '未开始') issue(['场景', '阶段'], '未选择章段时不能开始或结束剧情');
    const scene = state.场景;
    const chapter = version === 3 ? CHAPTERS.indexOf(scene.当前章) : storyPosition(scene.当前卷, scene.当前章);
    if (version === 4 && !getStoryVolume(scene.当前卷)) issue(['场景', '当前卷'], '卷号不在已核对的剧情目录中');
    if (version === 4 && scene.当前章 !== '待选择' && chapter < 0) issue(['场景', '当前章'], '当前卷与章节不是已核对的目录组合');
    for (const [name, event] of Object.entries(state.场景.已发生事件)) {
      const eventPosition = version === 3 ? CHAPTERS.indexOf(event.章段) : storyPosition(event.卷号, event.章段);
      if (version === 4 && eventPosition < 0) issue(['场景', '已发生事件', name, '章段'], '事件卷号与章段不是已核对的目录组合');
      else if (eventPosition > chapter) issue(['场景', '已发生事件', name, '章段'], '不能把后续卷章事件写成已发生');
    }
    if (state.系统.主角模式 === '黑铁一辉' && Object.hasOwn(state.人际, '黑铁一辉')) issue(['人际', '黑铁一辉'], '一辉模式不能新建另一个一辉的人际记录');
    for (const [name, relation] of Object.entries(state.人际)) {
      if (relation.恋爱阶段 !== undefined && romanceStage(relation) === null) issue(['人际', name, '恋爱阶段'], '只有已确认女性且好感为有效数值时才能派生恋爱阶段；男性、性别未知或好感待核定时不能预写。');
    }
  });
  // 上游桥接器对直接传入的 ZodObject 会改用 looseObject。
  // preprocess 保留本卡固定字段的 strict 校验；在 record 可能忽略保留键前明确拒绝。
  return z.preprocess((value, ctx) => {
    function inspect(node, path = []) {
      if (!node || typeof node !== 'object') return;
      for (const name of Object.keys(node)) {
        if (path.length === 0 && name === '$internal') continue;
        if (['__proto__', 'prototype', 'constructor'].includes(name)) ctx.addIssue({ code: 'custom', path: [...path, name], message: '不接受保留键，未丢弃原始数据' });
        else inspect(node[name], [...path, name]);
      }
    }
    inspect(value);
    // 只接收目录声明的精确别名，并在校验结果中归一成稳定章节键。
    if (version === 4 && value?.场景 && typeof value.场景 === 'object' && !Array.isArray(value.场景)) {
      const scene = { ...value.场景, 当前卷: normalizeStoryVolume(value.场景.当前卷) };
      const chapter = resolveStoryChapter(scene.当前卷, scene.当前章);
      const events = scene.已发生事件;
      value = { ...value, 场景: { ...scene,
        ...(chapter ? { 当前章: chapter.key } : {}),
        ...(events && typeof events === 'object' && !Array.isArray(events) ? { 已发生事件: Object.fromEntries(Object.entries(events).map(([name, event]) => {
          if (event && typeof event === 'object' && !Array.isArray(event)) event = { ...event, 卷号: normalizeStoryVolume(event.卷号) };
          const resolved = resolveStoryChapter(event?.卷号, event?.章段);
          return [name, resolved ? { ...event, 章段: resolved.key } : event];
        })) } : {}),
      } };
    }
    // 数值已经存在才派生阶段。旧记录缺支援度或为 null 时完全保留，绝不凭字母倒填分。
    // 只复制待归一化对象，schema.parse 不修改调用方或框架 $internal 快照。
    if (!normalizeRelationships || !value?.人际 || typeof value.人际 !== 'object' || Array.isArray(value.人际)) return value;
    const relations = Object.fromEntries(Object.entries(value.人际).map(([name, relation]) => {
      const stage = supportStage(relation?.支援度);
      const romance = romanceStage(relation);
      if (!relation || typeof relation !== 'object' || Array.isArray(relation)) return [name, relation];
      const normalized = { ...relation, ...(relation.支援度 === null ? { 羁绊阶段: '未定' } : stage !== '未定' ? { 羁绊阶段: stage } : {}) };
      if (romance !== null) normalized.恋爱阶段 = romance;
      else delete normalized.恋爱阶段;
      return [name, normalized];
    }));
    return { ...value, 人际: relations };
  }, root);
}

// 离线 v2 迁移：拒绝未识别数据，不覆盖聊天，不凭招式名猜测多招式分隔。
export function migrateV2(input, z) {
  const schema = createLegacyV3Schema(z, { normalizeRelationships: false });
  if ([3, 4].includes(input?.系统?.结构版本)) return migrateV3(input, z);
  if (input?.系统?.结构版本 !== 2) throw new Error('仅支持中文结构 v2 / v3 → v4；英文或未知版本须先核对原始数据');
  const next = structuredClone(input);
  next.系统.结构版本 = 3;
  next.场景 = { 当前章: '待选择', 阶段: '未开始', 已发生事件: {}, ...next.场景 };
  const p = next.玩家;
  p.伐刀能力 = { 能力系别: p.能力系别 ?? '', 能力本质: p.能力机制 ?? '', 共通限制: p.限制与代价 ?? '', 招式: {} };
  if (p.伐刀绝技?.trim()) p.伐刀能力.招式[p.伐刀绝技.trim()] = { 说明: '', 条件与代价: '', 掌握状态: '待确认' };
  p.其他能力 = {};
  for (const field of ['伐刀绝技', '能力系别', '能力机制', '限制与代价']) delete p[field];
  next.人际 ??= {};
  for (const relation of Object.values(next.人际)) {
    const old = relation.羁绊阶段;
    if (!['未定', '未建立', 'C', 'B', 'A', 'S'].includes(old)) {
      relation.羁绊阶段 = '未定';
      relation.变化依据 = `旧存档阶段：${old ?? '未记录'}。尚未确认 C/B/A/S 对应，保留原描述待核对。`;
    } else relation.变化依据 ??= '';
    relation.好感 ??= null;
  }
  return migrateV3(schema.parse(next), z);
}

export function migrateV3(input, z) {
  const targetSchema = createSchema(z, { normalizeRelationships: false });
  if (input?.系统?.结构版本 === 4) {
    targetSchema.parse(input);
    return structuredClone(input);
  }
  if (input?.系统?.结构版本 !== 3) throw new Error('在线迁移仅接受合法的第一卷 v3 档案；v2 或未知结构请先离线核对');
  // 兼容已写入觉醒开关、结构版本尚为 v3 的旧档；只识别原生布尔值，不猜测或转换。
  // 仅从校验副本暂去这一已知 v4 字段，原档与迁移候选都保留它；其余旧结构仍严格验证。
  const legacyInput = structuredClone(input);
  if (legacyInput.玩家 && Object.hasOwn(legacyInput.玩家, '魔人觉醒')) {
    if (typeof legacyInput.玩家.魔人觉醒 !== 'boolean') throw new Error('/玩家/魔人觉醒 必须是 true 或 false，旧档迁移不会转换其他值。');
    delete legacyInput.玩家.魔人觉醒;
  }
  // parse 仅用于校验；不采用其默认填充结果，也不重新派生人物字段。
  createLegacyV3Schema(z, { normalizeRelationships: false }).parse(legacyInput);
  const next = structuredClone(input);
  next.系统.结构版本 = 4;
  for (const event of Object.values(next.场景.已发生事件)) event.卷号 = 1;
  targetSchema.parse(next);
  return next;
}

export function migrationChanges(before, after, path = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (object(before) && object(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => {
      const escaped = key.replace(/~/g, '~0').replace(/\//g, '~1');
      return migrationChanges(before[key], after[key], path + '/' + escaped);
    });
  }
  return [{ path: path || '/', before: structuredClone(before), after: structuredClone(after) }];
}

export function prepareStateMigration(input, z) {
  const before = structuredClone(input);
  const state = migrateV3(before, z);
  return { status: before.系统.结构版本 === 3 ? 'migration-required' : 'current', before, state, changes: migrationChanges(before, state) };
}
