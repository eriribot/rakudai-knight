import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Real view builders with an inert DOM; no network, game writes or generated art.
const source = fs.readFileSync(new URL('terminal-asterisk.js', import.meta.url), 'utf8');
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', scrollTop: 0, style: { setProperty() {} },
    querySelectorAll: () => [], querySelector: () => null, setAttribute() {}, removeAttribute() {},
    getAttribute: () => null, addEventListener() {}, focus() {}, close() {}, classList: { add() {}, remove() {} } });
  return nodes.get(id);
}
const realm = vm.createContext({ console, setTimeout, clearTimeout,
  document: { getElementById: node, documentElement: node('html'), querySelectorAll: () => [], addEventListener() {} },
  window: { addEventListener() {} }
});
vm.runInContext(source.replace(/  render\(\);\s*\}\)\(\);\s*$/, `
  globalThis.viewTest = { model, profileView, calendarView, communicationView, settingsView, runCorrectionAction, plotView, runPlotAction,
    setState(value) { state = value; }, setBridge(value) { bridge = value; },
    settings() { currentApp = 'settings'; return settingsView(); } };
})();`), realm);
const api = realm.viewTest;
const skill = { 说明: '招式效果', 条件与代价: '消耗与范围', 掌握状态: '学习中' };
const state = {
  系统: { 已删除人物: ['已删除'] },
  玩家: { 姓名: '<img src=x onerror=alert(1)>', 性别: '男性', 性格关键词: '冷静', 处事风格: '谨慎观察', 所属: '星导馆学园·转学生',
    角色简介: '本局简介', 战斗风格: '近身剑术', 其他能力: { '<script>技能</script>': skill }, 当前身体: '当前躯体', 当前能力边界: '能力界限', 本局映射: '原身份映射',
    学战: { 学园ID: 'jielong', 能力身份: '魔术师', 能力机制: '能力机制说明', 共通限制: '共通限制说明', 招式: { 回旋: skill },
      星辰力: { 说明: '星辰力说明真实值' }, 校内序列: { 状态: '已上榜', 名次: 12 }, 武装: { 类别: '研究装备', 名称: '武装名称', 使用条件: '使用限制' } } },
  场景: { 当前卷: null, 当前章: '六花阶段', 阶段: '进行中', 时间: '2013-04-09', 地点: '测试室', 切入说明: '自由开场',
    日程: { 测试: { 类型: '训练', 日期: '2013-04-10', 时间: '09:30', 地点: '训练室', 参与者: ['甲', '乙'], 状态: '已安排', 说明: '日程说明' } },
    已发生事件: { 见面: { 卷号: null, 章段: '入学时', 结果: '事件结果', 参与者: ['甲'], 知情者: ['乙'] } } },
  人际: {
    史黛菈: { 关系: '已相识', 好感: 10, 支援度: 5, 羁绊阶段: '未建立', 态度印象: '认真', 已加联系方式: false,
      已知资料: { 身份: '交换生', 所属: '破军学园', 灵装: '妃龙罪剑', 登记等级: 'A', 已知能力: '火焰' } },
    尤莉丝: { 关系: '同学', 已加联系方式: true, 已知资料: { 所属: '星导馆学园', 武装: '细剑', 校内序列: '第五名' } },
    已隐藏: { 名册隐藏: true }, 已删除: {},
  }
};
api.setState(state);
const profile = api.profileView();
for (const value of ['界龙第七学院', '始页十二人', '冷静', '谨慎观察', '星导馆学园·转学生', '本局简介', '近身剑术', '当前躯体', '能力界限', '原身份映射',
  '魔术师', '能力机制说明', '共通限制说明', '回旋', '招式效果', '消耗与范围', '学习中', '星辰力说明真实值', '研究装备', '武装名称', '使用限制',
  '史黛菈', '破军学园', '妃龙罪剑', '尤莉丝', '细剑', '第五名']) assert.ok(profile.includes(value), 'Missing real field: ' + value);
