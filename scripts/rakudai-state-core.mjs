import { STORY_VOLUMES, getStoryVolume, resolveStoryChapter, storyPosition, nextStoryChapter, firstStoryChapter } from './rakudai-story-catalog.mjs';
import { GROWTH_RULES, GROWTH_AXES, ATTRIBUTE_GRADES, normalizeSkillEntry } from '../世界书规则/MVU/schema.mjs';

// 状态规则与运行时适配分开：本模块不访问宿主、不发送消息、不生成剧情。
export const STATE_CHAPTERS = ['待选择', ...getStoryVolume(1).chapters.map(chapter => chapter.key)];
export const cloneState = value => structuredClone(value);
export function stateKey(value) {
  if (Array.isArray(value)) return '[' + value.map(stateKey).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stateKey(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

export function applyOpening(before, payload) {
  if (before.系统.结构版本 !== 4) throw new Error('请先预览并确认升级为 v4，不能通过建档自动迁移旧楼层。');
  if (before.系统.开局状态 !== '待建档') throw new Error('当前分支已建档，不能再次初始化。');
  if (!payload || payload.系统?.结构版本 !== 4 || !['黑铁一辉', '自定义角色'].includes(payload.系统.主角模式)) throw new Error('请选择身份模式并使用 v4 档案。');
  if (before.场景.当前卷 !== 1 || (payload.场景?.当前卷 !== undefined && payload.场景.当前卷 !== 1)) throw new Error('开局页从第一卷建档，不能覆盖其他卷的剧情状态。');
  const next = cloneState(before);
  const scene = payload.场景 || {};
  for (const key of ['当前章', '时间', '地点', '切入说明']) {
    const incoming = scene[key];
    if (incoming !== undefined && typeof incoming !== 'string') throw new Error('场景字段必须是文字。');
    const existing = before.场景[key] || '';
    const established = existing && existing !== '待选择';
    if (established && incoming && incoming !== '待选择' && incoming !== existing) throw new Error(`场景${key}与已保存内容冲突，请先调整草稿：${existing}`);
    if (!established && incoming) next.场景[key] = incoming.trim();
  }
  const chapter = resolveStoryChapter(1, next.场景.当前章);
  if (!chapter || !next.场景.时间.trim() || !next.场景.地点.trim()) throw new Error('请先确定切入章段、时间和地点；相对时间也可以。');
  next.场景.当前章 = chapter.key;
  next.玩家 = cloneState(payload.玩家);
  if (!next.玩家 || !next.玩家.姓名?.trim()) throw new Error('档案缺少姓名。');
  if (next.玩家.性别 !== undefined && next.玩家.性别 !== '男性') throw new Error('当前版本仅支持男性玩家，不能提交其他玩家性别。');
  next.玩家.性别 = '男性';
  next.玩家.魔人觉醒 ??= false;
  next.玩家.登记等级 = payload.系统.主角模式 === '黑铁一辉' ? 'F' : null;
  next.系统 = { 结构版本: 4, 主角模式: payload.系统.主角模式, 开局状态: '已建档' };
  next.场景.阶段 = '进行中';
  return next;
}

// 仅修正尚未开演时选错的人物；不把读取草稿等同于重置整局。
export function assertOpeningReplacementState(state) {
  if (state?.系统?.结构版本 !== 4 || state.系统.开局状态 !== '已建档') throw new Error('只有已建档的开局可以替换人物，请先读取当前聊天。');
  if (state.场景?.当前卷 !== 1) throw new Error('剧情已进入其他卷，不能通过开局页替换人物。');
  if (Object.keys(state.场景.已发生事件 || {}).length) throw new Error('本局已经记录剧情事件，不能替换开局人物；请在新聊天使用该档案。');
}
export function applyOpeningReplacement(before, payload) {
  assertOpeningReplacementState(before);
  const draftBase = cloneState(before);
  draftBase.系统.开局状态 = '待建档';
  // 场景来自这次明确选定的草稿，仍走原建档的卷章、字段和身份校验。
  for (const key of ['当前章', '时间', '地点', '切入说明']) draftBase.场景[key] = '';
  const opening = applyOpening(draftBase, payload);
  const next = cloneState(before);
  next.玩家 = opening.玩家;
  next.系统.主角模式 = opening.系统.主角模式;
  for (const key of ['当前章', '时间', '地点', '切入说明']) next.场景[key] = opening.场景[key];
  return next;
}

export function applyTransition(before, request) {
  if (before.系统.结构版本 !== 4) throw new Error('请先预览并确认升级为 v4，再操作剧情卷章。');
  if (before.系统.开局状态 !== '已建档') throw new Error('请先在开局页完成建档。');
  const next = cloneState(before);
  const scene = next.场景;
  const volume = getStoryVolume(scene.当前卷);
  if (!volume) throw new Error('当前卷不在已核对的剧情目录中。');
  const currentChapter = resolveStoryChapter(scene.当前卷, scene.当前章);
  if (scene.当前章 !== '待选择' && !currentChapter) throw new Error('当前卷与章节不匹配，请核对存档。');
  if (currentChapter) scene.当前章 = currentChapter.key;
  function locateTarget(targetVolume, targetChapter) {
    const chapter = resolveStoryChapter(targetVolume, targetChapter);
    if (!chapter) throw new Error('目标卷与章节不是已核对的目录组合。');
    for (const key of ['time', 'location', 'entryNote']) {
      if (typeof request[key] !== 'string' || !request[key].trim()) throw new Error('请确认目标时间、地点和切入说明后再切换卷章。');
    }
    scene.当前卷 = targetVolume;
    scene.当前章 = chapter.key;
    scene.阶段 = '未开始';
    scene.时间 = request.time.trim();
    scene.地点 = request.location.trim();
    scene.切入说明 = request.entryNote.trim();
  }
  if (request.action === 'start') {
    if (scene.阶段 !== '未开始') throw new Error('当前章段已开始，不能重复开始。');
    const chapter = resolveStoryChapter(scene.当前卷, scene.当前章 === '待选择' ? request.chapter : scene.当前章);
    if (request.chapter && resolveStoryChapter(scene.当前卷, request.chapter)?.key !== chapter?.key) throw new Error('不能以开始操作跳到其他章段。');
    if (!chapter || !scene.时间.trim() || !scene.地点.trim()) throw new Error('当前章段、时间或地点尚未确认。');
    scene.当前章 = chapter.key;
    scene.阶段 = '进行中';
  } else if (request.action === 'end') {
    if (scene.阶段 !== '进行中') throw new Error('只有进行中的章段可以标记结束。');
    scene.阶段 = '已结束';
  } else if (request.action === 'next') {
    if (scene.阶段 !== '已结束') throw new Error('请先确认当前章段已结束。');
    const target = nextStoryChapter(scene.当前卷, scene.当前章);
    if (!target || target.volume !== scene.当前卷) throw new Error('已到当前卷末，请使用进入下一卷并确认切入场景。');
    scene.当前章 = target.chapter;
    scene.阶段 = '未开始';
  } else if (request.action === 'nextVolume') {
    if (scene.阶段 !== '已结束' || scene.当前章 !== volume.chapters.at(-1).key) throw new Error('只有当前卷的最后章节已结束，才能进入下一卷。');
    const chapter = firstStoryChapter(scene.当前卷 + 1);
    if (!chapter) throw new Error('已到已核对剧情目录的最后一卷。');
    locateTarget(scene.当前卷 + 1, chapter.key);
  } else if (request.action === 'jump') {
    const from = storyPosition(scene.当前卷, scene.当前章);
    const target = storyPosition(request.volume, request.chapter);
    if (from < 0) throw new Error('请先确认当前章段，再选择向前切入的目标。');
    if (target < 0) throw new Error('目标卷与章节不是已核对的目录组合。');
    if (target <= from) throw new Error('手动切入仅允许严格向前；回到已有剧情请使用聊天分支或已有回复页。');
    locateTarget(request.volume, request.chapter);
  } else throw new Error('未知剧情操作。');
  if (['jump', 'nextVolume'].includes(request.action)) {
    // 手动跳过的过程不是训练。取消未结算申请，保留已获得经验与历史。
    const growth = growthState(next.玩家.成长);
    growth.申请 = {};
    growth.最近提示 = '已切入新场景；跳过的事件不补算经验，待结算申请已取消。';
    next.玩家.成长 = growth;
  }
  return next;
}

// 世界书完成标识由模型结合本局事实判断；这里只约束更新方向和阶段。
// 一轮最多前进一个目录节点，不从正文关键词推断完成、不补写历史。
export function acceptAutomaticStoryProgress(before, after) {
  if (before?.系统?.结构版本 !== 4 || before.系统.开局状态 !== '已建档') return false;
  const old = before.场景, scene = after?.场景;
  if (!old || !scene || typeof scene !== 'object' || Array.isArray(scene)) return false;
  const current = resolveStoryChapter(old.当前卷, old.当前章);
  const proposed = resolveStoryChapter(scene.当前卷, scene.当前章);
  if (!current || !proposed) return false;
  const target = nextStoryChapter(old.当前卷, current.key);
  const unchanged = scene.当前卷 === old.当前卷 && proposed.key === current.key;
  function advance() {
    scene.当前卷 = target.volume;
    scene.当前章 = target.chapter;
    scene.阶段 = '进行中';
    scene.切入说明 = '';
  }
  if (unchanged) {
    if (scene.阶段 === old.阶段) return true;
    if (old.阶段 === '未开始' && scene.阶段 === '进行中') return true;
    if (old.阶段 === '进行中' && scene.阶段 === '已结束') {
      // 模型只提交本章完成时，由目录决定下一节点；末卷末章保持结束。
      if (target) advance();
      return true;
    }
    return false;
  }
  if (!target || !['进行中', '已结束'].includes(old.阶段) ||
      scene.当前卷 !== target.volume || proposed.key !== target.chapter ||
      !['未开始', '进行中'].includes(scene.阶段)) return false;
  advance();
  return true;
}

// 副校正共享主回复的推进额度；主回复已经切章时，重复“已结束”不再结束下一章。
function acceptRepairStoryProgress(before, after, storyBefore) {
  const old = before.场景, scene = after.场景;
  const start = storyBefore && storyPosition(storyBefore.当前卷, storyBefore.当前章);
  const current = storyPosition(old.当前卷, old.当前章);
  if (current < 0) return false;
  if (Number.isInteger(start) && start >= 0) {
    if (start === current) {
      // 以主回复开始前的阶段判断整轮结果；本轮刚开始的章节不能再借副校正结算一次。
      return acceptAutomaticStoryProgress({ ...before, 场景: { ...old, ...storyBefore } }, after);
    }
    // 已确认本回复发生过切入，副模型只补其他事实，不重复消费本章完成标识。
    for (const key of ['当前卷', '当前章', '阶段']) scene[key] = old[key];
    return true;
  }
  // 重载后若没有原结算快照，只接受当前节点的阶段纠正，不能猜测本轮还可跨章。
  return scene.当前卷 === old.当前卷 &&
    resolveStoryChapter(scene.当前卷, scene.当前章)?.key === resolveStoryChapter(old.当前卷, old.当前章)?.key &&
    ['未开始', '进行中', '已结束'].includes(scene.阶段);
}

// 供 MVU 的更新结束事件使用。身份与初评保留页面写入权；经绑定的副校正可补切入说明。
// v4 允许按世界书完成标识顺序推进；其他卷章修改仍恢复原值。
export function enforceStateOwnership(variables, previous, context = {}) {
  const before = previous?.stat_data;
  const after = variables?.stat_data;
  if (![3, 4].includes(before?.系统?.结构版本)) return [];
  if (!after || typeof after !== 'object' || Array.isArray(after)) {
    variables.stat_data = cloneState(before);
    return ['/stat_data'];
  }
  const changed = [];
  function restore(parent, key, original, path) {
    if (stateKey(parent[key]) !== stateKey(original)) { parent[key] = cloneState(original); changed.push(path); }
  }
  if (before.系统.开局状态 === '待建档') {
    for (const key of ['系统', '场景', '玩家', '人际']) restore(after, key, before[key], '/' + key);
  } else {
    restore(after, '系统', before.系统, '/系统');
    if (!after.场景 || typeof after.场景 !== 'object' || Array.isArray(after.场景)) after.场景 = cloneState(before.场景);
    const repair = Boolean(context.replyKey && context.storyCorrection === true);
    const flexible = Boolean(context.replyKey && context.flexibleRepair === true);
    if (!repair) restore(after.场景, '切入说明', before.场景.切入说明 ?? '', '/场景/切入说明');
    const repairDescription = repair && after.场景.切入说明 !== before.场景.切入说明 ? after.场景.切入说明 : undefined;
    const storyAccepted = repair ? acceptRepairStoryProgress(before, after, context.storyBefore) : acceptAutomaticStoryProgress(before, after);
    // 自动切章会清空旧切入说明；副校正明确补写的新说明属于本次最终场景，继续保留。
    if (storyAccepted && repairDescription !== undefined) after.场景.切入说明 = repairDescription;
    if (!storyAccepted) {
      for (const key of ['当前卷', '当前章', '阶段']) restore(after.场景, key, before.场景[key], '/场景/' + key);
    }
    if (!after.玩家 || typeof after.玩家 !== 'object') after.玩家 = cloneState(before.玩家);
    restore(after.玩家, '综合初评', before.玩家.综合初评, '/玩家/综合初评');
    restore(after.玩家, '性别', '男性', '/玩家/性别');
    if (before.系统.结构版本 === 4) {
      // false→true 是明确本局觉醒的事实更新，由更新规则约束语义；代码不从战斗或旧境界猜测。
      // 普通主回复不能抹掉已确认觉醒；经绑定的副校正可用原生布尔值修正误记。
      const awakened = before.玩家.魔人觉醒 === true;
      if (!flexible && awakened || typeof after.玩家.魔人觉醒 !== 'boolean') {
        restore(after.玩家, '魔人觉醒', awakened, '/玩家/魔人觉醒');
      }
      // 经绑定的副校正可核定已有评级；普通主回复仍通过成长结算修改六维。
      if (!flexible) {
        restore(after.玩家, '六维', before.玩家.六维, '/玩家/六维');
        restore(after.玩家, '登记等级', before.玩家.登记等级, '/玩家/登记等级');
      }
      // Zod 对简写补齐结构后，再结合本轮原快照恢复省略的旧条件与掌握状态。
      for (const [skills, originals] of [
        [after.玩家.其他能力, before.玩家.其他能力],
        [after.玩家.伐刀能力?.招式, before.玩家.伐刀能力?.招式],
      ]) {
        if (!skills || typeof skills !== 'object' || Array.isArray(skills)) continue;
        for (const [name, skill] of Object.entries(skills)) {
          if (['__proto__', 'prototype', 'constructor'].includes(name)) continue;
          const original = originals && Object.hasOwn(originals, name) ? originals[name] : undefined;
          skills[name] = normalizeSkillEntry(skill, flexible ? undefined : original);
        }
      }
    }
    // 名册显隐只由玩家在终端整理，AI 不能自行藏起人物。
    if (before.系统.结构版本 === 4 && after.人际 && typeof after.人际 === 'object' && !Array.isArray(after.人际)) {
      // 玩家永久移除后，当前分支继承删除标记；模型不能依据历史正文重新建档。
      // 标记在系统对象内随楼层保存，回退到操作前的快照自然恢复原记录。
      for (const name of before.系统.已删除人物 || []) {
        if (Object.hasOwn(after.人际, name)) {
          delete after.人际[name];
          changed.push('/人际/' + name + '（本分支已永久移除）');
        }
      }
      for (const [name, relation] of Object.entries(after.人际)) {
        if (!relation || typeof relation !== 'object' || Array.isArray(relation)) continue;
        const original = before.人际?.[name];
        if (flexible) continue;
        if (original && Object.hasOwn(original, '名册隐藏')) {
          restore(relation, '名册隐藏', original.名册隐藏, '/人际/' + name + '/名册隐藏');
        } else if (Object.hasOwn(relation, '名册隐藏')) {
          delete relation.名册隐藏;
          changed.push('/人际/' + name + '/名册隐藏');
        }
      }
    }
  }
  return changed;
}

export function growthDateKey(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/(?:^|[^\d])(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/) ||
    value.match(/(?:^|[^\d])(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) return null;
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function growthObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function growthName(value) { return typeof value === 'string' && !!value.trim() && !/[~/]/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value); }
function growthState(value) {
  const result = growthObject(value) ? cloneState(value) : {};
  result.版本 = GROWTH_RULES.version;
  result.经验 ??= {};
  for (const axis of GROWTH_AXES) result.经验[axis] ??= 0;
  result.记录 ??= {};
  result.申请 ??= {};
  result.最近提示 ??= '';
  // G01/G02 的境界、环境、复核与待结算申请原样留档；G03 不再创建这些字段。
  return result;
}
function growthFingerprint(request, event) {
  const text = JSON.stringify([request.目标, String(event.结果 || '').replace(/\s+/g, '')]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}
function growthRequestValid(request) {
  const fields = ['来源事件', '目标', '类型', '经验', '方式', '成果'];
  return growthObject(request) && Object.keys(request).length === fields.length && fields.every(key => Object.hasOwn(request, key)) &&
    growthName(request.来源事件) && GROWTH_AXES.includes(request.目标) &&
    Object.hasOwn(GROWTH_RULES.awards, request.类型) && ['实际练习', '意识模拟'].includes(request.方式) &&
    Number.isSafeInteger(request.经验) && request.经验 >= 0 && typeof request.成果 === 'string' && !!request.成果.trim();
}

// 成果判断来自本轮剧情；代码只检查来源、去重与额度，不再用分钟或恢复条件计分。
// replyKey 由宿主适配器根据解析原文定位活动助手回复页，不能由模型提供。
export function enforceGrowthProgress(variables, previous, { replyKey = '', repairEventKeys = [], flexibleRepair = false } = {}) {
  const before = previous?.stat_data, after = variables?.stat_data;
  const notices = [];
  if (before?.系统?.结构版本 !== 4 || before.系统.开局状态 !== '已建档' || !after?.玩家) return notices;
  const old = before.玩家.成长, incoming = after.玩家.成长;
  if (!old && incoming === undefined) return notices;
  const growth = growthState(old);
  const flexible = Boolean(replyKey && flexibleRepair);
  // 副模型明确更正的是经验和评级的最终值；仍由下方记录本轮申请，不能重复相加或覆盖终值。
  const correctedExperience = {}, correctedGrades = {};
  if (flexible) for (const axis of GROWTH_AXES) {
    const experience = incoming?.经验?.[axis];
    if (Number.isSafeInteger(experience) && experience >= 0 && experience !== old?.经验?.[axis]) correctedExperience[axis] = experience;
    if (after.玩家.六维?.[axis] !== before.玩家.六维?.[axis]) correctedGrades[axis] = after.玩家.六维[axis];
  }
  const proposed = growthObject(incoming?.申请) ? incoming.申请 : {};
  const events = after.场景.已发生事件 || {}, oldEvents = before.场景.已发生事件 || {};
  function note(id, text) {
    notices.push({ path: '/玩家/成长/申请/' + id, message: text });
    growth.最近提示 = text;
  }
  const ownedFields = value => growthObject(value) ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== '申请' && !(flexible && key === '经验'))) : {};
  if (stateKey(ownedFields(incoming)) !== stateKey(ownedFields(old))) {
    note('只读字段', '经验、评级、结算额度和历史由代码维护，已忽略模型直接改写。');
  }
  // 仅显式副 API 补漏传入：宿主已从同一真实回复的原始 JSONPatch 核对事件键。
  // 这只放行本回复已保存但漏领的成果，不能新增额度、绕过收据去重或追授其他历史。
  const repairEvents = new Set(Array.isArray(repairEventKeys) ? repairEventKeys.filter(growthName) : []);
  const scoped = typeof replyKey === 'string' && !!replyKey;
  const sameReply = scoped && growth.回合结算?.标识 === replyKey;
  const budget = sameReply ? cloneState(growth.回合结算) : { 标识: replyKey, 获得: {}, 已晋级: [] };
  for (const axis of GROWTH_AXES) budget.获得[axis] ??= 0;
  // 从本分支收据恢复额度，防止修复时回合汇总遗漏；历史楼层与其他 swipe 不合并。
  if (scoped) {
    for (const axis of GROWTH_AXES) {
      const spent = Object.values(growth.记录).filter(row => row.回合 === replyKey && row.目标 === axis)
        .reduce((sum, row) => sum + row.获得, 0);
      budget.获得[axis] = Math.min(GROWTH_RULES.perReplyCap, Math.max(budget.获得[axis], spent));
    }
  }
  const touched = new Set();
  let settled = false;
  for (const [id, request] of Object.entries(proposed)) {
    if (!growthName(id)) { note(id, '申请名称不合法，未结算。'); continue; }
    if (Object.hasOwn(growth.记录, id)) { delete growth.申请[id]; continue; }
    const prior = growth.申请[id];
    if (!growthRequestValid(request)) {
      // 旧申请保持可读但不会在安装新版时补发，也不让旧分钟申请占据新回复额度。
      if (prior && stateKey(prior) === stateKey(request)) continue;
      note(id, '请按来源事件、目标、类型、经验、方式、成果六字段提交；旧分钟申请不会自动折算。'); continue;
    }
    if (!scoped) { note(id, '尚未确定这次解析所属的助手回复页，本次未结算成长；不会猜测楼层或扣除额度。'); continue; }
    // 资格只读取同一楼层的原生布尔值，旧成长.境界、能力描述和经验多少都不能代替它。
    // 未觉醒的申请不产生经验，也不会借保留的旧经验触发魔力量晋级。
    if (request.目标 === '魔力量' && after.玩家.魔人觉醒 !== true) {
      note(id, '魔人觉醒不是 true，魔力量仍为先天固定；本次未结算，也未改动既有经验和能力。'); continue;
    }
    const tier = GROWTH_RULES.awards[request.类型];
    if (request.经验 < tier.min) { note(id, request.类型 + '申请经验应为 ' + tier.min + '～' + tier.max + '，请按实际成果修正。'); continue; }
    const event = Object.hasOwn(events, request.来源事件) ? events[request.来源事件] : null;
    if (!growthObject(event) || typeof event.结果 !== 'string' || !event.结果.trim()) {
      note(id, '对应事件结果尚未保存；请先写入同名已发生事件，再提交成长。'); continue;
    }
    const pos = storyPosition(event.卷号, event.章段);
    // 主回复可能刚自动切到相邻章。补漏只允许已核对来源回看前一目录节点，
    // 包括卷末到下一卷开头；不能借校正追回更早章节或手动跳过的训练。
    const from = storyPosition(before.场景.当前卷, before.场景.当前章);
    const earliest = from - (repairEvents.has(request.来源事件) ? 1 : 0);
    if (pos < earliest || pos < 0 ||
        pos > storyPosition(after.场景.当前卷, after.场景.当前章)) {
      note(id, '只结算当前实际经历的章段；手动跳过或尚未到达的事件不补经验。'); continue;
    }
    const fingerprint = growthFingerprint(request, event);
    const receipts = Object.values(growth.记录);
    const duplicate = receipts.some(row => row.目标 === request.目标 && (row.来源事件 === request.来源事件 ||
      row.活动指纹 === fingerprint || (oldEvents[row.来源事件] && growthFingerprint(request, oldEvents[row.来源事件]) === fingerprint)));
    if (duplicate) {
      delete growth.申请[id]; note(id, '同一成果已经结算，不能改名或重复解析再次领取。'); continue;
    }
    if (!repairEvents.has(request.来源事件) && String(oldEvents[request.来源事件]?.结果 || '').replace(/\s+/g, '') === event.结果.replace(/\s+/g, '')) {
      note(id, '本轮没有新增该事件的实际成果；旧档、回忆和跳过的活动不追授经验。'); continue;
    }
    const rank = before.玩家.六维?.[request.目标], threshold = GROWTH_RULES.costs[rank];
    if (!threshold && rank !== 'S') { note(id, '当前评级尚未确定，无法计算晋级；请先在变量中填写已确认的实际评级。'); continue; }
    const eligible = request.目标 !== '体能' || request.方式 !== '意识模拟';
    const requested = Math.min(request.经验, tier.max);
    const award = eligible && threshold ? Math.min(requested, Math.max(0, GROWTH_RULES.perReplyCap - budget.获得[request.目标])) : 0;
    growth.经验[request.目标] += award;
    budget.获得[request.目标] += award;
    touched.add(request.目标);
    let explanation = request.目标 + ' +' + award + '；' + request.类型 + '。';
    if (!eligible) explanation += ' 纯意识模拟不产生肉身体能经验。';
    else if (rank === 'S') explanation += ' 当前评级量表已封顶，保留剩余经验，不再继续累计或换算其他数值。';
    else if (award < request.经验) explanation += ' 已按本回复单项 ' + GROWTH_RULES.perReplyCap + ' 点上限截断，超出部分不留待补发。';
    growth.记录[id] = { 来源事件: request.来源事件, 目标: request.目标, 类型: request.类型,
      方式: request.方式, 成果: request.成果, 获得: award, 活动指纹: fingerprint, 说明: explanation, 回合: replyKey };
    delete growth.申请[id];
    growth.最近提示 = explanation;
    settled = true;
  }
  if (settled) {
    const promotions = [];
    for (const axis of touched) {
      const rank = before.玩家.六维[axis], cost = GROWTH_RULES.costs[rank], index = ATTRIBUTE_GRADES.indexOf(rank);
      if (!Object.hasOwn(correctedExperience, axis) && !Object.hasOwn(correctedGrades, axis) &&
          !budget.已晋级.includes(axis) && cost && index > 0 && growth.经验[axis] >= cost) {
        const nextRank = ATTRIBUTE_GRADES[index - 1];
        after.玩家.六维[axis] = nextRank;
        growth.经验[axis] -= cost;
        budget.已晋级.push(axis);
        const text = axis + '：' + rank + ' → ' + nextRank + '，剩余经验 ' + growth.经验[axis] + '。';
        promotions.push(text);
        const receipt = Object.values(growth.记录).findLast(row => row.回合 === replyKey && row.目标 === axis);
        if (receipt) receipt.说明 += ' ' + text;
      }
    }
    growth.回合结算 = budget;
    if (promotions.length) growth.最近提示 += ' ' + promotions.join(' ');
  }
  Object.assign(growth.经验, correctedExperience);
  after.玩家.成长 = growth;
  return notices;
}

export function createStateController(adapter) {
  const tokens = new WeakMap();
  async function capture(options = {}) {
    const snapshot = await adapter.capture(options);
    if (snapshot.data.stat_data?.系统?.结构版本 === 3) {
      const error = new Error('当前楼层是 v3 档案，请先查看迁移差异并确认升级为 v4。');
      error.code = 'MIGRATION_REQUIRED';
      throw error;
    }
    const state = adapter.validate(cloneState(snapshot.data.stat_data));
    const token = Object.freeze({});
    tokens.set(token, { snapshot, state, done: null, kind: 'state' });
    return { state: cloneState(state), token };
  }
  async function prepareMigration(options = {}) {
    if (typeof adapter.migrate !== 'function') throw new Error('当前运行环境未提供迁移预览，请更新状态服务。');
    const snapshot = await adapter.capture(options);
    const preview = adapter.migrate(cloneState(snapshot.data.stat_data));
    const state = adapter.validate(cloneState(preview.state));
    const token = Object.freeze({});
    tokens.set(token, { snapshot, state, done: null, kind: 'migration' });
    return { ...cloneState(preview), state: cloneState(state), token };
  }
  function assertReplacementScope(snapshot) {
    if (typeof adapter.assertOpeningReplacement !== 'function') throw new Error('当前状态服务不能核对开局替换范围，请更新状态控制器后重试。');
    // 范围验证必须同步完成，临写检查与宿主赋值之间不能让出执行权。
    const result = adapter.assertOpeningReplacement(snapshot);
    if (result && typeof result.then === 'function') throw new Error('开局替换需要同步宿主校验，尚未写入。');
  }
  async function commit(token, build, kind = 'state', openingReplacement = false) {
    const record = tokens.get(token);
    if (!record) throw new Error('操作凭据已失效，请重新读取当前分支。');
    if (record.kind !== kind) throw new Error('操作凭据用途不符；迁移必须通过明确的升级操作提交。');
    if (record.busy) throw new Error('正在写入，请勿重复操作。');
    record.busy = true;
    try {
      if (openingReplacement) assertReplacementScope(record.snapshot);
      const candidate = adapter.validate(build(cloneState(record.state)));
      if (record.done) {
        if (stateKey(candidate) !== stateKey(record.done)) throw new Error('同一凭据只能重试原操作，请重新读取后再执行新操作。');
        const now = await adapter.current(record.snapshot);
        if (openingReplacement) assertReplacementScope(record.snapshot);
        if (stateKey(adapter.validate(now.data.stat_data)) !== stateKey(record.done)) throw new Error('当前状态已变化，请刷新。');
        return { state: cloneState(record.done), alreadyApplied: true };
      }
      const current = await adapter.current(record.snapshot);
      if (openingReplacement) assertReplacementScope(record.snapshot);
      // API 返回异常但写入已落地时，仅确认匹配结果，绝不再写一遍。
      if (current.data.stat_data?.系统?.结构版本 === 4 && stateKey(adapter.validate(current.data.stat_data)) === stateKey(candidate)) {
        record.done = candidate;
        record.openingReplacement = openingReplacement;
        return { state: cloneState(candidate), alreadyApplied: true };
      }
      if (stateKey(current.data) !== stateKey(record.snapshot.data)) throw new Error('变量已被其他操作更新，请重新读取，草稿已保留。');
      if (openingReplacement) assertReplacementScope(record.snapshot);
      await adapter.write(record.snapshot, current.data, candidate, { openingReplacement });
      const persisted = await adapter.current(record.snapshot);
      if (openingReplacement) assertReplacementScope(record.snapshot);
      const result = adapter.validate(persisted.data.stat_data);
      if (stateKey(result) !== stateKey(candidate)) throw new Error('回读与提交内容不一致，未确认写入成功；请检查 MVU 通知后刷新。');
      record.done = result;
      record.openingReplacement = openingReplacement;
      return { state: cloneState(result) };
    } finally { record.busy = false; }
  }
  return Object.freeze({
    version: '4.0.0', get catalogue() { return cloneState(STORY_VOLUMES); }, capture, prepareMigration,
    get growthRules() { return cloneState(GROWTH_RULES); },
    commitMigration: token => commit(token, state => state, 'migration'),
    verify: async token => {
      const record = tokens.get(token);
      if (!record?.done) throw new Error('尚无已回读确认的建档结果。');
      const now = await adapter.current(record.snapshot);
      if (record.openingReplacement) assertReplacementScope(record.snapshot);
      const state = adapter.validate(now.data.stat_data);
      if (stateKey(state) !== stateKey(record.done)) throw new Error('本局状态已变化，请刷新后继续。');
      return { state: cloneState(state) };
    },
    commitOpening: (token, payload) => commit(token, state => applyOpening(state, payload)),
    replaceOpening: (token, payload) => commit(token, state => applyOpeningReplacement(state, payload), 'state', true),
    transition: (token, request) => commit(token, state => applyTransition(state, request)),
    setRosterHidden: (token, name, hidden) => commit(token, state => {
      if (typeof name !== 'string' || !name.trim() || /[~/]/.test(name) ||
          ['__proto__', 'prototype', 'constructor'].includes(name) || typeof hidden !== 'boolean') throw new Error('名册操作参数不合法。');
      if (state.系统.开局状态 !== '已建档' || !Object.hasOwn(state.人际, name)) throw new Error('当前分支没有该人物档案，请刷新名册。');
      state.人际[name].名册隐藏 = hidden;
      return state;
    }),
    deleteRosterPerson: (token, name) => commit(token, state => {
      if (typeof name !== 'string' || !name.trim() || /[~/]/.test(name) ||
          ['__proto__', 'prototype', 'constructor'].includes(name)) throw new Error('人物名称不合法。');
      if (state.系统.开局状态 !== '已建档' || !Object.hasOwn(state.人际, name)) throw new Error('当前回复页没有该人物资料，请刷新名册。');
      delete state.人际[name];
      state.系统.已删除人物 = [...new Set([...(state.系统.已删除人物 || []), name])];
      return state;
    }),
  });
}
