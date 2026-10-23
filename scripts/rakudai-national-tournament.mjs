import nationalTournamentDates from './story/national-tournament-calendar.json' with { type: 'json' };
import { parseTournamentDate } from './rakudai-tournament-calendar.mjs';

const ntStates = ['未开始', '进行中', '已结束'];
const ntMatchStates = ['待定', '已安排', '进行中', '已完成', '已取消'];
const ntQualificationStates = ['待确认', '已取得', '未取得', '已取消'];
const ntBlocks = ['A', 'B', 'C', 'D', '决赛区', '未定'];
const ntStages = ['16强', '8强', '4强', '决赛', '冠军'];
const ntDecisionStates = ['已确认', '已撤销'];
const ntObject = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const ntNonblank = value => typeof value === 'string' && Boolean(value.trim());
const ntId = value => ntNonblank(value) && !/[~/]/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value) && !value.startsWith('__rk_bg_');
const ntDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && parseTournamentDate(value)?.key === value;
const ntOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

function nationalTournamentIssues(tournament) {
  if (!ntObject(tournament)) return ['七星剑斗祭记录须为对象'];
  const issues = [], add = message => issues.push(message);
  if (tournament.状态 !== undefined && !ntStates.includes(tournament.状态)) add('全国赛状态无效');
  for (const field of ['开始日期', '结束日期']) if (tournament[field] !== undefined && !ntDate(tournament[field])) add(field + '须为有效的 YYYY-MM-DD 日期');
  if (tournament.开始日期 && tournament.结束日期 && tournament.开始日期 > tournament.结束日期) add('结束日期不能早于开始日期');
  for (const field of ['资格名册', '比赛', '晋级记录']) {
    if (tournament[field] !== undefined && !ntObject(tournament[field])) add(field + '须为按稳定 ID 保存的对象');
  }
  const roster = ntObject(tournament.资格名册) ? tournament.资格名册 : {};
  for (const [id, row] of Object.entries(roster)) {
    if (!ntId(id) || !ntObject(row) || !ntNonblank(row.姓名) || !ntNonblank(row.学园) || !ntQualificationStates.includes(row.资格状态) || typeof row.依据 !== 'string') add('资格记录 ' + id + ' 无效');
  }
  for (const [id, match] of Object.entries(ntObject(tournament.比赛) ? tournament.比赛 : {})) {
    if (!ntId(id) || !ntObject(match)) { add('比赛 ' + id + ' 无效'); continue; }
    if (!ntNonblank(match.轮次) || !ntBlocks.includes(match.分区) || !ntMatchStates.includes(match.状态)) add('比赛 ' + id + ' 的轮次、分区或状态无效');
    for (const field of ['日期', '时间', '地点', '依据']) if (typeof match[field] !== 'string') add('比赛 ' + id + ' ' + field + '须为文字');
    if (match.日期 && !ntDate(match.日期)) add('比赛 ' + id + ' 日期无效');
    const participants = Array.isArray(match.参赛者) ? match.参赛者 : [];
    if (participants.length < 2 || participants.some(pid => !ntId(pid) || !ntOwn(roster, pid)) || new Set(participants).size !== participants.length) add('比赛 ' + id + ' 须引用至少两名不同的资格名册选手');
    if (match.胜者 !== undefined && !participants.includes(match.胜者)) add('比赛 ' + id + ' 胜者须为参赛者');
    if (match.晋级至 !== undefined && match.晋级至 !== '' && !ntStages.includes(match.晋级至)) add('比赛 ' + id + ' 晋级阶段无效');
    if (match.状态 === '已完成' && (!match.胜者 || !participants.includes(match.胜者) || !ntNonblank(match.依据))) add('比赛 ' + id + ' 完成时须填写胜者与结果依据');
  }
  for (const [id, row] of Object.entries(ntObject(tournament.晋级记录) ? tournament.晋级记录 : {})) {
    if (!ntId(id) || !ntObject(row)) { add('晋级记录 ' + id + ' 无效'); continue; }
    if (!ntId(row.选手) || !ntOwn(roster, row.选手)) add('晋级记录 ' + id + ' 须引用资格名册选手');
    if (!ntStages.includes(row.阶段) || !ntDecisionStates.includes(row.状态)) add('晋级记录 ' + id + ' 的阶段或状态无效');
    if (typeof row.日期 !== 'string' || row.日期 && !ntDate(row.日期)) add('晋级记录 ' + id + ' 日期无效');
    if (typeof row.依据 !== 'string' || row.状态 === '已确认' && !ntNonblank(row.依据)) add('晋级记录 ' + id + ' 须填写裁定依据');
  }
  return issues;
}

export function createNationalTournamentSchema(z) {
  const id = () => z.string().refine(ntId);
  const qualification = z.object({ 姓名: z.string().refine(ntNonblank), 学园: z.string().refine(ntNonblank), 资格状态: z.enum(ntQualificationStates), 依据: z.string() }).passthrough();
  const match = z.object({ 轮次: z.string().min(1), 分区: z.enum(ntBlocks), 参赛者: z.array(id()).min(2), 日期: z.string(), 时间: z.string(), 地点: z.string(), 状态: z.enum(ntMatchStates), 胜者: id().optional(), 晋级至: z.enum(['', ...ntStages]).optional(), 依据: z.string() }).passthrough();
  const advancement = z.object({ 选手: id(), 阶段: z.enum(ntStages), 日期: z.string(), 状态: z.enum(ntDecisionStates), 依据: z.string() }).passthrough();
  return z.object({
    资格名册: z.record(id(), qualification).optional(), 状态: z.enum(ntStates).optional(),
    开始日期: z.string().optional(), 结束日期: z.string().optional(),
    比赛: z.record(id(), match).optional(), 晋级记录: z.record(id(), advancement).optional(),
  }).passthrough().superRefine((value, ctx) => {
    for (const message of nationalTournamentIssues(value)) ctx.addIssue({ code: 'custom', message });
  });
}

