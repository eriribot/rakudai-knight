import assert from 'node:assert/strict';
import { parseTournamentDate, tournamentCalendar } from './rakudai-tournament-calendar.mjs';

let passed = 0;
function test(label, run) { run(); passed++; console.log('通过：' + label); }
function progress(text, options) {
  const calendar = tournamentCalendar(text, options);
  assert.equal(calendar.valid, true);
  return [calendar.currentRound, calendar.elapsedRound, calendar.todayRound, calendar.nextRound, calendar.suspended];
}

test('中文与连字符完整日期沿用剧情日历解析口径', () => {
  const expected = { year: 2013, month: 6, day: 1, key: '2013-06-01' };
  for (const value of ['2013年6月1日', '西历 2013 年 6 月 1 日 · 早晨', '2013-06-01', '2013 - 6 - 1 08:00']) {
    assert.deepEqual(parseTournamentDate(value), expected, value);
  }
});

test('严格拒绝非法日期，并正确处理闰年与世纪规则', () => {
  for (const value of [undefined, null, {}, 20130601, '', '六月一日', '明天', '6/1', '2013/6/1',
    '2013-02-29', '1900-02-29', '2013-04-31', '2013-00-01', '2013-13-01', '2013-06-00',
    '2013-06-32', '2013-06-001', '12013-06-01', '0000-01-01']) {
    assert.equal(parseTournamentDate(value), null, String(value));
  }
  assert.deepEqual(parseTournamentDate('2012-02-29'), { year: 2012, month: 2, day: 29, key: '2012-02-29' });
  assert.deepEqual(parseTournamentDate('2000年2月29日'), { year: 2000, month: 2, day: 29, key: '2000-02-29' });
});

test('开幕前、默认首战及一辉晚一天互不混淆', () => {
  assert.deepEqual(progress('2013-04-21'), [0, 0, null, 1, false]);
  assert.deepEqual(progress('2013-04-22'), [1, 0, 1, 2, false]);
  assert.deepEqual(progress('2013-04-23'), [1, 1, null, 2, false]);
  for (const detained of [false, true]) {
    assert.deepEqual(progress('2013-04-22', { ikki: true, detained }), [0, 0, null, 1, false]);
    assert.deepEqual(progress('2013-04-23', { ikki: true, detained }), [1, 0, 1, 2, false]);
    assert.deepEqual(progress('2013-04-25', { ikki: true, detained }), [1, 1, null, 2, false]);
    assert.deepEqual(progress('2013-04-26', { ikki: true, detained }), [2, 1, 2, 3, false]);
  }
});

test('黄金周首尾均停赛，保持两场进度直到五月七日', () => {
  for (const text of ['2013-04-27', '2013-04-30', '2013-05-02', '2013-05-06']) {
    for (const ikki of [false, true]) assert.deepEqual(progress(text, { ikki }), [2, 2, null, 3, true]);
  }
  assert.deepEqual(progress('2013-05-07'), [3, 2, 3, 4, false]);
  assert.deepEqual(progress('2013-05-07', { ikki: true }), [3, 2, 3, 4, false]);
});

test('六月泳池与第十一场相邻剧情不会机械每三日加场', () => {
  assert.deepEqual(progress('2013-05-31'), [10, 9, 10, 11, false]);
  assert.deepEqual(progress('2013-06-01'), [10, 10, null, 11, false]);
  assert.deepEqual(progress('2013-06-04'), [10, 10, null, 11, false]);
  assert.deepEqual(progress('2013-06-05'), [11, 10, 11, 12, false]);
});

test('拘押只改一辉第十七至十九场，不改全校或首战', () => {
  assert.deepEqual(progress('2013-06-30'), [19, 18, 19, 20, false]);
  assert.deepEqual(progress('2013-06-30', { ikki: true }), [19, 18, 19, 20, false]);
  assert.deepEqual(progress('2013-06-30', { detained: true }), [19, 18, 19, 20, false]);
  assert.deepEqual(progress('2013-06-30', { ikki: true, detained: true }), [17, 17, null, 18, false]);
  assert.deepEqual(progress('2013-07-03', { ikki: true, detained: true }), [18, 17, 18, 19, false]);
  const normal = tournamentCalendar('2013-06-30', { ikki: true });
  const detained = tournamentCalendar('2013-06-30', { ikki: true, detained: true });
  assert.deepEqual(normal.schedule.filter((row, i) => row.date !== detained.schedule[i].date).map(row => row.round), [17, 18, 19]);
  assert.deepEqual(detained.schedule.slice(16, 19).map(row => row.date), ['2013-06-29', '2013-07-03', '2013-07-05']);
});

test('终战当天只到待赛，次日才将第二十场列为已过排期', () => {
  for (const options of [{}, { ikki: true }, { ikki: true, detained: true }]) {
    assert.deepEqual(progress('2013-07-08', options), [20, 19, 20, null, false]);
    assert.deepEqual(progress('2013-07-09', options), [20, 20, null, null, false]);
    assert.equal(tournamentCalendar('2013-07-08', options).schedule.at(-1).phase, 'today');
    assert.equal(tournamentCalendar('2013-07-09', options).schedule.at(-1).phase, 'elapsed');
  }
});

test('未知日期与赛季外年份明确待确认，不使用现实时间或查看月份', () => {
  for (const value of [null, '', '昨天傍晚', '2013-02-29', '2014-06-01', '2012-02-29',
    { 场景: { 时间: '未定' }, calendarState: { year: 2013, month: 6, day: 1 } }]) {
    const calendar = tournamentCalendar(value);
    assert.equal(calendar.valid, false);
    assert.ok(calendar.reason.length > 0);
    assert.deepEqual([calendar.currentRound, calendar.elapsedRound, calendar.todayRound, calendar.nextRound], [null, null, null, null]);
    assert.ok(calendar.schedule.every(row => row.phase === 'unknown'));
  }
  const otherYear = tournamentCalendar('2014-06-01');
  assert.equal(otherYear.date.key, '2014-06-01');
  assert.match(otherYear.reason, /2014.*2013/);
});

test('时间文字、状态本体与stat_data包装一致，调用不修改输入', () => {
  const state = { 场景: { 时间: '2013年6月30日 晚间' }, 选拔赛: { 比赛: { keep: { 胜者: '原记录' } } } };
  const before = structuredClone(state);
  const options = { ikki: true, detained: true };
  const expected = tournamentCalendar(state.场景.时间, options);
  assert.deepEqual(tournamentCalendar(state, options), expected);
  assert.deepEqual(tournamentCalendar({ stat_data: state }, options), expected);
  assert.deepEqual(state, before);
  expected.schedule[0].date = '2099-01-01';
  assert.equal(tournamentCalendar(state, options).schedule[0].date, '2013-04-23');
  const holiday = tournamentCalendar('2013-05-01');
  holiday.suspension.end = '2099-01-01';
  assert.equal(tournamentCalendar('2013-05-07').suspended, false);
});

test('各日期轨均为二十场，黄金周无排期且日期严格递增', () => {
  for (const options of [{}, { ikki: true }, { ikki: true, detained: true }]) {
    const { schedule, totalRounds } = tournamentCalendar('2013-06-01', options);
    assert.equal(totalRounds, 20);
    assert.equal(schedule.length, 20);
    assert.deepEqual(schedule.map(row => row.round), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.ok(schedule.every((row, i) => !i || schedule[i - 1].date < row.date));
    assert.ok(schedule.every(row => row.date < '2013-04-27' || row.date > '2013-05-06'));
  }
});

console.log(`选拔赛日历检查完成：${passed} 项通过。`);
