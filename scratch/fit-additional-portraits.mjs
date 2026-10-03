import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/eriri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve('resource/knightavatars'), settings=JSON.parse(fs.readFileSync('scripts/黑白ADV轮盘终端/avatar-fit.json','utf8'));
const script=fs.readFileSync('scripts/黑白ADV轮盘终端/prepare-avatars.mjs','utf8');
const {shieldInterior,bounds,chooseCrop}=vm.runInNewContext(script.slice(script.indexOf('function shieldInterior'),script.indexOf('const frameSource'))+';({shieldInterior,bounds,chooseCrop})',{Buffer});
const frame=await sharp(path.join(root,'shield-frame.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const fullMask=shieldInterior(frame.data,frame.info.width,frame.info.height);
const width=434,height=580;
const mask=await sharp(fullMask,{raw:{width:frame.info.width,height:frame.info.height,channels:1}}).resize(width,height).toColourspace('b-w').raw().toBuffer();
const box=bounds(mask,width,height);
const candidates={
  sara:[[515,1140,800,1010],[550,1230,670,890],[600,1260,600,850],[610,1250,580,810],[630,1290,570,740],[560,1330,630,790]],
  rinna:[[270,250,1000,1300],[310,310,900,1220],[325,345,870,1180],[290,360,920,1190],[350,415,810,1110]],
};
for(const [id,windows] of Object.entries(candidates)){
  const fit=settings.characters[id];
  const source=path.join(root,fit.sourceFile||`novel/${id}.jpg`);
  const eyes=fit.levelEyes, degrees=-Math.atan2(eyes[1][1]-eyes[0][1],eyes[1][0]-eyes[0][0])*180/Math.PI;
  const raw=await sharp(source).rotate(degrees,{background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const window of windows){
    try{
      const crop=chooseCrop({...fit,window},box,mask,width,height,raw);
      const portrait=await sharp(raw.data,{raw:{width:raw.info.width,height:raw.info.height,channels:4}}).extract(crop).resize(box.width,box.height).png().toBuffer();
      const canvas=await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:portrait,left:box.left,top:box.top}]).raw().toBuffer();
      for(let i=0;i<mask.length;i++)canvas[i*4+3]=Math.round(canvas[i*4+3]*mask[i]/255);
      const file=path.join(root,'research/epub',`${id}-fit-${window.join('-')}.png`);
      await sharp(canvas,{raw:{width,height,channels:4}}).composite([{input:await sharp(path.join(root,'shield-frame.png')).resize(width,height).png().toBuffer()}]).png().toFile(file);
      console.log(JSON.stringify({id,window,crop,file}));
    }catch(e){console.log(JSON.stringify({id,window,error:e.message}));}
  }
}
