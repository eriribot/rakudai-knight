import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectAvatarSlots } from '../../../scripts/黑白ADV轮盘终端/update-avatar-component.mjs';
import { readMappedScript } from '../../../scripts/黑白ADV轮盘终端/build-lime-story-component.mjs';
import { RELATIONSHIP_SCORING, supportStage, romanceStage } from '../../../世界书规则/MVU/schema.mjs';

const root = new URL('../../../', import.meta.url);
const target = '世界书规则/MVU/落第骑士-小手机-v1.3.29-B1-头像更新.json';
const artifact = JSON.parse(fs.readFileSync(new URL(target, root), 'utf8'));
let app = inspectAvatarSlots(readMappedScript(artifact.content).body).app.value;
const manifest = JSON.parse(fs.readFileSync(new URL('resource/knightavatars/manifest.json', root), 'utf8'));
for (const item of manifest.characters) {
  if (item.imageUrl) app = app.split(item.imageUrl).join('../../../resource/knightavatars/' + (item.displayFile || item.file));
}
const sample = {
  系统: { 结构版本: 3, 开局状态: '已建档', 主角模式: '自定义角色' },
  场景: { 当前卷: 10, 当前章: '离线展示', 阶段: '进行中', 时间: '2013-08-20 16:25', 地点: '法米利昂 · 预览场景', 宿舍: false },
  玩家: { 姓名: '预览玩家', 所属: '破军学园', 固有灵装: '未设置', 登记等级: '待定', 角色简介: '离线界面展示用角色。', 六维: {}, 伐刀能力: { 招式: {} }, 其他能力: {} },
  人际: Object.fromEntries([
    ['露娜艾丝·法米利昂', '女性', '史黛菈的姐姐'],
    ['阿斯特蕾亚·法米利昂', '女性', '史黛菈的母亲'],
    ['席琉斯·法米利昂', '男性', '史黛菈的父亲'],
    ['史黛菈·法米利昂', '女性', '法米利昂皇女'],
  ].map(([name, gender, identity]) => [name, {
    性别: gender, 关系: '离线展示联系人', 态度印象: '用于查看头像与页面排版，不代表实际剧情关系。',
    好感: null, 支援度: null, 已加联系方式: true, 已知资料: { 身份: identity, 登记等级: '', 灵装: '', 已知能力: '' },
  }])),
};
const incoming = ['史黛菈，欢迎回家。', '别站在门口了，先进来坐吧。', '既然来了，就堂堂正正地说清楚。'];
const source = { chatId: 'offline-family-preview', characterId: 'offline-family', messageId: 0, swipeId: 0, swipeCount: 1 };
const messages = [{ message_id: 0, role: 'assistant', swipe_id: 0,
  message: Object.keys(sample.人际).slice(0, 3).map((name, i) => '<LIME>\n' + JSON.stringify({ 对象: name, 消息: [{ 发言人: name, 内容: incoming[i] }] }) + '\n</LIME>').join('\n'),
  data: { stat_data: sample },
}];
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const bootstrap = `
const RELATIONSHIP_SCORING = ${safeJson(RELATIONSHIP_SCORING)};
const supportStage = ${supportStage.toString()};
const romanceStage = ${romanceStage.toString()};
const offlineState = ${safeJson(sample)};
const offlineSource = ${safeJson(source)};
const offlineMessages = ${safeJson(messages)};
const listeners = new Set();
function offlineNotice(text) { const el = window.parent.document.getElementById('preview-status'); if (el) el.textContent = String(text); }
window.RKBoot({
  version: '1.3.29', relationshipRules: RELATIONSHIP_SCORING, supportStage, romanceStage,
  getSnapshot: () => ({state: structuredClone(offlineState), source: offlineSource}),
  onUpdate: callback => { listeners.add(callback); return () => listeners.delete(callback); },
  notify: offlineNotice,
  dorm: async active => { offlineState.场景.宿舍 = active; },
  worldbookCalendar: {read: async () => ({worldbook:'离线预览 · 未加载世界书', entries:[], undatedCount:0})},
  lime: {read: () => ({messages:offlineMessages, playerName:offlineState.玩家.姓名, source:offlineSource, generating:false}),
    send: async () => { throw new Error('离线预览仅展示示例聊天，未发送消息。'); }},
  ui: {close: () => offlineNotice('这是本地预览，可关闭浏览器标签退出。'), recenter() {}, openStoryControls: () => offlineNotice('离线预览不执行建档或剧情写入。')}
});
window.refreshTerminalState().then(() => {
  window.goHome();
  window.parent.postMessage({type:'offline-phone-ready'}, window.location.origin);
});
`;
app = app.replace('</body>', '<script>' + bootstrap + '</script></body>');
fs.writeFileSync(new URL('phone-frame.html', import.meta.url), app);
const wrapper = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>B1 小手机 · 完整离线预览</title>
<style>*{box-sizing:border-box}body{margin:0;background:#15171c;color:#e8e9ed;font:15px/1.7 system-ui,"Microsoft YaHei",sans-serif}main{display:grid;grid-template-columns:minmax(240px,330px) minmax(0,440px);gap:42px;justify-content:center;padding:28px 20px}h1{font-size:26px;line-height:1.4;margin:0 0 14px}p{color:#aeb5c2}nav{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}button,select{font:inherit;color:inherit;background:#232730;border:1px solid #505866;border-radius:7px;padding:7px 12px;cursor:pointer}button:focus-visible,select:focus-visible{outline:2px solid #d6bd86;outline-offset:3px}button[aria-pressed=true]{border-color:#d6bd86;color:#f4dba7}a{color:#d6bd86}label{display:flex;align-items:center;gap:12px;margin:16px 0}#phone-shell{width:420px;max-width:100%;height:780px;max-height:calc(100dvh - 56px);min-height:560px;border:1px solid #525966;border-radius:16px;overflow:hidden;background:#111;box-shadow:0 20px 60px #0006}iframe{display:block;border:0;width:100%;height:100%}small{color:#929baa}#preview-status{font-size:13px;min-height:3em}@media(max-width:760px){main{display:flex;flex-direction:column;align-items:center;gap:18px;padding:18px 12px}.intro{width:100%;max-width:440px}h1{font-size:21px}nav{margin:12px 0}#phone-shell{height:760px;max-height:none;min-height:0}p{margin:8px 0}}</style></head>
<body><main><section class="intro"><small>HAGUN / OS · v1.3.29 B1</small><h1>小手机 · 完整离线预览</h1><p>当前头像更新版的完整界面。可点击手机里的应用，也可用下方按钮直达。</p><nav aria-label="预览页面"><button data-view="home" aria-pressed="true">首页</button><button data-view="roster">人物名册</button><button data-view="lime">LIME 通讯</button><button data-view="family-chat">姐姐的聊天</button><button data-view="arena">七星赛事</button><button data-view="calendar">日历</button><button data-view="settings">设置</button></nav><label>显示宽度<select id="width"><option value="420">420px</option><option value="360">360px</option><option value="320">320px</option></select></label><button id="theme">切换浅色</button><p id="preview-status" role="status">正在载入本地预览…</p><p><small>人物关系、时间和聊天均为演示样本。页面不连接酒馆，不写入 MVU，也不发送消息。</small></p><a href="bubble-preview.html">查看正文气泡</a></section><section id="phone-shell" aria-label="小手机完整界面"><iframe id="phone-frame" title="B1 小手机完整界面" src="phone-frame.html"></iframe></section></main>
<script>const frame=document.getElementById('phone-frame');let light=false;let ready=false;function show(view){if(!ready)return;const app=frame.contentWindow;app.goHome();if(view==='roster'){app.openApp('blazer');app.switchBlazerTab('roster')}else if(view==='family-chat'){app.openApp('lime');app.openLimeChat('露娜艾丝·法米利昂')}else if(view!=='home')app.openApp(view);document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)))}document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));document.getElementById('width').addEventListener('change',e=>{document.getElementById('phone-shell').style.width=e.target.value+'px'});document.getElementById('theme').addEventListener('click',e=>{light=!light;frame.contentDocument.documentElement.setAttribute('data-rk-theme',light?'light':'dark');e.target.textContent=light?'切换深色':'切换浅色'});window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.type!=='offline-phone-ready')return;ready=true;document.getElementById('preview-status').textContent='已载入当前 B1 · 40 人头像清单，三位家人已加入示例名册。';show(new URLSearchParams(location.search).get('view')||'home')});</script></body></html>`;
fs.writeFileSync(new URL('phone-preview.html', import.meta.url), wrapper);
fs.writeFileSync(new URL('phone-preview-receipt.json', import.meta.url), JSON.stringify({source:target,contentSha256:createHash('sha256').update(artifact.content).digest('hex'),render:'complete embedded APP_HTML, only image URL localization and offline RKBoot adapter added',data:'fictional in-memory display sample',hostWrites:false,modelCalls:false},null,2)+'\n');
console.log('Built complete current B1 offline phone: output/playwright/vermilion-family/phone-preview.html');
