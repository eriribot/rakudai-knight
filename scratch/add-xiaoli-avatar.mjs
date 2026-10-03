import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('C:/Users/eriri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve('resource/knightavatars');
const manifestFile=path.join(root,'manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
if(manifest.characters.some(c=>c.id==='xiaoli'))throw new Error('xiaoli already exists; do not overwrite.');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const sourceFile='novel/xiaoli-original.jpg';
const colorFile='color/xiaoli-colorized.png';
const original=await sharp(path.join(root,sourceFile)).metadata();
const color=await sharp(path.join(root,colorFile)).metadata();
const levelEyes=[[493,197],[653,248]];
const angle=-Math.atan2(levelEyes[1][1]-levelEyes[0][1],levelEyes[1][0]-levelEyes[0][0]);
const oriented=await sharp(path.join(root,colorFile)).rotate(angle*180/Math.PI,{background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const point=([x,y])=>[Math.round(Math.cos(angle)*(x-color.width/2)-Math.sin(angle)*(y-color.height/2)+oriented.info.width/2),Math.round(Math.sin(angle)*(x-color.width/2)+Math.cos(angle)*(y-color.height/2)+oriented.info.height/2)];
const eye=point([(levelEyes[0][0]+levelEyes[1][0])/2,(levelEyes[0][1]+levelEyes[1][1])/2]);
const cropWidth=Math.round(430*color.width/796),cropHeight=Math.round(cropWidth*472/393);
const fitFile=path.resolve('scripts/黑白ADV轮盘终端/avatar-fit.json');
const fitText=fs.readFileSync(fitFile,'utf8');
const fit=JSON.parse(fitText);
if(fit.characters.xiaoli)throw new Error('Existing xiaoli fit.');
const newFit={sourceFile:colorFile,levelEyes,window:[Math.max(0,Math.round(eye[0]-cropWidth*.52)),Math.max(0,Math.round(eye[1]-cropHeight*.46)),cropWidth,cropHeight+Math.round(70*color.width/796)],eye,protect:[...levelEyes,[553,325],[536,383],[535,432]].map(point),eyeTarget:.46,eyeTargetX:.52};
const closing=fitText.lastIndexOf('\n  }');
if(closing<0)throw new Error('Fit formatting changed.');
fs.writeFileSync(fitFile,fitText.slice(0,closing).trimEnd()+',\n    "xiaoli": '+JSON.stringify(newFit)+fitText.slice(closing));
manifest.characters.push({id:'xiaoli',name:'福小莉',aliases:['Fu Xiaoli','Xiaoli Fu'],file:sourceFile,
  sourceEpub:'39688/[台版]落第骑士英雄谭 12.epub',sourceMember:'OEBPS/Images/014.jpg',sourceUrl:'',sourcePage:'',hasShieldFrame:false,
  sourceStyle:'novel-monochrome-illustration',sourceStatus:'verified-local-epub-ai-colorized',width:original.width,height:original.height,sha256:hash(sourceFile),imageUrl:'',
  identityEvidence:'research/epub/character-evidence.json#xiaoli',colorization:{type:'ai-colorized-derivative',mode:'built-in',file:colorFile,record:'research/epub/xiaoli-colorization.json',
    note:'第12卷原黑白插图上色。第18卷明写黑发与黝黑肤色；具体棕色深浅、常态瞳色和束带色为艺术配色，非官方原生彩图。保留原白囚衣、束带及胸前锁链。'}});
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
const evidenceFile=path.join(root,'research/epub/character-evidence.json');
const evidence=JSON.parse(fs.readFileSync(evidenceFile,'utf8'));
if(evidence.characters.some(c=>c.id==='xiaoli'))throw new Error('Existing xiaoli evidence.');
evidence.characters.push({id:'xiaoli',name:'福小莉',sourceEpub:'39688/[台版]落第骑士英雄谭 12.epub',imageMember:'OEBPS/Images/014.jpg',
  evidence:[{xhtml:'OEBPS/Text/Chapter003.xhtml',location:'第12卷；XHTML第1389行',excerpt:'女孩的皮肤与发色偏深，全身穿着附有束带的白囚衣'},
    {xhtml:'OEBPS/Text/Chapter003.xhtml',location:'第12卷；插图第1399行后第1404行具名',excerpt:'「福小莉！？」'},
    {sourceEpub:'39688/落第骑士英雄谭 - 18.epub',xhtml:'OEBPS/Text/chapter4.xhtml',location:'第18卷第4章；XHTML第211行，222行具名',excerpt:'一名肤色黝黑的黑发女孩，从爱德怀斯身后冒出来。'}],
  detailedEvidence:'research/epub/xiaoli-evidence.json',colorizationRecord:'research/epub/xiaoli-colorization.json',displayVariant:'第12卷黑白插图AI上色；黑发与较深肤色有原文依据，精确棕色、常态瞳色、束带与金属配色为艺术补色。'});
fs.writeFileSync(evidenceFile,JSON.stringify(evidence,null,2)+'\n');
await sharp(oriented.data,{raw:oriented.info}).png().toFile(path.join(root,'research/review/xiaoli-upright-study.png'));
console.log(JSON.stringify({added:'xiaoli',total:manifest.characters.length,rotationDegrees:angle*180/Math.PI,orientedSize:[oriented.info.width,oriented.info.height],fit:newFit}));
