// GENERATED: node scripts/build-state-controller.mjs --write
(function () {
"use strict";
// GBK 原文目录是唯一顺序来源；浏览器产物在构建时内联这些数据和函数。
const STORY_VOLUMES = [{"volume":1,"title":"第1卷","chapters":[{"key":"序章","title":"序章 早晨的相遇","aliases":[]},{"key":"第一章","title":"第一章 天才骑士与落第骑士","aliases":[]},{"key":"第二章","title":"第二章 来自旧巢的访客","aliases":[]},{"key":"第三章","title":"第三章 解放军（Rebellion）","aliases":[]},{"key":"第四章","title":"第四章 初战","aliases":[]},{"key":"终章","title":"终章 月下誓言","aliases":[]}]},{"volume":2,"title":"第2卷","chapters":[{"key":"序章","title":"序章 遥远的记忆","aliases":[]},{"key":"第一章","title":"第一章 拜入师门","aliases":[]},{"key":"第二章","title":"第二章 逢魔时刻","aliases":[]},{"key":"第三章","title":"第三章 绫辻绚濑","aliases":[]},{"key":"第四章","title":"第四章 决战！〈落第骑士（Worst one）〉VS〈剑士杀手（Sword Eater）〉","aliases":[]},{"key":"终章","title":"终章 寒冰微笑","aliases":[]}]},{"volume":3,"title":"第3卷","chapters":[{"key":"序章","title":"序章 珠雫的挑战","aliases":[]},{"key":"第一章","title":"第一章〈深海魔女（Lorelei）〉VS〈雷切〉","aliases":[]},{"key":"第二章","title":"第二章 奥多摩的怪物","aliases":[]},{"key":"第三章","title":"第三章 身陷逆境的〈落第骑士（Worst one）〉","aliases":[]},{"key":"第四章","title":"第四章 一刀两断","aliases":[]},{"key":"终章","title":"终章 无冕剑王（Another one）","aliases":[]}]},{"volume":4,"title":"第4卷","chapters":[{"key":"序章","title":"序章 雪国的街道","aliases":[]},{"key":"第一章","title":"第一章 强化集训","aliases":[]},{"key":"第二章","title":"第二章 阴谋蠢动","aliases":[]},{"key":"第三章","title":"第三章 晓，进军","aliases":[]},{"key":"第四章","title":"第四章 过早的决战","aliases":[]},{"key":"终章","title":"终章 幕后黑手（fixer）","aliases":[]}]},{"volume":5,"title":"第5卷","chapters":[{"key":"序章","title":"序章 祭典的乐声","aliases":[]},{"key":"第一章","title":"第一章 全国的劲敌们","aliases":[]},{"key":"第二章","title":"第二章 浪速之星","aliases":[]},{"key":"第三章","title":"第三章 七星剑武祭·开幕","aliases":[]},{"key":"第四章","title":"第四章 决战·〈无冕剑王〉VS〈七星剑王〉","aliases":[]},{"key":"终章","title":"终章 好戏登场","aliases":[]}]},{"volume":6,"title":"第6卷","chapters":[{"key":"间章1","title":"间章 反射术士","aliases":["间章"]},{"key":"第五章","title":"第五章 快刀斩乱麻","aliases":[]},{"key":"第六章","title":"第六章 初战终了","aliases":[]},{"key":"第七章","title":"第七章 七星剑武祭第二轮战·开战","aliases":[]},{"key":"间章2","title":"间章 转暗","aliases":[]}]},{"volume":7,"title":"第7卷","chapters":[{"key":"间章1","title":"间章 毫无余韵的胜利","aliases":["间章"]},{"key":"第八章","title":"第八章 喧闹不休的医务室","aliases":[]},{"key":"第九章","title":"第九章 战士们略微喧嚣的中场休息","aliases":[]},{"key":"第十章","title":"第十章 七星剑舞祭第三轮战·开战","aliases":[]},{"key":"间章2","title":"间章 鲜血的结局","aliases":[]}]},{"volume":8,"title":"第8卷","chapters":[{"key":"间章1","title":"间章 为了让自己不再后悔","aliases":["间章"]},{"key":"第十一章","title":"第十一章 鲜血的真相","aliases":[]},{"key":"第十二章","title":"第十二章 双龙相克","aliases":[]},{"key":"第十三章","title":"第十三章 阴云密布的准决赛","aliases":[]},{"key":"间章2","title":"间章 姗姗来迟","aliases":[]}]},{"volume":9,"title":"第9卷","chapters":[{"key":"第十四章","title":"第十四章 战魂高昂","aliases":[]},{"key":"终章（前）","title":"终章（前） 约定之刻","aliases":[]},{"key":"终章（后）","title":"终章（后） 并立之人","aliases":[]}]},{"volume":10,"title":"第10卷","chapters":[{"key":"序章","title":"来自地狱的蜘蛛","aliases":[]},{"key":"第一章","title":"庆典结束之后","aliases":[]},{"key":"第二章","title":"〈深海魔女〉与〈白衣骑士〉","aliases":[]},{"key":"第三章","title":"法米利昂皇国","aliases":[]},{"key":"第四章","title":"惨剧开幕","aliases":[]}]},{"volume":11,"title":"第11卷","chapters":[{"key":"第五章","title":"〈落第骑士（Worst One）〉VS〈红莲狂狮〉！？","aliases":[]},{"key":"第六章","title":"杀戮之夜","aliases":[]},{"key":"第七章","title":"访问奎多兰","aliases":[]},{"key":"第八章","title":"名为「法米利昂」的国家","aliases":[]},{"key":"第九章","title":"卡尔迪亚城镇战","aliases":[]}]},{"volume":12,"title":"第12卷","chapters":[{"key":"间章","title":"第一皇女的决心","aliases":[]},{"key":"第十章","title":"皇族的职责","aliases":[]},{"key":"第十一章","title":"洁白之巅","aliases":[]},{"key":"第十二章","title":"严寒的考验","aliases":[]},{"key":"第十三章","title":"来自〈神龙寺〉的刺客","aliases":[]},{"key":"第十四章","title":"法米利昂之剑","aliases":[]}]},{"volume":13,"title":"第13卷","chapters":[{"key":"间章1","title":"凶信","aliases":["间章"]},{"key":"第十五章","title":"月下乱斗","aliases":[]},{"key":"第十六章","title":"王都开战","aliases":[]},{"key":"第十七章","title":"不转杀手","aliases":[]},{"key":"第十八章","title":"狂飙突进","aliases":[]},{"key":"间章2","title":"迟来的魔女","aliases":[]}]},{"volume":14,"title":"第14卷","chapters":[{"key":"间章","title":"泪雨","aliases":[]},{"key":"第十九章","title":"魔人对决","aliases":[]},{"key":"第二十章","title":"难舍的情谊","aliases":[]},{"key":"第二十一章","title":"天理难容的心愿","aliases":[]}]},{"volume":15,"title":"第15卷","chapters":[{"key":"间章","title":"遗言","aliases":[]},{"key":"第二十二章","title":"剑神","aliases":[]},{"key":"第二十三章","title":"法米利昂的怒火","aliases":[]},{"key":"第二十四章","title":"遗骸洒泪","aliases":[]},{"key":"第二十五章","title":"胜负已分，在那之后……","aliases":[]},{"key":"终章","title":"正义从天而降","aliases":[]}]},{"volume":16,"title":"第16卷","chapters":[{"key":"终章Ⅱ","title":"思乡","aliases":[]},{"key":"序章","title":"深渊熅火","aliases":[]},{"key":"第一章","title":"众劲敌的此刻","aliases":[]},{"key":"第二章","title":"〈剑士杀手〉VS〈浪速之星〉","aliases":[]},{"key":"第三章","title":"〈大炎〉","aliases":[]}]},{"volume":17,"title":"第17卷","chapters":[{"key":"间章","title":"波纹逐渐扩散","aliases":[]},{"key":"第四章","title":"恩宠的力量","aliases":[]},{"key":"第五章","title":"命运锁链","aliases":[]},{"key":"第六章","title":"两场大战·首都保卫战","aliases":[]},{"key":"第七章","title":"两场大战·〈大炎〉讨伐战","aliases":[]},{"key":"尾声","title":"急转直下","aliases":[]}]},{"volume":18,"title":"第18卷","chapters":[{"key":"序章","title":"所谓正义，所谓邪恶","aliases":[]},{"key":"第一章","title":"〈烈风剑帝〉VS〈超人(Thehero)〉","aliases":[]},{"key":"第二章","title":"屠尽三千世界之鸦","aliases":[]},{"key":"第三章","title":"圣母史黛菈","aliases":[]}]},{"volume":19,"title":"第19卷","chapters":[{"key":"间章","title":"遭囚的皇女","aliases":[]},{"key":"第四章","title":"划破黑暗","aliases":[]},{"key":"第五章","title":"〈大教授〉","aliases":[]},{"key":"第六章","title":"最爱，也是最强的劲敌","aliases":[]},{"key":"终章","title":"背负憧憬的意义","aliases":[]}]}];
function getStoryVolume(volume) {
  return Number.isInteger(volume) ? STORY_VOLUMES.find(item => item.volume === volume) || null : null;
}
function resolveStoryChapter(volume, key) {
  if (typeof key !== 'string' || !key.trim()) return null;
  const chapters = getStoryVolume(volume)?.chapters || [];
  const value = key.trim();
  return chapters.find(chapter => chapter.key === value) ||
    chapters.find(chapter => (chapter.aliases || []).includes(value)) || null;
}
function firstStoryChapter(volume) {
  return getStoryVolume(volume)?.chapters[0] || null;
}
function storyPosition(volume, key) {
  const chapter = resolveStoryChapter(volume, key);
  if (!chapter) return -1;
  let offset = 0;
  for (const book of STORY_VOLUMES) {
    if (book.volume === volume) return offset + book.chapters.indexOf(chapter);
    offset += book.chapters.length;
  }
  return -1;
}
function nextStoryChapter(volume, key) {
  const current = resolveStoryChapter(volume, key), book = getStoryVolume(volume);
  if (!current || !book) return null;
  const next = book.chapters[book.chapters.indexOf(current) + 1];
  if (next) return { volume, chapter: next.key };
  const following = STORY_VOLUMES[STORY_VOLUMES.indexOf(book) + 1];
  return following ? { volume: following.volume, chapter: following.chapters[0].key } : null;
}

// 本卡 stat_data v4。纯 schema 工厂；不访问聊天、不自动迁移旧楼层。
// CHAPTERS 仅为旧 v3 第一卷验证与开局兼容枚举；运行中卷章以共享目录为准。
const CHAPTERS = ['待选择', '序章', '第一章', '第二章', '第三章', '第四章', '终章'];
const GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E', 'F+', 'F'];
// A+、S 只扩展实际六维的成长尺度，联盟登记与开局综合初评仍使用原量表。
const ATTRIBUTE_GRADES = ['S', 'A+', ...GRADES];
const GROWTH_AXES = ['魔力控制', '体能', '魔力量'];
const AXES = ['攻击力', '防御力', '魔力量', '魔力控制', '体能', '运气'];
// 只转换含义明确的卷号写法，保存结果仍为数字；未知文本留给严格校验拒绝。
function normalizeStoryVolume(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  const numeric = text.match(/^(?:([1-9]|1[0-9])|第([1-9]|1[0-9])卷)$/);
  if (numeric) return Number(numeric[1] || numeric[2]);
  const names = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九'];
  const index = names.findIndex(name => text === '第' + name + '卷');
  return index < 0 ? value : index + 1;
}
// 描述兼容只补结构，不从说明文字推断掌握程度；有旧条目时保留已知资料。
function normalizeSkillEntry(value, previous) {
  if (typeof value === 'string') value = { 说明: value };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const next = { ...value };
  const old = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
  for (const field of ['说明', '条件与代价']) {
    const missing = next[field] === undefined;
    const blank = typeof next[field] === 'string' && !next[field].trim();
    if (missing || blank) {
      if (typeof old[field] === 'string' && old[field].trim()) next[field] = old[field];
      else if (missing) next[field] = '';
    }
  }
  const known = ['学习中', '已掌握'].includes(old.掌握状态);
  if (next.掌握状态 === undefined || (next.掌握状态 === '待确认' && known)) {
    next.掌握状态 = known ? old.掌握状态 : '待确认';
  }
  return next;
}
// 本卡成长尺度，不是原作公布的经验公式。
const GROWTH_RULES = {
  version: 'G03', costs: { F: 100, 'F+': 100, E: 150, 'E+': 150, D: 250, 'D+': 250, C: 400, 'C+': 400, B: 600, 'B+': 900, A: 1200, 'A+': 1600 },
  perReplyCap: 9999,
  // 类型说明成果性质；经验按本轮实际成长核定，不再用类型压低单次奖励。
  awards: { 基础训练: { min: 1, max: 9999 }, 纠正训练: { min: 1, max: 9999 }, 重大突破: { min: 1, max: 9999 } },
};
// 本卡关系计分配置；并非《火焰纹章》任一作品的官方公式。终端构建读取同一份配置。
const RELATIONSHIP_SCORING = {
  version: 'R10-按回复分项结算',
  affection: {
    min: 0, max: 1000, initial: 0,
    ordinaryMin: 2, ordinaryMax: 10, mediumMin: 11, mediumMax: 20, majorMin: 21, majorMax: 40,
    decrease: { ordinaryMin: 1, ordinaryMax: 5, mediumMin: 6, mediumMax: 10, majorMin: 11, majorMax: 20 },
    backgroundMin: 70, backgroundMax: 200,
  },
  support: {
    min: 0, max: 320, initial: 0, ordinaryMin: 1, ordinaryMax: 5, mediumMin: 6, mediumMax: 10, majorMin: 10, majorMax: 15,
    stages: [{ stage: 'C', min: 80 }, { stage: 'B', min: 160 }, { stage: 'A', min: 240 }, { stage: 'S', min: 320 }],
  },
  romance: {
    stages: [{ stage: '路人', min: 0 }, { stage: '在意', min: 200 }, { stage: '暧昧', min: 500 }, { stage: '交往', min: 800 }, { stage: '生死相随', min: 1000 }],
  },
};
function supportStage(value) {
  const config = RELATIONSHIP_SCORING.support;
  if (!Number.isInteger(value) || value < config.min || value > config.max) return '未定';
  let stage = '未建立';
  for (const threshold of config.stages) if (value >= threshold.min) stage = threshold.stage;
  return stage;
}
function romanceStage(relation) {
  const value = relation?.好感, config = RELATIONSHIP_SCORING.affection;
  if (relation?.性别 !== '女性' || typeof value !== 'number' || !Number.isFinite(value) || value < config.min || value > config.max) return null;
  let stage = null;
  for (const threshold of RELATIONSHIP_SCORING.romance.stages) if (value >= threshold.min) stage = threshold.stage;
  return stage;
}

// 数值保护与叙事判断分开：代码核对字段、范围、来源和收据，不用关键词判断关系真假。
// 每人每字段在同一完整回复内合并结算一次；收据随楼层保存，换措辞不能再次领奖。
function enforceRelationshipScores(variables, previous, { replyKey = '', submittedFields = [], relationshipCorrection = false, flexibleRepair = false } = {}) {
  const before = previous?.stat_data?.人际 || {};
  const after = variables?.stat_data?.人际;
  const notices = [];
  if (!after || typeof after !== 'object' || Array.isArray(after)) return notices;
  const submitted = new Map(Array.isArray(submittedFields) ? submittedFields : []);
  const flexible = Boolean(replyKey && flexibleRepair);
  const oldReceipt = previous?.stat_data?.系统?.关系计分;
  // 新回复只有真正成功计分后才换收据，普通读档和失败解析不清理已成功记录。
  const receipt = replyKey && oldReceipt?.回合 === replyKey ? structuredClone(oldReceipt) : { 回合: replyKey, 人物: {} };
  function sent(name, field, value) { return submitted.get(JSON.stringify([name, field])) === value; }
  const cleanText = value => typeof value === 'string' ? value.trim() : '';
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const display = value => value === undefined ? '缺失' : value === null ? 'null' : JSON.stringify(value)?.slice(0, 80) ?? '无效';
  for (const [name, relation] of Object.entries(after)) {
    if (!relation || typeof relation !== 'object' || Array.isArray(relation)) continue;
    const old = before[name];
    const evidence = cleanText(relation.变化依据);
    const breakthrough = cleanText(relation.好感突破依据);
    const priorBreakthrough = cleanText(old?.好感突破依据);
    const evidenceSubmitted = sent(name, '变化依据', evidence) && Boolean(evidence);
    const breakthroughSubmitted = sent(name, '好感突破依据', breakthrough) && Boolean(breakthrough);
    const isInitialAffection = !old || old.好感 === null;
    let attemptedScores = 0, acceptedScores = 0, acceptedBreakthrough = false;
    function reject(field, explanation) {
      if (old) {
        // 缺失不等于null；拒绝一次错误写入不能把旧缺失值变成可从0重开的账。
        if (Object.hasOwn(old, field)) relation[field] = old[field];
        else delete relation[field];
      } else if (field === '好感') relation[field] = null;
      // 新人物的支援起点明确为0；失败后保留空账，让同回复只补交失败项。
      else if (field === '支援度') relation[field] = RELATIONSHIP_SCORING.support.initial;
      else delete relation[field];
      notices.push({ path: '/人际/' + name + '/' + field, message: explanation });
    }
    if (!flexible && ['男性', '女性'].includes(old?.性别) && relation.性别 !== old.性别) {
      reject('性别', '模型不能改写已确认性别来改变路线；明确纠错请由玩家使用变量编辑器。');
    }
    for (const [field, config] of [['好感', RELATIONSHIP_SCORING.affection], ['支援度', RELATIONSHIP_SCORING.support]]) {
      const value = relation[field], prior = old?.[field];
      if (value === prior || (value == null && prior == null)) continue;
      // 登记0不属于奖励；不要求为新建空账伪造互动，旧的缺失支援仍不能擅自补0。
      if (field === '支援度' && !old && value === config.initial) continue;
      if (field === '好感' && isInitialAffection && value === config.initial) continue;
      attemptedScores++;
      // 明确清回待核定也是一次终值校正，留下同回复收据，普通主解析不能把清空当成重新领奖。
      if (flexible && value === null && sent(name, field, value)) {
        receipt.人物[name] ??= {};
        const done = receipt.人物[name][field];
        receipt.人物[name][field] = { 旧值: done ? done.旧值 : finite(prior) ? prior : null, 新值: null };
        variables.stat_data.系统.关系计分 = structuredClone(receipt);
        acceptedScores++;
        continue;
      }
      const baseline = finite(prior) ? prior : (!old || field === '好感' && prior === null) ? config.initial : null;
      const delta = finite(value) && baseline !== null ? value - baseline : null;
      function rejectScore(reason) {
        const change = delta === null ? '差值无法计算' : (prior == null ? '按0起点，' : '') + '差值' + (delta >= 0 ? '+' : '') + delta;
        reject(field, '旧值' + display(prior) + ' → 提交' + display(value) + '（' + change + '）：' + reason + '；未修改原分数。');
      }
      if (!finite(value)) { rejectScore('分数必须是有限的JSON数字，不能由模型清空或写成文本'); continue; }
      if (!flexible && field === '支援度' && old && !finite(prior)) {
        rejectScore('旧支援起点尚未核定，不能用0或旧字母倒填，请在变量编辑器确认'); continue;
      }
      if (!flexible && field === '好感' && old && prior !== null && !finite(prior)) {
        rejectScore('旧好感字段缺失或无效，不属于旧null可从0累计的情况，请先核定'); continue;
      }
      if (value < config.min || value > config.max || field === '支援度' && !Number.isInteger(value)) {
        rejectScore(field + '必须在' + config.min + '—' + config.max + '之间' + (field === '支援度' ? '且为整数' : '')); continue;
      }
      if (!replyKey || !variables.stat_data?.系统) {
        rejectScore('无法确认补丁所属的真实助手回复，请使用当前回复原文重新解析'); continue;
      }
      // 手动副API可纠正已有数字；权限来自绑定来源的代码通道，不能靠模型写字段自称纠错。
      const correcting = (relationshipCorrection === true || flexible) && (flexible || finite(prior)) && sent(name, field, value);
      if (receipt.人物?.[name]?.[field] && !correcting) {
        const done = receipt.人物[name][field];
        rejectScore('本回复的' + field + '已成功结算' + display(done.旧值) + '→' + done.新值 + '，不能追加或重算；其他失败字段可单独重试'); continue;
      }
      if (!flexible && !evidenceSubmitted) {
        rejectScore('请在本次JSONPatch显式提交非空变化依据；允许与历史措辞相同，不能只沿用存档里的旧字段'); continue;
      }
      if (correcting) {
        // 替换的是核定后的最终值，不再发一份奖励；允许调低误记支援，仍受总范围约束。
        if (field === '好感') acceptedBreakthrough = breakthroughSubmitted;
      } else if (field === '支援度') {
        if (delta < 0 || delta > config.majorMax) {
          rejectScore('支援只增不减，本回复合计最多+' + config.majorMax + '，请提交合并后的最终值'); continue;
        }
      } else {
        const limits = delta < 0 ? config.decrease : config;
        // 首次背景资格由明确的本局说明承担，不要求出现“青梅竹马”等硬编码词。
        const initialBackground = isInitialAffection && value >= config.backgroundMin && value <= config.backgroundMax && breakthroughSubmitted;
        const major = Math.abs(delta) > limits.mediumMax;
        if (major && !breakthroughSubmitted) {
          rejectScore('超过本回复常规' + (delta < 0 ? '减' : '增') + limits.mediumMax + '，须显式提交本次好感突破依据；首次背景70—200同样需要该依据'); continue;
        }
        if (Math.abs(delta) > limits.majorMax && !initialBackground) {
          rejectScore('超过本回复最多' + (delta < 0 ? '减少' : '增加') + limits.majorMax + '；70—200背景核定仅适用于新人物或旧好感null，已有数字不能重置'); continue;
        }
        acceptedBreakthrough = major;
      }
      // 只记已成功字段；另一个字段失败后，可在同一回复沿用依据修正，不必换词。
      receipt.人物[name] ??= {};
      const done = receipt.人物[name][field];
      // 更正本回复收据的最终值，保留第一次结算前的旧值（包括null），普通解析不能再加一遍。
      receipt.人物[name][field] = { 旧值: done ? done.旧值 : finite(prior) ? prior : null, 新值: value };
      variables.stat_data.系统.关系计分 = structuredClone(receipt);
      acceptedScores++;
    }
    if (!flexible && !acceptedBreakthrough && breakthrough !== priorBreakthrough) {
      if (old && Object.hasOwn(old, '好感突破依据')) relation.好感突破依据 = old.好感突破依据;
      else delete relation.好感突破依据;
    }
    if (attemptedScores > 0 && acceptedScores === 0 && relation.变化依据 !== (old?.变化依据 ?? '')) {
      relation.变化依据 = old?.变化依据 ?? '';
      notices.push({ path: '/人际/' + name + '/变化依据', message: '本次未新增成功计分，保留上次依据；未成功字段可修正后重试，无需改写措辞。' });
    }
    // 副通道无需模型为已有终值重写剧情依据；空依据时只记录本次核定数字，满足存档结构。
    if (flexible && !cleanText(relation.变化依据) &&
        (acceptedScores > 0 || ['C', 'B', 'A', 'S'].includes(supportStage(relation.支援度)))) {
      relation.变化依据 = '本轮副校正：' + ['好感', '支援度'].filter(field => finite(relation[field]) || relation[field] === null)
        .map(field => field + ' ' + (relation[field] === null ? '待核定' : relation[field])).join('；') + '。';
    }
    if (flexible && relation.支援度 === null) relation.羁绊阶段 = '未定';
    else if (typeof relation.支援度 === 'number') relation.羁绊阶段 = supportStage(relation.支援度);
    else if (old && relation.羁绊阶段 !== old.羁绊阶段) {
      relation.羁绊阶段 = old.羁绊阶段;
      notices.push({ path: '/人际/' + name + '/羁绊阶段', message: '支援度尚未核定，保留旧阶段；模型不能直接提升字母。' });
    } else if (!old && !['未定', '未建立'].includes(relation.羁绊阶段)) {
      relation.羁绊阶段 = '未定';
      notices.push({ path: '/人际/' + name + '/羁绊阶段', message: '新关系不能凭空授予字母阶段，请从已确认支援值累计。' });
    }
    // 计分或性别恢复后重新派生，不能留下本次被拒分数对应的高阶段。
    const romance = romanceStage(relation);
    if (romance !== null) relation.恋爱阶段 = romance;
    else if (Object.hasOwn(relation, '恋爱阶段')) {
      delete relation.恋爱阶段;
      notices.push({ path: '/人际/' + name + '/恋爱阶段', message: '只有已确认女性且好感已计分的记录可以拥有恋爱阶段；当前记录不进入恋爱路线。' });
    }
  }
  return notices;
}
// 联系记录只维护互动状态和关系标签，不派生好感或作为计分前置条件。
// 普通首次的0起点与实际变化由计分器处理，既定背景仍独立核定。
function enforceRelationshipContact(variables, previous, { replyKey = '', flexibleRepair = false } = {}) {
  // 副校正允许修正误记的联系状态；普通主回复仍保留已确认联系。
  if (replyKey && flexibleRepair) return [];
  const state = variables?.stat_data;
  const before = previous?.stat_data?.人际 || {};
  if (state?.系统?.结构版本 !== 4 || !state.人际 || typeof state.人际 !== 'object' || Array.isArray(state.人际)) return [];
  const changed = [];
  const text = value => typeof value === 'string' ? value.trim() : '';
  const initialLabel = value => ['', '初见', '尚未交谈', '初见／尚未交谈'].includes(text(value).replace(/\s+/g, '').replace(/\//g, '／'));
  for (const [name, relation] of Object.entries(state.人际)) {
    if (!relation || typeof relation !== 'object' || Array.isArray(relation)) continue;
    if ((state.系统.已删除人物 || []).includes(name)) continue;
    const old = Object.hasOwn(before, name) ? before[name] : undefined;
    function set(field, value) {
      if (relation[field] === value) return;
      relation[field] = value;
      changed.push('/人际/' + name + '/' + field);
    }
    // 当前分支内已确认的联系不会因离场、漏字段或重写最简对象退回“仅识别”。
    if (old?.联系状态 === '已建立联系' && text(old.联系依据)) {
      set('联系状态', '已建立联系');
      if (!text(relation.联系依据)) set('联系依据', old.联系依据);
    }
    if (relation.联系状态 !== '已建立联系' || !text(relation.联系依据)) continue;
    if (initialLabel(relation.关系)) {
      set('关系', old && !initialLabel(old.关系) ? old.关系 : '已建立直接联系');
    }
  }
  return changed;
}
const INITIAL_STATE = {
  系统: { 结构版本: 4, 开局状态: '待建档', 主角模式: '未选择' },
  场景: { 当前卷: 1, 当前章: '待选择', 阶段: '未开始', 时间: '', 地点: '', 切入说明: '', 已发生事件: {} },
  玩家: {
    性别: '男性',
    魔人觉醒: false,
    姓名: '', 性格关键词: '', 处事风格: '', 所属: '', 固有灵装: '', 角色简介: '', 战斗风格: '',
    伐刀能力: { 能力系别: '', 能力本质: '', 共通限制: '', 招式: {} },
    其他能力: {},
    六维: Object.fromEntries(AXES.map(key => [key, ''])),
    综合初评: { 规则版本: 'R05-第一版', 分数: null, 等级: null, 拟定登记等级: null, 评定状态: '待填写六维', 待填写项: AXES.slice(0, 4) },
    登记等级: null,
  },
  人际: {},
};

function createSchema(z, options = {}) {
  return createStateSchema(z, 4, options);
}

function createLegacyV3Schema(z, options = {}) {
  return createStateSchema(z, 3, options);
}

function createStateSchema(z, version, { normalizeRelationships = true } = {}) {
  const text = z.string();
  // 动态记录允许有名条目；固定对象全部 strict，禁止拼错路径后另造字段。
  const key = z.string().min(1).refine(value => !/[~/]/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value), '名称不能包含 /、~ 或保留键');
  const record = value => z.record(key, value);
  // 字段级转换也覆盖框架逐字段、逐条事件应用 JSONPatch 的校验入口。
  const volumeNumber = z.preprocess(normalizeStoryVolume, z.number().int().min(1).max(19));
  // G01 只用于读取旧档；旧分钟申请不自动折算，G02 的六字段成果申请继续兼容。
  const legacyGrowthRequest = z.object({
    来源事件: key, 日期: text, 目标: z.enum(['魔力控制', '体能']), 类型: z.enum(['基础训练', '纠正训练', '危机突破']),
    环境: text, 现实分钟: z.number().int().min(1).max(1440), 有效分钟: z.number().int().min(1).max(1440000),
    成果: text, 已确认: z.boolean(), 已恢复: z.boolean(),
  }).strict();
  const growthRequest = z.object({
    来源事件: key, 目标: z.enum(GROWTH_AXES), 类型: z.enum(['基础训练', '纠正训练', '重大突破']),
    // 超额值交给结算器截断，避免一个数值超额让整条实际事件保存失败。
    经验: z.number().int().min(0), 方式: z.enum(['实际练习', '意识模拟']), 成果: text.min(1),
  }).strict();
  const growth = z.object({
    版本: z.enum(['G01', 'G02', 'G03']).optional(),
    // 经验允许保留晋级后的溢出，不能拿最高单档门槛当累计上限；旧档经验原样读取。
    经验: z.object({ 魔力控制: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), 体能: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), 魔力量: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional() }).strict().optional(),
    申请: record(z.union([growthRequest, legacyGrowthRequest])).optional(),
    记录: record(z.object({
      来源事件: key, 日期: text.optional(), 目标: z.enum(GROWTH_AXES), 类型: z.enum(['基础训练', '纠正训练', '危机突破', '重大突破']),
      环境: text.optional(), 现实分钟: z.number().int().min(0).max(1440).optional(), 有效分钟: z.number().int().min(0).max(1440000).optional(),
      加速: z.boolean().optional(), 获得: z.number().int().min(0).max(Math.max(70, GROWTH_RULES.perReplyCap)), 活动指纹: text, 说明: text,
      方式: z.enum(['实际练习', '意识模拟']).optional(), 成果: text.optional(), 回合: text.optional(),
    }).strict()).optional(),
    回合结算: z.object({
      标识: text,
      获得: z.object({ 魔力控制: z.number().int().min(0).max(GROWTH_RULES.perReplyCap), 体能: z.number().int().min(0).max(GROWTH_RULES.perReplyCap), 魔力量: z.number().int().min(0).max(GROWTH_RULES.perReplyCap).optional() }).strict(),
      已晋级: z.array(z.enum(GROWTH_AXES)).max(GROWTH_AXES.length),
    }).strict().optional(),
    // 旧境界、环境与复核记录仅保留历史；绝不用于推断 /玩家/魔人觉醒。
    境界: z.enum(['未确认', '普通', '魔人']).optional(), 境界依据: text.optional(),
    训练环境: record(z.object({
      能力路径: text, 模式: z.enum(['意识模拟', '真实时间加速']), 倍率: z.number().min(1).max(1000),
      魔力参与: z.boolean(), 肉身参与: z.boolean(), 依据: text,
    }).strict()).optional(),
    复核记录: z.array(text).max(30).optional(), 最近提示: text.optional(), 结算起点: text.optional(),
  }).strict();
  const skillObject = z.object({ 说明: text, 条件与代价: text, 掌握状态: z.enum(['待确认', '学习中', '已掌握']) }).strict();
  const skill = version === 4 ? z.preprocess(value => normalizeSkillEntry(value), skillObject) : skillObject;
  const knownProfile = z.object({ 身份: text.optional(), 登记等级: text.optional(), 灵装: text.optional(), 已知能力: text.optional() }).strict();
  const scheduleDate = text.refine(value => {
    if (value === '') return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }, '日程日期使用真实的 YYYY-MM-DD；尚未确定时留空');
  const schedule = z.object({
    类型: z.enum(['比赛', '训练', '约定', '其他']), 日期: scheduleDate,
    时间: text, 地点: text, 参与者: z.array(text.min(1)),
    状态: z.enum(['待定', '已安排', '进行中', '已完成', '已取消']), 说明: text,
  }).strict();
  // 代码专属的当前回复收据：可选以兼容旧档，不要求模型提交，也不发给模型。
  // 旧值保留纠错前的真实数字，允许记录曾经越界的坏账；修正后的新值仍须合法。
  const scoreReceipt = z.object({ 旧值: z.number().nullable(), 新值: z.number().min(0).max(1000).nullable() }).strict();
  const relationshipReceipt = z.object({
    回合: text.min(1), 人物: record(z.object({ 好感: scoreReceipt.optional(), 支援度: scoreReceipt.optional() }).strict()),
  }).strict();
  const root = z.object({
    // MVU 更新过程临时注入的框架元数据；保留原值，不作为本卡业务结构校验。
    $internal: z.unknown().optional(),
    系统: z.object({
      结构版本: z.literal(version), 开局状态: z.enum(['待建档', '已建档']), 主角模式: z.enum(['未选择', '黑铁一辉', '自定义角色']),
      // 随当前楼层和活动 swipe 保存；回退读取旧快照，不使用聊天级或本地存储黑名单。
      ...(version === 4 ? { 已删除人物: z.array(key).optional(), 关系计分: relationshipReceipt.optional() } : {}),
    }).strict(),
    场景: z.object({
      当前卷: version === 3 ? z.literal(1) : volumeNumber,
      当前章: version === 3 ? z.enum(CHAPTERS) : text.min(1),
      阶段: z.enum(['未开始', '进行中', '已结束']),
      时间: text, 地点: text, 切入说明: text.default(''),
      已发生事件: record(z.object({ ...(version === 4 ? { 卷号: volumeNumber } : {}), 章段: version === 3 ? z.enum(CHAPTERS.slice(1)) : text.min(1), 结果: text.min(1), 参与者: z.array(text.min(1)), 知情者: z.array(text.min(1)) }).strict()),
      // 可选字段兼容现有 v4 存档；未来约定不占用已发生事件。
      ...(version === 4 ? { 日程: record(schedule).optional() } : {}),
    }).strict(),
    玩家: z.object({
      性别: z.literal('男性').default('男性'),
      // 唯一觉醒开关；不接受字符串或 0/1。旧档未保存时按未觉醒读取，不推断旧境界。
      ...(version === 4 ? { 魔人觉醒: z.boolean().default(false) } : {}),
      姓名: text, 性格关键词: text, 处事风格: text, 所属: text, 固有灵装: text, 角色简介: text, 战斗风格: text,
      伐刀能力: z.object({ 能力系别: z.enum(['', '体能强化系', '自然干涉系', '概念干涉系', '因果干涉系']), 能力本质: text, 共通限制: text, 招式: record(skill) }).strict(),
      其他能力: record(skill),
      六维: z.object(Object.fromEntries(AXES.map(axis => [axis, z.enum(['', ...(version === 4 ? ATTRIBUTE_GRADES : GRADES)])]))).strict(),
      综合初评: z.object({
        规则版本: text, 分数: z.number().min(1).max(6).nullable(), 等级: z.enum(GRADES).nullable(), 拟定登记等级: z.enum(GRADES).nullable(),
        评定状态: z.enum(['待填写六维', '已计算', '原作档案']), 待填写项: z.array(z.enum(AXES.slice(0, 4))),
      }).strict(),
      登记等级: z.enum(GRADES).nullable(),
      ...(version === 4 ? { 成长: growth.optional() } : {}),
    }).strict(),
    人际: record(z.object({ 关系: text, 态度印象: text, 性别: z.enum(['未知', '男性', '女性']).optional(), 已加联系方式: z.boolean().optional(), ...(version === 4 ? { 名册隐藏: z.boolean().optional(), 联系状态: z.enum(['仅识别', '已建立联系']).optional(), 联系依据: text.optional() } : {}), 好感: z.number().min(RELATIONSHIP_SCORING.affection.min).max(RELATIONSHIP_SCORING.affection.max).nullable(), 支援度: z.number().int().min(RELATIONSHIP_SCORING.support.min).max(RELATIONSHIP_SCORING.support.max).nullable().optional(), 羁绊阶段: z.enum(['未定', '未建立', 'C', 'B', 'A', 'S']), 恋爱阶段: z.enum(RELATIONSHIP_SCORING.romance.stages.map(item => item.stage)).optional(), 好感突破依据: text.optional(), 变化依据: text, 已知资料: knownProfile.optional() }).strict()),
  }).strict().superRefine((state, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path, message });
    if (state.系统.开局状态 === '已建档' && (state.系统.主角模式 === '未选择' || !state.玩家.姓名.trim())) issue(['系统', '开局状态'], '已建档需要已选身份和非空姓名');
    if (state.场景.阶段 !== '未开始' && state.系统.开局状态 !== '已建档') issue(['场景', '阶段'], '先完成建档，再开始剧情');
    if (state.场景.当前章 === '待选择' && state.场景.阶段 !== '未开始') issue(['场景', '阶段'], '未选择章段时不能开始或结束剧情');
    const scene = state.场景;
    const chapter = version === 3 ? CHAPTERS.indexOf(scene.当前章) : storyPosition(scene.当前卷, scene.当前章);
    if (version === 4 && !getStoryVolume(scene.当前卷)) issue(['场景', '当前卷'], '卷号不在已核对的剧情目录中');
    if (version === 4 && scene.当前章 !== '待选择' && chapter < 0) issue(['场景', '当前章'], '当前卷与章节不是已核对的目录组合');
    for (const [name, event] of Object.entries(state.场景.已发生事件)) {
      const eventPosition = version === 3 ? CHAPTERS.indexOf(event.章段) : storyPosition(event.卷号, event.章段);
      if (version === 4 && eventPosition < 0) issue(['场景', '已发生事件', name, '章段'], '事件卷号与章段不是已核对的目录组合');
      else if (eventPosition > chapter) issue(['场景', '已发生事件', name, '章段'], '不能把后续卷章事件写成已发生');
    }
    if (state.系统.主角模式 === '黑铁一辉' && Object.hasOwn(state.人际, '黑铁一辉')) issue(['人际', '黑铁一辉'], '一辉模式不能新建另一个一辉的人际记录');
    for (const [name, relation] of Object.entries(state.人际)) {
      if (['C', 'B', 'A', 'S'].includes(relation.羁绊阶段) && !relation.变化依据.trim()) issue(['人际', name, '变化依据'], '已成立羁绊必须有本局依据');
      if (relation.恋爱阶段 !== undefined && romanceStage(relation) === null) issue(['人际', name, '恋爱阶段'], '只有已确认女性且好感为有效数值时才能派生恋爱阶段；男性、性别未知或好感待核定时不能预写。');
    }
  });
  // 上游桥接器对直接传入的 ZodObject 会改用 looseObject。
  // preprocess 保留本卡固定字段的 strict 校验；在 record 可能忽略保留键前明确拒绝。
  return z.preprocess((value, ctx) => {
    function inspect(node, path = []) {
      if (!node || typeof node !== 'object') return;
      for (const name of Object.keys(node)) {
        if (path.length === 0 && name === '$internal') continue;
        if (['__proto__', 'prototype', 'constructor'].includes(name)) ctx.addIssue({ code: 'custom', path: [...path, name], message: '不接受保留键，未丢弃原始数据' });
        else inspect(node[name], [...path, name]);
      }
    }
    inspect(value);
    // 只接收目录声明的精确别名，并在校验结果中归一成稳定章节键。
    if (version === 4 && value?.场景 && typeof value.场景 === 'object' && !Array.isArray(value.场景)) {
      const scene = { ...value.场景, 当前卷: normalizeStoryVolume(value.场景.当前卷) };
      const chapter = resolveStoryChapter(scene.当前卷, scene.当前章);
      const events = scene.已发生事件;
      value = { ...value, 场景: { ...scene,
        ...(chapter ? { 当前章: chapter.key } : {}),
        ...(events && typeof events === 'object' && !Array.isArray(events) ? { 已发生事件: Object.fromEntries(Object.entries(events).map(([name, event]) => {
          if (event && typeof event === 'object' && !Array.isArray(event)) event = { ...event, 卷号: normalizeStoryVolume(event.卷号) };
          const resolved = resolveStoryChapter(event?.卷号, event?.章段);
          return [name, resolved ? { ...event, 章段: resolved.key } : event];
        })) } : {}),
      } };
    }
    // 数值已经存在才派生阶段。旧记录缺支援度或为 null 时完全保留，绝不凭字母倒填分。
    // 只复制待归一化对象，schema.parse 不修改调用方或框架 $internal 快照。
    if (!normalizeRelationships || !value?.人际 || typeof value.人际 !== 'object' || Array.isArray(value.人际)) return value;
    const relations = Object.fromEntries(Object.entries(value.人际).map(([name, relation]) => {
      const stage = supportStage(relation?.支援度);
      const romance = romanceStage(relation);
      return [name, stage !== '未定' || romance !== null ? { ...relation, ...(stage !== '未定' ? { 羁绊阶段: stage } : {}), ...(romance !== null ? { 恋爱阶段: romance } : {}) } : relation];
    }));
    return { ...value, 人际: relations };
  }, root);
}

