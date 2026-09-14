// T01：选拔赛只保存名册与逐场事实；积分每次从记录重算，不写累加缓存。
// 本模块无宿主、网络和 schema 依赖，可同时用于 MVU 校验与终端视图。
export const TOURNAMENT_VERSION = 'T01';
const tournamentStates = ['未开始', '进行中', '已结束'];
const matchStates = ['待定', '已安排', '已完成', '已取消'];
const participantStates = ['参赛', '退选', '取消资格'];
const sources = ['正典', '原创', '玩家'];
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const copy = value => structuredClone(value);
const natural = value => Number.isSafeInteger(value) && value >= 0;
const nonblank = value => typeof value === 'string' && Boolean(value.trim());
const fixtures = { 1: '桐原静矢', 9: '兔丸恋恋', 11: '绫辻绚濑', 20: '东堂刀华' };
const canon = ['黑铁一辉', '史黛菈·法米利昂', '东堂刀华', '黑铁珠雫', '贵德原彼方', '叶暮牡丹', '叶暮桔梗', '有栖院凪', '兔丸恋恋', '碎城雷', '绫辻绚濑', '桐原静矢', '桃谷武士', '管茂信'];

// 仅补容器和显示默认值，不猜比赛、初始胜场、初始积分或命定胜负。
export function normalizeTournament(value) {
  if (!object(value)) return value;
  const next = copy(value);
  next.版本 ??= TOURNAMENT_VERSION;
  next.赛季 ??= '破军学园选拔赛';
  next.状态 ??= '未开始';
  next.总轮次 ??= 20;
  next.代表名额 ??= 6;
  next.号池规模 ??= 288;
  next.模式 = '跟随系统';
  next.名册 ??= {};
  next.比赛 ??= {};
  if (object(next.名册)) for (const entry of Object.values(next.名册)) {
    if (!object(entry)) continue;
    entry.来源 ??= '原创';
    entry.参赛状态 ??= '参赛';
    // null 是显式清除旧基线；省略字段仍由操作入口保留旧值。
    if (entry.初始战绩 === null) delete entry.初始战绩;
  }
  if (object(next.比赛)) for (const entry of Object.values(next.比赛)) {
    if (!object(entry)) continue;
    entry.状态 ??= '待定';
    for (const key of ['日期', '时间', '地点', '依据']) entry[key] ??= '';
    // 表单的未填可选项不是一个空 ID，也不是零胜。
    for (const key of ['胜者', '弃权方', '甲赛前胜场', '乙赛前胜场']) if (entry[key] === '' || entry[key] === null) delete entry[key];
  }
  return next;
}

