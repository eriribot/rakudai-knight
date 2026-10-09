import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const scratch = path.resolve(here, '../../scratch');
fs.mkdirSync(scratch, { recursive: true });
function fixture(fn) {
  const root = fs.mkdtempSync(path.join(scratch, 'card-compat-test-'));
  const card = name => ({ spec: 'chara_card_v3', spec_version: '3.0', name,
    data: { name, character_version: '', description: 'literal $() and `text`', extensions: { regex_scripts: [], tavern_helper: { scripts: [], variables: {} } } } });
  const old = path.join(root, 'old.json'), fresh = path.join(root, 'new.json'), out = path.join(root, 'result.json');
  fs.writeFileSync(old, JSON.stringify(card('旧卡')));
  fs.writeFileSync(fresh, JSON.stringify(card('新卡')));
  const run = extra => spawnSync(process.execPath, [path.join(here, 'compat-update.mjs'), '--old', old, '--new', fresh,
    '--version', '0.08', '--out', out, ...extra], { encoding: 'utf8' });
  try { fn({ root, old, fresh, out, run }); }
  finally {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved).toLowerCase(), fs.realpathSync(scratch).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('card-compat-test-'));
    fs.rmSync(resolved, { recursive: true });
  }
}

test('default is dry-run, no output or source mutation', () => fixture(({ old, fresh, out, run }) => {
  const before = [fs.readFileSync(old), fs.readFileSync(fresh)];
  const result = run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).mode, 'dry-run');
  assert.equal(fs.existsSync(out), false);
  assert.equal(fs.existsSync(out + '.report.json'), false);
  assert.deepEqual([fs.readFileSync(old), fs.readFileSync(fresh)], before);
}));
test('write creates checked card plus report, then refuses overwrite', () => fixture(({ out, run }) => {
  const result = run(['--write']);
  assert.equal(result.status, 0, result.stderr);
  const card = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(card.name, '旧卡');
  assert.equal(card.data.name, '旧卡');
  assert.equal(card.data.character_version, '0.08');
  const before = fs.readFileSync(out);
  const repeat = run(['--write']);
  assert.equal(repeat.status, 1);
  assert.deepEqual(fs.readFileSync(out), before);
  assert.equal(JSON.parse(fs.readFileSync(out + '.report.json', 'utf8')).mode, 'write-new-file');
}));
test('existing report prevents creating a card', () => fixture(({ out, run }) => {
  fs.writeFileSync(out + '.report.json', 'keep');
  assert.equal(run(['--write']).status, 1);
  assert.equal(fs.existsSync(out), false);
  assert.equal(fs.readFileSync(out + '.report.json', 'utf8'), 'keep');
}));
test('duplicate and unknown options fail before writes', () => fixture(({ out, run }) => {
  assert.equal(run(['--out', out]).status, 1);
  assert.equal(run(['--force']).status, 1);
  assert.equal(fs.existsSync(out), false);
}));
test('input/output alias rejected', () => fixture(({ old, fresh }) => {
  const before = fs.readFileSync(old);
  const result = spawnSync(process.execPath, [path.join(here, 'compat-update.mjs'), '--old', old, '--new', fresh,
    '--version', '0.08', '--out', old, '--write'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.deepEqual(fs.readFileSync(old), before);
}));
test('output format cannot silently differ from its extension', () => fixture(({ old, fresh, root }) => {
  const output = path.join(root, 'wrong.png');
  const result = spawnSync(process.execPath, [path.join(here, 'compat-update.mjs'), '--old', old, '--new', fresh,
    '--version', '0.08', '--out', output, '--write'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(output), false);
}));
