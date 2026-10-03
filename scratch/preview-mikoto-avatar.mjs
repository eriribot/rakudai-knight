import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/eriri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve('resource/knightavatars');
const avatar = fs.readFileSync(path.join(root, 'prepared/mikoto.png'));
const label = Buffer.from('<svg width="434" height="32"><text x="217" y="23" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="18" fill="#263344">鹤屋美琴</text></svg>');
await sharp({create:{width:434,height:612,channels:4,background:'#fff8e7'}})
  .composite([{input:avatar,left:0,top:0},{input:label,left:0,top:580}])
  .png().toFile(path.join(root,'research/review/mikoto-shield-preview.png'));
