import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const readMessageWorld = vm.runInNewContext(fs.readFileSync(new URL('state-reader.js', import.meta.url), 'utf8') + '\nreadMessageWorld;');
const slot = world => ({ stat_data: { 系统: { 作品: world } } });
const messages = [
  { message_id: 0, swipe_id: 0, swipes_data: [slot('rakudai')] },
  null,
  { message_id: 2, swipe_id: 1, swipes_data: [slot('rakudai'), slot('asterisk')] },
  null,
  { message_id: 4, swipe_id: 1, swipes_data: [slot('rakudai'), {}] },
];
let reads = [];
const read = (id, options) => {
  assert.deepEqual(JSON.parse(JSON.stringify(options)), { role: 'assistant', include_swipes: true });
  reads.push(id);
  return messages[id] ? [messages[id]] : [];
};
assert.equal(readMessageWorld(read, 0), 'rakudai');
assert.deepEqual(reads, [0]);
assert.equal(readMessageWorld(read, 1), 'rakudai');
assert.equal(readMessageWorld(read, 2), 'asterisk');
assert.equal(readMessageWorld(read, 3), 'asterisk');
assert.equal(readMessageWorld(read, 4), 'asterisk');
messages[2].swipe_id = 0;
assert.equal(readMessageWorld(read, 3), 'rakudai');
messages[0].swipes_data = [{}];
reads = [];
assert.equal(readMessageWorld(read, 0), null);
assert.deepEqual(reads, [0]);
assert.equal(readMessageWorld(read, null), null);
assert.equal(readMessageWorld(null, 2), null);
console.log('PASS: historical message worlds, active swipes, user-floor inheritance and no future fallback.');
