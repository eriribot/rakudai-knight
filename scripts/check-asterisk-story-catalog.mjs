import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { ASTERISK_VOLUMES, asteriskStoryPosition, nextAsteriskChapter, resolveAsteriskChapter, STORY_ORDER_BASE, storyPosition } from './rakudai-story-catalog.mjs';

// 目录结构
assert.equal(ASTERISK_VOLUMES.length, 17);
const keys = ASTERISK_VOLUMES[0].chapters.map(c => c.key);
const chapters = ASTERISK_VOLUMES.flatMap(book => book.chapters);
assert.deepEqual(keys, ['序章', '第一章', '第二章', '第三章', '第四章', '第五章', '第六章', '第七章', '终章']);
assert.equal(asteriskStoryPosition('序章'), 0);
assert.equal(asteriskStoryPosition('序幕'), 0);
assert.equal(asteriskStoryPosition('终章'), 8);
assert.equal(asteriskStoryPosition('不存在'), -1);
assert.equal(nextAsteriskChapter('序章').key, '第一章');
assert.equal(nextAsteriskChapter('第七章').key, '终章');
assert.equal(nextAsteriskChapter('终章').key, '第二卷·第一章');
assert.equal(nextAsteriskChapter('第二卷·终章').key, '第三卷·第一章');
assert.equal(nextAsteriskChapter('第三卷·终章').key, '第四卷·第一章');
assert.equal(nextAsteriskChapter('第十七卷·终章'), null);
assert.equal(asteriskStoryPosition('第二卷·第一章'), 9);
assert.equal(asteriskStoryPosition('第二卷·终章'), 16);
assert.equal(resolveAsteriskChapter('第二卷·第一章').volume, 2);
assert.equal(resolveAsteriskChapter('第一章').volume, 1);
assert.equal(new Set(chapters.map(c => c.key)).size, 140);
assert.equal(resolveAsteriskChapter(' 序章 ').key, '序章');
assert.equal(STORY_ORDER_BASE.asterisk, 200);
assert.equal(storyPosition(1, '序章'), 0);

// EPUB 核验结果：第十四卷只有六章、没有终章；其后 order 不得多空一格。
const volumeLayout = [
  ['第一卷', 9, 200], ['第二卷', 8, 209], ['第三卷', 8, 217],
  ['第四卷', 8, 225], ['第五卷', 8, 233], ['第六卷', 8, 241], ['第七卷', 8, 249],
  ['第八卷', 9, 257], ['第九卷', 9, 266], ['第十卷', 9, 275], ['第十一卷', 9, 284],
  ['第十二卷', 8, 293], ['第十三卷', 10, 301], ['第十四卷', 6, 311],
  ['第十五卷', 8, 317], ['第十六卷', 8, 325], ['第十七卷', 7, 333],
];
const numberedChapters = ['第一章', '第二章', '第三章', '第四章', '第五章', '第六章', '第七章', '第八章', '第九章'];
const expectedChapters = volumeLayout.flatMap(([label, count, order], index) => {
  const local = index === 0 ? ['序章', ...numberedChapters.slice(0, 7), '终章']
    : index === 13 ? numberedChapters.slice(0, 6) : [...numberedChapters.slice(0, count - 1), '终章'];
  assert.equal(ASTERISK_VOLUMES[index].volume, index + 1);
  assert.equal(ASTERISK_VOLUMES[index].chapters.length, count);
  return local.map((chapter, offset) => ({ volume: index + 1, key: index === 0 ? chapter : label + '·' + chapter,
    chapter, order: order + offset, entryPrefix: '[剧情]' + label + '.' + chapter + '.' }));
});
assert.deepEqual(chapters.map(chapter => chapter.key), expectedChapters.map(chapter => chapter.key));
for (const [index, expected] of expectedChapters.entries()) {
  const actual = resolveAsteriskChapter(expected.key);
  assert.equal(actual.volume, expected.volume); assert.equal(actual.chapter, expected.chapter);
  assert.equal(actual.entryPrefix, expected.entryPrefix);
  assert.equal(200 + asteriskStoryPosition(expected.key), expected.order);
  assert.equal(nextAsteriskChapter(expected.key)?.key ?? null, expectedChapters[index + 1]?.key ?? null);
}
assert.equal(resolveAsteriskChapter('第十四卷·终章'), null);
assert.equal(resolveAsteriskChapter('第十八卷·第一章'), null);

// 独立列出第三卷世界书映射，不能由待测目录反推预期 order 或名称。
const thirdVolume = [
  ['第一章', '开幕前夜', 217], ['第二章', '凤凰星武祭', 218],
  ['第三章', '阿尔第与莉姆希', 219], ['第四章', '吸血暴姬', 220],
  ['第五章', '雷渥夫姐妹', 221], ['第六章', '力量与代价', 222],
  ['第七章', '霸溃血镰', 223], ['终章', '余烬与暗流', 224],
];
assert.deepEqual(ASTERISK_VOLUMES[2].chapters.map(chapter => chapter.key), thirdVolume.map(([chapter]) => '第三卷·' + chapter));
for (const [chapter, title, order] of thirdVolume) {
  const key = '第三卷·' + chapter, resolved = resolveAsteriskChapter(key);
  assert.equal(resolved.volume, 3);
  assert.equal(resolved.chapter, chapter);
  assert.equal(resolved.title, '第三卷·' + chapter + ' ' + title);
  assert.equal(resolved.entryPrefix, '[剧情]第三卷.' + chapter + '.');
  assert.equal(200 + asteriskStoryPosition(key), order);
}
assert.equal(resolveAsteriskChapter('第三卷·序章'), null);
assert.equal(resolveAsteriskChapter('第三卷·序幕'), null);

