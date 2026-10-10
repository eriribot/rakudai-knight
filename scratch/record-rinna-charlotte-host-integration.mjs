import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const root = 'resource/knightavatars/';
const manifest = JSON.parse(fs.readFileSync(root + 'manifest.json', 'utf8'));
const verification = JSON.parse(fs.readFileSync(root + 'research/github-pages/rinna-charlotte-verification.json', 'utf8'));
const componentDir = 'scripts/正文气泡/发布/components/';
const artifactCheck = JSON.parse(fs.readFileSync('scripts/正文气泡/验证记录/artifact-check.json', 'utf8'));
const terminal = fs.readFileSync('世界书规则/MVU/落第骑士-小手机-v1.3.27.json', 'utf8');
const style = JSON.parse(fs.readFileSync(componentDir + 'dialogue-bubble-style.regex.json', 'utf8'));
for (const image of verification.images) {
  assert.equal(image.status, 'verified-matching-local');
  assert.equal(manifest.characters.find(c => c.id === image.id).imageUrl, image.url);
  assert.ok(terminal.includes(image.url));
  assert.ok(style.replaceString.includes(image.url));
}
const digest = name => crypto.createHash('sha256').update(fs.readFileSync(componentDir + name)).digest('hex');
assert.equal(digest('dialogue-bubbles.regex.json'), '2f61ecf970bf2dd01e067177d1e35fba0a47cab71796374a196d84f6580394ee');
assert.equal(digest('dialogue-player-candidates.regex.json'), 'a548f8b4d27ef1db3ef8a969051833477a05370bbc45af4dbff2fb6194fb1f38');

const portraitFile = root + 'research/review/rinna-charlotte-acceptance.json';
const portrait = JSON.parse(fs.readFileSync(portraitFile, 'utf8'));
portrait.browserPreviewHistory = [...(portrait.browserPreviewHistory || []), portrait.browserPreview];
portrait.browserPreview = {
  url: 'http://127.0.0.1:58635/preview.html?sample=avatars&view=lime',
  status: 'passed-root-visual-review',
  notes: ['凛奈与夏洛特均使用已验证图床URL，浏览器实际加载434×580', '夏洛特盾形头像在LIME名册正常显示'],
  imageObservations: verification.images.map(image => ({ id: image.id, src: image.url, complete: true, width: 434, height: 580 })),
  screenshot: 'research/github-pages/charlotte-host-terminal-preview.jpg'
};
for (const active of portrait.activePortraits) {
  const image = verification.images.find(item => item.id === active.id);
  if (!image) continue;
  active.imageHostStatus = image.status;
  active.imageUrl = image.url;
  active.verificationRecord = 'research/github-pages/rinna-charlotte-verification.json';
}
fs.writeFileSync(portraitFile, JSON.stringify(portrait, null, 2) + '\n');

const bubbleFile = 'scripts/正文气泡/验证记录/风祭与夏洛特头像/acceptance.json';
const bubble = JSON.parse(fs.readFileSync(bubbleFile, 'utf8'));
bubble.browserPreviewHistory = [...(bubble.browserPreviewHistory || []), bubble.browserPreview];
bubble.browserPreview = {
  status: 'passed-local-visual-review',
  url: 'http://127.0.0.1:58636/scripts/正文气泡/发布/preview.html',
  observed: ['风祭气泡使用本地 prepared/rinna.png 预览', '夏洛特·科黛气泡使用本地 prepared/charlotte.png 预览', '两张头像及台词在浏览器完整显示'],
  scope: '便携预览将图床URL映射为相同本地素材；导入03样式含实际图床URL，未替用户导入真实酒馆',
  screenshot: 'resource/knightavatars/research/github-pages/rinna-charlotte-bubble-preview.jpg'
};
bubble.artifacts = artifactCheck.artifacts.map(item => ({ file: item.file.replace('components/', ''), sha256: item.sha256 }));
bubble.imageHostVerification = 'resource/knightavatars/research/github-pages/rinna-charlotte-verification.json';
bubble.nameAndOcRulesUnchangedDuringHostUpdate = true;
fs.writeFileSync(bubbleFile, JSON.stringify(bubble, null, 2) + '\n');
console.log(JSON.stringify({ imageHostUrls: verification.images.map(image => ({ id: image.id, url: image.url })), terminalAndBubbleStyleContainBothUrls: true, nameAndOcRulesUnchanged: true, historicalBrowserEvidencePreserved: true }));
