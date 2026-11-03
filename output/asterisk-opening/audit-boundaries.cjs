const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(__dirname, 'asterisk-mode.js'), 'utf8');
const html = fs.readFileSync(path.join(root, '第一卷-世界书整理/开局网页正则替换/index.html'), 'utf8');
const fields = ['name', 'personality', 'conduct', 'school', 'device', 'nobleArt', 'otherAbilities', 'category', 'desc', 'ability', 'limits', 'style'];
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { value: '', checked: false, hidden: false, disabled: false, required: false, textContent: '' });
  return nodes.get(id);
}
let replayCalls = 0;
const c = {
  openingWorldInitializing: false,
  window: { OpeningPrelude: { replay() { replayCalls++; } } },
  OPENING_CHAPTERS: ['待选择', '序章'],
  OPENING_FIELDS: Object.fromEntries(fields.map(key => [key, 'field-' + key])),
  FIELD_LIMITS: Object.fromEntries(fields.map(key => [key, 6000])),
  CONTEXT_FIELDS: { 当前身体: 'body', 当前能力边界: 'abilities', 本局映射: 'mapping' },
  SCENE_FIELDS: { 当前章: 'chapter', 时间: 'time', 地点: 'location', 切入说明: 'entry' },
  AXIS_LABELS: { attack: '攻击力', defense: '防御力', magic: '魔力量', control: '魔力控制', physical: '体能', luck: '运气' },
  ARCHIVE_FORMAT: 'tavern-opening-profile', ARCHIVE_VERSION: 6, ARCHIVE_LIMIT: 2097152,
  openingCommitBusy: false, bgmAudio: null, avatarState: 'placeholder', activeStartProfile: 'user',
  document: { getElementById: node },
  parseAbilityLines(text) {
    if (text === '半写招式｜说明') throw new Error('能力列表尚未完成');
    return {};
  },
  validateScene: scene => scene
};
vm.createContext(c);
vm.runInContext(source, c);
const applySource = html.match(/function applyOpeningDraft\(draft, restoreMemory\) \{[\s\S]*?\n      \}\n\n      function loadArchiveImage/);
assert.ok(applySource, 'integrated draft restore function is present');
vm.runInContext(applySource[0].replace(/\n\n      function loadArchiveImage$/, ''), c);
c.invalidateOpeningWorld = () => {};
c.applyWorldSkin = () => {};
c.switchScene = () => {};
c.syncCard = () => {};
c.setSceneInputs = scene => Object.entries(c.SCENE_FIELDS).forEach(([key, id]) => { node(id).value = scene[key] || ''; });
c.applyArchiveAvatar = () => { c.avatarState = 'placeholder'; };
c.loadPreset = () => {
  Object.entries(c.OPENING_FIELDS).forEach(([key, id]) => { node(id).value = key === 'school' ? '破军学园' : ''; });
  c.setSceneInputs({ 当前章: '待选择' });
};
c.loadAsteriskPreset = () => {
  c.loadPreset();
  node(c.OPENING_FIELDS.school).value = c.AST_SCHOOLS[c.activeAcademyId].name;
  c.applyAsteriskFields();
};
c.readOpeningDraft = () => {
  if (c.activeOpeningWorld === 'asterisk') return c.readAsteriskDraft();
  return {
    world_id: 'rakudai', profile_key: 'user', avatar: null, greeting: '', context: {}, scene: { 当前章: '待选择' },
    profile: { ...Object.fromEntries(Object.entries(c.OPENING_FIELDS).map(([key, id]) => [key, node(id).value])), stats: {} }
  };
};

c.activeOpeningWorld = 'asterisk';
c.loadAsteriskPreset();
node(c.OPENING_FIELDS.name).value = '未完成的学战人物';
node('aw-rank-status').value = 'ranked';
node('aw-rank-number').value = '';
node(c.OPENING_FIELDS.nobleArt).value = '半写招式｜说明';
const incomplete = c.readAsteriskDraft();
c.chooseOpeningWorld('rakudai');
c.chooseOpeningWorld('asterisk');
assert.equal(c.activeOpeningWorld, 'asterisk');
assert.equal(node(c.OPENING_FIELDS.name).value, incomplete.profile.name);
assert.equal(node(c.OPENING_FIELDS.nobleArt).value, incomplete.profile.nobleArt);
assert.equal(node('aw-rank-status').value, 'ranked');
assert.equal(node('aw-rank-number').value, '');
assert.equal(replayCalls, 0, 'switching worlds does not replay OP');
assert.throws(() => c.validateAsteriskArchive(incomplete), 'external archive still rejects unfinished content');

