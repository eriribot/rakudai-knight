import fs from 'node:fs';
const manifestFile = 'resource/knightavatars/manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const rinna = manifest.characters.find(c => c.id === 'rinna');
rinna.aliases = [...new Set([...rinna.aliases, '凛奈', '凜奈', 'Rinna Kazamatsuri'])];
const xiaoli = manifest.characters.find(c => c.id === 'xiaoli');
Object.assign(xiaoli, {
  file: 'novel/xiaoli-vol18-original.jpg',
  sourceEpub: '39688/落第骑士英雄谭 - 18.epub',
  sourceMember: 'OEBPS/Images/190226.jpg',
  width: 1120,
  height: 1600,
  sha256: '285689368c9c5e4599a63a3e548dd6bea507ad1d34315bb4c547bf0e14f34257',
  imageUrl: '',
  imageHostStatus: {
    status: 'pending-upload-new-portrait',
    intendedUrl: 'https://eriribot.github.io/rakudai-knight/resource/knightavatars/prepared/xiaoli.png',
    note: '此地址原为第12卷版本；第18卷新头像上传后再填写 imageUrl，当前内联本地新图。'
  },
  colorization: {
    type: 'ai-colorized-derivative',
    mode: 'built-in',
    file: 'color/xiaoli-vol18-colorized.png',
    record: 'research/epub/xiaoli-vol18-colorization.json',
    note: '第18卷中华服原黑白图上色；黑长发与偏深肤色依据原文，两枚金钱饰片金色为用户指定，白金服装与棕色瞳孔为衍生选色。非官方原生彩图。'
  }
});
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
const fitFile = 'scripts/黑白ADV轮盘终端/avatar-fit.json';
const text = fs.readFileSync(fitFile, 'utf8');
const fit = {
  sourceFile: 'color/xiaoli-vol18-colorized.png',
  levelEyes: [[291, 504], [495, 435]],
  window: [400, 150, 820, 1000],
  eye: [780, 571],
  protect: [[672, 571], [887, 571], [781, 720], [805, 780], [1122, 297], [487, 380]],
  eyeTarget: 0.44,
  eyeTargetX: 0.49
};
const updated = text.replace(/"xiaoli"\s*:\s*\{[^\r\n]+\}/, '"xiaoli": ' + JSON.stringify(fit));
if (updated === text) throw new Error('Failed to replace Xiaoli crop configuration');
fs.writeFileSync(fitFile, updated);
const recordFile = 'resource/knightavatars/research/epub/xiaoli-vol18-colorization.json';
const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
record.consumption = {
  status: 'active-avatar-variant',
  manifest: 'resource/knightavatars/manifest.json#xiaoli',
  displayFile: 'resource/knightavatars/prepared/xiaoli.png',
  previousVariant: {
    original: 'resource/knightavatars/novel/xiaoli-original.jpg',
    colorized: 'resource/knightavatars/color/xiaoli-colorized.png',
    shield: 'resource/knightavatars/research/review/xiaoli-vol12-shield-preserved.png'
  },
  note: '按用户“manifest老位置”接回同一 xiaoli 身份，原第12卷资料保留。新图尚待图床上传。'
};
fs.writeFileSync(recordFile, JSON.stringify(record, null, 2) + '\n');
console.log('Registered Rinna short names and Xiaoli volume-18 variant.');
