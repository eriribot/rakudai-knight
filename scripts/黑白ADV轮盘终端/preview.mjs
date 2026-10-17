import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildTerminal, directory, extractScripts, jsString } from './bundle.mjs';
import { RELATIONSHIP_SCORING, supportStage, romanceStage } from '../../世界书规则/MVU/schema.mjs';
import { samples as tournamentPreviewSamples } from '../../七星剑武祭-晋级面板预览/mvu-model.mjs';
import { deriveTournament as derivePreviewTournament } from '../rakudai-tournament.mjs';

// Preview fixtures belong only to this generator, never to the exported helper script.
function makeSamples() {
  const numeric = {
    系统: { 结构版本: 3, 开局状态: '已建档', 主角模式: '自定义角色' },
    场景: { 当前卷: 1, 当前章: '序章', 阶段: '进行中', 时间: '演示日 · 上午', 地点: '虚拟训练场' },
    玩家: {
      姓名: '测试教官', 所属: '演示学园／临时训练课程', 固有灵装: '演示训练剑', 登记等级: 'B',
      角色简介: '仅用于观察界面排版的虚拟教官。名册中的教学或协作关系均由此样本明确指定，不是按教官身份自动推断。',
      六维: { 攻击力: 'A', 防御力: 'B+', 魔力量: 'B', 魔力控制: 'A', 体能: 'A', 运气: 'E' },
      伐刀能力: { 能力系别: '', 能力本质: '', 共通限制: '', 招式: {} }, 其他能力: {},
    },
    人际: {
      训练生甲: {
        性别: '男性',
        关系: '学生；已确认参加本次指导', 态度印象: '愿意认真听取建议，但仍需要在实际训练中建立默契。',
        好感: 1000, 支援度: 320, 羁绊阶段: supportStage(320),
        变化依据: '演示：共同完成一次防守练习，只记录这次配合。',
        已知资料: { 身份: '本人已介绍为本次课程的训练生', 登记等级: '', 灵装: '', 已知能力: '' },
      },
      协作教员乙: {
        性别: '女性',
        关系: '同事；共同负责本次临时课程的训练安排与课后反馈，职责重叠处以本局已确认分工为准',
        态度印象: '本条使用较长中文描述，以检查展开后是否能完整换行。双方目前只有课程协作经验，不能由此补充其私人经历、能力机制或未来关系。',
        好感: 800, 支援度: 80, 羁绊阶段: supportStage(80),
        变化依据: '虚拟计分样本：好感达到交往门槛，支援度仅到 C；两套数值分别展示。',
        已知资料: { 身份: '当面介绍的协作教员', 登记等级: '', 灵装: '', 已知能力: '' },
      },
    },
  };
  const legacy = JSON.parse(JSON.stringify(numeric));
  legacy.人际.训练生甲.好感 = null;
  delete legacy.人际.训练生甲.支援度;
  legacy.人际.训练生甲.羁绊阶段 = 'C';
  legacy.人际.训练生甲.变化依据 = '演示旧记录：保留原 C 字母，尚未核定支援起点。';
  legacy.人际.协作教员乙.好感 = null;
  legacy.人际.协作教员乙.支援度 = null;
  legacy.人际.协作教员乙.羁绊阶段 = 'A';
  legacy.人际.协作教员乙.变化依据 = '演示旧记录：没有分数，不根据原字母补算。';
  const highest = JSON.parse(JSON.stringify(numeric));
  highest.人际.协作教员乙.好感 = 1000;
  highest.人际.协作教员乙.变化依据 = '虚拟样本：女性好感达到生死相随门槛。';
  const avatars = JSON.parse(JSON.stringify(numeric));
  avatars.人际 = {};
  ['史黛菈·法米利昂', '绫辻绚濑', '有栖院凪', '御祓泡沫', '西京宁音', '原创同行', '艾莉丝·阿斯卡里德', '多多良幽衣', '欧尔·格尔', '华伦斯坦', '药师雾子', '莎拉·布拉德莉莉', '风祭凛奈', '艾茵·阿伯伦特', '碎城雷', '浅木椛', '城之崎白夜', '诸星雄大', '鹤屋美琴', '福小莉', '夏洛特·科黛', '日下部加加美', '紫乃宫天音', '平贺玲泉', '叶暮牡丹', '叶暮桔梗'].forEach((name, index) => {
    avatars.人际[name] = {
      关系: '离线演示中登记的同伴', 态度印象: '仅用于比较盾形头像与首字回退，不代表本局关系。',
      好感: 100, 支援度: 80, 羁绊阶段: supportStage(80), 已加联系方式: index % 2 === 0,
    };
  });
  const lime = JSON.parse(JSON.stringify(avatars));
  lime.场景.时间 = '2013-05-15 16:25';
  const tournaments = Object.fromEntries(Object.entries(tournamentPreviewSamples).map(([key, sample]) => [key, structuredClone(sample.state)]));
  return { numeric, legacy, highest, avatars, lime, ...tournaments };
}

