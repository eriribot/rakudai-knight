import { deriveTournament } from '../scripts/rakudai-tournament.mjs';
import { deriveNationalTournament } from '../scripts/rakudai-national-tournament.mjs';
import { TOURNAMENT_CANON, seedTournamentRoster } from '../scripts/rakudai-tournament-background.mjs';

// 只读适配：赛程、资格和赛果均读取当前账本。
export function read(input, providedView) {
  const snapshot = input?.state ? input : { state: input?.stat_data || input };
  const stat = structuredClone(snapshot.state?.stat_data || snapshot.state || {});
  const source = snapshot.source ? structuredClone(snapshot.source) : null;
  const pending = snapshot.pending === true;
  const view = providedView || deriveTournament(stat);
  const schoolName = value => String(value || '').trim().split(/\s*[/／·]\s*/)[0].replace('破軍學園', '破军学园');
  const name = stat.系统?.主角模式 === '黑铁一辉' ? '黑铁一辉' : stat.玩家?.姓名?.trim();
  const school = schoolName(stat.玩家?.所属);
  const registry = Object.entries(stat.场景?.七星剑斗祭?.资格名册 || {});
  const matchesPlayer = ([, entry]) => name && school && entry.姓名 === name && schoolName(entry.学园) === school;
  const matches = registry.filter(matchesPlayer);
  // ponytail: 沿用已保存的稳定 ID；先登记资格、后加入选拔名册时用唯一姓名与学园接续。
  const recordedPlayer = matches.find(([id]) => id === view.playerId) || (matches.length === 1 ? matches[0] : null);
  const player = {
    id: view.playerId || recordedPlayer?.[0] || 'player',
    name: name || '未建档',
    school: stat.玩家?.所属 || '所属待确认',
    device: stat.玩家?.固有灵装 || '灵装待登记',
    rank: stat.玩家?.登记等级 || '未登记',
  };
  let qualification;
  const status = (key, label, reason, representatives = []) => ({ status: key, label, reason, representatives });
  if (pending) {
    qualification = status('pending', '等待 MVU 保存', '当前回复尚未保存完成，暂不确认代表资格。');
  } else if (snapshot.incomplete === true) {
    qualification = status('unconfirmed', '代表资格待确认', '当前快照尚不完整，等待已保存的资格记录。');
  } else {
    const representatives = registry.filter(([, entry]) => schoolName(entry.学园) === '破军学园' && entry.资格状态 === '已取得')
      .map(([id, entry]) => ({ ...view.roster.find(row => row.id === id && row.name === entry.姓名),
        id, name: entry.姓名, school: entry.学园, source: '资格名册', status: entry.资格状态,
        player: id === recordedPlayer?.[0], basis: entry.依据 }));
    const entry = recordedPlayer?.[1];
    const labels = {
      已取得: ['qualified', `已取得${school}代表资格`, '本局资格名册已确认取得代表资格。'],
      未取得: ['not-qualified', '本届未取得代表资格', '本局资格名册已记录未取得代表资格。'],
      已取消: ['revoked', '代表资格已取消', '本局资格名册已记录取消代表资格。'],
    };
    const [key, label, reason] = labels[entry?.资格状态] || ['unconfirmed', '代表资格待确认', '本局尚未确认代表资格；可在终端依据剧情登记，积分与背景推演不直接授予资格。'];
    qualification = status(key, label, entry?.依据 || reason, representatives);
  }
  const national = snapshot.nationalView || (typeof deriveNationalTournament === 'function' ? deriveNationalTournament(stat) : { exists: false, tournament: {}, participants: [], matches: [], advancement: [] });
  const stages = ['16强', '8强', '4强', '决赛', '冠军'];
  const bracket = national.matches.length || national.advancement.length ? {
    actual: true,
    players: Object.fromEntries(national.participants.map(row => [row.id, { ...row, player: row.id === (recordedPlayer?.[0] || player.id) }])),
    matches: national.matches.map(row => ({ id: row.id, people: row.参赛者, p1: row.参赛者[0], p2: row.参赛者[1],
      zone: row.分区 === '决赛区' ? 'finals' : row.分区, round: stages.indexOf(row.晋级至) + 1,
      label: row.轮次, winner: row.状态 === '已完成' ? row.胜者 : '', promotion: row.晋级至,
      date: row.日期, time: row.时间, place: row.地点, status: row.状态, basis: row.依据, from: [] })),
    advancement: national.advancement,
  } : null;
  return { stat, source, pending, view, player, qualification, national, bracket };
}

