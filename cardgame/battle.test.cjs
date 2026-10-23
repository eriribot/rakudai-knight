'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CARDS, INTENTS, createBattle, playCard, endTurn, snapshot, cardAvailability, currentIntent } = require('./battle.js');
const piles = ['hand', 'draw', 'discard', 'exhaust'];
const allCards = state => piles.flatMap(pile => state[pile]);
const instance = (state, id) => {
  const card = state.hand.find(card => card.id === id);
  assert.ok(card, id + ' must be in hand');
  return card;
};
const play = (state, id) => {
  const result = playCard(state, instance(state, id).uid);
  assert.equal(result.ok, true, result.reason);
  return result;
};
const bringToHand = (state, id) => {
  const index = state.draw.findIndex(card => card.id === id);
  assert.ok(index >= 0, id + ' must be in draw pile');
  state.hand.push(...state.draw.splice(index, 1));
};
const assertConserved = state => {
  const cards = allCards(state);
  assert.equal(cards.length, 15);
  assert.equal(new Set(cards.map(card => card.uid)).size, 15);
  assert.ok(state.hand.length <= 10);
  assert.ok(state.energy >= 0 && state.energy <= state.maxEnergy);
  assert.ok(state.insight >= 0 && state.insight <= 100);
  assert.ok(state.enemy.barrier >= 0);
  for (const actor of [state.player, state.enemy]) {
    assert.ok(actor.hp >= 0 && actor.hp <= actor.maxHp);
    assert.ok(actor.mp >= 0 && actor.mp <= actor.maxMp);
    assert.ok(actor.block >= 0);
  }
  assert.ok(cards.every(card => Object.hasOwn(CARDS, card.id)));
  assert.ok(cards.every(card => !/rasetsu|羅刹|罗刹/i.test(card.id)));
};
const assertRejectedWithoutMutation = (state, uid) => {
  const before = snapshot(state);
  const availability = cardAvailability(state, uid);
  assert.equal(availability.ok, false);
  assert.ok(typeof availability.reason === 'string' && availability.reason.length > 0);
  assert.deepEqual(state, before, 'availability must be read-only');
  const result = playCard(state, uid);
  assert.equal(result.ok, false);
  assert.equal(result.reason, availability.reason, 'preview and execution use the same rejection');
  assert.deepEqual(state, before, 'rejection must not spend, draw, log, or change state');
};

test('the duel starts with separate stamina, MP, AP, and a fixed fifteen-card build', () => {
  const state = createBattle();
  assert.deepEqual(state.player, { hp: 100, maxHp: 100, mp: 10, maxMp: 10, block: 0, glancing: false });
  assert.deepEqual(state.enemy, { hp: 120, maxHp: 120, mp: 3000, maxMp: 3000, block: 0, barrier: 0 });
  assert.equal(state.insight, 0);
  assert.equal(state.energy, 3);
  assert.equal(state.maxEnergy, 3);
  assert.equal(state.nextAttackBonus, 0);
  assert.deepEqual(state.hand.map(card => card.id), ['insight', 'guard', 'riposte', 'slash', 'shura']);
  assert.deepEqual(state.draw.map(card => card.id), ['step', 'slash', 'guard', 'slash', 'insight', 'riposte', 'step', 'guard', 'slash', 'riposte']);
  assertConserved(state);
});

test('the guarded opening deals 34 damage, takes four stamina, and earns 55 insight', () => {
  const state = createBattle();
  play(state, 'insight');
  assert.equal(state.hand.at(-1).id, 'step');
  assert.equal(state.insight, 20);
  play(state, 'guard');
  play(state, 'riposte');
  play(state, 'slash');
  assert.equal(state.enemy.hp, 86, '18 + 4 from riposte, then 12 from slash');
  assert.equal(state.insight, 40);
  assert.equal(state.energy, 0);
  assert.equal(state.nextAttackBonus, 0);
  endTurn(state);
  assert.equal(state.player.hp, 96, '14 block leaves 8 from the 22-point strike; active guard caps it at 4');
  assert.equal(state.player.block, 0);
  assert.equal(state.player.glancing, false);
  assert.equal(state.insight, 55, 'a defended attack awards insight only once');
  assert.equal(state.player.mp, 10);
  assert.equal(state.enemy.mp, 2940);
  assert.equal(state.intentIndex, 1);
  assert.equal(state.turn, 2);
  assert.equal(state.energy, 3);
  assert.equal(state.hand.length, 5);
  assertConserved(state);
});