function makeLimeMessages() {
  const reply = (name, text) => '<LIME>\n' + JSON.stringify({ 对象: name, 消息: [{ 发言人: name, 内容: text }] }) + '\n</LIME>';
  const latest = makeSamples().lime;
  const earlier = JSON.parse(JSON.stringify(latest));
  earlier.场景.时间 = '2013-05-15 16:20';
  return [
    { message_id: 0, role: 'assistant', message: '离线虚构剧情：放学后，教官在训练场整理器材。', swipe_id: 0,
      data: { stat_data: earlier, rk_lime: { version: 1, owner: { messageId: 0, swipeId: 0 }, exchanges: [
        { id: 'demo-0', contact: '风祭凛奈', time: earlier.场景.时间,
          player: '放学后一起去训练场吗？我想先确认一下集合地点。',
          reply: ['可以。就在训练场入口碰面吧，夏洛特也会一起。'] },
      ] } } },
    { message_id: 1, role: 'assistant', message: '离线虚构剧情：夏洛特主动传来集合地点确认。\n' +
        reply('夏洛特·科黛', '集合地点已经确认。我会和大小姐一起过去。'), swipe_id: 0,
      data: { stat_data: latest, rk_lime: { version: 1, owner: { messageId: 1, swipeId: 0 }, exchanges: [
        { id: 'demo-1', contact: '风祭凛奈', time: latest.场景.时间,
          player: '好，我带上训练用具。要是临时有事，直接在这里告诉我。',
          reply: ['知道啦。别忘记先热身，到了再联系。'] },
      ] } } },
  ];
}

