const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const sourcePath = path.join(root, '第一卷-世界书整理/开局网页正则替换/index.html');
const sourceBytes = fs.readFileSync(sourcePath);
const html = sourceBytes.toString('utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
  .map(match => match[1]).find(body => body.includes('function configureOpeningPreludeMedia'));
assert.ok(script, 'actual assembled prelude script found');
const original = fs.readFileSync(path.join(root, '第一卷-世界书整理/开局页面/index.html'), 'utf8');
const remote = original.match(/id="lkOpeningVideo"[\s\S]*?<source\s+src="([^"]+)"/)[1];
const originalTitleArt = original.match(/class="lk-title-art"\s+src="([^"]+)"/)[1];
const originalTitleLogo = original.match(/class="lk-title-logo"\s+src="([^"]+)"/)[1];
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const rejected = name => Object.assign(new Error(name), { name });

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn, options) {
    const listeners = this.listeners.get(type) || [];
    if (!listeners.some(listener => listener.fn === fn)) listeners.push({ fn, once: !!options?.once });
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(listener => listener.fn !== fn)); }
  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event.type) || [])]) {
      if (listener.once) this.removeEventListener(event.type, listener.fn);
      listener.fn(event);
    }
  }
}
function element(id) {
  const el = new Events();
  Object.assign(el, { id, tagName: 'DIV', attrs: {}, dataset: {}, hidden: false, inert: false, paused: true,
    currentTime: 0, muted: false, pending: [], playCalls: [], loads: 0, innerHTML: '' });
  const classes = new Set();
  el.classList = {
    add: (...values) => values.forEach(value => classes.add(value)),
    remove: (...values) => values.forEach(value => classes.delete(value)),
    contains: value => classes.has(value),
    toggle(value, force) {
      const add = force === undefined ? !classes.has(value) : force;
      if (add) classes.add(value); else classes.delete(value);
      return add;
    }
  };
  el.getAttribute = name => el.attrs[name] ?? null;
  el.setAttribute = (name, value) => { el.attrs[name] = String(value); };
  Object.defineProperty(el, 'src', { get: () => el.attrs.src || '', set: value => { el.attrs.src = String(value); } });
  el.querySelector = selector => selector === 'source' ? { getAttribute: name => name === 'data-src' ? remote : null } : null;
  el.closest = () => null;
  el.focus = () => {};
  el.pause = () => { el.paused = true; };
  el.load = () => { el.loads++; };
  el.play = () => {
    el.paused = false;
    el.playCalls.push({ muted: el.muted, src: el.src });
    if (id !== 'lkOpeningVideo') return Promise.resolve();
    return new Promise((resolve, reject) => el.pending.push({ resolve, reject }));
  };
  return el;
}
function makePage(search = '', hostname = '127.0.0.1', pathname = '/第一卷-世界书整理/开局网页正则替换/index.html', port = '18737') {
  const ids = ['lkPrelude', 'lkOpeningScreen', 'lkTitleScreen', 'lkOpeningVideo', 'lkOpeningVideoBackdrop', 'lkOpSoundGate', 'lkOpSkip', 'lkContinuePrompt', 'bgm-audio'];
  const nodes = Object.fromEntries(ids.map(id => [id, element(id)]));
  const body = element('body'), guide = element('guide');
  const art = element('art'), astArt = element('astArt'), logo = element('logo'), astLogo = element('astLogo'), wordmark = element('wordmark');
  const decorations = [element('titleDivider'), element('titleCross')];
  art.src = originalTitleArt;
  logo.src = originalTitleLogo;
  body.children = [nodes.lkPrelude, guide];
  nodes.lkPrelude.parentElement = body;
  const document = new Events();
  const styleProperties = {};
  Object.assign(document, { readyState: 'loading', body, documentElement: { style: { setProperty(name, value) { styleProperties[name] = value; }, getPropertyValue(name) { return styleProperties[name]; } } },
    getElementById: id => nodes[id], querySelector: selector => ({ '.lk-title-art': art, '.aw-title-original-art': astArt, '.lk-title-logo': logo, '.aw-title-logo': astLogo, '.aw-title-wordmark': wordmark }[selector]),
    querySelectorAll: selector => selector === '.aw-title-divider,.aw-title-cross' ? decorations : [] });
  const window = new Events();
  let timer = 0;
  const timers = new Map();
  Object.assign(window, { setTimeout(fn) { timers.set(++timer, fn); return timer; }, scrollTo() {} });
  const c = { document, window, URL, URLSearchParams, location: { protocol: 'http:', hostname, pathname, port, search,
      href: `http://${hostname}:${port}${pathname}${search}` },
    CustomEvent: class { constructor(type) { this.type = type; } }, clearTimeout: id => timers.delete(id) };
  vm.createContext(c);
  vm.runInContext(script, c);
  document.dispatchEvent({ type: 'DOMContentLoaded' });
  const click = id => nodes[id].dispatchEvent({ type: 'click', target: nodes[id], stopPropagation() {} });
  return { c, nodes, document, window, guide, timers, click, art, astArt, logo, astLogo, decorations, video: nodes.lkOpeningVideo, backdrop: nodes.lkOpeningVideoBackdrop, gate: nodes.lkOpSoundGate };
}

