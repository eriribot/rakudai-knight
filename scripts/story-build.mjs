import fs from 'node:fs';
import { STORY_VOLUMES } from './rakudai-story-catalog.mjs';

export const stripModuleSyntax = source => source.replace(/^import\b[^;]*;\s*/gm, '').replace(/^export /gm, '');
export function inlineStoryCatalog({ summaries = false } = {}) {
  const volumes = STORY_VOLUMES.map(book => ({ volume: book.volume, title: book.title,
    chapters: book.chapters.map(chapter => ({ key: chapter.key, title: chapter.title,
      aliases: chapter.aliases || [], ...(summaries ? { summary: chapter.summary } : {}) })) }));
  const source = fs.readFileSync(new URL('./rakudai-story-catalog.mjs', import.meta.url), 'utf8');
  return stripModuleSyntax(source).replace(/^const STORY_VOLUMES = .*;$/m,
    () => 'const STORY_VOLUMES = ' + JSON.stringify(volumes).replace(/</g, '\\u003c') + ';');
}