node(c.OPENING_FIELDS.nobleArt).value = '';
node('aw-rank-status').value = 'unranked';
const valid = JSON.parse(JSON.stringify(c.readAsteriskDraft()));
vm.runInContext(fs.readFileSync(path.join(__dirname, 'asterisk-prompts.js'), 'utf8'), c);
c.CHARACTER_SCOPE_PROMPT = '';
for (const rank of [1, 12, 13, 72]) {
  const ranked = JSON.parse(JSON.stringify(valid));
  ranked.asterisk.rank_status = 'ranked'; ranked.asterisk.rank = rank;
  const clean = c.validateAsteriskArchive(ranked);
  assert.equal(clean.asterisk.rank, rank);
  const label = c.asteriskRankLabel(clean.asterisk);
  assert.match(label, rank <= 12 ? /始页十二人/ : /在名祭祀书/);
  assert.match(label, new RegExp('序列第 ' + rank + ' 位'));
  const assistance = c.buildAsteriskAssistancePrompt(clean);
  const greeting = c.buildAsteriskGreetingPrompts(clean);
  for (const prompt of [assistance, greeting[0].content]) {
    assert.match(prompt, /每所学园各有72个在名序列名额/);
    assert.match(prompt, /第1–12名/);
    assert.match(prompt, /第13–72名同样在榜/);
    assert.match(prompt, /第1卷第1章《华焰魔女》/);
  }
  assert.equal(JSON.parse(greeting[1].content).locked.rank, rank);
  assert.match(assistance, new RegExp('"rank":' + rank + '(?:,|})'));
  assert.match(c.buildAsteriskOpeningMessage(clean), /每所学园各有 72 个在名序列名额/);
}
for (const rank of [0, 73, 12.5]) {
  const invalid = JSON.parse(JSON.stringify(valid));
  invalid.asterisk.rank_status = 'ranked'; invalid.asterisk.rank = rank;
  assert.throws(() => c.validateAsteriskArchive(invalid), /1–72/);
}
for (const id of ['seidoukan', 'gallardworth', 'jielong', 'rewolf', 'arlequint']) {
  const draft = JSON.parse(JSON.stringify(valid));
  draft.school_id = id; draft.profile.school = c.AST_SCHOOLS[id].name;
  draft.profile.stats = { attack: 'A' }; draft.profile.rank = 'A';
  const clean = c.validateAsteriskArchive(draft);
  assert.equal(clean.school_id, id);
  assert.equal(clean.profile.stats, undefined);
  assert.equal(clean.profile.rank, undefined);
}
const forbidden = JSON.parse(JSON.stringify(valid));
forbidden.school_id = 'queenvail'; forbidden.profile.school = c.AST_SCHOOLS.queenvail.name;
assert.throws(() => c.validateAsteriskArchive(forbidden));
for (const id of ['__proto__', 'constructor', 'toString', 'queenvail', 'not-a-school']) {
  const before = c.activeAcademyId;
  c.selectAcademy(id);
  assert.equal(c.activeAcademyId, before, 'reject invalid or disabled school ' + id);
}
assert.match(source, /hasOwnProperty\.call\(AST_SCHOOLS,school\)/, 'URL school lookup uses own-property allowlist');
const media = JSON.parse(html.match(/var OPENING_ASTERISK_MEDIA=(\{[^\n]+\});/)[1]);
function renderNode(tag) {
  return { tagName: tag.toUpperCase(), dataset: {}, children: [], attrs: {}, style: { setProperty() {} },
    setAttribute(key, value) { this.attrs[key] = value; }, append(child) { this.children.push(child); } };
}
const grid = renderNode('div');
nodes.set('aw-school-grid', grid);
node('aw-prompt-preview').addEventListener = () => {};
c.document.createElement = renderNode;
c.initializeNovelWorld = () => {};
c.updatePromptPreview = () => {};
c.location = { search: '' };
c.URLSearchParams = URLSearchParams;
c.OPENING_ASTERISK_MEDIA = media;
c.openingMediaUrl = file => new URL(file, 'http://127.0.0.1:18737/assets/asterisk/').href;
c.initializeWorldUI();
assert.deepEqual(grid.children.map(button => button.dataset.schoolId), ['seidoukan', 'gallardworth', 'jielong', 'rewolf', 'arlequint']);
for (const button of grid.children) {
  const image = button.children.find(child => child.tagName === 'IMG');
  assert.ok(image, 'each school renders an actual image');
  assert.equal(image.src, c.openingMediaUrl(media.emblems[button.dataset.schoolId]));
  assert.match(image.alt, /校徽$/);
}
assert.equal(grid.children.some(button => button.dataset.schoolId === 'queenvail'), false);
console.log('PASS: incomplete draft roundtrip; no OP replay; rank 1/12/13/72 accepted, 0/73/fraction rejected; both prompts keep per-school 72 slots and 1–12/13–72 distinction; five emblem cards; disabled/invalid schools rejected; old ratings removed.');
