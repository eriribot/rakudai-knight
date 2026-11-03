const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(__dirname, 'asterisk-novel.js'), 'utf8');
const html = fs.readFileSync(path.join(root, '第一卷-世界书整理/开局网页正则替换/index.html'), 'utf8');
assert.ok(html.replaceAll('\r\n', '\n').includes(source.replaceAll('\r\n', '\n').trim()), 'tests use integrated media functions');
const media = JSON.parse(html.match(/var OPENING_ASTERISK_MEDIA=(\{[^\n]+\});/)[1]);
function node() {
  return { children: [], dataset: { originalStory: 'original story' }, innerHTML: '', attrs: {},
    append(child) { this.children.push(child); }, replaceChildren() { this.children = []; }, setAttribute(name, value) { this.attrs[name] = value; }, getAttribute(name) { return this.attrs[name] ?? null; } };
}
function page(paused, activeOp = false) {
  const nodes = new Map();
  const get = key => { if (!nodes.has(key)) nodes.set(key, node()); return nodes.get(key); };
  const story = [node(), node()];
  const audio = { paused, pending: [], playCalls: 0, loads: 0, src: 'https://example.test/rakudai.mp3',
    pause() { this.paused = true; }, load() { this.loads++; },
    play() { this.paused = false; this.playCalls++; return new Promise((resolve, reject) => this.pending.push({ resolve, reject })); } };
  let badges = 0, replays = 0;
  const c = { OPENING_ASTERISK_MEDIA: media, bgmAudio: audio, activeOpeningWorld: 'asterisk', currentScene: 1,
    window: { __openingOpActive: activeOp, OpeningPrelude: { replay() { replays++; } } },
    document: { getElementById: get, querySelector: get, querySelectorAll: () => story, createElement: node },
    isAsteriskMode: () => c.activeOpeningWorld === 'asterisk', selectedAcademy: () => ({ name: '星导馆学园' }),
    openingMediaUrl: file => new URL(file, 'https://example.test/assets/asterisk/').href,
    worldText() {}, stopCarousel() {}, closeCinemaMode() {}, clearTimeout() {}, updateBgmUI() {},
    showAutoplayBadge() { badges++; }, configureOpeningPreludeMedia() {}, initCardScene() {}, showSlide() {}, startCarousel() {} };
  vm.createContext(c); vm.runInContext(source, c);
  c.rakudaiNovelMedia = { frame: '', dots: '', covers: [], gallery: [], label: 'original', audio: audio.src };
  c.novelMediaWorld = 'rakudai';
  return { c, audio, badges: () => badges, replays: () => replays };
}
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
(async () => {
  const paused = page(true); paused.c.applyNovelWorld();
  assert.equal(paused.audio.paused, true); assert.equal(paused.audio.playCalls, 0);
  const playing = page(false); playing.c.applyNovelWorld();
  assert.equal(playing.audio.paused, false); assert.equal(playing.audio.playCalls, 1); assert.equal(playing.replays(), 0);
  const duringOp = page(false, true); duringOp.c.applyNovelWorld();
  assert.equal(duringOp.audio.paused, true); assert.equal(duringOp.audio.playCalls, 0);
  const oldLoads = playing.audio.loads; playing.c.applyNovelWorld();
  assert.equal(playing.audio.loads, oldLoads, 'same world/school-only updates do not reload audio');
  playing.c.activeOpeningWorld = 'rakudai'; playing.c.applyNovelWorld();
  playing.audio.pending[0].reject(Object.assign(new Error('old failure'), { name: 'NotAllowedError' })); await flush();
  assert.equal(playing.badges(), 0, 'old world rejection does not alter new world UI');
  playing.audio.pending[1].reject(Object.assign(new Error('new failure'), { name: 'NotAllowedError' })); await flush();
  assert.equal(playing.badges(), 1, 'current blocked play request provides feedback');
  const aborted = page(false); aborted.c.applyNovelWorld();
  aborted.audio.pending[0].reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); await flush();
  assert.equal(aborted.badges(), 0);
  const initial = page(true);
  const logos = [...html.matchAll(/<img\b[^>]*data-world-logo="([^"]+)"[^>]*>/g)].map(match => ({ dataset: { worldLogo: match[1] } }));
  assert.equal(logos.length, 3, 'two navigation logos plus main Asterisk logo');
  assert.equal(logos.filter(logo => logo.dataset.worldLogo === 'asterisk').length, 2);
  initial.c.rakudaiNovelMedia = null;
  initial.c.NOVEL_COVERS = []; initial.c.GALLERY_CARDS = [];
  initial.c.document.querySelectorAll = selector => selector === '[data-world-logo]' ? logos : [];
  initial.c.document.addEventListener = () => {};
  initial.c.window.addEventListener = () => {};
  initial.c.initializeNovelWorld();
  for (const logo of logos) assert.equal(logo.src, initial.c.openingMediaUrl(media.logos[logo.dataset.worldLogo]));
  const report = { passed: true, sourceSha256: crypto.createHash('sha256').update(html).digest('hex'),
    checks: ['paused remains paused', 'playing resumes after source switch', 'no OP replay', 'OP guards BGM playback', 'same-world updates preserve current audio', 'stale BGM errors ignored', 'current playback rejection shows feedback', 'AbortError ignored', 'both navigation logos and main Asterisk logo bind to official image assets'],
    scope: 'Actual integrated novel media functions with deterministic DOM/audio mocks; real audio decoding is browser acceptance.' };
  fs.writeFileSync(path.join(__dirname, 'world-media-validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
