'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { INTENTS, createBattle, playCard, endTurn, snapshot } = require('./battle.js');

const piles = ['hand', 'draw', 'discard', 'exhaust'];
const allCards = state => piles.flatMap(pile => state[pile]);
const play = (state, id) => {
  const card = state.hand.find(card => card.id === id);
  assert.ok(card, id + ' must be in hand');
  const result = playCard(state, card.uid);
  assert.equal(result.ok, true, result.reason);
  return result;
};
const assertConserved = state => {
  const cards = allCards(state);
  assert.equal(cards.length, 10);
  assert.equal(new Set(cards.map(card => card.uid)).size, 10);
  assert.ok(state.hand.length <= 10);
  assert.ok(state.energy >= 0 && state.energy <= state.maxEnergy);
  for (const actor of [state.player, state.enemy]) {
    assert.ok(actor.hp >= 0 && actor.hp <= actor.maxHp);
    assert.ok(actor.block >= 0);
  }
};

test('the fixed opener demonstrates intent, block, card order, and the exact first-round result', () => {
  const state = createBattle();
  assert.deepEqual(state.hand.map(card => card.id), ['insight', 'guard', 'riposte', 'slash', 'shura']);
  play(state, 'insight');
  assert.equal(state.hand.at(-1).id, 'step');
  play(state, 'guard');
  play(state, 'riposte');
  play(state, 'slash');
  assert.equal(state.enemy.hp, 49);
  assert.equal(state.energy, 0);
  assert.equal(state.nextAttackBonus, 0);
  endTurn(state);
  assert.equal(state.player.hp, 48);
  assert.equal(state.player.block, 0);
  assert.equal(state.intentIndex, 1);
  assert.equal(state.turn, 2);
  assert.equal(state.energy, 3);
  assert.equal(state.hand.length, 5);
  assertConserved(state);
});

test('stale card clicks, unknown cards, and unaffordable actions do not mutate anything', () => {
  const state = createBattle();
  const before = snapshot(state);
  assert.equal(playCard(state, 'not-a-card').ok, false);
  assert.deepEqual(state, before);
  state.energy = 0;
  const broke = snapshot(state);
  assert.equal(playCard(state, state.hand.find(card => card.id === 'shura').uid).ok, false);
  assert.deepEqual(state, broke);
  const insight = state.hand.find(card => card.id === 'insight');
  assert.equal(playCard(state, insight.uid).ok, true, 'zero-cost cards remain usable without energy');
  const after = snapshot(state);
  assert.equal(playCard(state, insight.uid).ok, false);
  assert.deepEqual(state, after);
});

test('riposte gets its conditional damage only while the player actually has block', () => {
  const unguarded = createBattle();
  play(unguarded, 'riposte');
  assert.equal(unguarded.enemy.hp, 66);
  const guarded = createBattle();
  play(guarded, 'guard');
  play(guarded, 'riposte');
  assert.equal(guarded.enemy.hp, 60);
});

test('enemy block persists through the player turn and absorbs damage before HP', () => {
  const state = createBattle();
  state.intentIndex = 1;
  endTurn(state);
  assert.equal(state.enemy.block, 10);
  assert.equal(state.intentIndex, 2);
  play(state, 'slash');
  assert.equal(state.enemy.hp, 72);
  assert.equal(state.enemy.block, 3);
  const result = play(state, 'slash');
  assert.equal(state.enemy.hp, 68);
  assert.equal(state.enemy.block, 0);
  assert.equal(result.events.find(event => event.type === 'damage').blocked, 3);
});

test('leftover block expires at the owning side next turn and unused insight expires at end turn', () => {
  const state = createBattle();
  state.player.block = 20;
  state.enemy.block = 15;
  play(state, 'insight');
  endTurn(state);
  assert.equal(state.player.hp, 48);
  assert.equal(state.player.block, 0);
  assert.equal(state.enemy.block, 0);
  assert.equal(state.nextAttackBonus, 0);
});

