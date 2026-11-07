export const ASTERISK_CONTRACT = {
  schools: ['seidoukan', 'gallardworth', 'jielong', 'rewolf', 'arlequint'],
  identities: ['星脉世代', '魔术师', '自定义'],
  ranks: ['未知', '未上榜', '已上榜'],
  weapons: ['尚未确定', '常规武器', '煌式武装', '纯星煌式武装', '研究装备', '不使用武装'],
};

// 原生模式不依赖 Zod；仅检查学战必需数据，未知资料原样保留，不做整档清洗。
export function hasAsteriskNativeContract(state) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string';
  const texts = (value, keys) => object(value) && keys.every(key => text(value[key]));
  const names = value => Array.isArray(value) && value.every(item => text(item) && item.length > 0);
  const skills = value => object(value) && Object.values(value).every(skill => text(skill) || object(skill) &&
    ['说明', '条件与代价'].every(key => skill[key] === undefined || text(skill[key])) &&
    (skill.掌握状态 === undefined || ['待确认', '学习中', '已掌握'].includes(skill.掌握状态)));
  if (!isSharedMvuState(state) || resolveMvuWorld(state) !== 'asterisk') return false;
  const player = state.玩家, scene = state.场景, aw = player.学战, rank = aw?.校内序列;
  return player.性别 === '男性' && texts(player, ['姓名', '性格关键词', '处事风格', '所属', '角色简介', '战斗风格']) &&
    (state.系统.开局状态 !== '已建档' || player.姓名.trim().length > 0) &&
    ['当前身体', '当前能力边界', '本局映射'].every(key => player[key] === undefined || text(player[key])) && skills(player.其他能力) &&
    texts(aw, ['能力机制', '共通限制']) && ASTERISK_CONTRACT.schools.includes(aw.学园ID) && ASTERISK_CONTRACT.identities.includes(aw.能力身份) &&
    skills(aw.招式) && texts(aw.星辰力, ['说明']) && object(rank) && ASTERISK_CONTRACT.ranks.includes(rank.状态) &&
    (rank.状态 === '已上榜' ? Number.isInteger(rank.名次) && rank.名次 >= 1 && rank.名次 <= 72 : rank.名次 === null) &&
    texts(aw.武装, ['名称', '使用条件']) && ASTERISK_CONTRACT.weapons.includes(aw.武装.类别) &&
    scene.当前卷 === null && texts(scene, ['当前章', '时间', '地点', '切入说明']) && scene.当前章.trim().length > 0 &&
    ['未开始', '进行中', '已结束', '已完成'].includes(scene.阶段) && object(scene.已发生事件) &&
    Object.values(scene.已发生事件).every(event => texts(event, ['章段', '结果']) && event.章段.length > 0 && event.结果.length > 0 &&
      event.卷号 === null && names(event.参与者) && names(event.知情者)) && (scene.日程 === undefined || object(scene.日程));
}

// 作品标记与外观无关；仅旧的已建档 v4 缺标记时按落第解释。
export function resolveMvuWorld(state) {
  const system = state?.系统;
  if (!system || typeof system !== 'object' || Array.isArray(system)) return null;
  if (Object.hasOwn(system, '作品')) return ['rakudai', 'asterisk'].includes(system.作品) ? system.作品 : null;
  return system.结构版本 === 4 && system.开局状态 === '已建档' &&
    ['场景', '玩家', '人际'].every(key => state[key] && typeof state[key] === 'object' && !Array.isArray(state[key])) ? 'rakudai' : null;
}
export function isSharedMvuState(state) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  return Boolean(object(state) && state.系统?.结构版本 === 4 &&
    [state.系统, state.场景, state.玩家, state.人际].every(object) &&
    (resolveMvuWorld(state) || state.系统.开局状态 === '待建档' && state.系统.作品 == null));
}
export function isRakudaiMvuState(state) {
  return isSharedMvuState(state) && resolveMvuWorld(state) === 'rakudai';
}
export function hasBlazerAbility(state) {
  const ability = state?.玩家?.伐刀能力;
  return isSharedMvuState(state) && state.系统.开局状态 === '已建档' &&
    ability !== null && typeof ability === 'object' && !Array.isArray(ability);
}
export function hasBlazerGrowth(state) {
  const attributes = state?.玩家?.六维;
  return hasBlazerAbility(state) && attributes !== null && typeof attributes === 'object' && !Array.isArray(attributes);
}

export function repairRakudaiMvuStructure(state, { legacyRequests = true } = {}) {
  // 学战只补已明确建立的成长账本，不因觉醒或换装备自动创建经验。
  if (!isRakudaiMvuState(state) && !(hasBlazerGrowth(state) && Object.hasOwn(state.玩家, '成长'))) return state;
  legacyRequests &&= resolveMvuWorld(state) === 'rakudai';
  const player = state.玩家;
  if (!Object.hasOwn(player, '成长')) {
    return { ...state, 玩家: { ...player, 成长: { 经验: { 魔力控制: 0, 体能: 0, 魔力量: 0 }, ...(legacyRequests ? { 申请: {} } : {}) } } };
  }
  const growth = player.成长;
  if (growth === null || typeof growth !== 'object' || Array.isArray(growth)) return state;
  let next = growth;
  function fill(field, value) {
    if (next === growth) next = { ...growth };
    next[field] = value;
  }
  if (!Object.hasOwn(growth, '经验')) fill('经验', { 魔力控制: 0, 体能: 0, 魔力量: 0 });
  else if (growth.经验 !== null && typeof growth.经验 === 'object' && !Array.isArray(growth.经验)) {
    let experience = growth.经验;
    for (const axis of ['魔力控制', '体能', '魔力量']) if (!Object.hasOwn(experience, axis)) {
      if (experience === growth.经验) experience = { ...growth.经验 };
      experience[axis] = 0;
    }
    if (experience !== growth.经验) fill('经验', experience);
  }
  // N02 的父容器兼容仍保留；新规则不创建或兑现申请。
  if (legacyRequests && !Object.hasOwn(growth, '申请')) fill('申请', {});
  return next === growth ? state : { ...state, 玩家: { ...player, 成长: next } };
}
