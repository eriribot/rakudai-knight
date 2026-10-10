import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';
import { buildKnightAvatarCatalog } from './knight-avatars.mjs';
import { buildTerminal, extractScripts } from './bundle.mjs';

const results = [];
function check(name, run) {
  try { run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); }
}
const catalog = buildKnightAvatarCatalog();
const listeners = new Map();
const realm = vm.createContext({
  document: { getElementById: () => null, addEventListener: (type, handler) => listeners.set(type, handler) },
  addEventListener() {}, setTimeout, clearTimeout, console,
});
realm.window = realm;
const built = buildTerminal();
vm.runInContext(extractScripts(built.html)[0].content, realm);
const ids = Object.keys(catalog.entries);
const plain = ids.find(id => !catalog.entries[id].hasShieldFrame && !catalog.entries[id].prepared);
const prepared = ids.find(id => !catalog.entries[id].hasShieldFrame && catalog.entries[id].prepared);
const alias = id => Object.keys(catalog.byName).find(key => catalog.byName[key] === id);
function images(html) {
  const found = [];
  function visit(node) {
    if (node.tagName === 'img') found.push(Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value])));
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parseFragment(html)); return found;
}

check('实际构建按清单输出本地内联或 HTTPS 头像，页面使用同一份目录', () => {
  assert.ok(ids.length > 0);
  for (const id of ids) assert.match(catalog.entries[id].src, /^(?:data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+|https:\/\/.+)$/i);
  assert.deepEqual(JSON.parse(JSON.stringify(realm.RK_KNIGHT_AVATARS)), JSON.parse(JSON.stringify(catalog)));
});
check('全名与清单别名匹配，空白和中点等价；不把同姓 OC 匹配为正典人物', () => {
  const key = alias(ids[0]);
  assert.equal(realm.resolveKnightAvatar(key), realm.resolveKnightAvatar(' ' + key.split('').join('·') + ' '));
  assert.equal(realm.resolveKnightAvatar('未登记的原创同伴'), null);
  assert.equal(realm.resolveKnightAvatar(key.slice(0, 1) + '原创同伴'), null);
  const html = realm.renderCompanionAvatar('未登记的原创同伴');
  assert.equal(images(html).length, 0); assert.match(html, />未<\/div>/);
});
check('黑骑士 Iris 与有栖院 Alice 以完整别名消歧，同译裸名和共用称号保留首字回退', () => {
  const iris = realm.RK_KNIGHT_AVATARS.entries.iris;
  const nagi = realm.RK_KNIGHT_AVATARS.entries.nagi;
  assert.ok(iris, '黑骑士必须具有独立的 iris 人物 ID');
  assert.ok(nagi, '有栖院必须保留 nagi 人物 ID');
  assert.notEqual(iris.src, nagi.src, '两个人物不能复用同一实际头像');
  for (const name of ['艾莉丝·阿斯卡里德', '艾莉絲·阿斯卡里德', '艾莉丝·格尔', '艾莉絲·格爾',
    '艾莉丝·格尔·阿斯卡里德', '艾莉絲·格爾·阿斯卡里德',
    '阿斯卡里德', 'Iris Ascarid', 'Iris Gaule', 'アイリス・アスカリッド', 'アイリス・ゴール', '黑骑士艾莉丝', '黑騎士艾莉絲']) {
    assert.equal(realm.resolveKnightAvatar(name), iris, name + ' 应指向黑骑士');
    assert.equal(images(realm.renderCompanionAvatar(name))[0].src, iris.src);
  }
  for (const name of ['有栖院凪', '有栖院', '有栖院艾莉丝', '有栖院艾莉絲', '爱丽丝', '愛麗絲', 'Alice', 'Alice Arisuin']) {
    assert.equal(realm.resolveKnightAvatar(name), nagi, name + ' 应指向有栖院');
    assert.equal(images(realm.renderCompanionAvatar(name))[0].src, nagi.src);
  }
  for (const name of ['艾莉丝', '艾莉絲', '黑骑士', '黑騎士']) {
    assert.equal(catalog.byName[name], undefined, '同译裸名或共用称号不得绑定任一人物');
    assert.equal(realm.resolveKnightAvatar(name), null);
    const html = realm.renderCompanionAvatar(name);
    assert.equal(images(html).length, 0); assert.match(html, new RegExp('>' + name.slice(0, 1) + '<\\/div>'));
  }
});
check('本次四名 EPUB 人物有独立 ID 与完整合成盾图，不再裁切人物', () => {
  const characters = [['iris', '艾莉丝·阿斯卡里德'], ['uri', '多多良幽衣'], ['or_gaule', '欧尔·格尔'], ['wallenstein', '华伦斯坦']];
  const sources = new Set();
  for (const [id, name] of characters) {
    const avatar = realm.RK_KNIGHT_AVATARS.entries[id];
    assert.ok(avatar, name + ' 的独立头像缺失');
    assert.equal(realm.resolveKnightAvatar(name), avatar);
    assert.equal(avatar.prepared, true, name + ' 应使用完整合成盾图');
    assert.equal(avatar.hasShieldFrame, false, name + ' 的原图来源状态应保留');
    const html = realm.renderCompanionAvatar(name);
    const nodes = images(html);
    assert.match(html, /rk-knight-avatar--native/);
    assert.doesNotMatch(html, /mask-image:|transform:scale/);
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0].src, avatar.src);
    assert.equal(nodes[0].style, undefined);
    sources.add(avatar.src);
  }
  assert.equal(sources.size, characters.length, '新增人物应有各自的实际头像');
});
check('已补入小说头像集合的姓名对应独立完整 PNG，保留来源与框分层', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../../resource/knightavatars/manifest.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
  const characters = [
    ['kiriko', ['药师雾子', '藥師霧子']],
    ['sara', ['莎拉·布拉德莉莉']],
    ['rinna', ['风祭凛奈', '風祭凜奈', '風祭凛奈', '风祭凜奈', '凛奈', '凜奈', 'Rinna Kazamatsuri']],
    ['ein', ['艾茵·阿伯伦特', '艾茵·阿伯倫特']],
    ['rai', ['碎城雷']],
    ['momiji', ['浅木椛', '淺木椛', '浅桦', '淺樺']],
    ['byakuya', ['城之崎白夜']],
    ['mikoto', ['鹤屋美琴', '鶴屋美琴', 'Mikoto Tsuruya']],
    ['xiaoli', ['福小莉', 'Fu Xiaoli', 'Xiaoli Fu']],
    ['charlotte', ['夏洛特', '夏洛特·科黛', '夏洛特・科黛', '夏洛特•科黛', 'Charlotte Cordé', 'Charlotte Corde']],
  ];
  const files = new Set(), sources = new Set();
  for (const [id, names] of characters) {
    const record = manifest.characters.find(character => character.id === id);
    const avatar = realm.RK_KNIGHT_AVATARS.entries[id];
    assert.ok(record && avatar, id + ' 的真实清单或运行头像缺失');
    assert.equal(record.hasShieldFrame, false);
    assert.equal(avatar.hasShieldFrame, false);
    assert.equal(avatar.prepared, true, id + ' 应使用已生成的完整盾图');
    assert.equal(path.extname(record.displayFile).toLowerCase(), '.png');
    const pixels = fs.readFileSync(new URL('../../resource/knightavatars/' + record.displayFile, import.meta.url));
    assert.ok(pixels.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), id + ' 的显示文件应是真实 PNG');
    files.add(record.displayFile); sources.add(avatar.src);
    for (const name of names) {
      assert.equal(realm.resolveKnightAvatar(name), avatar, name + ' 应对应 ' + id);
      const html = realm.renderCompanionAvatar(name);
      const nodes = images(html);
      assert.match(html, /rk-knight-avatar--native/);
      assert.doesNotMatch(html, /mask-image:|transform:scale/);
      assert.equal(nodes.length, 2);
      assert.equal(nodes[0].src, avatar.src);
      assert.equal(nodes[0].style, undefined);
      assert.match(nodes[1].class, /rk-avatar-frame/);
      assert.equal(nodes[1].src, realm.RK_KNIGHT_AVATARS.shield.src);
    }
  }
  assert.equal(files.size, characters.length, '已补入人物不能引用同一个 prepared PNG');
  assert.equal(sources.size, characters.length, '已补入人物应显示彼此不同的实际头像');
  const yuudaiRecord = manifest.characters.find(character => character.id === 'yuudai');
  const yuudai = realm.RK_KNIGHT_AVATARS.entries.yuudai;
  assert.ok(yuudaiRecord && yuudai, '诸星雄大的原版头像必须保留');
  assert.equal(yuudaiRecord.file, 'yuudai.png');
  assert.equal(yuudaiRecord.hasShieldFrame, true);
  assert.equal(yuudai.hasShieldFrame, true);
  assert.equal(yuudai.prepared, false);
  const original = fs.readFileSync(new URL('../../resource/knightavatars/yuudai.png', import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'), '48ecaae18cbbf038b6a5bdf483ad31742557dc482804cf919d0151ab9b0865ae', '诸星原始盾图不可被新人物合照替换');
  for (const name of ['诸星雄大', '諸星雄大']) {
    assert.equal(realm.resolveKnightAvatar(name), yuudai);
    const nodes = images(realm.renderCompanionAvatar(name));
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].src, yuudai.src);
  }
});
check('宁音的简繁姓名匹配同一人物近景，并套用透明盾框', () => {
  const nene = realm.resolveKnightAvatar('西京宁音');
  assert.ok(nene, '宁音的已核实头像必须进入清单');
  assert.equal(realm.resolveKnightAvatar('西京寧音'), nene);
  const html = realm.renderCompanionAvatar('西京寧音');
  assert.match(html, nene.prepared ? /rk-knight-avatar--native/ : /rk-knight-avatar--plain/);
  assert.equal(images(html).length, 2);
});
check('自带盾框保留整图，无盾框使用本地框；小通讯录共用匹配', () => {
  for (const id of ids.filter(id => catalog.entries[id].hasShieldFrame)) {
    const html = realm.renderCompanionAvatar(alias(id));
    assert.match(html, /rk-knight-avatar--native/); assert.equal(images(html).length, 1, id + ' 的官方原图不叠框');
  }
  if (plain) {
    const html = realm.renderCompanionAvatar(alias(plain), true);
    assert.match(html, /rk-knight-avatar--plain/); assert.match(html, /rk-knight-avatar--compact/);
    assert.equal(images(html).length, 2); assert.match(catalog.shield.src, /^(?:data:image\/|https:\/\/)/i);
  }
  if (prepared) {
    const html = realm.renderCompanionAvatar(alias(prepared), true);
    assert.match(html, /rk-knight-avatar--native/); assert.equal(images(html).length, 2);
    assert.doesNotMatch(html, /rk-avatar-portrait--masked|transform:scale/);
  }
});
check('头像或装饰框加载失败均切回首字，重复刷新无需逐张绑定', () => {
  const classes = new Set();
  const wrapper = { classList: { add: name => classes.add(name) } };
  const target = { matches: () => true, closest: () => wrapper };
  listeners.get('load')({ target }); assert.ok(classes.has('rk-avatar-ready'));
  listeners.get('error')({ target }); assert.ok(classes.has('rk-avatar-failed'));
  listeners.get('error')({ target: {} });
});
check('显示头像不会预填名册或改动游戏状态，未知名字作为惰性文本显示', () => {
  const before = JSON.stringify(realm.stat);
  realm.renderCompanionAvatar(alias(ids[0]));
  assert.equal(JSON.stringify(realm.stat), before);
  const html = realm.renderCompanionAvatar('<img onerror=alert(1)>');
  assert.equal(images(html).length, 0); assert.match(html, /&lt;/);
});
const tempRoot = fs.realpathSync(os.tmpdir());
const temp = fs.mkdtempSync(path.join(tempRoot, 'rakudai-avatar-test-'));
try {
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
  const inner = path.join(temp, 'assets'); fs.mkdirSync(inner);
  fs.writeFileSync(path.join(inner, 'pixel.png'), pixel);
  const displayPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lSMAAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync(path.join(inner, 'prepared.png'), displayPixel);
  fs.writeFileSync(path.join(inner, 'mask.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path fill="white" d="M0 0H1V1H0Z"/></svg>');
  fs.writeFileSync(path.join(temp, 'outside.png'), pixel);
  const person = { id: 'a', name: '同伴甲', aliases: ['甲'], file: 'pixel.png', hasShieldFrame: true };
  const write = (characters, shieldFrame) => fs.writeFileSync(path.join(inner, 'manifest.json'), JSON.stringify({ schemaVersion: 1, characters, shieldFrame }));
  check('图床地址优先且不内嵌大图回退，未填与空字符串保留本地内联', () => {
    const address = 'https://cdn.example.test/avatar.png';
    write([{ ...person, imageUrl: '  ' + address + '  ' }]);
    const remote = buildKnightAvatarCatalog(inner);
    assert.equal(remote.entries.a.src, address);
    assert.ok(!JSON.stringify(remote).includes('data:image/png;base64,'));
    for (const imageUrl of [undefined, '']) {
      write([{ ...person, imageUrl }]);
      assert.ok(buildKnightAvatarCatalog(inner).entries.a.src.startsWith('data:image/png;base64,'));
    }
    write([{ ...person, imageUrl: address, displayFile: 'prepared.png', hasShieldFrame: false }], { file: 'pixel.png' });
    const preparedCatalog = buildKnightAvatarCatalog(inner);
    assert.equal(preparedCatalog.entries.a.prepared, true);
    assert.equal(preparedCatalog.entries.a.src, address);
    assert.ok(preparedCatalog.shield, '全部非原版人物均合成后仍需框的对比层');
  });
  check('合成图使用 displayFile 位元组，渲染不二次裁切并保留独立框对比层', () => {
    write([{ ...person, hasShieldFrame: false, displayFile: 'prepared.png', portraitScale: 1.8 }],
      { file: 'pixel.png', maskFile: 'mask.svg', aperture: { x: 10, y: 20, width: 80, height: 60 } });
    const preparedCatalog = buildKnightAvatarCatalog(inner);
    assert.equal(preparedCatalog.entries.a.src, 'data:image/png;base64,' + displayPixel.toString('base64'));
    assert.notEqual(preparedCatalog.entries.a.src, 'data:image/png;base64,' + pixel.toString('base64'));
    assert.ok(preparedCatalog.shield);
    const previous = realm.RK_KNIGHT_AVATARS;
    try {
      realm.RK_KNIGHT_AVATARS = preparedCatalog;
      const html = realm.renderCompanionAvatar('同伴甲');
      const nodes = images(html);
      assert.match(html, /rk-knight-avatar--native/);
      assert.doesNotMatch(html, /rk-avatar-portrait--masked|mask-image:|transform:scale/);
      assert.equal(nodes.length, 2);
      assert.equal(nodes[0].src, preparedCatalog.entries.a.src);
      assert.equal(nodes[0].style, undefined);
      assert.match(nodes[1].class, /rk-avatar-frame/);
      assert.equal(nodes[1].src, preparedCatalog.shield.src);
    } finally { realm.RK_KNIGHT_AVATARS = previous; }
  });
  check('盾框也可用图床，SVG 遮罩仍在本地内联', () => {
    const address = 'https://cdn.example.test/frame.png';
    write([{ ...person, hasShieldFrame: false }], { file: 'pixel.png', imageUrl: address, maskFile: 'mask.svg' });
    const remote = buildKnightAvatarCatalog(inner);
    assert.equal(remote.shield.src, address);
    assert.ok(remote.shield.mask.startsWith('data:image/svg+xml;base64,'));
    for (const imageUrl of [undefined, '']) {
      write([{ ...person, hasShieldFrame: false }], { file: 'pixel.png', imageUrl });
      assert.ok(buildKnightAvatarCatalog(inner).shield.src.startsWith('data:image/png;base64,'));
    }
  });
  check('人物与盾框地址拒绝其他协议、URL 凭证及无效类型', () => {
    for (const imageUrl of ['javascript:alert(1)', 'http://cdn.example.test/a.png', 'https://user:secret@cdn.example.test/a.png', 'https://user@cdn.example.test/a.png', '   ', 42, null]) {
      write([{ ...person, imageUrl }]);
      assert.throws(() => buildKnightAvatarCatalog(inner), /人物 a\.imageUrl/);
      write([{ ...person, hasShieldFrame: false }], { file: 'pixel.png', imageUrl });
      assert.throws(() => buildKnightAvatarCatalog(inner), /盾框 shieldFrame\.imageUrl/);
    }
    write([person], { file: 'pixel.png', imageUrl: 'javascript:alert(1)' });
    assert.throws(() => buildKnightAvatarCatalog(inner), /盾框 shieldFrame\.imageUrl/);
  });
  check('图床模式共用原渲染器，URL 中引号与 HTML 字符不会新增标签或属性', () => {
    const address = 'https://cdn.example.test/avatar.png?caption="\x3e\x3cimg\x3e&track=1';
    const frameAddress = 'https://cdn.example.test/frame.png?caption="\x3e\x3cimg\x3e&track=2';
    write([{ ...person, imageUrl: address, hasShieldFrame: false }], { file: 'pixel.png', imageUrl: frameAddress, maskFile: 'mask.svg' });
    const previous = realm.RK_KNIGHT_AVATARS;
    try {
      realm.RK_KNIGHT_AVATARS = buildKnightAvatarCatalog(inner);
      const html = realm.renderCompanionAvatar('同伴甲');
      const nodes = images(html);
      assert.equal(nodes.length, 2);
      assert.equal(nodes[0].src, address); assert.equal(nodes[1].src, frameAddress);
      for (const node of nodes) assert.equal(node.onerror, undefined);
      assert.match(html, /&quot;&gt;&lt;img&gt;&amp;track=/);
    } finally { realm.RK_KNIGHT_AVATARS = previous; }
  });
  check('合成图图床模式保留原来源、整图与框分层，不内嵌合成位图回退', () => {
    const address = 'https://cdn.example.test/prepared.png?caption="\x3e\x3cimg\x3e&track=1';
    const frameAddress = 'https://cdn.example.test/frame.png';
    write([{ ...person, imageUrl: address, hasShieldFrame: false, displayFile: 'prepared.png', portraitScale: 1.8 }],
      { file: 'pixel.png', imageUrl: frameAddress, maskFile: 'mask.svg' });
    const remote = buildKnightAvatarCatalog(inner);
    assert.equal(remote.entries.a.hasShieldFrame, false);
    assert.equal(remote.entries.a.prepared, true);
    assert.equal(remote.entries.a.src, address);
    assert.equal(remote.shield.src, frameAddress);
    assert.ok(!JSON.stringify(remote).includes('data:image/png;base64,'));
    const previous = realm.RK_KNIGHT_AVATARS;
    try {
      realm.RK_KNIGHT_AVATARS = remote;
      const html = realm.renderCompanionAvatar('同伴甲', true);
      assert.doesNotMatch(html, /mask-image:|transform:scale/);
      assert.equal(images(html).length, 2);
      assert.equal(images(html)[0].src, address);
      assert.match(html, /&quot;&gt;&lt;img&gt;&amp;track=/);
    } finally { realm.RK_KNIGHT_AVATARS = previous; }
  });
  check('构建拒绝互相覆盖的人物别名', () => {
    write([person, { ...person, id: 'b', name: '同伴乙' }]);
    assert.throws(() => buildKnightAvatarCatalog(inner), /别名冲突/);
  });
  check('构建拒绝越出素材目录的文件及缺失图片', () => {
    write([{ ...person, file: '../outside.png', imageUrl: 'https://cdn.example.test/a.png' }]);
    assert.throws(() => buildKnightAvatarCatalog(inner), /越出素材目录/);
    write([{ ...person, file: 'missing.png', imageUrl: 'https://cdn.example.test/a.png' }]);
    assert.throws(() => buildKnightAvatarCatalog(inner), /ENOENT/);
    write([{ ...person, hasShieldFrame: false }], { file: '../outside.png', imageUrl: 'https://cdn.example.test/frame.png' });
    assert.throws(() => buildKnightAvatarCatalog(inner), /越出素材目录/);
    write([{ ...person, hasShieldFrame: false }], { file: 'missing.png', imageUrl: 'https://cdn.example.test/frame.png' });
    assert.throws(() => buildKnightAvatarCatalog(inner), /ENOENT/);
  });
} finally {
  const resolved = fs.realpathSync(temp);
  assert.equal(path.dirname(resolved), tempRoot);
  assert.ok(path.basename(resolved).startsWith('rakudai-avatar-test-'));
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log(JSON.stringify({ evidence: '真实构建目录 + HTTPS 选择与本地回退 + V8 页面转义与回退；未连接酒馆', passed: results.filter(item => item.passed).length, total: results.length, results }, null, 2));
if (results.some(item => !item.passed)) process.exitCode = 1;