function sampleState(ikki = false) {
  const name = ikki ? '黑铁一辉' : '示例骑士';
  const state = {
    系统: { 结构版本: 4, 开局状态: '已建档', 主角模式: ikki ? '黑铁一辉' : '自定义角色' },
    场景: { 当前卷: 1, 当前章: '第四章', 阶段: '进行中', 时间: '2013-04-24', 地点: '破军学园', 切入说明: '虚构预览样本，不是玩家存档或原著赛果。', 已发生事件: {}, 日程: {} },
    玩家: {
      性别: '男性', 魔人觉醒: false, 姓名: name, 性格关键词: '沉着', 处事风格: '观察后行动', 所属: '破军学园 / 一年一班',
      固有灵装: ikki ? '阴铁' : '星刻', 角色简介: ikki ? '一辉模式的虚构预览档案。' : '用于演示现有 MVU 身份流转的自捏角色。', 战斗风格: '近身剑术',
      伐刀能力: { 能力系别: '体能强化系', 能力本质: '预览能力', 共通限制: '按正文行动判定', 招式: {} },
      其他能力: {}, 成长: { 经验: { 魔力控制: 0, 体能: 0, 魔力量: 0 } },
      六维: { 攻击力: 'C', 防御力: 'C', 魔力量: ikki ? 'F' : 'C', 魔力控制: 'B', 体能: 'B', 运气: 'C' },
      综合初评: { 规则版本: 'R05-第一版', 分数: null, 等级: null, 拟定登记等级: null, 评定状态: '待填写六维', 待填写项: [] },
      登记等级: ikki ? 'F' : 'C',
    },
    人际: {},
  };
  state.场景.选拔赛 = seedTournamentRoster(state, {
    版本: 'T01', 赛季: '破军学园选拔赛 · 虚构预览', 状态: '进行中', 总轮次: 20, 代表名额: 6, 号池规模: 288, 模式: '跟随系统', 名册: {}, 比赛: {},
  });
  return state;
}

function selectionSample(ikki = false) {
  const state = sampleState(ikki), ledger = state.场景.选拔赛;
  const idFor = name => Object.keys(ledger.名册).find(id => ledger.名册[id].姓名 === name);
  const playerId = idFor(state.玩家.姓名);
  const pairs = [[playerId, idFor('桐原静矢')], [idFor('史黛菈·法米利昂'), idFor('桃谷武士')],
    [idFor('东堂刀华'), idFor('碎城雷')], [idFor('黑铁珠雫'), idFor('管茂信')]];
  if (!ikki) pairs.push([idFor('黑铁一辉'), idFor('兔丸恋恋')]);
  pairs.forEach(([a, b], index) => {
    ledger.比赛['preview_match_' + (index + 1)] = {
      轮次: 1, 甲方: a, 乙方: b, 日期: '2013-04-23', 时间: '14:00', 地点: '破军学园竞技场', 状态: '已完成', 胜者: a,
      依据: '虚构预览的已登记比赛，用于展示实际账本覆盖背景；不是原著赛果或当前聊天事实。',
    };
  });
  return state;
}

