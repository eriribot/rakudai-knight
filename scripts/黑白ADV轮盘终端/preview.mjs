import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildTerminal, directory, extractScripts, jsString } from './bundle.mjs';
import { RELATIONSHIP_SCORING, supportStage, romanceStage } from '../../世界书规则/MVU/schema.mjs';

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
  return { numeric, legacy, highest };
}

function previewRuntime() {
  const frame = document.getElementById('preview-frame');
  const frameWrap = document.getElementById('preview-frame-wrap');
  const status = document.getElementById('preview-status');
  let selected = 'numeric';
  let theme = 'dark';
  let app = null;
  const subscribers = new Set();
  const descriptions = {
    numeric: '虚拟数值样本：防御 B+；男性好感 1000、支援 S，没有恋爱阶段；女性好感 800 显示交往、支援仍为 C。点击人物展开。',
    highest: '虚拟上限样本：女性好感 1000 显示生死相随；男性同为 1000 仍只展示好感和支援。',
    legacy: '虚拟旧记录：好感为 null，支援度缺失或 null；原 C / A 仅作为旧字母显示，分数保持待核定。',
    empty: '虚拟第 8 楼的另一回复槽未保存 MVU：应清空此前人物，显示当前槽未就绪，不借用上一回复。',
  };
  function source() {
    return { chatId: 'offline-preview', messageId: selected === 'legacy' ? 6 : 8,
      swipeId: selected === 'empty' ? 1 : 0, swipeCount: selected === 'legacy' ? 1 : 2 };
  }
  function getSnapshot() {
    if (selected === 'empty') {
      const error = new Error('演示：当前回复槽尚未保存 MVU，请切回数值样本查看已有记录。');
      error.source = source();
      throw error;
    }
    return { state: JSON.parse(JSON.stringify(samples[selected])), source: source() };
  }
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
      onUpdate(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
      notify(message) { status.textContent = '离线预览提示：' + String(message); },
      ui: {
        close() { status.textContent = '这是离线预览，关闭页面即可退出；当前没有酒馆连接。'; },
        recenter() {},
        openStoryControls() { status.textContent = '离线预览不执行建档或剧情写入。'; },
      },
    });
    app.openApp('blazer');
    app.switchBlazerTab('roster');
    updateDescription();
  });
  updateDescription();
  frame.srcdoc = compiledHtml;
}

export function buildPreview() {
  const built = buildTerminal();
  const bootstrap = 'const compiledHtml = ' + jsString(built.html) + ';\n' +
    'const version = ' + jsString(built.version) + ';\n' +
    'const RELATIONSHIP_SCORING = ' + jsString(RELATIONSHIP_SCORING) + ';\n' +
    'const supportStage = ' + supportStage.toString() + ';\n' +
    'const romanceStage = ' + romanceStage.toString() + ';\n' +
    'const samples = ' + jsString(makeSamples()) + ';\n' +
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
<p class="note">以下是独立虚拟样本，不是当前聊天。页面使用实际编译后的终端 HTML，不连接酒馆，也不写入 MVU。</p>
<div class="controls" aria-label="切换虚拟记录">
<button type="button" data-sample="numeric" aria-pressed="true">男／女阶段</button>
<button type="button" data-sample="highest" aria-pressed="false">女性好感 1000</button>
<button type="button" data-sample="legacy" aria-pressed="false">旧 null · 待核定</button>
<button type="button" data-sample="empty" aria-pressed="false">另一回复 · 空槽</button></div>
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