// 离线 v2 迁移：拒绝未识别数据，不覆盖聊天，不凭招式名猜测多招式分隔。
function migrateV2(input, z) {
  const schema = createLegacyV3Schema(z, { normalizeRelationships: false });
  if ([3, 4].includes(input?.系统?.结构版本)) return migrateV3(input, z);
  if (input?.系统?.结构版本 !== 2) throw new Error('仅支持中文结构 v2 / v3 → v4；英文或未知版本须先核对原始数据');
  const next = structuredClone(input);
  next.系统.结构版本 = 3;
  next.场景 = { 当前章: '待选择', 阶段: '未开始', 已发生事件: {}, ...next.场景 };
  const p = next.玩家;
  p.伐刀能力 = { 能力系别: p.能力系别 ?? '', 能力本质: p.能力机制 ?? '', 共通限制: p.限制与代价 ?? '', 招式: {} };
  if (p.伐刀绝技?.trim()) p.伐刀能力.招式[p.伐刀绝技.trim()] = { 说明: '', 条件与代价: '', 掌握状态: '待确认' };
  p.其他能力 = {};
  for (const field of ['伐刀绝技', '能力系别', '能力机制', '限制与代价']) delete p[field];
  next.人际 ??= {};
  for (const relation of Object.values(next.人际)) {
    const old = relation.羁绊阶段;
    if (!['未定', '未建立', 'C', 'B', 'A', 'S'].includes(old)) {
      relation.羁绊阶段 = '未定';
      relation.变化依据 = `旧存档阶段：${old ?? '未记录'}。尚未确认 C/B/A/S 对应，保留原描述待核对。`;
    } else relation.变化依据 ??= '';
    relation.好感 ??= null;
  }
  return migrateV3(schema.parse(next), z);
}

