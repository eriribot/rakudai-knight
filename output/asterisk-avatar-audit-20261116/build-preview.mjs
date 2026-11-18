import fs from 'node:fs';
import {applyRules} from '../../scripts/正文气泡/build.mjs';

const dir = 'output/asterisk-avatar-audit-20261116';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const added = read(`${dir}/added.json`);
const sources = read('resource/asteriskavatars/sources.json').characters;
const rules = ['dialogue-bubbles', 'dialogue-player-candidates', 'dialogue-bubble-style'].map(name => read(`scripts/正文气泡/发布/components/${name}.regex.json`));
const local = text => text.replaceAll('https://eriribot.github.io/rakudai-knight/', '../../');
const bubble = name => local(applyRules(`${name}:「头像显示测试」`, rules));
const first = bubble(added[0].name);
const css = first.match(/<style>[\s\S]*?<\/style>/)[0];
const cards = added.map(person => {
  const kind = sources.find(source => source.id === person.id).kind;
  const type = kind.includes('设定') || kind.includes('expression') ? '动画官网表情图' : '动画正片';
  return `<article><div class="face">${bubble(person.name).replace(/<pre hidden>[\s\S]*?<\/pre>/, '')}</div><h2>${person.name}</h2><p>${type}</p></article>`;
}).join('\n');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学战角色头像 · 本轮补齐</title>
<style>*{box-sizing:border-box}body{margin:0;background:#0f1c25;color:#eef9ff;font:15px/1.5 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1080px;margin:auto;padding:26px}h1{font-size:27px;margin:0 0 5px}header p{margin:0;color:#9abac8}header{margin-bottom:20px}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}article{padding:12px 8px;text-align:center;background:#152c39;border:1px solid #315767;border-radius:6px}article h2{font-size:14px;margin:7px 0 2px}article p{color:#9fbcc9;font-size:12px;margin:0}.face{height:135px;display:flex;justify-content:center;align-items:center}.face [data-rkd="bubble"]{margin:0!important}.face [data-rkd-avatar]{zoom:1.9}.face [data-rkd-body]{display:none}.note{border-left:3px solid #d6a14a;padding:12px 15px;background:#192832;margin-top:20px;color:#c5d6de;font-size:13px}footer{color:#87aab9;font-size:12px;margin-top:14px}@media(max-width:650px){main{padding:16px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}} </style>${css}
<main><header><h1>学战都市 · 动画头像补齐</h1><p>新增 20 人 · 现有 43 / 44 人具备头像 · 六边框脸部取景</p></header><section class="grid">${cards}</section><div class="note">待补：沙沙宫创一。本轮尚未找到可核验的本人脸图，保留缺图状态。</div><footer>由正式发布的 01 / 03 规则渲染；为便于检查头像放大 1.9 倍，原图字节未修改。本地图片预览，尚未导入酒馆或部署 Git Pages。</footer></main></html>`;
fs.writeFileSync(`${dir}/preview.html`, html);
console.log(`${dir}/preview.html`);
