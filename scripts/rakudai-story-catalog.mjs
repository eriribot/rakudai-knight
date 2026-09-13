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
