import { tournamentCalendar, parseTournamentDate } from './rakudai-tournament-calendar.mjs';

// T02：确定性、按需的场外推演。只是本卡模拟，绝不声称补齐了全校真实账本。
export const TOURNAMENT_CANON = ['黑铁一辉', '史黛菈·法米利昂', '东堂刀华', '黑铁珠雫', '贵德原彼方', '叶暮牡丹', '叶暮桔梗', '有栖院凪', '兔丸恋恋', '碎城雷', '绫辻绚濑', '桐原静矢', '桃谷武士', '管茂信'];
const backgroundFixtures = [
  [1, 0, 11, 0], [1, 1, 12, 1], [1, 3, 13, 3], [9, 0, 8, 0],
  [9, 1, 9, 1], [11, 0, 10, 0], [14, 3, 2, 2], [20, 0, 2, 0],
];
const backgroundExit = new Set(['桐原静矢', '桃谷武士', '绫辻绚濑', '碎城雷']);
export function tournamentBackgroundHash(value) {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

export function identifyTournamentPlayer(state, ledger, create = false) {
  const name = state?.系统?.主角模式 === '黑铁一辉' ? '黑铁一辉' : state?.玩家?.姓名?.trim();
  if (!name) return;
  let id = Object.keys(ledger.名册).find(key => ledger.名册[key].姓名 === name);
  if (!id && create) {
    id = 'player'; while (Object.hasOwn(ledger.名册, id)) id += '_';
    ledger.名册[id] = { 姓名: name, 参赛状态: '参赛' };
  }
  for (const [key, person] of Object.entries(ledger.名册)) {
    if (key === id) person.来源 = '玩家';
    else if (person.来源 === '玩家') person.来源 = TOURNAMENT_CANON.includes(person.姓名) ? '正典' : '原创';
  }
}

// 种子名册只补可见正典和当前玩家，不把288人整池写进存档或提示词。
export function seedTournamentRoster(state, ledger) {
  const next = structuredClone(ledger);
  for (const [index, name] of TOURNAMENT_CANON.entries()) {
    if (Object.values(next.名册).some(person => person.姓名 === name)) continue;
    let id = 'canon_' + String(index + 1).padStart(2, '0');
    while (Object.hasOwn(next.名册, id)) id += '_';
    next.名册[id] = { 姓名: name, 来源: '正典', 参赛状态: '参赛' };
  }
  identifyTournamentPlayer(state, next, true);
  return next;
}

export function projectTournamentBackground(state, ledger) {
  // 拘押是明确的本局业务事实，不靠到了6/23或自由文字关键词猜它发生了。
  const detained = ledger.一辉拘押 === true;
  const calendar = tournamentCalendar(state, { ikki: state?.系统?.主角模式 === '黑铁一辉', detained });
  const next = structuredClone(ledger), visibleIds = Object.keys(ledger.名册), warnings = [];
  const endDate = ledger.状态 === '已结束' ? parseTournamentDate(ledger.结束日期) : null;
  const settlementDate = endDate && calendar.valid && endDate.key < calendar.date.key ? endDate.key : calendar.date?.key;
  const progressState = settlementDate || state;
  const simulatedCounts = {}, pendingRounds = {}, schedules = {}, reserved = new Set(), stopped = new Map(), checkpoints = {};
  const actual = Object.entries(ledger.比赛), pairs = new Set();
  const pairKey = (a, b) => JSON.stringify([a, b].sort());
  const slot = (id, round) => JSON.stringify([id, round]);
  const byName = name => visibleIds.find(id => next.名册[id].姓名 === name);
  for (const id of visibleIds) {
    const person = next.名册[id];
    schedules[id] = tournamentCalendar(progressState, { ikki: person.姓名 === '黑铁一辉', detained });
    simulatedCounts[id] = 0; pendingRounds[id] = [];
  }
  if (!calendar.valid || ledger.总轮次 !== 20 || ledger.状态 === '已结束' && !endDate) {
    warnings.push(!calendar.valid ? calendar.reason : ledger.状态 === '已结束' && !endDate ? '旧赛季已结束但缺少结束日期：仅显示真实账本，未追加场外推演。' : '当前自定义赛季不是20轮，S01场外推演未启用。');
    return { ledger: next, calendar, visibleIds, simulatedCounts, pendingRounds, warnings, active: false };
  }
  for (const [id, match] of actual) {
    // 连取消/草案也保留该槽，不把用户取消的比赛偷偷再生成。
    for (const participant of [match.甲方, match.乙方]) reserved.add(slot(participant, match.轮次));
    if (['已安排', '已完成'].includes(match.状态)) pairs.add(pairKey(match.甲方, match.乙方));
    const date = parseTournamentDate(match.日期);
    if (match.状态 === '已完成' && date && date.key > settlementDate) {
      next.比赛[id].状态 = '已安排';
      warnings.push(`比赛 ${id} 的日期晚于当前剧情日，未来赛果暂不计分。`);
    }
    if (next.比赛[id].状态 === '已完成') for (const [person, field] of [[match.甲方, '甲赛前胜场'], [match.乙方, '乙赛前胜场']]) {
      if (match[field] !== undefined) checkpoints[person] = Math.max(checkpoints[person] || 0, match.轮次);
    }
  }
  for (const id of visibleIds) {
    const person = next.名册[id];
    if (checkpoints[id]) warnings.push(`${person.姓名}有已确认的赛前胜场：第${checkpoints[id]}场以前缺失历史保留待补，背景不覆盖人工记录。`);
    if (!checkpoints[id] && person.来源 !== '玩家' && (person.参赛状态 === '参赛' || parseTournamentDate(person.退赛日期)) && !person.初始战绩) {
      person.初始战绩 = { 截至轮次: (person.入赛轮次 || 1) - 1, 胜场: 0, 败场: 0, 积分: 0, 依据: 'T02程序推演起点，不是补录的真实战果' };
    }
  }
  const canPlay = (id, round) => id && !stopped.has(id) && (next.名册[id].参赛状态 === '参赛' ||
    parseTournamentDate(next.名册[id].退赛日期)?.key > schedules[id].schedule[round - 1].date) &&
    round >= (next.名册[id].入赛轮次 || 1) && round >= (checkpoints[id] || 1) && round > (next.名册[id].初始战绩?.截至轮次 ?? 0) && !reserved.has(slot(id, round));
  const generated = (id, match) => {
    next.比赛[id] = { 日期: '', 时间: '', 地点: '', ...match, 程序推演: true, 推演版本: 'T02',
      依据: 'T02固定背景策略；本局真实赛果可覆盖，非原著已确认战果' };
    for (const participant of [match.甲方, match.乙方]) {
      reserved.add(slot(participant, match.轮次));
      if (simulatedCounts[participant] !== undefined && match.状态 === '已完成') simulatedCounts[participant]++;
    }
    pairs.add(pairKey(match.甲方, match.乙方));
  };
  for (let round = 1; round <= 20; round++) {
    for (const [, ai, bi, wi] of backgroundFixtures.filter(row => row[0] === round)) {
      const a = byName(TOURNAMENT_CANON[ai]), b = byName(TOURNAMENT_CANON[bi]), winner = byName(TOURNAMENT_CANON[wi]);
      if (!canPlay(a, round) || !canPlay(b, round) || pairs.has(pairKey(a, b))) continue;
      const date = [schedules[a].schedule[round - 1].date, schedules[b].schedule[round - 1].date].sort().at(-1);
      if (date > settlementDate) continue;
      const player = [a, b].some(id => next.名册[id].来源 === '玩家');
      const completed = date < settlementDate && !player;
      generated(`__rk_bg_fixture_${round}_${ai}_${bi}`, { 轮次: round, 甲方: a, 乙方: b, 日期: date,
        状态: completed ? '已完成' : '已安排', ...(completed ? { 胜者: winner } : {}) });
      if (completed) {
        const loser = winner === a ? b : a;
        if (backgroundExit.has(next.名册[loser].姓名)) stopped.set(loser, round);
      }
    }
    for (const id of visibleIds) {
      const person = next.名册[id], scheduled = schedules[id].schedule[round - 1];
      if (!canPlay(id, round) || person.来源 === '玩家' || scheduled.phase !== 'elapsed') continue;
      const token = Array.from(id).map(char => char.codePointAt(0).toString(16)).join('_');
      const opponent = `__rk_bg_opponent_${token}_${round}`;
      const wins = tournamentBackgroundHash(`T02:opponent:${id}:${round}`) % (Math.floor((round - 1) / 2) + 1);
      // 背景对手采用程序基线，不递归虚构其全校逐场履历，也不进入可见名册。
      next.名册[opponent] = { 姓名: `场外选手·${person.姓名}第${round}场对手`, 来源: '原创', 参赛状态: '参赛',
        初始战绩: { 截至轮次: round - 1, 胜场: wins, 败场: round - 1 - wins, 依据: 'T02固定种子生成的背景对手基线，非本局确认事实' } };
      const victory = TOURNAMENT_CANON.includes(person.姓名) || tournamentBackgroundHash(`T02:result:${id}:${round}`) % 2 === 0;
      generated(`__rk_bg_match_${token}_${round}`, { 轮次: round, 甲方: id, 乙方: opponent, 日期: scheduled.date,
        状态: '已完成', 胜者: victory ? id : opponent });
    }
    // 只有既定退选节点的那场真实败局才应用默认退出；OC提前打败正典不会自动踢掉他。
    for (const [id, match] of actual) {
      if (match.轮次 !== round || next.比赛[id].状态 !== '已完成') continue;
      for (const [r, ai, bi, wi] of backgroundFixtures.filter(row => row[0] === round)) {
        const a = byName(TOURNAMENT_CANON[ai]), b = byName(TOURNAMENT_CANON[bi]);
        if (pairKey(a, b) !== pairKey(match.甲方, match.乙方)) continue;
        const loser = match.胜者 === a ? b : a;
        if (loser && backgroundExit.has(next.名册[loser].姓名)) stopped.set(loser, round);
      }
    }
  }
  for (const id of visibleIds) {
    const person = next.名册[id];
    if (person.参赛状态 !== '参赛') continue;
    const completed = new Set(Object.values(next.比赛).filter(match => match.状态 === '已完成' && [match.甲方, match.乙方].includes(id)).map(match => match.轮次));
    const finalRound = stopped.has(id) ? Math.max(person.初始战绩?.截至轮次 || 0, ...completed) : schedules[id].elapsedRound;
    for (let round = (person.初始战绩?.截至轮次 || 0) + 1; round <= finalRound; round++) {
      if (!completed.has(round)) pendingRounds[id].push(round);
    }
  }
  warnings.push('场外结果为T02程序推演，实际赛果优先；背景对手使用固定基线，当前榜单不是全校完整账本。');
  if (endDate) warnings.push(`赛季已结束，场外推演冻结于${endDate.key}；重新开启赛季才会继续随日期推进。`);
  return { ledger: next, calendar, visibleIds, simulatedCounts, pendingRounds, warnings, stoppedRounds: Object.fromEntries(stopped), active: true };
}
