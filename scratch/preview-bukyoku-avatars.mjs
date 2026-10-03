import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('C:/Users/eriri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve('resource/knightavatars');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const ids=['rai','momiji','byakuya','yuudai'];
const tiles=[];
for(const id of ids){
  const person=manifest.characters.find(c=>c.id===id);
  const thumb=await sharp(path.join(root,person.displayFile||person.file)).resize(130,174,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  const label=Buffer.from(`<svg width="174" height="32"><text x="87" y="23" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="16" fill="#263344">${person.name}</text></svg>`);
  tiles.push(await sharp({create:{width:174,height:212,channels:4,background:'#fff8e7'}}).composite([{input:thumb,left:22,top:4},{input:label,left:0,top:178}]).png().toBuffer());
}
const output=path.join(root,'prepared/latest-contact-sheet.png');
await sharp({create:{width:696,height:212,channels:4,background:'#fff8e7'}}).composite(tiles.map((input,i)=>({input,left:i*174,top:0}))).png().toFile(output);
console.log(output);
