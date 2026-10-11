import fs from 'node:fs';
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['世界书规则/v0.3/导出/落第骑士英雄谭.json', '落第骑士英雄谭v0.05.json', '落第骑士英雄谭v0.03.json'];
const rules = {
  infinity: /Infinity|无上限|魔力无限|S\s*级|S\s*級/,
  absoluteHit: /Natural\s*20|自然\s*20|绝对命中|无视目标一切|无视一切物理/,
  bukyokuBuff: /北境霸权|六维整体判定基准提高一级|六维.{0,30}提高一级/,
  heatVanish: /热力学法术|火属性完全无效|强制消散判定|强制熄灭一切火焰异能/,
};
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8'), json = JSON.parse(raw);
  const entries = json.entries ? Object.values(json.entries) : json.data?.character_book?.entries ?? json.character_book?.entries ?? [];
  console.log('FILE', file, 'entries', entries.length, 'rootKeys', Object.keys(json));
  for (const entry of entries) {
    const content = String(entry.content ?? '');
    const hit = Object.entries(rules).filter(([, r]) => r.test(content));
    if (!hit.length) continue;
    const encoded = JSON.stringify(content), pos = raw.indexOf(encoded);
    console.log(JSON.stringify({id:entry.uid??entry.id,name:entry.comment??entry.name, line:pos<0?null:raw.slice(0,pos).split('\n').length, disable:entry.disable, enabled:entry.enabled, constant:entry.constant, selective:entry.selective, keys:entry.key??entry.keys, position:entry.position, probability:entry.probability, useProbability:entry.useProbability, cases:hit.map(([name, r])=>({name, phrase:content.match(r)[0], excerpt:content.slice(Math.max(0, content.search(r)-100),content.search(r)+220)}))}, null,2));
  }
  console.log('SCRIPT_NAMES', JSON.stringify(json.data?.extensions?.tavern_helper?.scripts?.map(s=>({name:s.name, enabled:s.enabled})),null,2));
}