function tournamentIssues(tournament) {
  const issues = [], add = message => issues.push(message);
  if (!object(tournament)) return ['选拔赛必须是对象'];
  if (tournament.版本 !== TOURNAMENT_VERSION) add('选拔赛版本应为 T01');
  if (!nonblank(tournament.赛季)) add('赛季名称不能为空');
  if (!tournamentStates.includes(tournament.状态)) add('选拔赛状态无效');
  if (!Number.isSafeInteger(tournament.总轮次) || tournament.总轮次 < 1) add('总轮次须为正整数');
  if (!Number.isSafeInteger(tournament.代表名额) || tournament.代表名额 < 1) add('代表名额须为正整数');
  if (!Number.isSafeInteger(tournament.号池规模) || tournament.号池规模 < 2) add('号池规模须至少为 2');
  if (!object(tournament.名册) || !object(tournament.比赛)) return [...issues, '名册与比赛须为按稳定 ID 保存的对象'];
  for (const [id, person] of Object.entries(tournament.名册)) {
    if (!nonblank(id) || unsafeKeys.has(id)) add('名册 ID 无效');
    if (!object(person)) { add(`名册 ${id} 必须是对象`); continue; }
    if (!nonblank(person.姓名)) add(`名册 ${id} 缺少姓名`);
    if (!sources.includes(person.来源)) add(`名册 ${id} 来源无效`);
    if (!participantStates.includes(person.参赛状态)) add(`名册 ${id} 参赛状态无效`);
    const baseline = person.初始战绩;
    if (baseline !== undefined) {
      if (!object(baseline)) { add(`名册 ${id} 初始战绩必须是对象`); continue; }
      if (![baseline.截至轮次, baseline.胜场, baseline.败场].every(natural)) add(`名册 ${id} 初始战绩须填非负整数`);
      else if (baseline.截至轮次 > tournament.总轮次 || baseline.胜场 + baseline.败场 > baseline.截至轮次) add(`名册 ${id} 初始战绩与轮次矛盾`);
      if (baseline.积分 !== undefined && !natural(baseline.积分)) add(`名册 ${id} 初始积分须为非负整数`);
      else if (baseline.积分 !== undefined && natural(baseline.胜场) && natural(baseline.截至轮次)) {
        const maximum = 5 * baseline.胜场 * (2 * baseline.截至轮次 - baseline.胜场 + 1);
        if (baseline.积分 < 10 * baseline.胜场 || baseline.积分 > maximum || baseline.积分 % 10 !== 0) add(`名册 ${id} 初始积分与胜场及轮次不符`);
      }
      if (!nonblank(baseline.依据)) add(`名册 ${id} 初始战绩必须注明本局依据`);
    }
  }
  const pairs = new Set(), occupied = new Set();
  for (const [id, match] of Object.entries(tournament.比赛)) {
    if (!nonblank(id) || unsafeKeys.has(id)) add('比赛 ID 无效');
    if (!object(match)) { add(`比赛 ${id} 必须是对象`); continue; }
    if (!Number.isSafeInteger(match.轮次) || match.轮次 < 1 || match.轮次 > tournament.总轮次) add(`比赛 ${id} 轮次超出赛季范围`);
    if (!matchStates.includes(match.状态)) add(`比赛 ${id} 状态无效`);
    for (const field of ['日期', '时间', '地点', '依据']) if (typeof match[field] !== 'string') add(`比赛 ${id} ${field}须为文字`);
    const a = own(tournament.名册, match.甲方) ? tournament.名册[match.甲方] : null;
    const b = own(tournament.名册, match.乙方) ? tournament.名册[match.乙方] : null;
    if (!a || !b) add(`比赛 ${id} 双方必须引用已有名册 ID`);
    if (match.甲方 === match.乙方) add(`比赛 ${id} 不能自己对战自己`);
    if (match.胜者 !== undefined && ![match.甲方, match.乙方].includes(match.胜者)) add(`比赛 ${id} 胜者不是参赛双方`);
    if (match.弃权方 !== undefined && ![match.甲方, match.乙方].includes(match.弃权方)) add(`比赛 ${id} 弃权方不是参赛双方`);
    if (match.状态 === '已完成') {
      if (![match.甲方, match.乙方].includes(match.胜者) || !match.胜者) add(`比赛 ${id} 完成时必须填写胜者`);
      if (match.弃权方 && match.弃权方 === match.胜者) add(`比赛 ${id} 弃权方不能同时获胜`);
      if (!nonblank(match.依据)) add(`比赛 ${id} 完成时须注明本局结果依据`);
    }
    for (const field of ['甲赛前胜场', '乙赛前胜场']) {
      if (match[field] !== undefined && (!natural(match[field]) || match[field] >= match.轮次)) add(`比赛 ${id} ${field}与轮次矛盾`);
    }
    if (!['已安排', '已完成'].includes(match.状态)) continue;
    // 已退选者的历史完赛仍有效；只阻止继续给退选或取消资格的人安排新赛。
    if (match.状态 === '已安排' && [a, b].some(person => person && person.参赛状态 !== '参赛')) add(`比赛 ${id} 不能为退选或取消资格者安排比赛`);
    const pair = JSON.stringify([match.甲方, match.乙方].sort());
    if (pairs.has(pair)) add(`比赛 ${id} 与既有对局重复匹配`);
    pairs.add(pair);
    for (const participantId of [match.甲方, match.乙方]) {
      const key = JSON.stringify([participantId, match.轮次]);
      if (occupied.has(key)) add(`比赛 ${id} 同一选手同轮有多个对局`);
      occupied.add(key);
      const baseline = tournament.名册[participantId]?.初始战绩;
      if (baseline && match.轮次 <= baseline.截至轮次) add(`比赛 ${id} 与 ${participantId} 的初始战绩覆盖轮次重叠`);
    }
  }
  return issues;
}