function previewRuntime() {
  const frame = document.getElementById('preview-frame');
  const frameWrap = document.getElementById('preview-frame-wrap');
  const status = document.getElementById('preview-status');
  const query = new URLSearchParams(window.location.search);
  let selected = ['numeric', 'highest', 'legacy', 'empty', 'avatars', 'lime', 'selection', 'qualified', 'tie', 'other', 'ikki'].includes(query.get('sample')) ? query.get('sample') : 'numeric';
  let theme = 'dark';
  let app = null;
  const subscribers = new Set();
  const limeMessages = JSON.parse(JSON.stringify(limePreviewMessages));
  let limeSending = false;
  let limeSequence = limeMessages.length;
  const calendarContext = { characterId: 'offline-worldbook-preview', chatId: 'offline-preview', chat: [] };
  const calendarReader = createCalendarWorldbookReader({
    getCharWorldbookNames: async () => ({ primary: '本地世界书 v0.02 · 离线预览' }),
    getWorldbook: async () => calendarWorldbookEntries,
    getContext: () => calendarContext
  });
  const descriptions = {
    numeric: '虚拟数值样本：防御 B+；男性好感 1000、支援 S，没有恋爱阶段；女性好感 800 显示交往、支援仍为 C。点击人物展开。',
    highest: '虚拟上限样本：女性好感 1000 显示生死相随；男性同为 1000 仍只展示好感和支援。',
    legacy: '虚拟旧记录：好感为 null，支援度缺失或 null；原 C / A 仅作为旧字母显示，分数保持待核定。',
    empty: '虚拟第 8 楼的另一回复槽未保存 MVU：应清空此前人物，显示当前槽未就绪，不借用上一回复。',
    avatars: '虚拟头像样本：风祭凛奈、夏洛特共用清单姓名与别名匹配；凛奈保留第5卷上色头像，小莉沿用原图床地址，本地保留第18卷中华服、金钱饰片版。凛奈、碎城雷、美琴、小莉与夏洛特的上色均记录为AI衍生图，未核实配色与用户指定配色分别标注。诸星雄大保留原版彩色盾图，欧尔图为童年回忆形态；有栖院凪与艾莉丝使用全名分别识别，原创同行保留首字。图床地址留空的素材由本地内联显示。可在手机首页打开 LIME 比较通讯录。',
    lime: 'LIME虚构聊天样本：通讯附于两条剧情记录，按各自楼层的 MVU 时间显示；夏洛特的主动来信也来自虚构正文。发送只向当前剧情附加本地通讯，不增加楼层、不生成角色回信，不调用模型或写入真实酒馆。',
    selection: '本局选拔虚构样本：自捏骑士与原作角色共用正式选拔引擎。显示已登记的玩家实际对局；代表资格尚待确认，离线预览不保存比赛。',
    qualified: '已出线虚构样本：288 人、20 轮完整旧账本且赛季已结束，正式引擎确认玩家位于前六名。全国赛签位仍待公布，不沿用原著胜者。',
    tie: '同分虚构样本：完整赛季的第六、第七名积分相同，代表资格保留待决，不按姓名或录入顺序分配。',
    other: '他校虚构角色：保留当前姓名、所属和灵装，破军选拔不适用；全国赛资格与签位须有本局记录。',
    ikki: '一辉模式虚构样本：正式引擎将玩家绑定到既有黑铁一辉参赛 ID，名册不重复添加一辉。',
  };
  function source() {
    return { chatId: 'offline-preview', messageId: selected === 'lime' ? limeMessages.length - 1 : selected === 'legacy' ? 6 : 8,
      swipeId: selected === 'empty' ? 1 : 0, swipeCount: ['legacy', 'lime'].includes(selected) ? 1 : 2 };
  }
  function getSnapshot() {
    if (selected === 'empty') {
      const error = new Error('演示：当前回复槽尚未保存 MVU，请切回数值样本查看已有记录。');
      error.source = source();
      throw error;
    }
    return { state: JSON.parse(JSON.stringify(samples[selected])), source: source() };
  }
  function tournamentReadOnly() { throw new Error('赛事离线预览只读：不会保存比赛或修改真实 MVU。'); }
  function updateDescription() {
    status.textContent = descriptions[selected];
    document.querySelectorAll('[data-sample]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.sample === selected));
    });
  }
  document.querySelectorAll('[data-sample]').forEach(button => {
    button.addEventListener('click', () => {
      selected = button.dataset.sample;
      updateDescription();
      subscribers.forEach(callback => callback({ reset: true }));
    });
  });
  document.querySelectorAll('[data-theme]').forEach(button => {
    button.addEventListener('click', () => {
      theme = button.dataset.theme;
      if (app) app.document.documentElement.setAttribute('data-rk-theme', theme);
      document.querySelectorAll('[data-theme]').forEach(item => {
        item.setAttribute('aria-pressed', String(item.dataset.theme === theme));
      });
    });
  });
  document.getElementById('preview-width').addEventListener('change', event => {
    if (['320', '420', '560'].includes(event.target.value)) frameWrap.style.width = event.target.value + 'px';
  });
  frame.addEventListener('load', () => {
    app = frame.contentWindow;
    if (!app || typeof app.RKBoot !== 'function') {
      status.textContent = '预览未启动：请重新运行 node preview.mjs，并重新打开生成文件。';
      return;
    }
    subscribers.clear();
    app.document.documentElement.setAttribute('data-rk-theme', theme);
    app.RKBoot({
      version,
      relationshipRules: RELATIONSHIP_SCORING,
      supportStage,
      romanceStage,
      getSnapshot,
      tournament: {
        view: () => JSON.parse(JSON.stringify(tournamentViews[selected])),
        action: tournamentReadOnly,
        participant: tournamentReadOnly,
        opponents: tournamentReadOnly,
      },
      lime: {
        read: () => ({ messages: selected === 'lime' ? limeMessages : [], playerName: samples[selected]?.玩家?.姓名,
          source: source(), generating: false }),
        async send(request) {
          if (selected !== 'lime') throw new Error('请切到「聊天记录」样本测试；这里不会发送真实酒馆消息。');
          if (limeSending) throw new Error('演示通讯正在保存，请稍候。');
          if (JSON.stringify(request.expectedSource) !== JSON.stringify(source())) throw new Error('演示来源已变化，草稿已保留。');
          if (samples.lime.人际[request.name]?.已加联系方式 !== true) throw new Error('请先建立联系方式。');
          const owner = limeMessages[limeMessages.length - 1], before = limeMessages.length;
          limeSending = true;
          try {
            await new Promise(resolve => setTimeout(resolve, 180));
            owner.data.rk_lime.exchanges.push({ id: 'demo-' + limeSequence++, contact: request.name,
              time: owner.data.stat_data.场景.时间, player: request.text, reply: [] });
            subscribers.forEach(callback => callback({ type: 'LIME_UPDATED', retainDisplay: true }));
            status.textContent = '离线通讯已附于当前剧情：剧情楼层数仍为 ' + before + ' → ' + limeMessages.length +
              '，没有生成角色回信、模型调用或真实酒馆写入。';
            return { sent: true, notice: '离线演示：通讯已附于当前剧情，楼层数保持 ' + limeMessages.length + '；未生成角色回信。' };
          } finally { limeSending = false; }
        },
      },
      dorm: async active => { samples[selected].场景.宿舍 = active; },
      worldbookCalendar: { read: () => calendarReader.read() },
      onUpdate(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
      notify(message) { status.textContent = '离线预览提示：' + String(message); },
      ui: {
        close() { status.textContent = '这是离线预览，关闭页面即可退出；当前没有酒馆连接。'; },
        recenter() {},
        openStoryControls() { status.textContent = '离线预览不执行建档或剧情写入。'; },
      },
    });
    if (query.get('view') === 'arena') { app.openApp('schedule'); app.openApp('arena'); }
    else if (query.get('view') === 'calendar') app.openApp('calendar');
    else if (['avatars', 'lime'].includes(selected) && query.get('view') === 'lime') {
      app.openApp('lime');
      if (selected === 'lime') app.refreshTerminalState().then(() => { app.openLimeChat('风祭凛奈'); app.refreshLimeRecords(); });
    }
    else { app.openApp('blazer'); app.switchBlazerTab('roster'); }
    updateDescription();
  });
  updateDescription();
  frame.srcdoc = compiledHtml;
}

