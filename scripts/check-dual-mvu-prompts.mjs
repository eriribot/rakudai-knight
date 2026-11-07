import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { GROWTH_RULES } from '../世界书规则/MVU/schema.mjs';

const require = createRequire(new URL('../output/worldbook-calibration/dev/package.json', import.meta.url));
const ejs = require('ejs');
const templates = ['变量更新规则', '变量输出格式'].map(name =>
  fs.readFileSync(new URL(`../世界书规则/MVU/${name}.txt`, import.meta.url), 'utf8'));
const combinedTemplates = [fs.readFileSync(new URL('../世界书规则/MVU/变量列表.txt', import.meta.url), 'utf8'), ...templates];

const confirmed = { 结构版本: 4, 开局状态: '已建档', 主角模式: '自定义角色' };
const blade = { 能力系别: '体能强化系', 能力本质: '', 共通限制: '', 招式: {} };
const stats = { 攻击力: 'F', 防御力: 'F', 魔力量: 'F', 魔力控制: 'F', 体能: 'F', 运气: 'F' };
const asteriskProfile = {
  学园ID: 'seidoukan', 能力身份: '星脉世代', 能力机制: '', 共通限制: '', 招式: {},
  星辰力: { 说明: '' }, 校内序列: { 状态: '未上榜', 名次: null }, 武装: { 类别: '尚未确定', 名称: '', 使用条件: '' },
};

let checks = 0;
function render(state, options = {}) {
  const context = { getvar: key => key.split('.').reduce((value, part) => value?.[part], state) };
  return templates.map(text => ejs.render(text, context, options));
}
function checkCombined(state, options, label) {
  const context = { getvar: key => key.split('.').reduce((value, part) => value?.[part], state) };
  const rendered = combinedTemplates.map(text => ejs.render(text, context, options)).join('\n');
  check(label + '/combined-templates', () => {
    assert.equal(ejs.render(combinedTemplates.join('\n'), context, options), rendered);
  });
  check(label + '/repeated-combined-templates', () => {
    assert.equal(ejs.render([...combinedTemplates, ...combinedTemplates].join('\n'), context, options), rendered + '\n' + rendered);
  });
}
function check(label, callback) {
  callback(label);
  checks++;
}
function section(text, heading) {
  const content = text.split(`【${heading}】`)[1];
  assert.notEqual(content, undefined, `缺少 ${heading}`);
  return content.split('【')[0].trim();
}

