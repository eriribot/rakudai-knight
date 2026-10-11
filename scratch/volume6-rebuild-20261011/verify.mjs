import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const dir = path.join(root, '第六卷-世界书整理');
const recordDir = path.join(dir, '核验记录');
const sourcePath = path.join(root, '落第骑士英雄谭 第六卷 gbk.txt');
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
const errors = [];
const raw = fs.readFileSync(sourcePath);
const manifest = JSON.parse(fs.readFileSync(path.join(dir,'Gemini整理基线/20261011/manifest.json'),'utf8'));
const sourceHash = digest(raw);
if (sourceHash !== manifest.sourceSha256) errors.push('Source bytes changed');
const source = new TextDecoder('gb18030',{fatal:true}).decode(raw);
const lines = source.split(/\r\n|\r|\n/);
fs.mkdirSync(recordDir, {recursive:true});
fs.writeFileSync(path.join(recordDir,'第六卷原文_UTF8.txt'),source,'utf8');
const baseline = manifest.baseline.map(e => ({...e,unchanged:digest(fs.readFileSync(path.join(dir,'Gemini整理基线/20261011',e.path)))===e.sha256}));
if (baseline.some(e=>!e.unchanged)) errors.push('Frozen baseline changed');
const oldStats = JSON.parse(fs.readFileSync(path.join(dir,'Gemini整理基线/20261011/split_stats.json'),'utf8'));
const splits = oldStats.map(e => {
  const normalized = lines.slice(e.startLine-1,e.endLine).join('\n');
  const stored = fs.readFileSync(path.join(dir,e.file),'utf8').replace(/\r\n|\r/g,'\n');
  const matched = normalized.trimEnd() === stored.trimEnd();
  if (!matched) errors.push(`Split mismatch: ${e.file}`);
  return {...e,charCount:[...normalized].length,storedFileCharCount:[...stored].length,trimEndMatchesSource:matched};
});
fs.writeFileSync(path.join(dir,'split_stats.json'),JSON.stringify(splits,null,2)+'\n','utf8');
const mdPaths = [];
const walk = folder => {
 for(const e of fs.readdirSync(folder,{withFileTypes:true})){
  if(e.name==='Gemini整理基线' || e.name==='核验记录') continue;
  const p=path.join(folder,e.name);
  if(e.isDirectory())walk(p); else if(e.name.endsWith('.md'))mdPaths.push(p);
 }
};
walk(dir);
const docs = mdPaths.map(p=>{
 const bytes=fs.readFileSync(p);
 const s=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(s.includes('\uFFFD'))errors.push(`Replacement character: ${p}`);
 // Decoded source references are made persistent after authoring.
 const updated=s.replaceAll('scratch/volume6-rebuild-20261011/original.utf8.txt','第六卷-世界书整理/核验记录/第六卷原文_UTF8.txt');
 if(updated!==s)fs.writeFileSync(p,updated,'utf8');
 const missingLinks=[];
 for(const m of updated.matchAll(/\[[^\]]+\]\(([^\n)]+)\)/g)){
  const target=m[1].replace(/^<|>$/g,'').split('#')[0];
  if(!target||/^[a-z]+:\/\//i.test(target))continue;
  if(!fs.existsSync(path.resolve(path.dirname(p),decodeURIComponent(target))))missingLinks.push(target);
 }
 if(missingLinks.length)errors.push(`Missing links ${p}: ${missingLinks.join(', ')}`);
 const invalidRefs=[...updated.matchAll(/\bL(\d+)/g)].map(m=>Number(m[1])).filter(n=>n<1||n>lines.length);
 if(invalidRefs.length)errors.push(`Out of range source references: ${p}`);
 const blocks=[...updated.matchAll(/```xml\s*\n([\s\S]*?)\n```/g)].map(m=>m[1]);
 const relative=path.relative(dir,p).replaceAll('\\','/');
 if(/^(人物条目|场景条目|设定条目)\//.test(relative)&&!blocks.length)errors.push(`Missing XML: ${relative}`);
 return {path:relative,bytes:Buffer.byteLength(updated),sha256:digest(Buffer.from(updated)),xmlBlocks:blocks.length,missingLinks,invalidRefs};
});
const xml=JSON.parse(fs.readFileSync(path.join(root,'scratch/volume6-rebuild-20261011/xml-audit.json'),'utf8').replace(/^\uFEFF/,''));
if(xml.some(e=>!e.ok))errors.push('XML parse or six-segment check failed');
const counts={markdown:docs.length,scenes:docs.filter(e=>e.path.startsWith('场景条目/')).length,characters:docs.filter(e=>e.path.startsWith('人物条目/')).length,settings:docs.filter(e=>e.path.startsWith('设定条目/')).length,authorDocs:docs.filter(e=>!e.path.includes('/')).length,xmlBlocks:docs.reduce((sum,e)=>sum+e.xmlBlocks,0),baselineMarkdown:baseline.filter(e=>e.path.endsWith('.md')).length};
if(counts.markdown!==34||counts.scenes!==5||counts.characters!==18||counts.settings!==5||counts.authorDocs!==6)errors.push('Unexpected delivery counts');
const result={date:'2026-10-11',status:errors.length?'failed':'passed',source:{path:path.basename(sourcePath),bytes:raw.length,sha256:sourceHash,unchanged:sourceHash===manifest.sourceSha256,encoding:'gb18030',physicalLines:lines.length,decodedCharacters:[...source].length,lfNormalizedCharacters:[...source.replace(/\r\n|\r/g,'\n')].length,utf8CopySha256:digest(Buffer.from(source))},counts,baseline,splits,xml,docs,errors,scope:'Static Markdown author-source verification; not a SillyTavern import/runtime test'};
fs.writeFileSync(path.join(recordDir,'静态核验.json'),JSON.stringify(result,null,2)+'\n','utf8');
console.log(JSON.stringify({status:result.status,source:result.source,counts,errors},null,2));
if(errors.length)process.exitCode=1;
