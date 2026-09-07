// 本卡 stat_data v3。纯 schema 工厂；不访问聊天、不自动迁移旧楼层。
export const CHAPTERS = ['待选择', '序章', '第一章', '第二章', '第三章', '第四章', '终章'];
export const GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E', 'F+', 'F'];
export const AXES = ['攻击力', '防御力', '魔力量', '魔力控制', '体能', '运气'];
export const INITIAL_STATE = {
  系统: { 结构版本: 3, 开局状态: '待建档', 主角模式: '未选择' },
  场景: { 当前卷: 1, 当前章: '待选择', 阶段: '未开始', 时间: '', 地点: '', 切入说明: '', 已发生事件: {} },
  玩家: {
    姓名: '', 性格关键词: '', 处事风格: '', 所属: '', 固有灵装: '', 角色简介: '', 战斗风格: '',
    伐刀能力: { 能力系别: '', 能力本质: '', 共通限制: '', 招式: {} },
    其他能力: {},
    六维: Object.fromEntries(AXES.map(key => [key, ''])),
    综合初评: { 规则版本: 'R05-第一版', 分数: null, 等级: null, 拟定登记等级: null, 评定状态: '待填写六维', 待填写项: AXES.slice(0, 4) },
    登记等级: null,
  },
  人际: {},
};

export function createSchema(z) {
  const text = z.string();
  // 动态记录允许有名条目；固定对象全部 strict，禁止拼错路径后另造字段。
  const key = z.string().min(1).refine(value => !/[~/]/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value), '名称不能包含 /、~ 或保留键');
  const record = value => z.record(key, value);
  const skill = z.object({ 说明: text, 条件与代价: text, 掌握状态: z.enum(['待确认', '学习中', '已掌握']) }).strict();
  const root = z.object({
    // MVU 更新过程临时注入的框架元数据；保留原值，不作为本卡业务结构校验。
    $internal: z.unknown().optional(),
    系统: z.object({ 结构版本: z.literal(3), 开局状态: z.enum(['待建档', '已建档']), 主角模式: z.enum(['未选择', '黑铁一辉', '自定义角色']) }).strict(),
    场景: z.object({
      当前卷: z.literal(1),
      当前章: z.enum(CHAPTERS),
      阶段: z.enum(['未开始', '进行中', '已结束']),
      时间: text, 地点: text, 切入说明: text.default(''),
      已发生事件: record(z.object({ 章段: z.enum(CHAPTERS.slice(1)), 结果: text.min(1), 参与者: z.array(text.min(1)), 知情者: z.array(text.min(1)) }).strict()),
    }).strict(),
    玩家: z.object({
      姓名: text, 性格关键词: text, 处事风格: text, 所属: text, 固有灵装: text, 角色简介: text, 战斗风格: text,
      伐刀能力: z.object({ 能力系别: z.enum(['', '体能强化系', '自然干涉系', '概念干涉系', '因果干涉系']), 能力本质: text, 共通限制: text, 招式: record(skill) }).strict(),
      其他能力: record(skill),
      六维: z.object(Object.fromEntries(AXES.map(axis => [axis, z.enum(['', ...GRADES])]))).strict(),
      综合初评: z.object({
        规则版本: text, 分数: z.number().min(1).max(6).nullable(), 等级: z.enum(GRADES).nullable(), 拟定登记等级: z.enum(GRADES).nullable(),
        评定状态: z.enum(['待填写六维', '已计算', '原作档案']), 待填写项: z.array(z.enum(AXES.slice(0, 4))),
      }).strict(),
      登记等级: z.enum(GRADES).nullable(),
    }).strict(),
    人际: record(z.object({ 关系: text, 态度印象: text, 好感: z.number().min(0).max(100).nullable(), 羁绊阶段: z.enum(['未定', '未建立', 'C', 'B', 'A', 'S']), 变化依据: text }).strict()),
  }).strict().superRefine((state, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path, message });
    if (state.系统.开局状态 === '已建档' && (state.系统.主角模式 === '未选择' || !state.玩家.姓名.trim())) issue(['系统', '开局状态'], '已建档需要已选身份和非空姓名');
    if (state.场景.阶段 !== '未开始' && state.系统.开局状态 !== '已建档') issue(['场景', '阶段'], '先完成建档，再开始剧情');
    if (state.场景.当前章 === '待选择' && state.场景.阶段 !== '未开始') issue(['场景', '阶段'], '未选择章段时不能开始或结束剧情');
    const chapter = CHAPTERS.indexOf(state.场景.当前章);
    for (const [name, event] of Object.entries(state.场景.已发生事件)) {
      if (CHAPTERS.indexOf(event.章段) > chapter) issue(['场景', '已发生事件', name, '章段'], '不能把后续章段事件写成已发生');
    }
    if (state.系统.主角模式 === '黑铁一辉' && Object.hasOwn(state.人际, '黑铁一辉')) issue(['人际', '黑铁一辉'], '一辉模式不能新建另一个一辉的人际记录');
    for (const [name, relation] of Object.entries(state.人际)) {
      if (['C', 'B', 'A', 'S'].includes(relation.羁绊阶段) && !relation.变化依据.trim()) issue(['人际', name, '变化依据'], '已成立羁绊必须有本局依据');
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
    return value;
  }, root);
}

// 离线 v2 迁移：拒绝未识别数据，不覆盖聊天，不凭招式名猜测多招式分隔。
export function migrateV2(input, z) {
  const schema = createSchema(z);
  if (input?.系统?.结构版本 === 3) return schema.parse(structuredClone(input));
  if (input?.系统?.结构版本 !== 2) throw new Error('仅支持中文结构 v2 → v3；英文或未知版本须先核对原始数据');
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
  return schema.parse(next);
}
