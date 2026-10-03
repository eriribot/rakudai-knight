import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/eriri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base = path.resolve('resource/knightavatars');
const studies = {
  kiriko: {file:'novel/kiriko.jpg', eyes:[[1712,492],[1986,599]], points:{eye:[1849,545], mouth:[1805,728]}, window:[1300,90,1150,1370]},
  sara: {file:'novel/sara.jpg', eyes:[[659,416],[767,519]], points:{eye:[713,468], mouth:[622,550]}, window:[290,630,960,1100]},
  rinna: {file:'novel/rinna-colorized.png', eyes:[[356,740],[628,817]], points:{eye:[492,779], mouth:[448,940]}, window:[330,155,880,1190]}
};
const result = {};
for (const [id, item] of Object.entries(studies)) {
  const source = path.join(base,item.file), meta = await sharp(source).metadata();
  const degrees = -Math.atan2(item.eyes[1][1]-item.eyes[0][1],item.eyes[1][0]-item.eyes[0][0])*180/Math.PI;
  const {data,info} = await sharp(source).rotate(degrees,{background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const theta=degrees*Math.PI/180, c=Math.cos(theta), s=Math.sin(theta);
  const transform = ([x,y]) => [c*(x-meta.width/2)-s*(y-meta.height/2)+info.width/2, s*(x-meta.width/2)+c*(y-meta.height/2)+info.height/2].map(Math.round);
  const [left,top,width,height]=item.window;
  await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).extract({left,top,width,height}).resize({width:500}).png().toFile(path.join(base,'research/epub',`${id}-upright-study.png`));
  result[id]={degrees,dimensions:[info.width,info.height],eyes:item.eyes.map(transform),points:Object.fromEntries(Object.entries(item.points).map(([key,point])=>[key,transform(point)])),window:item.window};
}
fs.writeFileSync(path.join(base,'research/epub','new-portrait-landmarks.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
