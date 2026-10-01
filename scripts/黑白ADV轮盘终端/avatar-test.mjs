import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
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
