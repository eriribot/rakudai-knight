import fs from 'node:fs';
import { STORY_VOLUMES } from './rakudai-story-catalog.mjs';

export const stripModuleSyntax = source => source.replace(/^import\b[^;]*;\s*/gm, '')
  .replace(/^export\s*\{[^}]*\}(?:\s+from\s+[^;]*)?;?\s*/gm, '').replace(/^export /gm, '');
export function inlineTournamentSource() {
  const calendar = JSON.parse(fs.readFileSync(new URL('./story/tournament-calendar-2013.json', import.meta.url), 'utf8'));
  return 'const tournamentCalendar2013 = ' + JSON.stringify(calendar).replace(/</g, '\\u003c') + ';\n' +
    ['rakudai-tournament-calendar.mjs', 'rakudai-tournament-background.mjs', 'rakudai-tournament.mjs']
      .map(file => stripModuleSyntax(fs.readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n'))).join('\n');
}
export function inlineStoryCatalog({ summaries = false } = {}) {
  const volumes = STORY_VOLUMES.map(book => ({ volume: book.volume, title: book.title,
    chapters: book.chapters.map(chapter => ({ key: chapter.key, title: chapter.title,
      aliases: chapter.aliases || [], ...(summaries ? { summary: chapter.summary } : {}) })) }));
  const source = fs.readFileSync(new URL('./rakudai-story-catalog.mjs', import.meta.url), 'utf8');
  return stripModuleSyntax(source).replace(/^const STORY_VOLUMES = .*;$/m,
    () => 'const STORY_VOLUMES = ' + JSON.stringify(volumes).replace(/</g, '\\u003c') + ';');
}
