import { deriveTournament } from '../scripts/rakudai-tournament.mjs';
import { TOURNAMENT_CANON, seedTournamentRoster } from '../scripts/rakudai-tournament-background.mjs';

// 只读预览适配：复用正式选拔引擎；没有写档、全国赛签位或剧情文本确权。
export function read(input) {
  const snapshot = input?.state ? input : { state: input?.stat_data || input };
  const stat = structuredClone(snapshot.state?.stat_data || snapshot.state || {});
  const source = snapshot.source ? structuredClone(snapshot.source) : null;
  const pending = snapshot.pending === true;
  const view = deriveTournament(stat);
  const row = view.roster.find(person => person.id === view.playerId);
  const player = {
    id: view.playerId,
    name: row?.name || stat.玩家?.姓名 || '未建档',
    school: stat.玩家?.所属 || '所属待确认',
    device: stat.玩家?.固有灵装 || '灵装待登记',
    rank: stat.玩家?.登记等级 || '未登记',
  };
  let qualification;
  const status = (key, label, reason, representatives = []) => ({ status: key, label, reason, representatives });
  if (pending) {
    qualification = status('pending', '等待 MVU 保存', '当前回复尚未保存完成，暂不确认代表资格。');
  } else if (!view.applicable) {
    qualification = status('not-applicable', '他校资格待确认', '当前所属不适用破军选拔；保留角色档案，须依据所属学校的代表资格进入全国赛。');
  } else if (snapshot.incomplete === true || !view.exists || !view.complete || view.tournament?.状态 !== '已结束') {
    qualification = status('unconfirmed', '代表资格待确认', '当前选拔仍在进行或完整账本尚未确认，已记录积分和背景推演不直接授予代表资格。');
  } else if (view.qualificationTie) {
    qualification = status('tie', '代表席位同分待决', '第六名席位边界同分，须由本局附加赛或已确认规则决定。');
  } else if (!row) {
    qualification = status('unconfirmed', '玩家参赛身份待确认', '当前选拔名册尚未绑定本局玩家。');
  } else {
    const representatives = view.eligible.slice(0, view.tournament.代表名额);
    const qualified = representatives.some(person => person.id === player.id);
    qualification = status(qualified ? 'qualified' : 'not-qualified', qualified ? '已取得破军代表资格' : '本届未取得代表资格',
      qualified ? '已结束的完整选拔账本无席位同分，玩家位于有效代表名额内。' : '已结束的完整选拔账本无席位同分，玩家未列入有效代表名额。', representatives);
  }
  return { stat, source, pending, view, player, qualification };
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

const otherState = selectionSample();
otherState.玩家.所属 = '武曲学园 / 一年一班';
delete otherState.场景.选拔赛;

export const samples = {
  selection: { label: '选拔进行中', description: '虚构 OC 与原作角色共用现有 MVU 选拔账本；资格尚待确认。', state: selectionSample() },
  qualified: { label: '完整账本 · 已出线', description: '虚构完整旧账本：288 人、20 轮基线、赛季结束且代表边界不同分；现有引擎确认完整。', state: completedSample() },
  tie: { label: '代表席位同分', description: '虚构完整旧账本：第六、第七名同分，保留待决。', state: completedSample(true) },
  other: { label: '他校自捏角色', description: '虚构他校 OC：读取同一角色档案，不套用破军选拔资格。', state: otherState },
  ikki: { label: '黑铁一辉模式', description: '虚构一辉模式：绑定现有一辉参赛 ID，名册不重复添加。', state: selectionSample(true) },
};
