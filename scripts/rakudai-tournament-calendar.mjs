import tournamentCalendar2013 from './story/tournament-calendar-2013.json' with { type: 'json' };

// S01：只读取剧情时钟和裁定日期，不写存档，也不从日期推断比赛胜负。
// 与终端 parseSceneDate 接受相同的中文/连字符日期，拒绝不存在的公历日。
export function parseTournamentDate(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(/(?:^|[^\d])(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/) ||
    text.match(/(?:^|[^\d])(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})(?!\d)/);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = month === 2 ? (leapYear ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > monthDays) return null;
  return { year, month, day,
    key: String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0') };
}

/**
 * 输入为剧情时间文字、stat_data 本体或 { stat_data } 包装。
 * currentRound 包含当天排期；elapsedRound 仅计过去排期，均不表示已完成比赛。
 * todayRound/nextRound 是个人场次数字或 null；nextRound 严格指未来，不重复当天。
 * 日期无效或不属于 2013 赛季时 valid=false、轮次为 null，schedule 仍可供查看。
 */
export function tournamentCalendar(stateOrText, { ikki = false, detained = false } = {}) {
  const text = typeof stateOrText === 'string' ? stateOrText :
    stateOrText?.stat_data?.场景?.时间 ?? stateOrText?.场景?.时间;
  const date = parseTournamentDate(text);
  const valid = Boolean(date && date.year === tournamentCalendar2013.year);
  const reason = !date ? '日期待确认：剧情时间须包含有效的完整年月日。' :
    !valid ? `当前剧情年份为 ${date.year}；本赛程仅适用于 ${tournamentCalendar2013.year} 年。` : '';
  const schedule = tournamentCalendar2013.rounds.map(row => {
    // 一辉前两场错开一天是开赛安排，不以拘押是否发生为条件。
    const personalDate = Boolean(ikki && (row.round <= 2 || (detained && row.round >= 17 && row.round <= 19)));
    const scheduledDate = personalDate ? row.ikkiDate : row.defaultDate;
    const phase = !valid ? 'unknown' : scheduledDate < date.key ? 'elapsed' : scheduledDate === date.key ? 'today' : 'upcoming';
    return { ...row, date: scheduledDate, dateSource: personalDate ? 'ikkiDate' : 'defaultDate', phase };
  });
  const suspension = valid ? tournamentCalendar2013.suspensions.find(period =>
    period.inclusive ? date.key >= period.start && date.key <= period.end : date.key > period.start && date.key < period.end) : null;
  const elapsed = schedule.filter(row => row.phase === 'elapsed');
  const today = schedule.find(row => row.phase === 'today');
  const upcoming = schedule.find(row => row.phase === 'upcoming');
  const elapsedRound = valid ? elapsed.at(-1)?.round ?? 0 : null;
  return {
    valid, reason, date, track: ikki ? 'ikki' : 'default', detained: Boolean(ikki && detained),
    totalRounds: tournamentCalendar2013.totalRounds,
    currentRound: valid ? today?.round ?? elapsedRound : null,
    elapsedRound, todayRound: today?.round ?? null, nextRound: upcoming?.round ?? null,
    suspended: Boolean(suspension), suspension: suspension ? { ...suspension } : null,
    schedule,
  };
}
