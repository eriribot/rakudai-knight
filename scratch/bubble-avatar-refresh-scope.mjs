import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const source = 'scripts/正文气泡/发布/components';
const backup = 'scratch/bubble-avatar-before';
const reportDir = 'scripts/正文气泡/验证记录/风祭与夏洛特头像';
fs.mkdirSync(backup, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const files = ['dialogue-bubbles', 'dialogue-player-candidates', 'dialogue-bubble-style'].map(n => n + '.regex.json');
const components = files.map(file => {
  const input = path.join(source, file);
  const raw = fs.readFileSync(input);
  const target = path.join(backup, file);
  if (!fs.existsSync(target)) fs.writeFileSync(target, raw);
  const data = JSON.parse(raw);
  const { findRegex, replaceString, ...preservedFields } = data;
  return { file: input.replaceAll('\\', '/'), sha256: hash(raw), preservedFields };
});
const scope = {
  deliveryMode: 'component', kind: 'regex',
  goal: '正文气泡与头像正确匹配风祭凛奈、风祭简繁短名和夏洛特全名/短名/既有别名',
  sources: ['resource/knightavatars/manifest.json', 'scripts/正文气泡/build.mjs'],
  outputDirectory: source,
  components,
  unchangedScope: ['稳定ID及字段开关', 'OC候选逻辑与保护边界', '变量正则与MVU状态', '整卡与历史气泡发布'],
  acceptance: ['现有所有姓名/别名检查', '发布文件与源码完全一致', '未知或延伸姓名不绑定NPC', '浏览器预览确认风祭与夏洛特的盾形头像'],
  library: { snapshot: '2026-08-18', routeIds: ['sillytavern-render-regex-pipeline', 'sillytavern-component-update'], loadedDocuments: ['ST-A0', 'ST-A2', 'ST-A5', 'ST-A6', 'ST-B2'], adoptedCandidates: [] },
  dialect: 'SillyTavern card RegexScriptData',
  targetVersion: '现有项目固定SillyTavern 1.18.0字段契约，不改字段语义',
  runtimeBoundary: '本次不替用户导入真实酒馆；交付可导入正则与本地预览。'
};
fs.writeFileSync(path.join(reportDir, 'scope-lock.json'), JSON.stringify(scope, null, 2) + '\n');
console.log(JSON.stringify({ deliveryMode: scope.deliveryMode, components: files.length, backup, reportDir }));