// 工厂不注册全局 schema；调用者将结果挂到可选的 /场景/选拔赛。
export function createTournamentSchema(z) {
  const count = () => z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
  const baseline = z.object({ 截至轮次: count(), 胜场: count(), 败场: count(), 积分: count().optional(), 依据: z.string().min(1) }).passthrough();
  const participant = z.object({ 姓名: z.string().min(1), 来源: z.enum(sources), 参赛状态: z.enum(participantStates), 初始战绩: baseline.optional() }).passthrough();
  const match = z.object({ 轮次: count(), 甲方: z.string().min(1), 乙方: z.string().min(1), 日期: z.string(), 时间: z.string(), 地点: z.string(), 状态: z.enum(matchStates), 胜者: z.string().optional(), 弃权方: z.string().optional(), 甲赛前胜场: count().optional(), 乙赛前胜场: count().optional(), 依据: z.string() }).passthrough();
  return z.preprocess(normalizeTournament, z.object({ 版本: z.literal(TOURNAMENT_VERSION), 赛季: z.string().min(1), 状态: z.enum(tournamentStates), 总轮次: count(), 代表名额: count(), 号池规模: count(), 模式: z.literal('跟随系统'), 名册: z.record(z.string(), participant), 比赛: z.record(z.string(), match) }).passthrough().superRefine((value, ctx) => {
    const messages = [...tournamentIssues(value), ...calculateTournament(value).conflicts];
    for (const message of new Set(messages)) ctx.addIssue({ code: 'custom', message });
  }));
}

