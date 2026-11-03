import fs from 'node:fs';
import vm from 'node:vm';
const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

export function buildAsteriskApp() {
  let script = read('terminal-asterisk.js');
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