export function buildPreview() {
  const built = buildTerminal();
  const previewSamples = makeSamples();
  const tournamentViews = Object.fromEntries(Object.entries(previewSamples).map(([key, state]) => [key, derivePreviewTournament(state)]));
  const exportedWorldbook = JSON.parse(fs.readFileSync(new URL('../../落第骑士英雄谭v0.02.json', import.meta.url), 'utf8'));
  const calendarWorldbookEntries = Object.values(exportedWorldbook.entries).filter(entry => entry.comment && entry.comment.startsWith('[剧情]'))
    .map(entry => ({ uid: entry.uid, name: entry.comment, content: entry.content }));
  const calendarReaderSource = fs.readFileSync(path.join(directory, 'calendar-worldbook.js'), 'utf8').replace(/\r\n/g, '\n');
  const bootstrap = 'const compiledHtml = ' + jsString(built.html) + ';\n' +
    'const version = ' + jsString(built.version) + ';\n' +
    'const RELATIONSHIP_SCORING = ' + jsString(RELATIONSHIP_SCORING) + ';\n' +
    'const supportStage = ' + supportStage.toString() + ';\n' +
    'const romanceStage = ' + romanceStage.toString() + ';\n' +
    'const samples = ' + jsString(previewSamples) + ';\n' +
    'const tournamentViews = ' + jsString(tournamentViews) + ';\n' +
    'const limePreviewMessages = ' + jsString(makeLimeMessages()) + ';\n' +
    'const calendarWorldbookEntries = ' + jsString(calendarWorldbookEntries) + ';\n' + calendarReaderSource + '\n' +
    '(' + previewRuntime.toString() + ')();\n';
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>终端 v${built.version} · 离线状态预览</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:18px 12px 28px;background:#d8e0d9;color:#1b2748;font:14px/1.65 "Microsoft YaHei UI",sans-serif}
main{max-width:780px;margin:auto}h1{font-size:19px;margin:0 0 4px}p{margin:6px 0 12px}.controls{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:8px 0}
button,select{font:inherit;padding:6px 10px;border:2px solid #1b2748;background:#fff3d6;color:#1b2748;cursor:pointer;min-height:36px}button[aria-pressed=true]{background:#2b4773;color:#fff3d6}
button:focus-visible,select:focus-visible{outline:3px solid #b66226;outline-offset:2px}label{display:flex;align-items:center;gap:6px}.note{font-size:12px;color:#425469}
#preview-status{padding:8px 10px;background:#fff3d6;border-left:4px solid #319e8e;min-height:44px}#preview-frame-wrap{width:420px;max-width:100%;margin:14px auto 0;border:2px solid #1b2748;background:#223759}
iframe{display:block;width:100%;height:min(760px,80vh);min-height:420px;border:0}
</style></head><body><main>
<h1>终端 v${built.version} · 离线状态预览</h1>
<p class="note">本局状态使用独立虚拟样本；校历的剧情资料来自本地世界书 v0.02。页面使用实际编译后的终端 HTML，不连接酒馆，也不写入 MVU。</p>
<div class="controls" aria-label="切换虚拟记录">
<button type="button" data-sample="numeric" aria-pressed="true">男／女阶段</button>
<button type="button" data-sample="highest" aria-pressed="false">女性好感 1000</button>
<button type="button" data-sample="legacy" aria-pressed="false">旧 null · 待核定</button>
<button type="button" data-sample="empty" aria-pressed="false">另一回复 · 空槽</button></div>
<div class="controls"><button type="button" data-sample="avatars" aria-pressed="false">盾形头像</button><button type="button" data-sample="lime" aria-pressed="false">聊天记录</button></div>
<div class="controls" aria-label="赛事虚构样本"><button type="button" data-sample="selection" aria-pressed="false">本局选拔</button><button type="button" data-sample="qualified" aria-pressed="false">已出线</button><button type="button" data-sample="other" aria-pressed="false">他校角色</button></div>
<div class="controls" aria-label="预览显示条件">
<button type="button" data-theme="dark" aria-pressed="true">黑色外壳</button><button type="button" data-theme="light" aria-pressed="false">白色外壳</button>
<label>容器宽度 <select id="preview-width"><option value="320">320 px</option><option value="420" selected>420 px</option><option value="560">560 px</option></select></label></div>
<p id="preview-status" role="status" aria-live="polite"></p>
<div id="preview-frame-wrap"><iframe id="preview-frame" title="实际编译终端的离线预览"></iframe></div>
</main><script>${bootstrap}</script></body></html>`;
  const scripts = extractScripts(html);
  if (scripts.length !== 1 || scripts[0].attrs.src) throw new Error('预览脚本被 HTML 解析截断或出现外部来源');
  new vm.Script(scripts[0].content, { filename: 'preview-bootstrap.js' });
  return { html, version: built.version };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const preview = buildPreview();
  const destination = path.join(directory, 'dist', 'preview.html');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, preview.html, 'utf8');
  console.log('离线预览已生成：' + destination);
  console.log('仅虚拟样本；HTML/JS 编译检查通过，尚未进行浏览器视觉验收。');
}
