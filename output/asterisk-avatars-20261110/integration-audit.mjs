import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root = process.cwd();
const out = path.join(root, 'output/asterisk-avatars-20261110');
const read = file => fs.readFileSync(path.join(root, file));
const json = file => JSON.parse(read(file).toString('utf8').replace(/^\uFEFF/, ''));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const now = json('scripts/正文气泡/asterisk-portraits.json');
const before = json('output/asterisk-avatars-20261110/before/asterisk-portraits.json');
const knights = json('resource/knightavatars/manifest.json');
const artifact = json('世界书规则/MVU/落第骑士-小手机-v1.3.29-B1-头像更新.json');
const newIds = ['ophelia','irene','priscilla','corona','rimcy','ardy'];
const results = [];
const details = {};
function check(name, fn) { try { fn(); results.push({name,passed:true}); } catch(error) { results.push({name,passed:false,error:error.message}); } }
const normalize = name => name.normalize('NFKC').replace(/[\s·・･‧•．.]/g, '').toLowerCase();
let portraits;
check('Actual delivered B1 contains parseable contactPortraits index', () => {
  const line = artifact.content.split('\n').find(line => /^\s*const ASTERISK_APP_HTML = /.test(line));
  assert.ok(line, 'ASTERISK_APP_HTML declaration');
  const html = JSON.parse(line.replace(/^\s*const ASTERISK_APP_HTML = /, '').replace(/;\s*$/, ''));
  const indexLine = html.split('\n').find(line => /^\s*var contactPortraits = /.test(line));
  assert.ok(indexLine, 'contactPortraits declaration');
  portraits = JSON.parse(indexLine.replace(/^\s*var contactPortraits = /, '').replace(/;\s*$/, ''));
  assert.ok(portraits.byName && portraits.entries);
  details.contactIndex = {entries:Object.keys(portraits.entries).length, normalizedNames:Object.keys(portraits.byName).length};
});
let mappedNames = 0;
for (const id of newIds) check('Actual delivered contact portraits map '+id+' and all declared aliases', () => {
  assert.ok(portraits);
  const person = now.characters.find(person => person.id === id);
  assert.ok(person, id);
  const expectedId = 'asterisk-' + id;
  const entry = portraits.entries[expectedId];
  assert.equal(entry.src, person.imageUrl);
  assert.equal(entry.world, 'asterisk');
  const [x,y,w,h] = person.portraitCrop;
  assert.equal(entry.style, `width:${person.width / w * 100}%;height:${person.height / h * 100}%;left:${-x / w * 100}%;top:${-y / h * 100}%;`);
  for (const name of [person.name,...person.aliases]) { assert.equal(portraits.byName[normalize(name)], expectedId, name); mappedNames++; }
});
check('All 42 knight and 21 asterisk characters have no normalized cross-character alias collisions', () => {
  const owners = new Map(), collisions = [];
  for (const [world,characters] of [['rakudai',knights.characters],['asterisk',now.characters]]) for (const person of characters) for (const name of [person.name,...person.aliases]) {
    const key = normalize(name), owner = world+'-'+person.id;
    if (owners.has(key) && owners.get(key) !== owner) collisions.push({name,previous:owners.get(key),owner});
    else owners.set(key, owner);
  }
  details.normalization = {knights:knights.characters.length,asterisk:now.characters.length,normalizedNames:owners.size,collisions};
  assert.deepEqual(collisions, []);
});
check('Rule 02 candidate artifact is byte-identical to before snapshot', () => {
  const previous = read('output/asterisk-avatars-20261110/before/dialogue-player-candidates.regex.json');
  const current = read('scripts/正文气泡/发布/components/dialogue-player-candidates.regex.json');
  details.rule02 = {beforeSha256:hash(previous),afterSha256:hash(current),bytes:current.length};
  assert.deepEqual(current, previous);
});
check('Previous first 15 portrait manifest entries are unchanged and exactly six are appended', () => {
  assert.equal(before.characters.length,15);
  assert.equal(now.characters.length,21);
  assert.deepEqual(now.characters.slice(0,15),before.characters);
  assert.deepEqual(now.characters.slice(15).map(person=>person.id),newIds);
  const {characters:oldCharacters,...oldMetadata} = before;
  const {characters:newCharacters,...newMetadata} = now;
  assert.deepEqual(newMetadata,oldMetadata);
  details.previousEntries = {unchanged:15,newIds};
});
details.newNameMappings = mappedNames;
const report = {generatedAt:new Date().toISOString(),scope:'Offline actual delivered JSON audit; no SillyTavern runtime access',passed:results.filter(r=>r.passed).length,total:results.length,results,details};
fs.writeFileSync(path.join(out,'integration-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.passed !== report.total) process.exitCode=1;
