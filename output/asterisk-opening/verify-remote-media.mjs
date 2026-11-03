import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const work = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(work, '../../第一卷-世界书整理/开局网页正则替换');
const html = fs.readFileSync(path.join(target, 'index.html'), 'utf8');
const media = JSON.parse(html.match(/var OPENING_ASTERISK_MEDIA=(.*);\r?\n/)[1]);
const source = fs.readFileSync(path.join(work, 'prelude-media.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(target, 'assets/asterisk/media-manifest.json'), 'utf8'));
const remoteRoot = 'https://eriribot.github.io/rakudai-knight/';
const remoteImages = remoteRoot + '第一卷-世界书整理/开局网页正则替换/assets/asterisk/';
const images = manifest.assets.filter(asset => asset.kind === 'image');
assert.equal(images.length, 34);
assert.ok(!html.includes('http://127.0.0.1:18737/'), 'no live loopback fallback in packaged HTML');
assert.ok(!/\.\.\/resource\/no\d+\.jpg/.test(html), 'no iframe-relative cover fallback');

function start(url) {
  function element(src = '') {
    return { src, hidden: false, complete: false, naturalWidth: 0, dataset: {},
      getAttribute(name) { return name === 'src' ? this.src : null; },
      pause() {}, load() {}, querySelector() { return { getAttribute() { return remoteRoot + 'op.mp4'; } }; } };
  }
  const root = element(), art = element(remoteRoot + 'title-screen-8k.png');
  const logo = element(remoteRoot + 'rakudai-logo.png'), astArt = element(), astLogo = element();
  const video = element(), backdrop = element(), styles = new Map();
  const selectors = { '.lk-title-art': art, '.lk-title-logo': logo, '.aw-title-logo': astLogo, '.aw-title-original-art': astArt };
  const ids = { lkPrelude: root, lkOpeningVideo: video, lkOpeningVideoBackdrop: backdrop };
  const context = { URL, URLSearchParams, location: new URL(url), OPENING_ASTERISK_MEDIA: media,
    document: { getElementById: id => ids[id], querySelector: selector => selectors[selector], querySelectorAll: () => [],
      documentElement: { style: { setProperty: (name, value) => styles.set(name, value) } }, body: { dataset: {} } } };
  context.window = context;
  vm.runInNewContext(source, context, { filename: 'prelude-media.js' });
  return { context, root, art, logo, astArt, astLogo, video, styles };
}

const cases = [
  ['file preview', 'file:///E:/web/落第/第一卷-世界书整理/开局网页正则替换/index.html', true],
  ['HTTP preview', 'http://127.0.0.1:18737/第一卷-世界书整理/开局网页正则替换/index.html', true],
  ['live local ST', 'http://127.0.0.1:8000/', false],
  ['live localhost ST', 'http://localhost:8000/scripts/extensions/third-party/iframe.html', false],
  ['srcdoc iframe', 'about:srcdoc', false],
  ['blob iframe', 'blob:http://127.0.0.1:8000/preview-id', false],
  ['hosted opening', remoteRoot + '第一卷-世界书整理/开局网页正则替换/index.html', false]
];
for (const [label, url, local] of cases) {
  const run = start(url), localBase = local ? new URL('assets/asterisk/', url).href : null;
  assert.equal(run.context.openingIsLocalPreview, local, label);
  for (const image of images) assert.equal(run.context.openingMediaUrl(image.source.path), new URL(image.source.path, local ? localBase : remoteImages).href, label + ': ' + image.id);
  assert.equal(run.context.openingMediaUrl(media.op), local ? new URL(media.op, localBase).href : remoteRoot + 'op.mp4', label + ': shared OP');
  assert.ok(run.styles.get('--opening-title-backdrop').includes(run.context.openingMediaUrl(media.titleBackdrop)), label + ': background');
  assert.equal(run.astLogo.src, run.context.openingMediaUrl(media.logos.asterisk), label + ': official logo');
  assert.equal(run.astArt.src, run.context.openingMediaUrl(media.asteriskEntryCover), label + ': original character image');
  run.astArt.onload(); run.art.onload();
  assert.equal(run.root.dataset.titleLayout, 'original-pair', label + ': complete pair');
}
const failed = start('about:srcdoc'), oldLoad = failed.astArt.onload;
failed.astArt.onerror(); oldLoad(); failed.art.onload();
assert.equal(failed.root.dataset.titleLayout, 'rakudai', 'failed Asterisk image cannot be restored by stale load');
const fallback = start('about:srcdoc'); fallback.astArt.onload(); fallback.art.onerror();
assert.equal(fallback.art.src, remoteRoot + 'title-screen-8k.png', 'original remote Rakudai cover remains fallback');
fallback.art.onload();
assert.equal(fallback.root.dataset.titleLayout, 'rakudai', 'fallback keeps the single-cover layout');
console.log(JSON.stringify({ passed: true, contexts: cases.length, imageURLsPerContext: images.length, titleFailureCases: 2, originalCharacterFilesModified: false, networkAvailabilityChecked: false }, null, 2));
