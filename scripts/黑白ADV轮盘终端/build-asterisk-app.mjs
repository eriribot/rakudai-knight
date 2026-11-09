import fs from 'node:fs';
import vm from 'node:vm';
const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

export function buildAsteriskApp() {
  let script = read('terminal-asterisk.js');
  // 与正文气泡、黑白名册共用素材和别名；只打包小型索引，不重复内嵌头像。
  const asterisk = JSON.parse(read('../正文气泡/asterisk-portraits.json'));
  const knights = JSON.parse(read('../../resource/knightavatars/manifest.json'));
  const portraits = { byName: {}, entries: {} };
  for (const [world, characters] of [['rakudai', knights.characters], ['asterisk', asterisk.characters]]) {
    for (const person of characters) {
      if (!person.imageUrl) continue;
      const id = world + '-' + person.id;
      let style = '';
      if (world === 'asterisk' && person.portraitCrop) {
        const [x, y, width, height] = person.portraitCrop;
        style = `width:${person.width / width * 100}%;height:${person.height / height * 100}%;left:${-x / width * 100}%;top:${-y / height * 100}%;`;
      }
      portraits.entries[id] = { src: person.imageUrl, world, style };
      for (const name of [person.name, ...person.aliases]) portraits.byName[name.normalize('NFKC').replace(/[\s·・･‧•．.]/g, '').toLowerCase()] = id;
    }
  }
  script = script.replace('/*__AW_CONTACT_PORTRAITS__*/ null', JSON.stringify(portraits));
  const assets = {
    EMBLEM_SEIDOUKAN: 'emblem-seidoukan.png', EMBLEM_GALLARDWORTH: 'emblem-gallardworth.png',
    EMBLEM_JIELONG: 'emblem-jielong.png', EMBLEM_REWOLF: 'emblem-rewolf.png',
    EMBLEM_ARLEQUINT: 'emblem-arlequint.png', HEROINES: 'entry-cover-asterisk-original.jpg'
  };
  for (const [key, file] of Object.entries(assets)) {
    const bytes = fs.readFileSync(new URL('../../第一卷-世界书整理/开局网页正则替换/assets/asterisk/' + file, import.meta.url));
    const data = 'data:image/' + (file.endsWith('.jpg') ? 'jpeg' : 'png') + ';base64,' + bytes.toString('base64');
    script = script.replaceAll('__AW_ASSET_' + key + '__', data);
  }
  const css = read('terminal-asterisk.css') + '\n' + read('terminal-cross-theme.css');
  if (/<\/script[\s/>]|<!--|<script[\s/>]/i.test(script)) throw new Error('学战脚本包含 HTML 终止片段');
  if (/<\/style[\s/>]/i.test(css)) throw new Error('学战样式包含 HTML 终止片段');
  new vm.Script(script, { filename: 'terminal-asterisk.js' });
  return read('terminal-asterisk.html')
    .replace('<link rel="stylesheet" href="./terminal-asterisk.css">', '<style>' + css + '</style>')
    .replace('<script src="./terminal-asterisk.js"></script>', '<script>' + script + '</script>');
}
