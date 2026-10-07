import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

// Isolated native-browser probe: only synthetic DOM and in-memory display data.
// No Tavern connection, external images, persistent browser storage or product writes.
const modules = ['player-display-store.js', 'player-portrait.js'].map(name => {
  const text = readFileSync(new URL(name, import.meta.url), 'utf8');
  return { name, text, sha256: createHash('sha256').update(text).digest('hex') };
});
const metadata = modules.map(({ name, sha256 }) => ({ name, sha256 }));
const html = `<!doctype html><html lang="en"><meta charset="utf-8">
<title>Isolated player bubble browser probe</title>
<style>body{font:14px system-ui;margin:24px;color:#333}pre{white-space:pre-wrap} [data-rkd-avatar]{position:relative;display:inline-block;width:40px;height:40px} [data-rkd-body]{display:inline-block;margin-left:8px}</style>
<h1>Isolated player bubble browser probe</h1>
<p>Synthetic names, in-memory settings and a generated 2×2 data image. No live Tavern data.</p>
<div id="chat"><div class="mes" is_user="false"><div class="mes_text"></div></div></div>
<pre id="results">Running native MutationObserver checks…</pre>
<script>${modules.map(module => module.text).join('\n').replace(/<\/script/gi, '<\\/script')}
(async () => {
  const checks = [], metadata = ${JSON.stringify(metadata)};
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async (predicate, message) => {
    const deadline = performance.now() + 2000;
    while (!predicate()) {
      if (performance.now() > deadline) throw new Error(message);
      await wait(10);
    }
    await wait(25);
  };
  const check = (name, condition, detail) => {
    checks.push({ name, passed: !!condition, ...(detail ? { detail } : {}) });
    if (!condition) throw new Error(name);
  };
  const target = document.querySelector('.mes_text');
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const context = { chatId: 'isolated-browser', characterId: 'probe', groupId: null, name1: 'Probe Persona' };
  const state = { 玩家: { 姓名: 'Probe Player' }, 人际: { 'Other Person': {} } };
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
  const drawing = canvas.getContext('2d'); drawing.fillStyle = '#809080'; drawing.fillRect(0, 0, 2, 2);
  const avatarUrl = canvas.toDataURL('image/png');
  const store = createPlayerDisplayStore({ storage, getContext: () => context });
  store.save(store.get(), { avatarUrl, aliases: ['Alias'], profileName: 'Probe Player', source: 'opening' });
  const actualService = createPlayerPortraitService({ storage, getContext: () => context,
    getSnapshot: () => ({ state }), reservedNames: ['Other Person'] });
  let available = true, serviceGets = 0, observerCallbacks = 0;
  const service = { get() { serviceGets++; if (!available) throw new Error('Synthetic unavailable dependency'); return actualService.get(); },
    resolve: (name, snapshot) => actualService.resolve(name, snapshot) };
  const NativeObserver = window.MutationObserver;
  const host = { MutationObserver: class {
    constructor(callback) { this.native = new NativeObserver(records => { observerCallbacks++; callback(records); }); }
    observe(...args) { this.native.observe(...args); }
    disconnect() { this.native.disconnect(); }
  } };
  const source = text => { const node = document.createElement('span'); node.setAttribute('data-rkd-source', ''); node.textContent = text; return node; };
  const resetCandidate = (node, name, text) => {
    const freshSource = source(text);
    node.replaceChildren(freshSource); node.setAttribute('data-rkd', 'candidate'); node.setAttribute('data-rkd-name', name);
    node.removeAttribute('data-rkd-player'); node.removeAttribute('data-rkd-runtime-player');
    return freshSource;
  };
  const candidate = (name, text) => {
    const node = document.createElement('div'); resetCandidate(node, name, text); target.replaceChildren(node); return node;
  };
  const image = node => node.querySelector('[data-rkd-oc-image]');
  const complete = node => node.getAttribute('data-rkd') === 'bubble' && node.querySelectorAll('[data-rkd-avatar]').length === 1 &&
    node.querySelectorAll('[data-rkd-oc-image]').length === 1 && node.querySelectorAll('[data-rkd-oc-initial]').length === 1 &&
    image(node).getAttribute('src') === avatarUrl && image(node).complete && image(node).naturalWidth === 2 &&
    node.querySelector('[data-rkd-oc-initial]').hidden;
  let binder;
  try {
    let node = candidate('Alias', 'Alias: baseline');
    binder = createPlayerBubbleBinder({ host, document, service });
    await until(() => complete(node), 'Initial candidate did not receive its data image');
    check('native observer and real modules', host.MutationObserver !== NativeObserver && typeof binder.refresh === 'function' && data.size === 1);
    check('initial promotion and data image load', complete(node));

    const outer = node;
    const replacementAvatar = document.createElement('span'); replacementAvatar.setAttribute('data-rkd-avatar', '');
    node.querySelector('[data-rkd-avatar]').replaceWith(replacementAvatar);
    await until(() => complete(node), 'Replacement avatar was not repaired automatically');
    check('preserved outer shell, replaced avatar', node === outer && node.querySelector('[data-rkd-avatar]') === replacementAvatar && complete(node));

    replacementAvatar.replaceChildren();
    await until(() => complete(node), 'Cleared avatar children were not repaired automatically');
    check('cleared avatar children', complete(node));

    node.querySelector('[data-rkd-avatar]').remove();
    await until(() => complete(node), 'Removed avatar was not repaired automatically');
    check('removed avatar recreated', complete(node));

    const staleImage = image(node);
    const copiedAvatar = node.querySelector('[data-rkd-avatar]').cloneNode(true);
    node.querySelector('[data-rkd-avatar]').replaceWith(copiedAvatar);
    await until(() => complete(node) && image(node) !== staleImage, 'Copied decoration was not replaced');
    const currentImage = image(node);
    staleImage.dispatchEvent(new Event('error')); staleImage.dispatchEvent(new Event('load'));
    await wait(30);
    check('copied decoration deduplicated and late image events ignored', complete(node) && image(node) === currentImage);

    resetCandidate(node, 'Alias', 'Alias: latest matching source');
    await until(() => complete(node), 'Matching candidate redraw was not promoted automatically');
    check('candidate source and attributes reset, player matched', complete(node) && node.querySelector('[data-rkd-line]').textContent === 'latest matching source');

    const unknownSource = resetCandidate(node, 'Other Person', 'Other Person: unknown new source');
    await until(() => node.getAttribute('data-rkd') === 'candidate' && node.querySelector('[data-rkd-source]') === unknownSource, 'Unknown source was overwritten');
    check('candidate reset, unknown new source preserved', node.textContent === 'Other Person: unknown new source' && !image(node));

    node = candidate('Alias', 'Alias: old available source');
    await until(() => complete(node), 'Fresh candidate did not promote');
    available = false;
    const unavailableSource = resetCandidate(node, 'Alias', 'Alias: source while dependency unavailable');
    await wait(50);
    check('unavailable dependency preserves host source', node.querySelector('[data-rkd-source]') === unavailableSource && node.textContent === 'Alias: source while dependency unavailable' && !image(node));

    available = true;
    node = candidate('Alias', 'Alias: old scope source');
    await until(() => complete(node), 'Fresh scope candidate did not promote');
    context.chatId = 'isolated-browser-second';
    const changedScopeSource = resetCandidate(node, 'Alias', 'Alias: host source in second scope');
    await wait(50);
    check('scope switch preserves new source and drops old alias', node.querySelector('[data-rkd-source]') === changedScopeSource && node.textContent === 'Alias: host source in second scope' && !image(node));

    context.chatId = 'isolated-browser';
    node = candidate('Alias', 'Alias: restore this latest source');
    await until(() => complete(node), 'Final candidate did not promote');
    const finalSource = resetCandidate(node, 'Alias', 'Alias: final replacement source');
    await until(() => complete(node), 'Final candidate source did not promote');
    const countsBeforeIdle = { observerCallbacks, serviceGets };
    await wait(120);
    check('observer becomes idle without repeated writes', observerCallbacks === countsBeforeIdle.observerCallbacks && serviceGets === countsBeforeIdle.serviceGets,
      { stableForMs: 120, observerCallbacks, serviceGets });
    binder.destroy();
    check('destroy restores latest matching source', node.querySelector('[data-rkd-source]') === finalSource && node.textContent === 'Alias: final replacement source' && !image(node));
    check('memory storage remains isolated to synthetic scopes', data.size === 1 && [...data.keys()].every(key => key.includes('isolated-browser')));
  } catch (error) {
    checks.push({ name: 'probe completion', passed: false, error: String(error?.stack || error) });
  } finally { binder?.destroy(); }
  const result = { status: checks.every(item => item.passed) ? 'passed' : 'failed',
    passed: checks.filter(item => item.passed).length, total: checks.length,
    browser: navigator.userAgent, fixture: 'in-memory display store, synthetic DOM, generated 2x2 PNG data URL',
    observer: 'native window.MutationObserver with callback-count wrapper', modules: metadata, checks,
    metrics: { observerCallbacks, serviceGets }, boundary: 'Isolated browser only; no live Tavern import or chat integration tested.' };
  window.probeResult = result;
  document.getElementById('results').textContent = JSON.stringify(result, null, 2);
})();</script></html>`;

new Script(html.match(/<script>([\s\S]*)<\/script>/)[1], { filename: 'isolated-player-bubble-browser-probe.js' });

if (!process.argv.includes('--serve')) {
  console.log('Run node ' + fileURLToPath(import.meta.url) + ' --serve to open an isolated browser fixture.');
} else {
  const port = Number(process.env.RK_BUBBLE_PROBE_PORT || 18978);
  const server = createServer((request, response) => {
    if (request.url !== '/') { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'" });
    response.end(html);
  });
  server.listen(port, '127.0.0.1', () => console.log('Isolated bubble browser probe: http://127.0.0.1:' + port + '/'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