assert.ok(profile.includes('&lt;img src=x onerror=alert(1)&gt;'));
assert.ok(profile.includes('&lt;script&gt;技能&lt;/script&gt;')); assert.doesNotMatch(profile, /<script>|<img src=x|已隐藏|已删除/);
assert.doesNotMatch(profile, /BLAZER RECORD|BLAZER GROWTH/);
Object.assign(state.玩家, {
  伐刀能力: { 能力系别: '自然干涉系', 能力本质: '本局确认的伐刀能力', 共通限制: '伐刀限制', 招式: { '<反击>': skill } },
  固有灵装: '本局灵装', 登记等级: 'B', 魔人觉醒: false, 六维: { 魔力控制: 'D' }, 成长: { 经验: { 魔力控制: 25 } },
});
const hybridProfile = api.profileView();
for (const value of ['武装名称', '星辰力说明真实值', '本局确认的伐刀能力', '本局灵装', '伐刀限制', '未觉醒', '魔力控制档内经验', '25', '&lt;反击&gt;']) assert.ok(hybridProfile.includes(value), value);
assert.doesNotMatch(hybridProfile, /<反击>/);
assert.equal(api.model().school.id, 'jielong');
state.玩家.学战.学园ID = 'unknown'; assert.equal(api.model().school, null); assert.equal(api.model().schoolName, state.玩家.所属);
state.玩家.学战.校内序列 = { 状态: '未上榜', 名次: 12 }; assert.equal(api.model().rank, '未上榜');
state.玩家.学战.校内序列 = { 状态: '已上榜', 名次: 73 }; assert.equal(api.model().rank, '已上榜');
const contacts = api.communicationView(); assert.match(contacts, /尤莉丝/); assert.doesNotMatch(contacts, /史黛菈/);
const calendar = api.calendarView();
for (const value of ['六花阶段', '自由开场', '2013-04-10', '09:30', '甲、乙', '日程说明', '已安排', '事件结果', '入学时']) assert.ok(calendar.includes(value), value);
assert.doesNotMatch(calendar, /落第|第一卷|七星/);
let saved = null, applied = 0;
api.setBridge({ correction: {
  getConfig: () => ({ world: 'asterisk', endpoint: 'https://example.invalid/v1', model: 'test', maxTokens: 3000, prompt: '学战独立提示', autoApply: true }),
  getStatus: () => ({ message: '就绪' }), cancel() {},
  saveConfig(value) { saved = structuredClone(value); return { ...value }; },
  request: async () => ({ count: 1, patch: '[{"op":"replace","path":"/场景/地点","value":"学院"}]' }),
  apply: async () => { applied++; return '已回读确认'; },
} });
assert.match(api.settings(), /学战独立提示/);
await api.runCorrectionAction('request'); assert.equal(saved.world, 'asterisk'); assert.match(api.settingsView(), /1 项待检查/);
await api.runCorrectionAction('apply'); assert.equal(applied, 1); assert.match(api.settingsView(), /已回读确认/);
let injectionEnabled = true;
api.setBridge({ plot: {
  getStatus: () => ({ enabled: injectionEnabled, reason: '注入器修订测试。', lastInjection: null }),
  setEnabled(value) { injectionEnabled = value; },
  preview: async () => ({ worldbook: '主世界书', entryName: '[剧情]第一卷.第一章.华焰魔女', entryOrder: 201, text: '当前剧情节点：学战 第一卷 · 第一章\n<第一章>正文 & 原文</第一章>' })
} });
await api.runPlotAction('preview');
assert.match(api.plotView(), /华焰魔女（order 201）/);
assert.match(api.plotView(), /&lt;第一章&gt;正文 &amp; 原文&lt;\/第一章&gt;/);
assert.doesNotMatch(api.plotView(), /<第一章>/);
await api.runPlotAction('toggle'); assert.equal(injectionEnabled, false); assert.match(api.plotView(), /已关闭/);
api.setBridge({ plot: { getStatus: () => ({ enabled: true, reason: '' }), preview: async () => { throw new Error('剧情条目正文为空'); } } });
await api.runPlotAction('preview'); assert.match(api.plotView(), /剧情条目正文为空/); assert.doesNotMatch(api.plotView(), /<pre/);
console.log('PASS: formal Asterisk fields, shared people, contacts, calendar, inert text, correction settings and preview/apply.');
