const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

class Element extends EventTarget {
  constructor() { super(); this.dataset = {}; this.style = {}; this.hidden = true; this.isConnected = true; this.children = []; }
  focus() {}
  replaceChildren(...children) { this.children = children; }
  append(child) { this.children.push(child); }
  removeAttribute() {}
}
class AudioStub extends Element {
  constructor() { super(); this.paused = true; this.currentTime = 0; this.ended = false; this.calls = 0; this.deferred = null; }
  play() {
    this.calls++;
    this.paused = false;
    if (this.defer) return new Promise(resolve => { this.deferred = () => { this.paused = false; resolve(); }; });
    return Promise.resolve();
  }
  pause() { this.paused = true; }
}
class ImageStub extends Element {
  set src(value) { this.url = value; }
}
class CustomEventStub extends Event { constructor(type, options) { super(type); this.detail = options.detail; } }
const elements = Object.fromEntries(['shura-intro','shura-visual','shura-skip','music-status'].map(id => [id, new Element()]));
elements['bgm-normal'] = new AudioStub();
elements['bgm-shura'] = new AudioStub();
const window = new EventTarget();
window.matchMedia = () => ({matches: false});
const context = {window, document: {getElementById: id => elements[id], activeElement: new Element()},
  Audio: AudioStub, Image: ImageStub, CustomEvent: CustomEventStub, location: {protocol:'file:'},
  setTimeout, clearTimeout, URL, console};
vm.runInNewContext(fs.readFileSync('cardgame/media.js', 'utf8'), context);
const media = window.BattleMedia;
const normal = elements['bgm-normal'], shura = elements['bgm-shura'];
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  assert.equal(media.state.activated, false);
  assert.equal(normal.paused, true);
  media.unlock();
  assert.equal(normal.paused, false);
  const cancelled = media.shuraIntro();
  assert.equal(normal.paused, true);
  assert.equal(shura.paused, false);
  assert.equal(elements['shura-intro'].hidden, false);
  const staleLoad = elements['shura-visual'].children[0].onload;
  media.reset();
  staleLoad();
  assert.equal(await cancelled, false);
  assert.equal(elements['shura-intro'].hidden, true);
  assert.equal(normal.paused, false);
  const skipped = media.shuraIntro();
  media.setEnabled(false);
  media.skipIntro();
  assert.equal(await skipped, true);
  assert.equal(shura.paused, true);
  assert.equal(media.state.enabled, false);
  media.reset();
  assert.equal(normal.paused, true);
  media.setEnabled(true);
  assert.equal(normal.paused, false);
  const finished = media.shuraIntro();
  media.finish();
  assert.equal(await finished, false);
  assert.equal(normal.paused, true);
  assert.equal(shura.paused, true);
  assert.equal(media.state.playing, false);
  media.reset();
  shura.defer = true;
  const racing = media.shuraIntro();
  media.reset();
  shura.deferred();
  await tick();
  assert.equal(await racing, false);
  assert.equal(shura.paused, true);
  assert.equal(normal.paused, false);
  shura.defer = false;
  const ended = media.shuraIntro();
  media.skipIntro();
  await ended;
  shura.dispatchEvent(new Event('ended'));
  assert.equal(media.state.mode, 'normal');
  assert.equal(shura.paused, true);
  assert.equal(normal.paused, false);
  const failed = media.shuraIntro();
  elements['shura-visual'].children[0].onerror();
  assert.equal(await failed, true);
  assert.equal(elements['shura-intro'].hidden, true);
  media.finish();
  console.log('PASS: unlock, mode handoff, cancel during load, stale load, skip, mute/reset, finish, late play race, ended fallback, GIF failure.');
})().catch(error => {console.error(error); process.exitCode = 1;});