test('Shura bypasses own block for its self-damage and is exhausted permanently', () => {
  const state = createBattle();
  state.player.block = 99;
  play(state, 'shura');
  assert.equal(state.player.hp, 42);
  assert.equal(state.player.block, 99);
  assert.equal(state.enemy.hp, 48);
  assert.deepEqual(state.exhaust.map(card => card.id), ['shura']);
  for (let i = 0; i < 12; i++) {
    state.player.hp = state.player.maxHp;
    endTurn(state);
    assert.equal(state.hand.some(card => card.id === 'shura'), false);
    assertConserved(state);
  }
});

test('a simultaneous knockout loses after all card effects and costs resolve', () => {
  const state = createBattle();
  state.player.hp = 6;
  state.enemy.hp = 24;
  const result = play(state, 'shura');
  assert.equal(state.player.hp, 0);
  assert.equal(state.enemy.hp, 0);
  assert.equal(state.status, 'lost');
  assert.equal(state.exhaust.length, 1);
  assert.equal(result.events.filter(event => event.type === 'win').length, 0);
  assert.equal(result.events.at(-1).type, 'loss');
});

test('victory locks both action entry points without letting a dead enemy retaliate', () => {
  const state = createBattle();
  state.enemy.hp = 1;
  play(state, 'slash');
  assert.equal(state.status, 'won');
  assert.equal(state.enemy.hp, 0);
  const won = snapshot(state);
  assert.equal(endTurn(state).ok, false);
  assert.equal(playCard(state, state.hand[0].uid).ok, false);
  assert.deepEqual(state, won);
});

test('lethal enemy intent stops before replenishing energy or drawing the next hand', () => {
  const state = createBattle();
  state.player.hp = 3;
  state.energy = 0;
  const result = endTurn(state);
  assert.equal(result.ok, true);
  assert.equal(state.status, 'lost');
  assert.equal(state.player.hp, 0);
  assert.equal(state.turn, 1);
  assert.equal(state.energy, 0);
  assert.equal(state.hand.length, 0);
  assert.equal(result.events.some(event => event.type === 'draw'), false);
  assertConserved(state);
});

test('seeded shuffles replay exactly and preserve all ten unique cards', () => {
  const a = createBattle(12345);
  const b = createBattle(12345);
  for (let i = 0; i < 12; i++) {
    a.player.hp = b.player.hp = 48;
    endTurn(a);
    endTurn(b);
    assert.deepEqual(a, b);
    assertConserved(a);
  }
  assert.ok(a.logs.some(line => line.includes('重新洗入')));
});

test('a resolving draw card cannot reshuffle itself and decks never require phantom cards', () => {
  const state = createBattle();
  const insight = state.hand.find(card => card.id === 'insight');
  state.exhaust.push(...state.hand.filter(card => card !== insight), ...state.draw);
  state.hand = [insight];
  state.draw = [];
  play(state, 'insight');
  assert.equal(state.hand.length, 0);
  assert.deepEqual(state.discard, [insight]);
  assertConserved(state);
});

test('a full legal ten-card hand remains bounded after a draw effect', () => {
  const state = createBattle();
  state.hand.push(...state.draw.splice(0));
  assert.equal(state.hand.length, 10);
  play(state, 'insight');
  assert.equal(state.hand.length, 9);
  assertConserved(state);
});

test('the intent cycle is exact and snapshots are detached from mutable state', () => {
  const state = createBattle();
  const copied = snapshot(state);
  copied.player.hp = 1;
  copied.hand.pop();
  assert.equal(state.player.hp, 48);
  assert.equal(state.hand.length, 5);
  const seen = [];
  for (let i = 0; i < 6; i++) {
    seen.push(INTENTS[state.intentIndex].id);
    state.player.hp = 48;
    endTurn(state);
  }
  assert.deepEqual(seen, ['flame-slash', 'dragon-charge', 'dragon-breath', 'flame-slash', 'dragon-charge', 'dragon-breath']);
});

test('generated legal and invalid sequences preserve card/resource invariants for many seeds', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const state = createBattle(seed);
    let choice = seed;
    for (let action = 0; action < 70 && state.status === 'playing'; action++) {
      choice = (Math.imul(choice, 1664525) + 1013904223) >>> 0;
      if (choice % 5 === 0 || state.hand.length === 0) endTurn(state);
      else playCard(state, state.hand[choice % state.hand.length].uid);
      assertConserved(state);
    }
  }
});
