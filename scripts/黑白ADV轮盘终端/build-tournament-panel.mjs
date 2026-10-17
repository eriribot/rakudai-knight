import fs from 'node:fs';
import vm from 'node:vm';

const sourceDirectory = new URL('../../七星剑武祭-晋级面板预览/', import.meta.url);
const read = file => fs.readFileSync(new URL(file, sourceDirectory), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const literal = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const normalizeName = name => name.normalize('NFKC').replace(/[\s·・･‧•．.]/g, '');

function inlineScript(code, file) {
  new vm.Script(code, { filename: 'tournament/' + file });
  if (/<\/script(?:\s|\/|>)|<!--|<script(?:\s|\/|>)/i.test(code)) throw new Error(file + ' 含会截断赛事脚本的文本');
  return '<script>\n' + code + '\n</script>';
}

// 原著回放与当前角色页共用维护源码；不打入示例存档、演示签表或第二份选拔引擎。
export function buildTournamentPanel(knightAvatars) {
  const dataSource = read('data.js');
  const realm = { window: {} };
  new vm.Script(dataSource, { filename: 'tournament/data.js' }).runInNewContext(realm);
  const byName = Object.fromEntries(Object.entries(knightAvatars.byName).map(([name, id]) => [name, knightAvatars.entries[id].src]));
  const portraits = Object.fromEntries(Object.entries(realm.window.TOURNAMENT_DATA.players).flatMap(([id, player]) => {
    const src = byName[normalizeName(player.name)];
    return src ? [[id, src]] : [];
  }));
  const modelSource = read('mvu-model.mjs');
  const readStart = modelSource.indexOf('export function read(');
  const sampleStart = modelSource.indexOf('\nfunction sampleState(', readStart);
  if (readStart < 0 || sampleStart < 0) throw new Error('赛事只读适配函数边界缺失');
  const model = modelSource.slice(readStart, sampleStart).replace(/^export /, '') +
    '\nwindow.RK_PREVIEW_MVU = { read: input => read(input, input.view) };';
  const modules = {
    'data.js': dataSource,
    'portraits.js': 'window.TOURNAMENT_PORTRAITS = ' + literal(portraits) + ';\nwindow.TOURNAMENT_ROLE_PORTRAITS = ' + literal(byName) + ';',
    'mvu-model.js': model,
    'session-ui.js': read('session-ui.js'),
    'app.js': read('app.js'),
  };
  const scripts = [], seen = new Set();
  let html = read('index.html').replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, file) => {
    if (!['style.css', 'session-ui.css'].includes(file)) throw new Error('未知赛事样式：' + file);
    const css = read(file);
    if (/<\/style(?:\s|\/|>)/i.test(css)) throw new Error(file + ' 含会截断赛事样式的文本');
    return '<style>\n' + css + '\n</style>';
  });
  html = html.replace(/<script src="([^"]+)" defer><\/script>/g, (_, file) => {
    if (file === 'session-bracket.js') return '';
    if (!Object.hasOwn(modules, file) || seen.has(file)) throw new Error('未知或重复赛事脚本：' + file);
    seen.add(file);
    scripts.push(inlineScript(modules[file], file));
    return '';
  });
  for (const file of Object.keys(modules)) if (!seen.has(file)) throw new Error('赛事页面未引入模块：' + file);
  html = html.replace('<head>', '<head>\n' + inlineScript('window.RK_TOURNAMENT_EMBEDDED = true;', 'embedded-mode.js'));
  html = html.replace('独立预览 · 未连接酒馆', '本局记录 / 原著档案');
  html = html.replace('</head>', '<style>body{min-height:0}.topbar,.page-footer,.arena-light{display:none}.arena{padding-top:8px}.snapshot-tools>label,#import-snapshot,#snapshot-file{display:none}</style>\n</head>');
  // 内联 script 不支持 defer；等页面节点齐备后按原顺序执行。
  return html.replace('</body>', scripts.join('\n') + '\n</body>');
}
