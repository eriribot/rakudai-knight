// 本卡 v4 的经验初值为零；只补缺失容器/轴，不覆盖已有值或修猜坏值。
export function isRakudaiMvuState(state) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  return Boolean(object(state) && state.系统?.结构版本 === 4 &&
    [state.系统, state.场景, state.玩家, state.人际].every(object));
}

export function repairRakudaiMvuStructure(state, { legacyRequests = true } = {}) {
  if (!isRakudaiMvuState(state)) return state;
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