function completedSample(tie = false) {
  const state = sampleState(), ledger = state.场景.选拔赛;
  state.场景.时间 = '2013-07-08';
  state.场景.当前卷 = 3;
  state.场景.当前章 = '终章';
  state.场景.切入说明 = '虚构的完整旧账本预览：288 人 20 轮基线；无结束日期，因此现有 T02 仅读取完整账本、不生成日期背景。';
  ledger.状态 = '已结束';
  // 正式引擎支持的旧账本基线；此处只构造演示数据，不给实际存档补战绩。
  const leaders = ['史黛菈·法米利昂', '黑铁一辉', '东堂刀华', '黑铁珠雫', '贵德原彼方', '示例骑士', '叶暮牡丹'];
  for (let i = Object.keys(ledger.名册).length; i < 288; i++) {
    ledger.名册['preview_npc_' + String(i + 1).padStart(3, '0')] = { 姓名: '示例选手 ' + (i + 1), 来源: '原创', 参赛状态: '参赛' };
  }
  for (const person of Object.values(ledger.名册)) {
    const leader = leaders.indexOf(person.姓名), wins = leader >= 0 ? 20 - Math.floor(leader / 2) : 10;
    person.初始战绩 = { 截至轮次: 20, 胜场: wins, 败场: 20 - wins,
      积分: leader >= 0 ? (tie && leader === 6 ? 1400 : 1900 - 100 * leader) : 500,
      依据: '虚构预览：完整旧账本基线，专用于展示资格与同分状态；禁止视为实际剧情证据。' };
  }
  return state;
}

function qualifiedSample() {
  const state = selectionSample();
  state.场景.选拔赛.状态 = '已结束';
  const names = ['史黛菈·法米利昂', '黑铁一辉', '东堂刀华', '黑铁珠雫', '贵德原彼方', '示例骑士'];
  state.场景.七星剑斗祭 = { 资格名册: Object.fromEntries(Object.entries(state.场景.选拔赛.名册)
    .filter(([, entry]) => names.includes(entry.姓名))
    .map(([id, entry]) => [id, { 姓名: entry.姓名, 学园: '破军学园', 资格状态: '已取得', 依据: '虚构预览：本局已确认的代表名单。' }])) };
  return state;
}

const otherState = selectionSample();
otherState.玩家.所属 = '武曲学园 / 一年一班';
delete otherState.场景.选拔赛;
otherState.场景.七星剑斗祭 = { 资格名册: { player: { 姓名: '示例骑士', 学园: '武曲学园', 资格状态: '已取得', 依据: '虚构预览：武曲学园已确认的代表资格。' } } };

function nationalSample() {
  const state = structuredClone(otherState), ledger = state.场景.七星剑斗祭;
  state.场景.时间 = '2013-08-08';
  ledger.状态 = '进行中';
  for (let i = 1; i <= 4; i++) ledger.资格名册['guest_' + i] = { 姓名: '预览选手' + i, 学园: '预览学园', 资格状态: '已取得', 依据: '虚构演示' };
  ledger.比赛 = {
    preview_special: { 轮次: '特别赛', 分区: 'B', 参赛者: ['player', 'guest_1', 'guest_2', 'guest_3', 'guest_4'], 日期: '2013-08-08', 时间: '14:00', 地点: '预览赛场', 状态: '已完成', 胜者: 'player', 晋级至: '8强', 依据: '虚构多人赛果，展示本局账本' },
    preview_final: { 轮次: '分区决赛', 分区: 'B', 参赛者: ['player', 'guest_1'], 日期: '2013-08-10', 时间: '', 地点: '预览赛场', 状态: '已安排', 晋级至: '4强', 依据: '虚构排期，尚未比赛' },
  };
  ledger.晋级记录 = { preview_advance: { 选手: 'guest_1', 阶段: '8强', 日期: '2013-08-08', 状态: '已确认', 依据: '虚构直接晋级裁定' } };
  return state;
}

export const samples = {
  selection: { label: '选拔进行中', description: '虚构 OC 与原作角色共用现有 MVU 选拔账本；资格尚待确认。', state: selectionSample() },
  qualified: { label: '资格已登记 · 已出线', description: '虚构的已确认代表名单：选拔账本可不完整，资格读取本局已保存记录。', state: qualifiedSample() },
  tie: { label: '选拔同分 · 资格待确认', description: '虚构完整旧账本：第六、第七名同分；资格名册未登记，不从积分自动授予资格。', state: completedSample(true) },
  other: { label: '他校自捏角色 · 已出线', description: '虚构他校 OC：读取同一角色档案与已保存的武曲代表资格。', state: otherState },
  national: { label: '全国赛 · 已登记赛果', description: '虚构全国赛账本，展示多人对局、排期与直接晋级裁定。', state: nationalSample() },
  ikki: { label: '黑铁一辉模式', description: '虚构一辉模式：绑定现有一辉参赛 ID，名册不重复添加。', state: selectionSample(true) },
};