function migrateV3(input, z) {
  const targetSchema = createSchema(z, { normalizeRelationships: false });
  if (input?.系统?.结构版本 === 4) {
    targetSchema.parse(input);
    return structuredClone(input);
  }
  if (input?.系统?.结构版本 !== 3) throw new Error('在线迁移仅接受合法的第一卷 v3 档案；v2 或未知结构请先离线核对');
  // 兼容已写入觉醒开关、结构版本尚为 v3 的旧档；只识别原生布尔值，不猜测或转换。
  // 仅从校验副本暂去这一已知 v4 字段，原档与迁移候选都保留它；其余旧结构仍严格验证。
  const legacyInput = structuredClone(input);
  if (legacyInput.玩家 && Object.hasOwn(legacyInput.玩家, '魔人觉醒')) {
    if (typeof legacyInput.玩家.魔人觉醒 !== 'boolean') throw new Error('/玩家/魔人觉醒 必须是 true 或 false，旧档迁移不会转换其他值。');
    delete legacyInput.玩家.魔人觉醒;
  }
  // parse 仅用于校验；不采用其默认填充结果，也不重新派生人物字段。
  createLegacyV3Schema(z, { normalizeRelationships: false }).parse(legacyInput);
  const next = structuredClone(input);
  next.系统.结构版本 = 4;
  for (const event of Object.values(next.场景.已发生事件)) event.卷号 = 1;
  targetSchema.parse(next);
  return next;
}

