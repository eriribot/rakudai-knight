import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { buildTerminal, directory, extractScripts } from './bundle.mjs';

const built = buildTerminal({ asteriskPreview: true });
const output = path.join(directory, 'dist');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'asterisk-preview-runtime.js'), built.artifact.content);
const fixture = fs.readFileSync(path.join(directory, 'asterisk-preview-fixture.js'), 'utf8');
new vm.Script(fixture);
fs.writeFileSync(path.join(output, 'asterisk-preview-fixture.js'), fixture);
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-src 'self' blob:; object-src 'none'">
<title>学战 × MONO · 同一终端外壳预览</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100svh;color:#e7f7ff;font:14px/1.6 'Microsoft YaHei UI',sans-serif;background:linear-gradient(90deg,#041521e8,#09202b80),url('../../../resource/dorm/B-entrance-to-balcony.webp') center/cover fixed}
main{width:min(520px,calc(100% - 36px));padding:28px 0;margin-left:clamp(18px,5vw,80px)}
.eyebrow{font:11px Consolas,monospace;letter-spacing:3px;color:#8ccedb}h1{font-size:clamp(23px,3vw,34px);font-weight:500;letter-spacing:2px;margin:14px 0 8px}p{color:#c2d6df;margin:8px 0 20px}.controls{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
button,select{font:inherit;color:#d7f9ff;background:#062331cc;border:1px solid #4b7f91;min-height:42px;padding:8px 14px;cursor:pointer;border-radius:0}button[aria-pressed=true]{color:#09212d;background:#a7eff8}button:focus-visible,select:focus-visible{outline:2px solid #c1fbff;outline-offset:3px}select{max-width:100%;margin-top:6px}label{display:block;color:#c2d6df;margin:16px 0}.note{font-size:12px;color:#89b4c6}.stage-hint{margin-top:40px;padding:18px 20px;border-left:1px solid #8cdae4;max-width:390px;background:#061e2a9c}.stage-hint b{display:block;font-weight:500;color:#e3faff;margin-bottom:6px}#preview-effects{font:11px/1.8 Consolas,'Microsoft YaHei UI',sans-serif;color:#8dceba}
@media(max-width:600px){main{padding:20px 0}.stage-hint{margin-top:24px}h1{margin-top:10px}.note{max-width:270px}}
</style></head><body><main>
<span class="eyebrow">TERMINAL / PRESENTATION STUDY</span><h1>同一终端，两种外观。</h1>
<p>原有浮动入口、八项轮盘与终端视窗。<br>学战以六边节点连接；落第保留黑白 ADV。</p>
<div class="controls"><button data-world="asterisk">学战存档</button><button data-world="rakudai">落第存档</button><button data-world="unselected">未选开局</button></div>
<label>学园配色<br><select id="preview-school"><option value="0">星导馆学园</option><option value="1">圣嘉莱多瓦思学园</option><option value="2">界龙第七学院</option><option value="3">雷渥夫黑学园</option><option value="4">阿勒坎特学园</option></select></label>
<div class="controls"><button id="preview-open">展开操作轮盘 ↗</button><button id="preview-home">打开终端总览</button></div>
<div class="stage-hint"><b>外观自由选，档案跟随本局。</b>打开终端，在顶部选择「跟随本局／黑白 ADV／六花科技」。<br>上方按钮只切换预览存档，不是样式开关。</div>
<p class="note">只读外观预览，使用独立样本。<br>正式 MVU 字段、剧情分流与写入尚未接入。</p><output id="preview-effects"></output>
</main><script src="./asterisk-preview-fixture.js"></script><script src="./asterisk-preview-runtime.js"></script></body></html>`;
if (extractScripts(html).length !== 2) throw new Error('预览外层脚本数量不符');
fs.writeFileSync(path.join(output, 'asterisk-shell-preview.html'), html);
console.log('已生成实际宿主轮盘预览：' + path.join(output, 'asterisk-shell-preview.html'));
console.log('正式交付 JSON 未改动；模型连接由 CSP 禁止，写入接口为拒绝桩。');
