import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { ASTERISK_VOLUMES, asteriskStoryPosition, nextAsteriskChapter, resolveAsteriskChapter, STORY_ORDER_BASE, storyPosition } from './rakudai-story-catalog.mjs';

// 目录结构
assert.equal(ASTERISK_VOLUMES.length, 1);
const keys = ASTERISK_VOLUMES[0].chapters.map(c => c.key);
assert.deepEqual(keys, ['序章', '第一章', '第二章', '第三章', '第四章', '第五章', '第六章', '第七章', '终章']);
assert.equal(asteriskStoryPosition('序章'), 0);
assert.equal(asteriskStoryPosition('序幕'), 0);
assert.equal(asteriskStoryPosition('终章'), 8);
assert.equal(asteriskStoryPosition('不存在'), -1);
assert.equal(nextAsteriskChapter('序章').key, '第一章');
assert.equal(nextAsteriskChapter('第七章').key, '终章');
assert.equal(nextAsteriskChapter('终章'), null);
assert.equal(resolveAsteriskChapter(' 序章 ').key, '序章');
assert.equal(STORY_ORDER_BASE.asterisk, 200);
assert.equal(storyPosition(1, '序章'), 0);

// 世界书读取：order = 200 + position，且只认 [剧情] 前缀
const source = fs.readFileSync('scripts/rakudai-worldbook-reader.js', 'utf8');
const { createRakudaiWorldbookReader } = vm.runInNewContext(`${source}\n({ createRakudaiWorldbookReader })`, { console, JSON, storyPosition });
const entries = keys.map((key, index) => ({ uid: 300 + index, name: '[剧情]学战·' + key, enabled: false,
  order: 200 + index, content: '学战原文 ' + key }));
const reader = createRakudaiWorldbookReader({
  getCharWorldbookNames: async () => ({ primary: '主世界书' }),
  getWorldbook: async () => entries,
});
const got = await reader.read(1, '序章', { position: asteriskStoryPosition('序章'), orderBase: STORY_ORDER_BASE.asterisk });
assert.equal(got.order, 200);
assert.equal(got.content, '学战原文 序章');
const last = await reader.read(1, '终章', { position: asteriskStoryPosition('终章'), orderBase: STORY_ORDER_BASE.asterisk });
assert.equal(last.order, 208);
await assert.rejects(() => reader.read(1, '序章', { position: 0, orderBase: 100 }), /未找到顺序为 100/);

// 已启用条目应被拒绝（避免重复注入）
const enabledReader = createRakudaiWorldbookReader({
  getCharWorldbookNames: async () => ({ primary: '主世界书' }),
  getWorldbook: async () => entries.map(entry => ({ ...entry, enabled: true })),
});
await assert.rejects(() => enabledReader.read(1, '序章', { position: 0, orderBase: 200 }), /请关闭/);

// 同一次取书给出可用目录与下一章签名，缺章不冒充可用，也不误选同 order 人物条目。
let reads = 0, primary = '主世界书';
const changing = entries.slice(0, 8).map(entry => ({ ...entry }));
changing.push({ uid: 999, name: '[人物]同序号', order: 208, enabled: true, content: '人物' });
const listing = createRakudaiWorldbookReader({ getCharWorldbookNames: () => ({ primary }),
  getWorldbook: async () => { reads++; return changing; } });
const listed = await listing.list(1, ASTERISK_VOLUMES[0].chapters, { orderBase: 200 });
assert.equal(reads, 1); assert.equal(listed.chapters.length, 9);
assert.equal(listed.chapters[7].available, true); assert.equal(listed.chapters[8].available, false);
assert.match(listed.chapters[8].reason, /208/);
const penultimate = await listing.read(1, '第七章', { position: 7, nextPosition: 8, orderBase: 200 });
assert.equal(reads, 2); assert.equal(penultimate.next.available, false); assert.equal(penultimate.order, 207);
const nextPresent = await listing.read(1, '序章', { position: 0, nextPosition: 1, orderBase: 200 });
changing[1].content += '修订';
const nextChanged = await listing.read(1, '序章', { position: 0, nextPosition: 1, orderBase: 200 });
assert.equal(nextPresent.signature, nextChanged.signature); assert.notEqual(nextPresent.next.signature, nextChanged.next.signature);
changing.push({ ...changing[2], uid: 998 }); changing[3].content = ''; changing[4].enabled = true;
const invalid = await listing.list(1, ASTERISK_VOLUMES[0].chapters, { orderBase: 200 });
assert.match(invalid.chapters[2].reason, /多个/); assert.match(invalid.chapters[3].reason, /为空/); assert.match(invalid.chapters[4].reason, /请关闭/);
const rebound = createRakudaiWorldbookReader({ getCharWorldbookNames: () => ({ primary }),
  getWorldbook: async () => { primary = '另一本'; return changing; } });
await assert.rejects(rebound.list(1, ASTERISK_VOLUMES[0].chapters, { orderBase: 200 }), /绑定已变化/);

console.log('asterisk catalogue + order-200 reader OK');