function migrationChanges(before, after, path = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (object(before) && object(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => {
      const escaped = key.replace(/~/g, '~0').replace(/\//g, '~1');
      return migrationChanges(before[key], after[key], path + '/' + escaped);
    });
  }
  return [{ path: path || '/', before: structuredClone(before), after: structuredClone(after) }];
}

function prepareStateMigration(input, z) {
  const before = structuredClone(input);
  const state = migrateV3(before, z);
  return { status: before.系统.结构版本 === 3 ? 'migration-required' : 'current', before, state, changes: migrationChanges(before, state) };
}

// 状态规则与运行时适配分开：本模块不访问宿主、不发送消息、不生成剧情。
const STATE_CHAPTERS = ['待选择', ...getStoryVolume(1).chapters.map(chapter => chapter.key)];
const cloneState = value => structuredClone(value);
function stateKey(value) {
  if (Array.isArray(value)) return '[' + value.map(stateKey).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stateKey(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function applyOpening(before, payload) {
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
function assertOpeningReplacementState(state) {
  if (state?.系统?.结构版本 !== 4 || state.系统.开局状态 !== '已建档') throw new Error('只有已建档的开局可以替换人物，请先读取当前聊天。');
  if (state.场景?.当前卷 !== 1) throw new Error('剧情已进入其他卷，不能通过开局页替换人物。');
  if (Object.keys(state.场景.已发生事件 || {}).length) throw new Error('本局已经记录剧情事件，不能替换开局人物；请在新聊天使用该档案。');
}
function applyOpeningReplacement(before, payload) {
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

function applyTransition(before, request) {
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
function acceptAutomaticStoryProgress(before, after) {
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
function enforceStateOwnership(variables, previous, context = {}) {
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

function growthDateKey(value) {
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
function enforceGrowthProgress(variables, previous, { replyKey = '', repairEventKeys = [], flexibleRepair = false } = {}) {
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

function createStateController(adapter) {
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

// 构建时与 schema、纯状态规则一起内联；只在 Tavern Helper 上下文使用。
// 精确接口依据及尚未完成的实机验收见 世界书规则/MVU/v4_使用与迁移.md。
(function installRakudaiController() {
  const W = window;
  function host() {
    // Helper 给每个 iframe 都提供 SillyTavern getter，不能据此把自己当成宿主。
    // 每次访问单独捕获跨源异常，优先实际最外层同源酒馆窗口。
    for (const resolve of [() => W.top, () => W.parent, () => W]) {
      try { const candidate = resolve(); if (candidate?.SillyTavern?.getContext) return candidate; } catch (_) {}
    }
    throw new Error('未连接 SillyTavern，档案仅为草稿。');
  }
  function helper(name) {
    if (typeof W[name] === 'function') return W[name].bind(W);
    if (typeof W.TavernHelper?.[name] === 'function') return W.TavernHelper[name].bind(W.TavernHelper);
    throw new Error(`酒馆助手缺少 ${name}，尚未写入。`);
  }
  function runtime() {
    const H = host(), mvu = W.Mvu || H.Mvu;
    if (!mvu || typeof mvu.getMvuData !== 'function') throw new Error('MVU 尚未就绪，请启用变量框架后重试。');
    const version = helper('getTavernHelperVersion')();
    const parts = String(version).match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!parts || Number(parts[1]) < 4 || (Number(parts[1]) === 4 && (Number(parts[2]) < 8 || (Number(parts[2]) === 8 && Number(parts[3]) < 19)))) throw new Error('本建档器需要酒馆助手 4.8.19 或以上的同步变量接口。');
    const Z = W.z || H.z;
    if (!Z?.preprocess || !Z?.toJSONSchema) throw new Error('未找到酒馆助手提供的 Zod 4，尚未写入。');
    return { H, mvu, Z };
  }
  function sync(value, label) {
    if (value && typeof value.then === 'function') throw new Error(`${label} 在此版本不是同步接口，不能确认分支隔离。`);
    return value;
  }
  function position(messageId) {
    const { H, mvu } = runtime();
    const oldGuard = [W, H].some(scope => scope.__RK_MVU_GUARD_V3__) || (function () {
      try { return W.parent?.__RK_MVU_GUARD_V3__ || W.top?.__RK_MVU_GUARD_V3__; } catch (_) { return false; }
    })();
    if (oldGuard) throw new Error('旧版 v3 约束仍在运行，请先停用旧版约束，只启用 v4 后再读取或写入。');
    const guard = H.__RK_MVU_GUARD_V4__ || W.__RK_MVU_GUARD_V4__ || (function () {
      try { return W.parent?.__RK_MVU_GUARD_V4__; } catch (_) {}
    })() || (function () {
      try { return W.top?.__RK_MVU_GUARD_V4__; } catch (_) {}
    })();
    if (guard?.version !== '4.0.0') throw new Error('请先导入并启用“落第骑士·MVU v4 字段与卷章约束”脚本，并停用旧版约束。');
    // 旧v4也叫4.0.0，但不认识魔人觉醒；在建档前核对实际功能修订，不能只看显示名。
    if (guard.growth !== 'G03') throw new Error('当前运行的是旧v4约束，不支持玩家.魔人觉醒。请替换为标有G03/P02的v4约束并重载酒馆；保留现有true/false，不要重新初始化。');
    const ctx = H.SillyTavern.getContext();
    const chatId = ctx.chatId;
    if (chatId === null || chatId === undefined || chatId === '' || !Array.isArray(ctx.chat) || !ctx.chat.length) throw new Error('当前没有可建档的聊天。');
    const readMessages = helper('getChatMessages');
    const assistants = sync(readMessages(`0-${ctx.chat.length - 1}`, { role: 'assistant', include_swipes: true }), '读取楼层');
    const latest = assistants.at(-1);
    if (!latest) throw new Error('当前聊天没有助手楼层。');
    const id = messageId === undefined ? latest.message_id : messageId;
    if (!Number.isInteger(id) || id !== latest.message_id) throw new Error('该开局页已是历史楼层；请在当前分支最新助手楼层操作，不能覆盖旧状态。');
    const message = latest;
    if (!Number.isInteger(message.swipe_id) || message.swipe_id < 0 || !Array.isArray(message.swipes) || message.swipe_id >= message.swipes.length) throw new Error('未能识别当前 swipe，尚未写入。');
    const options = { type: 'message', message_id: id };
    const data = sync(mvu.getMvuData(options), '读取 MVU');
    if (!data?.stat_data) throw new Error('当前楼层没有 MVU 初始化数据，请先检查初始化通知。');
    return { H, mvu, ctx, chatId, characterId: ctx.characterId, groupId: ctx.groupId, chatRef: ctx.chat, messageId: id, messageRef: ctx.chat[id], swipeId: message.swipe_id,
      messageText: message.swipes?.[message.swipe_id], length: ctx.chat.length, data: cloneState(data), options };
  }
  function current(saved) {
    const now = position(saved.messageId);
    if (now.chatId !== saved.chatId || now.characterId !== saved.characterId || now.groupId !== saved.groupId ||
      now.chatRef !== saved.chatRef || now.messageRef !== saved.messageRef || now.length !== saved.length ||
      now.swipeId !== saved.swipeId || now.messageText !== saved.messageText) throw new Error('聊天、楼层或 swipe 已变化，请重新读取；草稿已保留。');
    return now;
  }
  function assertOpeningReplacement(saved) {
    const now = current(saved);
    // 只信实际宿主聊天：过滤后的助手列表无法证明中间没有用户消息。
    if (now.ctx.chat.length !== 1 || now.messageId !== 0) throw new Error('本局已经产生后续聊天，不能替换开局人物；请在新聊天使用该档案。');
    assertOpeningReplacementState(now.data.stat_data);
  }
  const api = createStateController({
    capture: async ({ messageId } = {}) => {
      // MVU 可能在本 iframe 创建后初始化；用本 iframe 的 Helper 安装动态 getter。
      // 等待仅放在读取入口，current/write 内的同步比较与更新不能插入 await。
      await helper('waitGlobalInitialized')('Mvu');
      return position(messageId);
    },
    current, assertOpeningReplacement,
    validate: value => {
      // 页面事务只验证，不借迁移或切章重算人际、补入人物默认字段。
      const parsed = createSchema(runtime().Z, { normalizeRelationships: false }).parse(value);
      const state = cloneState(value);
      // 仅规范已经存在的卷章别名，避免合法别名在终端目录中失配。
      state.场景.当前章 = parsed.场景.当前章;
      for (const name of Object.keys(state.场景.已发生事件)) state.场景.已发生事件[name].章段 = parsed.场景.已发生事件[name].章段;
      return state;
    },
    migrate: value => prepareStateMigration(value, runtime().Z),
    write: (saved, expected, state, { openingReplacement = false } = {}) => {
      if (openingReplacement) assertOpeningReplacement(saved);
      const now = current(saved);
      if (stateKey(now.data) !== stateKey(expected)) throw new Error('变量在提交前发生变化，请刷新。');
      // 使用宿主同步 updater：校验与赋值之间不 await，不退回 chat/global scope。
      const result = helper('updateVariablesWith')(variables => {
        current(saved);
        if (openingReplacement) assertOpeningReplacement(saved);
        if (stateKey(variables) !== stateKey(expected)) throw new Error('变量已经更新，未覆盖。');
        const next = cloneState(variables);
        next.stat_data = cloneState(state);
        return next;
      }, now.options);
      sync(result, '更新变量');
      return undefined;
    },
  });
  W.RakudaiStateController = api;
})();

})();