test('stale clicks, absent cards, and unknown definitions cannot mutate the duel', () => {
  const state = createBattle();
  assertRejectedWithoutMutation(state, 'not-a-card');
  const insight = instance(state, 'insight');
  play(state, 'insight');
  assertRejectedWithoutMutation(state, insight.uid);
  state.hand[0].id = 'unknown-definition';
  assertRejectedWithoutMutation(state, state.hand[0].uid);
});

test('availability and execution share AP and MP checks without partially paying costs', () => {
  const state = createBattle();
  const shura = instance(state, 'shura');
  state.energy = 1;
  assertRejectedWithoutMutation(state, shura.uid);
  state.energy = 3;
  state.player.mp = 9;
  assertRejectedWithoutMutation(state, shura.uid);
  state.player.mp = 10;
  const before = snapshot(state);
  assert.equal(cardAvailability(state, shura.uid).ok, true);
  assert.deepEqual(state, before);
  state.energy = 0;
  assertRejectedWithoutMutation(state, instance(state, 'slash').uid);
  assert.equal(cardAvailability(state, instance(state, 'insight').uid).ok, true);
  play(state, 'insight');
  assert.equal(state.energy, 0, 'zero-AP observation remains usable');
});

test('riposte requires actual block for its bonus, not just the guard flag', () => {
  const unguarded = createBattle();
  unguarded.player.glancing = true;
  play(unguarded, 'riposte');
  assert.equal(unguarded.enemy.hp, 110);
  const guarded = createBattle();
  play(guarded, 'guard');
  play(guarded, 'riposte');
  assert.equal(guarded.enemy.hp, 102);
  assert.equal(guarded.insight, 10);
});

test('step supplies seven block and one draw, without the four-point glancing cap', () => {
  const state = createBattle();
  bringToHand(state, 'step');
  const handSize = state.hand.length;
  play(state, 'step');
  assert.equal(state.hand.length, handSize);
  assert.equal(state.player.block, 7);
  assert.equal(state.player.glancing, false);
  assert.equal(state.energy, 2);
  endTurn(state);
  assert.equal(state.player.hp, 85, 'seven block leaves fifteen damage from the 22-point strike');
  assert.equal(state.insight, 15);
  assertConserved(state);
});

test('active guard caps a heavy attack remainder at four and awards insight once', () => {
  const state = createBattle();
  state.intentIndex = 2;
  play(state, 'guard');
  assert.equal(state.player.glancing, true);
  endTurn(state);
  assert.equal(state.player.hp, 96, '42 - 14 is capped to 4 after playing guard');
  assert.equal(state.insight, 15, 'block plus glancing must not award 30');
  assert.equal(state.player.glancing, false);
  assert.equal(state.player.block, 0);
  assert.equal(state.enemy.mp, 2760);
});

test('glancing works after block depletion but is never an innate damage cap', () => {
  const guarded = createBattle();
  play(guarded, 'guard');
  guarded.player.block = 0;
  endTurn(guarded);
  assert.equal(guarded.player.hp, 96);
  assert.equal(guarded.insight, 15);
  const exposed = createBattle();
  endTurn(exposed);
  assert.equal(exposed.player.hp, 78);
  assert.equal(exposed.insight, 0, 'taking damage alone does not award observation');
});

test('unused glancing and block expire at the new player turn after a non-attack', () => {
  const state = createBattle();
  state.intentIndex = 1;
  play(state, 'guard');
  endTurn(state);
  assert.equal(state.player.glancing, false);
  assert.equal(state.player.block, 0);
  assert.equal(state.insight, 0);
  assert.equal(state.enemy.barrier, 24);
  endTurn(state);
  assert.equal(state.player.hp, 58, 'last round guard cannot soften the 42-point breath');
});

