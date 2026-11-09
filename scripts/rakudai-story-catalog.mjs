import firstVolumes from './story/volumes-01-09.json' with { type: 'json' };
import lastVolumes from './story/volumes-10-19.json' with { type: 'json' };

// GBK 原文目录是唯一顺序来源；浏览器产物在构建时内联这些数据和函数。
export const STORY_VOLUMES = [...firstVolumes, ...lastVolumes];
export function getStoryVolume(volume) {
  return Number.isInteger(volume) ? STORY_VOLUMES.find(item => item.volume === volume) || null : null;
}
export function resolveStoryChapter(volume, key) {
  if (typeof key !== 'string' || !key.trim()) return null;
  const chapters = getStoryVolume(volume)?.chapters || [];
  const value = key.trim();
  return chapters.find(chapter => chapter.key === value) ||
    chapters.find(chapter => (chapter.aliases || []).includes(value)) || null;
}
export function firstStoryChapter(volume) {
  return getStoryVolume(volume)?.chapters[0] || null;
}
export function storyPosition(volume, key) {
  const chapter = resolveStoryChapter(volume, key);
  if (!chapter) return -1;
  let offset = 0;
  for (const book of STORY_VOLUMES) {
    if (book.volume === volume) return offset + book.chapters.indexOf(chapter);
    offset += book.chapters.length;
  }
  return -1;
}
export function nextStoryChapter(volume, key) {
  const current = resolveStoryChapter(volume, key), book = getStoryVolume(volume);
  if (!current || !book) return null;
  const next = book.chapters[book.chapters.indexOf(current) + 1];
  if (next) return { volume, chapter: next.key };
  const following = STORY_VOLUMES[STORY_VOLUMES.indexOf(book) + 1];
  return following ? { volume: following.volume, chapter: following.chapters[0].key } : null;
}

// Route is a saved MVU fact. Only the two deliberate hand-off points override
// the catalogue order; every other chapter keeps the ordinary adjacent flow.
export function nextStoryChapterForState(volume, key, state) {
  if (volume === 10 && key === '第二章' && state?.场景?.路线 === 'B') {
    return { volume: 16, chapter: '序章' };
  }
  if (volume === 16 && key === '终章Ⅱ') {
    return { volume: 18, chapter: '第二章' };
  }
  return nextStoryChapter(volume, key);
}

// 学战前两卷按已核对条目连续编号，worldbook order 200–216。
// 第一卷沿用旧存档键；后续卷在章名中带卷号，兼容当前卷为 null 的学战 MVU。
export const ASTERISK_VOLUMES = [{
  volume: 1, title: '第1卷 姬焰邂逅',
  chapters: [
    { key: '序章', title: '序章 倏然疾风', aliases: ['序幕'] },
    { key: '第一章', title: '第一章 华焰魔女', aliases: [] },
    { key: '第二章', title: '第二章 学战都市', aliases: [] },
    { key: '第三章', title: '第三章 凛凛眼神', aliases: [] },
    { key: '第四章', title: '第四章 回忆与重逢', aliases: [] },
    { key: '第五章', title: '第五章 黑炉魔剑', aliases: [] },
    { key: '第六章', title: '第六章 两人的假日', aliases: [] },
    { key: '第七章', title: '第七章 解放者', aliases: [] },
    { key: '终章', title: '终章 并肩之誓', aliases: [] },
  ],
}, {
  volume: 2, title: '第2卷 银绮觉醒',
  chapters: [
    { key: '第一章', title: '第一章 六花园会议', aliases: [] },
    { key: '第二章', title: '第二章 昏枭暗跃', aliases: [] },
    { key: '第三章', title: '第三章 疾风刃雷', aliases: [] },
    { key: '第四章', title: '第四章 错综的思绪', aliases: [] },
    { key: '第五章', title: '第五章 少女素颜', aliases: [] },
    { key: '第六章', title: '第六章 雾中魔手', aliases: [] },
    { key: '第七章', title: '第七章 决意与决斗', aliases: [] },
    { key: '终章', title: '终章 蜀山组队', aliases: [] },
  ],
}].map(book => ({ ...book, chapters: book.chapters.map(chapter => ({
  ...chapter, volume: book.volume, chapter: chapter.key,
  key: book.volume === 1 ? chapter.key : '第二卷·' + chapter.key,
  title: (book.volume === 1 ? '第一卷·' : '第二卷·') + chapter.title,
  entryPrefix: '[剧情]' + (book.volume === 1 ? '第一卷.' : '第二卷.') + chapter.key + '.',
})) }));

export const STORY_ORDER_BASE = { rakudai: 100, asterisk: 200 };

export function resolveAsteriskChapter(key) {
  if (typeof key !== 'string' || !key.trim()) return null;
  const chapters = ASTERISK_VOLUMES.flatMap(book => book.chapters), value = key.trim();
  return chapters.find(chapter => chapter.key === value) ||
    chapters.find(chapter => (chapter.aliases || []).includes(value)) || null;
}

export function asteriskStoryPosition(key) {
  const chapter = resolveAsteriskChapter(key);
  return chapter ? ASTERISK_VOLUMES.flatMap(book => book.chapters).indexOf(chapter) : -1;
}

export function nextAsteriskChapter(key) {
  const chapter = resolveAsteriskChapter(key);
  if (!chapter) return null;
  const chapters = ASTERISK_VOLUMES.flatMap(book => book.chapters);
  return chapters[chapters.indexOf(chapter) + 1] || null;
}
