import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const host = 'F:/SillyTavern-Launcher/SillyTavern';
const data = host + '/data/default-user';
const root = 'C:/Users/eriri/AppData/Local/Temp/rakudai-plot-bubble-repro-20261107';
const user = root + '/data/default-user';
const output = 'output/plot-bubble-repair-20261107';
const cardName = '落第x学战v0.02';
const bytes = fs.readFileSync(`${data}/characters/${cardName}.png`);
let card;
for (let offset=8; offset<bytes.length;) {
  const len=bytes.readUInt32BE(offset), type=bytes.toString('ascii',offset+4,offset+8);
  if(type==='tEXt') {
    const chunk=bytes.subarray(offset+8,offset+8+len), zero=chunk.indexOf(0), key=chunk.toString('utf8',0,zero);
    if(key==='chara'||key==='ccv3') card=JSON.parse(Buffer.from(chunk.toString('utf8',zero+1),'base64').toString('utf8'));
  }
  offset += len+12;
}
if(!card?.data) throw new Error('No card payload');
const book=card.data.extensions.world;
if(typeof book!=='string'||book.includes('/')||book.includes('\\')) throw new Error('Invalid worldbook');
for(const p of [user+'/characters',user+'/worlds',user+'/chats/'+cardName,root+'/baseline',output+'/diagnosis']) fs.mkdirSync(p,{recursive:true});
fs.copyFileSync(`${data}/characters/${cardName}.png`,`${user}/characters/${cardName}.png`);
fs.copyFileSync(`${data}/worlds/${book}.json`,`${user}/worlds/${book}.json`);
const chats=fs.readdirSync(`${data}/chats/${cardName}`).filter(n=>n.endsWith('.jsonl')).sort((a,b)=>fs.statSync(`${data}/chats/${cardName}/${b}`).mtimeMs-fs.statSync(`${data}/chats/${cardName}/${a}`).mtimeMs);
if(chats[0]) fs.copyFileSync(`${data}/chats/${cardName}/${chats[0]}`,`${user}/chats/${cardName}/${chats[0]}`);
// Settings without credentials; secrets.json, other cards and other chats are not copied.
const settings=JSON.parse(fs.readFileSync(`${data}/settings.json`,'utf8'));
settings.main_api='openai';
fs.writeFileSync(`${user}/settings.json`,JSON.stringify(settings));
fs.copyFileSync(host+'/config.yaml',root+'/config.yaml');
fs.writeFileSync(root+'/baseline/card.json',JSON.stringify(card));
const flatten = list => (list||[]).flatMap(x=>x.type==='folder'?flatten(x.scripts):[x]);
const helper=card.data.extensions.tavern_helper;
const scripts=flatten(helper?.scripts || (Array.isArray(helper)?helper:[]));
for(const s of scripts) fs.writeFileSync(`${root}/baseline/${s.id}.json`,JSON.stringify(s,null,2));
const receipt={deliveryMode:'component',scope:['学战终端剧情控制','剧情缺失章防护','双语气泡格式约定'],card:cardName,cardSha256:crypto.createHash('sha256').update(bytes).digest('hex'),worldbook:book,temporaryDirectory:root,port:18008,scripts:scripts.map(({id,name,enabled,content})=>({id,name,enabled,sha256:crypto.createHash('sha256').update(content||'').digest('hex')})),chatCopied:Boolean(chats[0]),productionMutation:false};
fs.writeFileSync(`${output}/scope-receipt.json`,JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt,null,2));