export function shouldInjectNationalTournament(state) {
  const scene = (state?.stat_data || state)?.场景;
  const date = parseTournamentDate(scene?.时间), tournament = scene?.七星剑斗祭;
  const start = tournament?.开始日期 ?? nationalTournamentDates.startDate;
  const end = tournament?.结束日期 ?? nationalTournamentDates.endDate;
  return Boolean(date && ntDate(start) && ntDate(end) && date.key >= start && date.key <= end && tournament?.状态 !== '已结束');
}

export function deriveNationalTournament(input) {
  const state = input?.stat_data || input, raw = state?.场景?.七星剑斗祭;
  const tournament = ntObject(raw) ? structuredClone(raw) : null;
  const roster = ntObject(tournament?.资格名册) ? tournament.资格名册 : {};
  const participants = Object.entries(roster).filter(([, row]) => ntObject(row)).map(([id, row]) => ({ id, name: row.姓名, school: row.学园, status: row.资格状态, basis: row.依据 }));
  const matches = Object.entries(ntObject(tournament?.比赛) ? tournament.比赛 : {}).filter(([, row]) => ntObject(row)).map(([id, row]) => ({
    ...row, id, 参赛者姓名: (Array.isArray(row.参赛者) ? row.参赛者 : []).map(pid => roster[pid]?.姓名 || pid), 胜者姓名: roster[row.胜者]?.姓名 || row.胜者 || '',
  })).sort((a, b) => (a.日期 || '').localeCompare(b.日期 || '') || (a.时间 || '').localeCompare(b.时间 || '') || a.id.localeCompare(b.id));
  const candidates = matches.filter(row => row.状态 === '已完成' && row.参赛者?.includes(row.胜者) && ntOwn(roster, row.胜者) && ntStages.includes(row.晋级至))
    .map(row => ({ id: row.胜者, stage: row.晋级至, date: row.日期 || '', matchId: row.id }));
  for (const [id, row] of Object.entries(ntObject(tournament?.晋级记录) ? tournament.晋级记录 : {})) {
    if (row?.状态 === '已确认' && ntOwn(roster, row.选手) && ntStages.includes(row.阶段)) candidates.push({ id: row.选手, stage: row.阶段, date: row.日期 || '', decisionId: id });
  }
  // ponytail: 晋级从现存结果重算；同阶段取较晚记录，只存一份事实账本。
  candidates.sort((a, b) => ntStages.indexOf(a.stage) - ntStages.indexOf(b.stage) || a.date.localeCompare(b.date) || (a.matchId || a.decisionId).localeCompare(b.matchId || b.decisionId));
  const progression = new Map(candidates.map(row => [row.id, { ...row, name: roster[row.id].姓名 }]));
  const date = parseTournamentDate(state?.场景?.时间);
  return { exists: raw !== undefined, tournament, participants, matches, advancement: [...progression.values()], calendar: {
    date, valid: Boolean(date), active: shouldInjectNationalTournament(state),
    startDate: tournament?.开始日期 ?? nationalTournamentDates.startDate, endDate: tournament?.结束日期 ?? nationalTournamentDates.endDate,
    reference: structuredClone(nationalTournamentDates.schedule),
    matches: matches.filter(row => row.日期).map(row => ({ id: row.id, date: row.日期, time: row.时间, round: row.轮次, status: row.状态, title: row.参赛者姓名.join(' / ') })),
  } };
}

export function prepareNationalTournamentAction(state, request) {
  if (!ntObject(state?.场景) || !ntObject(request)) throw new Error('请先读取本局状态和操作内容');
  if (state.场景.七星剑斗祭 !== undefined && !ntObject(state.场景.七星剑斗祭)) throw new Error('七星剑斗祭记录须为对象');
  const next = structuredClone(state), tournament = next.场景.七星剑斗祭 ??= {};
  if (request.action === 'setNationalSchedule') {
    const schedule = request.schedule ?? request;
    if (!ntObject(schedule)) throw new Error('请填写赛程设置');
    for (const field of ['开始日期', '结束日期', '状态']) if (ntOwn(schedule, field)) tournament[field] = schedule[field];
  } else if (request.action === 'upsertNationalMatch' || request.action === 'upsertNationalAdvancement') {
    if (!ntId(request.id)) throw new Error('记录 ID 不能为空、包含 / 或 ~，或使用保留名称');
    const match = request.action === 'upsertNationalMatch';
    const field = match ? '比赛' : '晋级记录', data = match ? request.match : request.advancement;
    if (!ntObject(data)) throw new Error(match ? '请填写比赛资料' : '请填写晋级裁定');
    if (tournament[field] !== undefined && !ntObject(tournament[field])) throw new Error(field + '须为按稳定 ID 保存的对象');
    const records = tournament[field] ??= {};
    records[request.id] = { ...(match ? { 分区: '未定', 日期: '', 时间: '', 地点: '', 状态: '待定', 依据: '' } : { 日期: '', 状态: '已确认', 依据: '' }), ...records[request.id], ...structuredClone(data) };
    if (match && records[request.id].胜者 === '') delete records[request.id].胜者;
  } else throw new Error('未知全国赛操作');
  const issues = nationalTournamentIssues(tournament);
  if (issues.length) throw new Error(issues.join('；'));
  return next;
}