test('damage consumes magic barrier, physical block, then stamina in that order', () => {
  const state = createBattle();
  state.enemy.barrier = 7;
  state.enemy.block = 3;
  play(state, 'slash');
  assert.equal(state.enemy.barrier, 0);
  assert.equal(state.enemy.block, 0);
  assert.equal(state.enemy.hp, 118);
  assert.equal(state.insight, 10);
  const shielded = createBattle();
  shielded.enemy.barrier = 20;
  shielded.enemy.block = 8;
  play(shielded, 'slash');
  assert.equal(shielded.enemy.barrier, 8);
  assert.equal(shielded.enemy.block, 8);
  assert.equal(shielded.enemy.hp, 120);
});

test('physical block expires at its owner turn while barrier and analysis persist', () => {
  const state = createBattle();
  state.player.block = 20;
  state.enemy.block = 15;
  state.enemy.barrier = 30;
  play(state, 'insight');
  endTurn(state);
  assert.equal(state.player.hp, 98, 'twenty block without glancing leaves two damage');
  assert.equal(state.player.block, 0);
  assert.equal(state.enemy.block, 0);
  assert.equal(state.enemy.barrier, 30);
  assert.equal(state.nextAttackBonus, 0);
  assert.equal(state.insight, 35, 'analysis survives unlike the unused attack bonus');
  endTurn(state);
  assert.equal(state.enemy.barrier, 54, 'the shield intent adds 24 to surviving barrier');
});

test('full insight bypasses only magic barrier and spends itself without re-earning insight', () => {
  const state = createBattle();
  state.insight = 100;
  state.enemy.barrier = 99;
  state.enemy.block = 5;
  play(state, 'slash');
  assert.equal(state.enemy.barrier, 99);
  assert.equal(state.enemy.block, 0);
  assert.equal(state.enemy.hp, 113);
  assert.equal(state.insight, 0);
  assert.equal(state.status, 'playing', 'full analysis does not guarantee a knockout');
  assertConserved(state);
});

test('reaching 100 enables the following attack, never retroactive penetration', () => {
  const state = createBattle();
  state.insight = 90;
  state.enemy.barrier = 50;
  bringToHand(state, 'slash');
  play(state, 'slash');
  assert.equal(state.enemy.barrier, 38);
  assert.equal(state.enemy.hp, 120);
  assert.equal(state.insight, 100);
  play(state, 'slash');
  assert.equal(state.enemy.barrier, 38);
  assert.equal(state.enemy.hp, 108);
  assert.equal(state.insight, 0);
});

test('analysis caps at 100 and non-attacks do not consume it or penetrate shields', () => {
  const state = createBattle();
  state.insight = 95;
  state.enemy.barrier = 20;
  play(state, 'insight');
  assert.equal(state.insight, 100);
  play(state, 'guard');
  assert.equal(state.insight, 100);
  assert.equal(state.enemy.barrier, 20);
  endTurn(state);
  assert.equal(state.insight, 100);
});

test('Shura pays ten MP and eighteen stamina through own block, then stays exhausted', () => {
  const state = createBattle();
  state.player.block = 99;
  play(state, 'shura');
  assert.equal(state.player.hp, 82);
  assert.equal(state.player.block, 99);
  assert.equal(state.player.mp, 0);
  assert.equal(state.energy, 1);
  assert.equal(state.enemy.hp, 78);
  assert.equal(state.insight, 10);
  assert.deepEqual(state.exhaust.map(card => card.id), ['shura']);
  for (let i = 0; i < 12; i++) {
    state.player.hp = state.player.maxHp;
    endTurn(state);
    assert.equal(state.player.mp, 0, 'round transition never replenishes MP');
    assert.equal(state.hand.some(card => card.id === 'shura'), false);
    assertConserved(state);
  }
});

test('full-analysis Shura remains a finite hit and still pays its entire cost', () => {
  const state = createBattle();
  state.insight = 100;
  state.enemy.barrier = 70;
  state.enemy.block = 12;
  play(state, 'shura');
  assert.equal(state.enemy.barrier, 70);
  assert.equal(state.enemy.block, 0);
  assert.equal(state.enemy.hp, 90, '42 damage minus 12 physical block is not an execution');
  assert.equal(state.insight, 0);
  assert.equal(state.player.hp, 82);
  assert.equal(state.player.mp, 0);
  assert.equal(state.status, 'playing');
});