function calculateTournament(tournament) {
  const rows = new Map(), matches = [], usedOpponents = {}, conflicts = [];
  for (const [id, person] of Object.entries(tournament.名册 || {})) {
    const base = person.初始战绩;
    rows.set(id, { id, name: person.姓名, source: person.来源, status: person.参赛状态,
      wins: base ? base.胜场 : null, losses: base ? base.败场 : null, points: base?.积分 ?? null,
      recordedWins: base?.胜场 ?? 0, recordedLosses: base?.败场 ?? 0, recordedPoints: base?.积分 ?? 0,
      pendingPoints: 0, throughRound: base?.截至轮次 ?? null, complete: false, minimumWins: base?.胜场 ?? 0, opponentHistoryComplete: Boolean(base && base.胜场 === 0 && base.败场 === 0) });
    usedOpponents[id] = [];
  }
  const records = Object.entries(tournament.比赛 || {}).filter(([, match]) => object(match)).sort((a, b) => a[1].轮次 - b[1].轮次 || a[0].localeCompare(b[0]));
  for (const [id, match] of records) {
    const a = rows.get(match.甲方), b = rows.get(match.乙方);
    const view = { id, ...copy(match), 甲方姓名: a?.name || match.甲方, 乙方姓名: b?.name || match.乙方, 积分: null, 说明: match.状态 };
    matches.push(view);
    if (!a || !b) continue;
    if (['已安排', '已完成'].includes(match.状态)) {
      if (!usedOpponents[a.id].includes(b.id)) usedOpponents[a.id].push(b.id);
      if (!usedOpponents[b.id].includes(a.id)) usedOpponents[b.id].push(a.id);
    }
    if (match.状态 !== '已完成' || ![a.id, b.id].includes(match.胜者)) continue;
    // 已完成的首轮是本赛季的真实起点，可确定赛前零战零分；跳轮绝不补这个基线。
    if (match.轮次 === 1) for (const row of [a, b]) {
      if (row.throughRound === null) { row.wins = 0; row.losses = 0; row.points = 0; row.throughRound = 0; row.opponentHistoryComplete = true; }
      else if (row.throughRound === 0 && row.wins === 0 && row.losses === 0 && row.points === null) row.points = 0;
    }
    const winsBefore = (row, field) => {
      const adjacent = row.throughRound !== null && row.throughRound === match.轮次 - 1;
      const known = adjacent ? row.wins : null;
      const supplied = match[field];
      if (supplied !== undefined && known !== null && supplied !== known) conflicts.push(`比赛 ${id} ${field}与已确认的先前战绩不一致`);
      // 缺场次时允许补赛前总胜场，但不能少于已经证实的胜场下界。
      if (supplied !== undefined && supplied < row.minimumWins) conflicts.push(`比赛 ${id} ${field}小于此前已确认的胜场`);
      if (supplied !== undefined && supplied > match.轮次 - 1 - row.recordedLosses) conflicts.push(`比赛 ${id} ${field}超过扣除已知败场后的胜场上界`);
      return supplied !== undefined ? supplied : known;
    };
    const aBefore = winsBefore(a, '甲赛前胜场'), bBefore = winsBefore(b, '乙赛前胜场');
    const winner = match.胜者 === a.id ? a : b;
    const opponentWins = winner === a ? bBefore : aBefore;
    const points = natural(opponentWins) ? 10 + 10 * opponentWins : null;
    view.积分 = points;
    view.说明 = points === null ? '对手赛前胜场未确认，积分待补' : `胜者 +${points} 分；败方历史积分不扣减`;
    for (const [row, before] of [[a, aBefore], [b, bBefore]]) {
      const victory = row === winner;
      const adjacent = row.throughRound !== null && row.throughRound === match.轮次 - 1;
      if (!adjacent) { row.losses = null; row.points = null; row.opponentHistoryComplete = false; }
      row.wins = natural(before) ? before + Number(victory) : null;
      if (row.losses !== null) row.losses += Number(!victory);
      row.minimumWins = Math.max(row.minimumWins + Number(victory), row.wins ?? 0);
      row.recordedWins += Number(victory);
      row.recordedLosses += Number(!victory);
      if (victory) {
        if (points === null) { row.pendingPoints++; row.points = null; }
        else { row.recordedPoints += points; if (row.points !== null) row.points += points; }
      }
      row.throughRound = match.轮次;
    }
  }
  for (const row of rows.values()) {
    row.complete = row.wins !== null && row.losses !== null && row.points !== null && row.pendingPoints === 0;
  }
  return { roster: [...rows.values()], matches, usedOpponents, conflicts };
}