// 世界书读取：order = 200 + position，且只认 [剧情] 前缀
const source = fs.readFileSync('scripts/rakudai-worldbook-reader.js', 'utf8');
const { createRakudaiWorldbookReader } = vm.runInNewContext(`${source}\n({ createRakudaiWorldbookReader })`, { console, JSON, storyPosition });
const entries = expectedChapters.map(chapter => ({ uid: chapter.order + 100, name: chapter.entryPrefix + '核验正文', enabled: false,
  order: chapter.order, content: '学战原文 ' + chapter.key }));
entries.splice(17, 8, ...thirdVolume.map(([chapter, title, order]) => ({ uid: order + 100, name: '[剧情]第三卷.' + chapter + '.' + title,
  enabled: false, order, content: '学战原文 第三卷·' + chapter })));
const reader = createRakudaiWorldbookReader({
  getCharWorldbookNames: async () => ({ primary: '主世界书' }),
  getWorldbook: async () => entries,
});
const got = await reader.read(1, '序章', { position: asteriskStoryPosition('序章'), orderBase: STORY_ORDER_BASE.asterisk });
assert.equal(got.order, 200);
assert.equal(got.content, '学战原文 序章');
const last = await reader.read(1, '终章', { position: asteriskStoryPosition('终章'), orderBase: STORY_ORDER_BASE.asterisk });
assert.equal(last.order, 208);
for (const chapter of chapters) {
  const material = await reader.read(chapter.volume, chapter.key, { position: asteriskStoryPosition(chapter.key), orderBase: 200, expectedPrefix: chapter.entryPrefix });
  assert.equal(material.content, '学战原文 ' + chapter.key);
}
await assert.rejects(reader.read(1, '终章', { position: 9, orderBase: 200, expectedPrefix: resolveAsteriskChapter('终章').entryPrefix }), /卷章不符/);
await assert.rejects(reader.read(3, '第三卷·第一章', { position: 18, orderBase: 200, expectedPrefix: '[剧情]第三卷.第一章.' }), /卷章不符/);
await assert.rejects(reader.read(3, '第三卷·第一章', { position: 9, orderBase: 200, expectedPrefix: '[剧情]第三卷.第一章.' }), /卷章不符/);
await assert.rejects(() => reader.read(1, '序章', { position: 0, orderBase: 100 }), /未找到顺序为 100/);

// 目录预置不代表正文已安装；补入/修改世界书后同一 reader 下一次读取必须立即生效。
const installed = entries.slice(0, 25).map(entry => ({ ...entry }));
const growingReader = createRakudaiWorldbookReader({ getCharWorldbookNames: () => ({ primary: '主世界书' }), getWorldbook: () => installed });
const beforeInstall = await growingReader.list(1, chapters, { orderBase: 200 });
assert.equal(beforeInstall.chapters.length, 140);
assert.deepEqual(beforeInstall.chapters.filter(chapter => chapter.available).map(chapter => chapter.order), Array.from({ length: 25 }, (_, index) => 200 + index));
const thirdEndOptions = { position: 24, nextPosition: 25, orderBase: 200, expectedPrefix: '[剧情]第三卷.终章.', nextExpectedPrefix: '[剧情]第四卷.第一章.' };
const thirdEnd = await growingReader.read(3, '第三卷·终章', thirdEndOptions);
assert.equal(thirdEnd.order, 224); assert.equal(thirdEnd.next.available, false); assert.match(thirdEnd.next.reason, /225/);
await assert.rejects(growingReader.read(4, '第四卷·第一章', { position: 25, orderBase: 200, expectedPrefix: '[剧情]第四卷.第一章.' }), /225/);
installed.push({ uid: 425, name: '[剧情]第四卷.第一章.界龙之主', order: 225, enabled: false, content: '新增第四卷正文' });
const afterInstall = await growingReader.read(3, '第三卷·终章', thirdEndOptions);
assert.equal(afterInstall.next.available, true); assert.notEqual(afterInstall.next.signature, thirdEnd.next.signature);
assert.equal((await growingReader.list(1, chapters, { orderBase: 200 })).chapters[25].available, true);
const fourthOptions = { position: 25, orderBase: 200, expectedPrefix: '[剧情]第四卷.第一章.' };
assert.equal((await growingReader.read(4, '第四卷·第一章', fourthOptions)).content, '新增第四卷正文');
installed.at(-1).content = '修订后的第四卷正文';
assert.equal((await growingReader.read(4, '第四卷·第一章', fourthOptions)).content, '修订后的第四卷正文');

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