test('simultaneous Shura knockout loses after damage, MP payment, and exhaustion resolve', () => {
  const state = createBattle();
  state.player.hp = 18;
  state.enemy.hp = 42;
  const result = play(state, 'shura');
  assert.equal(state.player.hp, 0);
  assert.equal(state.enemy.hp, 0);
  assert.equal(state.player.mp, 0);
  assert.equal(state.status, 'lost');
  assert.equal(state.exhaust.length, 1);
  assert.equal(result.events.filter(event => event.type === 'win').length, 0);
  assert.equal(result.events.at(-1).type, 'loss');
});

test('the public enemy intent resolves its previewed effect and spends its exact MP', () => {
  const state = createBattle();
  const sequence = [
    { id: 'flame-slash', type: 'attack', amount: 22, mpCost: 60 },
    { id: 'dragon-charge', type: 'barrier', amount: 24, mpCost: 120 },
    { id: 'dragon-breath', type: 'attack', amount: 42, mpCost: 240 }
  ];
  for (const expected of sequence) {
    const before = snapshot(state);
    const intent = currentIntent(state);
    assert.deepEqual(state, before);
    for (const key of ['id', 'type', 'amount', 'mpCost']) assert.equal(intent[key], expected[key], key);
    const hp = state.player.hp, mp = state.enemy.mp, barrier = state.enemy.barrier;
    endTurn(state);
    assert.equal(state.enemy.mp, mp - expected.mpCost);
    assert.equal(state.player.hp, hp - (expected.type === 'attack' ? expected.amount : 0));
    assert.equal(state.enemy.barrier, barrier + (expected.type === 'barrier' ? expected.amount : 0));
  }
  assert.equal(state.enemy.mp, 2580);
  assert.equal(state.player.hp, 36);
  assert.equal(state.intentIndex, 0);
});

test('each unaffordable enemy technique visibly falls back to the same free ten-point strike', () => {
  for (const [intentIndex, insufficientMp] of [[0, 59], [1, 119], [2, 239]]) {
    const state = createBattle();
    state.intentIndex = intentIndex;
    state.enemy.mp = insufficientMp;
    const before = snapshot(state), fallback = currentIntent(state);
    assert.equal(fallback.type, 'attack');
    assert.equal(fallback.amount, 10);
    assert.equal(fallback.mpCost, 0);
    assert.deepEqual(state, before);
    endTurn(state);
    assert.equal(state.player.hp, 90);
    assert.equal(state.enemy.mp, insufficientMp);
    assert.equal(state.enemy.barrier, 0);
    assertConserved(state);
  }
});

test('an enemy can pay its exact last MP, then uses a free strike without magic recovery', () => {
  for (const [intentIndex, mpCost, expectedHp, expectedBarrier] of [[0, 60, 78, 0], [1, 120, 100, 24], [2, 240, 58, 0]]) {
    const state = createBattle();
    state.intentIndex = intentIndex;
    state.enemy.mp = mpCost;
    assert.equal(currentIntent(state).mpCost, mpCost);
    endTurn(state);
    assert.equal(state.enemy.mp, 0);
    assert.equal(state.player.hp, expectedHp);
    assert.equal(state.enemy.barrier, expectedBarrier);
    assert.equal(currentIntent(state).amount, 10);
    assert.equal(currentIntent(state).mpCost, 0);
    endTurn(state);
    assert.equal(state.player.hp, expectedHp - 10);
    assert.equal(state.enemy.mp, 0);
  }
});

test('victory freezes actions and all readers leave the terminal state intact', () => {
  const state = createBattle();
  state.enemy.hp = 1;
  play(state, 'slash');
  assert.equal(state.status, 'won');
  assert.equal(state.enemy.hp, 0);
  const won = snapshot(state);
  assert.equal(endTurn(state).ok, false);
  assertRejectedWithoutMutation(state, state.hand[0].uid);
  currentIntent(state);
  snapshot(state);
  assert.deepEqual(state, won);
  assert.equal(state.enemy.mp, 3000, 'a defeated enemy never retaliates or spends MP');
});