// 推荐传 stat_data，从系统主角模式与玩家姓名解析当前玩家；直接传账本时仅提供中立视图。
export function deriveTournament(stateOrTournament) {
  const state = stateOrTournament?.stat_data || stateOrTournament;
  const directLedger = object(state) && ['版本', '名册', '比赛', '赛季'].some(key => own(state, key));
  const raw = state?.场景 ? state.场景.选拔赛 : directLedger ? state : null;
  if (!raw) return { version: TOURNAMENT_VERSION, exists: false, tournament: null, mode: state?.系统?.主角模式 || '未选择', playerId: null, roster: [], matches: [], leaderboard: [], eligible: [], ties: [], qualificationTie: false, usedOpponents: {}, warnings: [], complete: false, rankingLabel: '仅据已记录积分' };
  const tournament = normalizeTournament(raw), issues = tournamentIssues(tournament);
  if (issues.length) return { version: TOURNAMENT_VERSION, exists: true, tournament, mode: state?.系统?.主角模式 || '未选择', playerId: null, roster: [], matches: [], leaderboard: [], eligible: [], ties: [], qualificationTie: false, usedOpponents: {}, warnings: issues, complete: false, rankingLabel: '账本格式待修正' };
  const result = calculateTournament(tournament);
  const mode = state?.系统?.主角模式 || '未选择';
  const player = result.roster.find(row => row.source === '玩家') || result.roster.find(row => row.name === state?.玩家?.姓名);
  // 同积分并列；ID 只稳定显示顺序，不拿胜场或名字暗定代表席位。
  const leaderboard = [...result.roster].sort((a, b) => b.recordedPoints - a.recordedPoints || a.id.localeCompare(b.id));
  const ties = [];
  for (let start = 0; start < leaderboard.length;) {
    let end = start + 1;
    while (end < leaderboard.length && leaderboard[end].recordedPoints === leaderboard[start].recordedPoints) end++;
    for (let i = start; i < end; i++) { leaderboard[i].rank = start + 1; leaderboard[i].tied = end - start > 1; }
    if (end - start > 1) ties.push({ rank: start + 1, points: leaderboard[start].recordedPoints, ids: leaderboard.slice(start, end).map(row => row.id) });
    start = end;
  }
  const eligible = leaderboard.filter(row => row.status === '参赛');
  const cutoff = tournament.代表名额;
  const qualificationTie = eligible.length > cutoff && eligible[cutoff - 1].recordedPoints === eligible[cutoff].recordedPoints;
  const complete = tournament.状态 === '已结束' && result.roster.length >= tournament.号池规模 && result.roster.every(row => row.complete && (row.status !== '参赛' || row.throughRound === tournament.总轮次)) && !result.conflicts.length;
  const warnings = [...result.conflicts];
  if (result.roster.some(row => !row.complete)) warnings.push('记录不完整：未知场外战绩未补成零胜，缺少赛前胜场的胜局积分待补。');
  if (!complete) warnings.push('排行榜仅据已记录积分，不据此自动宣布完整排名或代表资格。');
  if (qualificationTie) warnings.push('代表席位边界同分：暂列并列，须由本局附加赛或已确认规则决出，不按 ID 或胜场擅定。');
  return { version: TOURNAMENT_VERSION, exists: true, tournament, mode, playerId: player?.id || null, ...result, leaderboard, eligible, ties, qualificationTie, warnings, complete, rankingLabel: complete ? '完整赛季账本排名' : '仅据已记录积分' };
}

// 非法赛制更新只恢复选拔赛子树；其他剧情、成长与人际更新继续保留。
export function enforceTournamentState(variables, previous) {
  const scene = variables?.stat_data?.场景;
  if (!scene || !own(scene, '选拔赛')) return [];
  const next = normalizeTournament(scene.选拔赛);
  const issues = tournamentIssues(next);
  if (!issues.length) issues.push(...calculateTournament(next).conflicts);
  if (issues.length) {
    const old = previous?.stat_data?.场景;
    if (old && own(old, '选拔赛')) scene.选拔赛 = copy(old.选拔赛);
    else delete scene.选拔赛;
    return [...new Set(issues)].map(message => `选拔赛：${message}；本次仅恢复选拔赛记录。`);
  }
  scene.选拔赛 = next;
  return [];
}

export function createTournamentParticipant(state, { name = '', source = '原创', id = '' } = {}) {
  const sourceState = state?.stat_data || state;
  const tournament = sourceState?.场景?.选拔赛 || sourceState;
  const roster = tournament?.名册 || {};
  if (!sources.includes(source)) throw new Error('参赛者来源无效');
  let nextId = id;
  if (!nextId && source === '正典' && canon.includes(name)) nextId = 'canon_' + String(canon.indexOf(name) + 1).padStart(2, '0');
  if (!nextId) { let index = 1; while (own(roster, 'oc_' + String(index).padStart(3, '0'))) index++; nextId = 'oc_' + String(index).padStart(3, '0'); }
  if (!nonblank(nextId) || unsafeKeys.has(nextId) || own(roster, nextId)) throw new Error('参赛者 ID 已存在或无效');
  return { id: nextId, participant: { 姓名: name.trim() || `未命名选手 ${nextId}`, 来源: source, 参赛状态: '参赛' } };
}