const checks = [];
async function check(name, run) { await run(); checks.push(name); }
(async () => {
  await check('immediate audible play; policy fallback starts muted; sound toggle preserves playback', async () => {
    const p = makePage();
    assert.equal(p.video.playCalls.length, 1, 'starts before window load');
    assert.equal(p.video.playCalls[0].muted, false);
    p.video.pending[0].reject(rejected('NotAllowedError')); await flush();
    assert.equal(p.video.playCalls.length, 2); assert.equal(p.video.playCalls[1].muted, true);
    p.video.pending[1].resolve(); await flush();
    assert.equal(p.gate.classList.contains('is-sound-toggle'), true);
    assert.equal(p.backdrop.paused, false);
    p.click('lkOpSoundGate');
    assert.equal(p.video.muted, false, 'unmutes within click handler');
    assert.equal(p.video.playCalls.length, 3);
    p.video.pending[2].resolve(); await flush();
    assert.equal(p.gate.classList.contains('is-visible'), false);
  });
  await check('old audible denial cannot remute a newer user request', async () => {
    const p = makePage();
    p.click('lkOpSoundGate');
    p.video.pending[1].resolve(); await flush();
    p.video.pending[0].reject(rejected('NotAllowedError')); await flush();
    assert.equal(p.video.playCalls.length, 2); assert.equal(p.video.muted, false);
  });
  await check('AbortError does not retry or show blocking gate', async () => {
    const p = makePage(); p.video.pending[0].reject(rejected('AbortError')); await flush();
    assert.equal(p.video.playCalls.length, 1); assert.equal(p.gate.classList.contains('is-visible'), false);
  });
  await check('skip invalidates pending muted fallback; replay ignores stale hide and play callbacks', async () => {
    const p = makePage(); p.click('lkOpSkip'); p.click('lkTitleScreen');
    const oldHide = [...p.timers.values()][0];
    p.window.OpeningPrelude.replay(); oldHide();
    p.video.pending[0].reject(rejected('NotAllowedError')); await flush();
    assert.equal(p.video.playCalls.length, 2); assert.equal(p.nodes.lkPrelude.hidden, false);
    assert.equal(p.guide.inert, true);
    p.video.dispatchEvent({ type: 'ended' }); p.click('lkTitleScreen');
    assert.equal(p.guide.inert, false);
    p.window.OpeningPrelude.replay(); p.video.dispatchEvent({ type: 'ended' }); p.click('lkTitleScreen');
    assert.equal(p.window.__lkPreludeComplete, true);
    assert.equal((p.document.listeners.get('keydown') || []).length, 0);
  });
  await check('silent-playing screen remains skippable without enabling sound', async () => {
    const p = makePage(); p.video.pending[0].reject(rejected('NotAllowedError')); await flush();
    p.video.pending[1].resolve(); await flush(); p.click('lkOpeningScreen');
    assert.equal(p.window.__openingOpActive, false);
    assert.equal(p.video.playCalls.length, 2);
  });
  await check('both worlds use identical OP; local error retries original URL exactly once', async () => {
    const p = makePage(); const local = p.video.src;
    p.c.configureOpeningPreludeMedia('asterisk'); assert.equal(p.video.src, local);
    p.video.dispatchEvent({ type: 'error' }); assert.equal(p.video.src, remote); assert.equal(p.backdrop.src, remote);
    assert.equal(p.video.playCalls.length, 2);
    p.video.dispatchEvent({ type: 'error' }); assert.equal(p.video.playCalls.length, 2);
    assert.equal(p.window.__openingOpActive, false);
  });
  await check('remote fallback remains selected across world changes', async () => {
    const p = makePage(); p.video.dispatchEvent({ type: 'error' });
    p.video.pending.at(-1).resolve(); await flush();
    p.click('lkOpSkip'); p.click('lkTitleScreen');
    p.c.configureOpeningPreludeMedia('asterisk'); p.window.OpeningPrelude.replay();
    assert.equal(p.video.src, remote, 'do not reselect failed local source on world change');
  });
  await check('hosted entry keeps original OP URL; skipIntro releases initial locks', async () => {
    const hosted = makePage('', 'example.test'); assert.equal(hosted.video.src, remote);
    const skipped = makePage('?skipIntro=1');
    assert.equal(skipped.window.__lkPreludeComplete, true); assert.equal(skipped.window.__openingOpActive, false);
    assert.equal(skipped.guide.inert, false); assert.equal(skipped.video.playCalls.length, 0);
  });
  await check('localhost:8000 and 127.0.0.1:8000 SillyTavern roots use original remote OP', async () => {
    for (const hostname of ['localhost', '127.0.0.1']) {
      const tavern = makePage('', hostname, '/', '8000');
      assert.equal(tavern.c.openingIsLocalPreview, false);
      assert.equal(tavern.video.src, remote);
      tavern.c.configureOpeningPreludeMedia('asterisk');
      assert.equal(tavern.video.src, remote);
    }
  });
  await check('original pair requires both image loads in either order; switching/replay preserves both files', async () => {
    for (const asteriskFirst of [true, false]) {
      const p = makePage('?world=asterisk');
      const rakudai = p.c.openingMediaUrl(p.c.OPENING_ASTERISK_MEDIA.entryCover);
      const asterisk = p.c.openingMediaUrl(p.c.OPENING_ASTERISK_MEDIA.asteriskEntryCover);
      assert.equal(p.art.src, rakudai); assert.equal(p.astArt.src, asterisk);
      assert.equal(p.document.documentElement.style.getPropertyValue('--opening-title-backdrop'), 'url("' + p.c.openingMediaUrl(p.c.OPENING_ASTERISK_MEDIA.titleBackdrop) + '")', 'local preview gets a separate background layer');
      assert.equal(p.nodes.lkPrelude.dataset.titleLayout, 'rakudai');
      assert.equal(p.astLogo.hidden, true); assert.equal(p.astArt.hidden, true);
      const first = asteriskFirst ? p.astArt : p.art, second = asteriskFirst ? p.art : p.astArt;
      first.onload();
      assert.equal(p.nodes.lkPrelude.dataset.titleLayout, 'rakudai', 'one successful image is insufficient');
      assert.equal(p.astArt.hidden, true);
      second.onload();
      assert.equal(p.nodes.lkPrelude.dataset.titleLayout, 'original-pair');
      assert.equal(p.astLogo.hidden, false); assert.equal(p.astArt.hidden, false);
      assert.equal(p.decorations.every(el => !el.hidden), true);
      const successfulHandler = p.art.onload, astHandler = p.astArt.onload;
      for (const world of ['asterisk', 'rakudai', 'asterisk']) {
        p.c.configureOpeningPreludeMedia(world);
        assert.equal(p.art.src, rakudai); assert.equal(p.astArt.src, asterisk);
        assert.equal(p.art.onload, successfulHandler); assert.equal(p.astArt.onload, astHandler);
        assert.equal(p.document.documentElement.style.getPropertyValue('--opening-title-art'), 'url("' + rakudai + '")');
        assert.equal(p.logo.hidden, false);
        assert.equal(p.nodes.lkPrelude.dataset.titleLayout, 'original-pair');
        assert.equal(p.document.body.dataset.world, world);
      }
      p.window.OpeningPrelude.replay();
      assert.equal(p.art.src, rakudai); assert.equal(p.astArt.src, asterisk);
      assert.equal(p.art.onload, successfulHandler); assert.equal(p.astArt.onload, astHandler);
    }
  });
  await check('Rakudai failure uses single remote cover; stale callbacks cannot restore pair; final failure stops', async () => {
    const p = makePage('?world=asterisk');
    const localLoad = p.art.onload, localError = p.art.onerror;
    p.astArt.onload(); p.art.onload();
    assert.equal(p.nodes.lkPrelude.dataset.titleLayout, 'original-pair');
    p.art.onerror(); assert.equal(p.art.src, originalTitleArt);
    assert.equal(p.nodes.lkPrelude.dataset.titleLayout, 'rakudai'); assert.equal(p.astLogo.hidden, true);
    assert.equal(p.astArt.hidden, true);
    assert.equal(p.decorations.every(el => el.hidden), true);
    localLoad(); localError(); p.astArt.onload();
    assert.equal(p.art.src, originalTitleArt); assert.equal(p.nodes.lkPrelude.dataset.titleLayout, 'rakudai');
    p.art.onload();
    p.c.configureOpeningPreludeMedia('rakudai'); p.c.configureOpeningPreludeMedia('asterisk');
    assert.equal(p.art.src, originalTitleArt, 'world switching does not retry failed local originals');
    assert.equal(p.document.documentElement.style.getPropertyValue('--opening-title-art'), 'url("' + originalTitleArt + '")');
    const remoteError = p.art.onerror;
    remoteError(); assert.equal(p.art.onload, null); assert.equal(p.art.onerror, null);
    remoteError(); assert.equal(p.art.src, originalTitleArt);
    assert.equal(p.astLogo.hidden, true); assert.equal(p.nodes.lkPrelude.dataset.titleLayout, 'rakudai');
  });
  await check('Asterisk image failure remains single cover and ignores later stale success', async () => {
    for (const failAfterPair of [true, false]) {
      const p = makePage('?world=asterisk');
      const oldLoad = p.astArt.onload;
      p.art.onload(); if (failAfterPair) p.astArt.onload();
      const originalSource = p.art.src;
      p.astArt.onerror(); oldLoad();
      assert.equal(p.astArt.onload, null); assert.equal(p.astArt.onerror, null);
      assert.equal(p.astArt.hidden, true); assert.equal(p.astLogo.hidden, true);
      assert.equal(p.nodes.lkPrelude.dataset.titleLayout, 'rakudai');
      assert.equal(p.art.src, originalSource, 'keep successfully loaded original Rakudai image');
      p.c.configureOpeningPreludeMedia('rakudai'); p.c.configureOpeningPreludeMedia('asterisk');
      assert.equal(p.astArt.hidden, true);
    }
  });
  await check('failed title logos hide safely without reviving on cover load', async () => {
    const p = makePage('?world=asterisk');
    p.astLogo.onerror(); p.art.onload(); p.astArt.onload();
    assert.equal(p.nodes.lkPrelude.dataset.titleLayout, 'original-pair'); assert.equal(p.astLogo.hidden, true);
    p.logo.onerror(); assert.equal(p.logo.src, originalTitleLogo); assert.equal(p.logo.hidden, false);
    p.logo.onerror(); assert.equal(p.logo.hidden, true);
  });
  await check('hosted and local ST use original title only; no competing remote preload', async () => {
    for (const [hostname, pathname, port] of [['example.test', '/', '443'], ['127.0.0.1', '/', '8000'], ['localhost', '/', '8000']]) {
      const hosted = makePage('?world=asterisk', hostname, pathname, port);
      assert.equal(hosted.art.src, originalTitleArt, 'hosted and local ST use original remote cover');
      hosted.art.onload();
      assert.equal(hosted.nodes.lkPrelude.dataset.titleLayout, 'rakudai');
      assert.equal(hosted.astArt.getAttribute('src'), null, 'do not request local preview original in ST');
      assert.equal(hosted.document.documentElement.style.getPropertyValue('--opening-title-backdrop'), undefined, 'hosted/ST entry does not request the local generated background');
      assert.equal(hosted.astArt.hidden, true);
      assert.equal(hosted.astLogo.hidden, true);
      assert.equal(hosted.logo.src, originalTitleLogo);
    }
    assert.equal(/<div\b[^>]*class="aw-title-wordmark"/.test(html), false, 'no hand-built title wordmark element');
    assert.equal(/body\[data-world="asterisk"\][^{]*\.lk-title[^{]*\{/.test(html), false, 'no Asterisk title composition override');
    assert.equal(/<link\s+rel="preload"\s+as="image"\s+href="https:\/\/eriribot\.github\.io\/rakudai-knight\/title-screen-8k\.png"/.test(html), false, 'no competing remote cover preload');
    assert.equal(html.includes('var(--opening-title-art,'), true, 'blurred background shares cover source');
    assert.equal(/opening-crossover-v1|crossoverCover|shared-crossover-cover/.test(html), false, 'generated picture has no product reference');
  });
  const report = { passed: true, sourceSha256: crypto.createHash('sha256').update(sourceBytes).digest('hex'), checks,
    scope: 'Actual assembled prelude JavaScript in deterministic event/media mocks; browser policy and decoding require browser acceptance.' };
  fs.writeFileSync(path.join(__dirname, 'prelude-race-validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error('FAILED after checks:', checks); console.error(error); process.exitCode = 1; });