test('lethal enemy intent pays MP but stops before advancing, refilling AP, or drawing', () => {
  const state = createBattle();
  state.player.hp = 3;
  state.energy = 0;
  const result = endTurn(state);
  assert.equal(result.ok, true);
  assert.equal(state.status, 'lost');
  assert.equal(state.player.hp, 0);
  assert.equal(state.enemy.mp, 2940);
  assert.equal(state.turn, 1);
  assert.equal(state.energy, 0);
  assert.equal(state.hand.length, 0);
  assert.equal(result.events.some(event => event.type === 'draw'), false);
  const lost = snapshot(state);
  assert.equal(endTurn(state).ok, false);
  assertRejectedWithoutMutation(state, 'card-1');
  currentIntent(state);
  assert.deepEqual(state, lost);
  assertConserved(state);
});

test('seeded shuffles replay exactly and preserve all fifteen unique cards', () => {
  const a = createBattle(12345), b = createBattle(12345);
  for (let i = 0; i < 12; i++) {
    a.player.hp = b.player.hp = 100;
    endTurn(a);
    endTurn(b);
    assert.deepEqual(a, b);
    assertConserved(a);
  }
  assert.ok(a.logs.some(line => line.includes('重新洗入')));
});

test('a resolving zero-cost draw cannot reshuffle itself or create phantom cards', () => {
  const state = createBattle(), insight = instance(state, 'insight');
  state.exhaust.push(...state.hand.filter(card => card !== insight), ...state.draw);
  state.hand = [insight];
  state.draw = [];
  play(state, 'insight');
  assert.equal(state.hand.length, 0);
  assert.deepEqual(state.discard, [insight]);
  assertConserved(state);
});

test('a legal ten-card hand remains capped while drawing from the remaining five cards', () => {
  const state = createBattle();
  state.hand.push(...state.draw.splice(0, 5));
  assert.equal(state.hand.length, 10);
  assert.equal(state.draw.length, 5);
  play(state, 'insight');
  assert.equal(state.hand.length, 10);
  assert.equal(state.draw.length, 4);
  assertConserved(state);
});

test('snapshots are detached and six undefended turns follow the exact intent cycle into defeat', () => {
  const state = createBattle(), copied = snapshot(state);
  copied.player.hp = 1;
  copied.enemy.barrier = 999;
  copied.hand.pop();
  assert.equal(state.player.hp, 100);
  assert.equal(state.enemy.barrier, 0);
  assert.equal(state.hand.length, 5);
  const seen = [];
  for (let i = 0; i < 6; i++) {
    seen.push(currentIntent(state).id);
    endTurn(state);
  }
  assert.deepEqual(seen, ['flame-slash', 'dragon-charge', 'dragon-breath', 'flame-slash', 'dragon-charge', 'dragon-breath']);
  assert.deepEqual(INTENTS.map(intent => intent.id), seen.slice(0, 3));
  assert.equal(state.player.hp, 0);
  assert.equal(state.status, 'lost');
  assert.equal(state.enemy.mp, 2160);
  assert.equal(state.enemy.barrier, 48);
});

test('Rasetsu art does not unlock a card, legal action, or any deck entry', () => {
  assert.deepEqual(Object.keys(CARDS).sort(), ['guard', 'insight', 'riposte', 'shura', 'slash', 'step']);
  assert.ok(Object.values(CARDS).every(card => !/rasetsu|羅刹|罗刹/i.test(card.name + card.id)));
  const state = createBattle();
  assertRejectedWithoutMutation(state, 'rasetsu-locked');
  assertConserved(state);
});

test('generated legal and invalid sequences preserve cards and resources across forty seeds', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const state = createBattle(seed);
    let choice = seed;
    for (let action = 0; action < 70 && state.status === 'playing'; action++) {
      choice = (Math.imul(choice, 1664525) + 1013904223) >>> 0;
      if (choice % 5 === 0 || state.hand.length === 0) endTurn(state);
      else {
        const uid = state.hand[choice % state.hand.length].uid;
        const before = snapshot(state), availability = cardAvailability(state, uid);
        assert.deepEqual(state, before);
        const result = playCard(state, uid);
        assert.equal(result.ok, availability.ok);
        if (!result.ok) assert.deepEqual(state, before);
      }
      assertConserved(state);
    }
  }
});