// 只建议下一场，不改动名册、不写预设胜负。原著锚点若与本局记录冲突就让位。
export function suggestTournamentOpponents(state, { participantId, round } = {}) {
  const view = deriveTournament(state);
  if (!view.exists || !view.roster.length) return { anchorId: null, candidates: [], warnings: ['请先登记选拔赛与参赛者。'] };
  const id = participantId || view.playerId, person = view.roster.find(row => row.id === id);
  if (!person || person.status !== '参赛' || !Number.isInteger(round) || round < 1 || round > view.tournament.总轮次) return { anchorId: null, candidates: [], warnings: ['请选择参赛者和有效轮次。'] };
  const occupied = new Set(view.matches.filter(match => ['已安排', '已完成'].includes(match.状态) && match.轮次 === round).flatMap(match => [match.甲方, match.乙方]));
  if (occupied.has(id)) return { anchorId: null, candidates: [], warnings: ['该选手本轮已有对局，请查看或修正原比赛。'] };
  const used = new Set(view.usedOpponents[id] || []);
  const candidates = view.roster.filter(row => row.id !== id && row.status === '参赛' && !occupied.has(row.id) && !used.has(row.id)).map(row => ({ id: row.id, name: row.name, source: row.source, reason: '本轮可安排，现有记录未重复对战' }));
  const anchorName = view.mode === '黑铁一辉' && person.name === '黑铁一辉' ? fixtures[round] : null;
  const anchor = anchorName ? candidates.find(row => row.name === anchorName) : null;
  const warnings = [];
  if (!person.opponentHistoryComplete || candidates.some(candidate => !view.roster.find(row => row.id === candidate.id)?.opponentHistoryComplete)) warnings.push('部分场外对手历史不完整，建议仅据现有记录排除重复；请核对未登记的旧对手。');
  if (anchor) { anchor.reason = '原著模式默认对手，可依本局剧情调整'; candidates.sort((a, b) => Number(b.id === anchor.id) - Number(a.id === anchor.id)); }
  else if (anchorName) warnings.push(`本轮原著默认对手为${anchorName}；未登记、已退选或与既有赛程冲突时不强行改写。`);
  return { anchorId: anchor?.id || null, candidates, warnings };
}

// 终端手动记账使用同一校验入口；同 ID 是纠错替换，不是再发一次积分。
export function prepareTournamentAction(state, request) {
  if (!object(state?.场景) || !object(request)) throw new Error('请先读取本局状态和操作内容');
  const next = copy(state);
  if (request.action === 'initialize') {
    if (next.场景.选拔赛) throw new Error('本局已有选拔赛，请修改现有赛季记录');
    next.场景.选拔赛 = normalizeTournament({ 赛季: request.season || '破军学园选拔赛' });
  } else {
    if (!next.场景.选拔赛) throw new Error('请先初始化选拔赛');
    const t = normalizeTournament(next.场景.选拔赛);
    if (['upsertParticipant', 'upsertMatch', 'cancelMatch'].includes(request.action) && (!nonblank(request.id) || unsafeKeys.has(request.id))) throw new Error('记录 ID 不能为空或保留名称');
    if (request.action === 'upsertParticipant') {
      if (!object(request.participant)) throw new Error('请填写参赛者资料');
      t.名册[request.id] = { ...(t.名册[request.id] || {}), ...copy(request.participant) };
    } else if (request.action === 'upsertMatch') {
      if (!object(request.match)) throw new Error('请填写比赛资料');
      t.比赛[request.id] = { ...(t.比赛[request.id] || {}), ...copy(request.match) };
    } else if (request.action === 'cancelMatch') {
      if (!own(t.比赛, request.id)) throw new Error('没有找到该比赛');
      t.比赛[request.id].状态 = '已取消';
    } else if (request.action === 'setStatus') t.状态 = request.status;
    else throw new Error('未知选拔赛操作');
    next.场景.选拔赛 = t;
  }
  const checked = normalizeTournament(next.场景.选拔赛);
  const issues = tournamentIssues(checked);
  if (!issues.length) issues.push(...calculateTournament(checked).conflicts);
  if (issues.length) throw new Error([...new Set(issues)].join('；'));
  next.场景.选拔赛 = checked;
  return next;
}