// 渲染模式：普通与严格（destructuredLocals 只注入 getvar），两种都必须无残留标签。
for (const options of [{}, { strict: true, _with: false, destructuredLocals: ['getvar'] }]) {
  const mode = options.strict ? 'strict' : 'plain';
  const reference = render({ stat_data: { 系统: { ...confirmed, 作品: 'rakudai' }, 玩家: { 伐刀能力: blade, 六维: stats } } }, options);
  for (const [label, system, world] of [
    ['legacy', confirmed, 'rakudai'],
    ['rakudai', { ...confirmed, 作品: 'rakudai' }, 'rakudai'],
    ['asterisk', { ...confirmed, 作品: 'asterisk' }, 'asterisk'],
    ['pending', { ...confirmed, 作品: 'asterisk', 开局状态: '待建档' }, null],
    ['null', { ...confirmed, 作品: null }, null],
    ['invalid', { ...confirmed, 作品: 'unknown' }, null],
    ['missing', {}, null],
  ]) {
    const state = { stat_data: { 系统: system, 玩家: { 姓名: '测试', 学战: asteriskProfile, 伐刀能力: blade, 六维: stats } } };
    checkCombined(state, options, `${mode}/${label}`);
    const [rules, format] = render(state, options);
    check(`${mode}/${label}/no-ejs-left`, () => {
      assert(!rules.includes('<%') && !format.includes('<%'), label);
      assert(!/\$\{/.test(rules) && !/\$\{/.test(format), label);
    });
    if (!world) {
      check(`${mode}/${label}/empty-patch`, () => {
        assert.match(rules, /JSONPatch 为 \[\]/);
        assert.match(format, /JSONPatch 必须为 \[\]/);
        assert(!rules.includes('【成长终值】') && !rules.includes('【能力与装备】'));
      });
      continue;
    }
    check(`${mode}/${label}/shared-chapter-rules`, () => {
      // 共用章节规则必须在两个作品下都出现，且不依赖另一个分支的上下文。
      assert.match(rules, /本轮最多前进一个节点/);
      assert.match(rules, /把行动权交还玩家/);
      assert(!rules.includes('沿用上面同一套规则'));
    });
    check(`${mode}/${label}/ability-not-gated-by-world`, () => {
      // 能力段必须完整共用，不能因作品分支消失；字段契约在格式中统一说明。
      assert.equal(section(rules, '能力与装备'), section(reference[0], '能力与装备'));
      for (const field of ['伐刀能力', '固有灵装', '/玩家/学战', '/玩家/魔人觉醒']) assert(rules.includes(field), field);
      assert(!rules.includes('默认不建伐刀能力'));
      assert(!rules.includes('不生成伐刀者'));
      assert(!rules.includes('【同一世界与两座舞台】'));
    });
    check(`${mode}/${label}/format-both-directions`, () => {
      const fields = format.split('1. /玩家')[1].split('2. /场景')[0];
      assert.equal(fields, reference[1].split('1. /玩家')[1].split('2. /场景')[0]);
      for (const field of ['伐刀能力', '固有灵装', '登记等级', '六维/<目标>', '成长/经验/<目标>', '学战']) {
        assert(new RegExp('^- ' + field + '[：:]|^- ' + field + '（', 'm').test(fields), field);
      }
      // 保留原生必填档案与选填跨体系资料，不能将「本轮不更新」混同「可以删除」。
      assert.match(fields, /落第保留[^\n]+综合初评/);
      assert.match(fields, /学战保留完整 \/玩家\/学战/);
      assert.match(fields, /落第的 \/玩家\/学战 可只新增已有部分/);
      assert(!format.includes('Do not create Rakudai growth fields'));
    });
    if (world === 'rakudai') {
      check(`${mode}/${label}/rakudai-only`, () => {
        assert.match(rules, /【成长终值】/);
        assert.match(rules, /<rk-selection-rules>/);
        assert.match(rules, /<rk-national-rules>/);
        assert.match(rules, /落第：\/场景\/当前卷 用 1—19/);
        assert.match(format, /当前卷：1—19 的整数/);
        assert.match(format, /宿舍/);
        assert(!rules.includes('学战目前只有第一卷'));
      });
    } else {
      check(`${mode}/${label}/asterisk-only`, () => {
        assert.match(rules, /【成长终值】/, '觉醒后仍要能结算成长');
        assert.match(rules, /\/场景\/当前卷 与已发生事件卷号保持 null/);
        assert.match(format, /当前卷：null/);
        assert(!rules.includes('<rk-selection-rules>'));
        assert(!rules.includes('<rk-national-rules>'));
        assert(!format.includes('<rk-selection-rules>'));
      });
    }
  }
}

// 成长按字段判断。首轮新增能力与六维后也要能读到完整结算规则，不能等下一轮才开放。
for (const options of [{}, { strict: true, _with: false, destructuredLocals: ['getvar'] }]) {
  for (const world of ['rakudai', 'asterisk']) {
    for (const player of [{}, { 伐刀能力: blade }, { 六维: stats }, { 伐刀能力: [], 六维: stats },
      { 伐刀能力: blade, 六维: stats }, { 伐刀能力: blade, 六维: stats, 魔人觉醒: true }]) {
      const [rules] = render({ stat_data: { 系统: { ...confirmed, 作品: world }, 玩家: player } }, options);
      const growth = section(rules, '成长终值');
      check(`growth/${world}/${Object.keys(player).join(',')}/${options.strict || false}`, () => {
        for (const [grade, cost] of Object.entries(GROWTH_RULES.costs)) assert(growth.includes(grade + cost), grade);
        const complete = player.伐刀能力 && !Array.isArray(player.伐刀能力) && player.六维;
        assert.equal(growth.includes('当前档案尚缺'), !complete);
        if (!complete) assert.match(growth, /新增[^\n]+同轮[^\n]+真实发生的训练/);
        assert(growth.includes('/玩家/伐刀能力') && growth.includes('/玩家/六维'));
        assert(growth.includes(`魔人觉醒:${player.魔人觉醒 === true}`));
        if (!player.魔人觉醒) assert.match(growth, /魔力量不获新成长经验/);
        assert(!growth.includes('不提交成长经验与六维'));
      });
    }
  }
}

console.log(`${checks} EJS 分支检查通过（普通与严格两种渲染模式）。`);
