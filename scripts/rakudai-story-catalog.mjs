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
