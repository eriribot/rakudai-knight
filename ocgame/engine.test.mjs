import test from "node:test";
import assert from "node:assert/strict";
import {
  ARCANAS,
  PACTS,
  CARD_MODS,
  PRESETS,
  CARDS,
  cleanProfile,
  createBattle,
  cardCost,
  cardBlockValue,
  intent,
  attackValue,
  playCard,
  evolveCard,
  useNobleArt,
  useSupport,
  beginEnemy,
  resolveEnemy,
  nextTurn,
} from "./engine.mjs";
const play = (s, kind) => playCard(s, s.hand.find((c) => c.kind === kind)?.id);
function turn(s) {
  beginEnemy(s);
  const result = resolveEnemy(s);
  nextTurn(s);
  return result;
}
function conserved(s) {
  const cards = [...s.hand, ...s.deck, ...s.discard];
  assert.equal(cards.length, 12);
  assert.equal(new Set(cards.map((c) => c.id)).size, 12);
  assert.ok(s.energy >= 0 && s.energy <= 3);
  assert.ok(s.player.hp >= 0 && s.player.hp <= 76);
  assert.ok(s.enemy.hp >= 0 && s.enemy.hp <= 108);
}
test("opening defense resolves at impact, then expires on the next player turn", () => {
  const s = createBattle();
  play(s, "guard");
  play(s, "step");
  assert.equal(s.player.block, 16);
  const hp = s.player.hp;
  beginEnemy(s);
  assert.equal(s.player.hp, hp);
  const event = resolveEnemy(s);
  assert.deepEqual(event.hit, { amount: 14, blocked: 14, lost: 0 });
  assert.equal(s.player.block, 2);
  nextTurn(s);
  assert.equal(s.player.block, 0);
  conserved(s);
});
test("cost limits and invalid/repeated card ids cannot consume or duplicate cards", () => {
  const s = createBattle(),
    slash = s.hand[0];
  playCard(s, slash.id);
  const snapshot = JSON.stringify(s);
  assert.equal(playCard(s, slash.id), null);
  assert.equal(playCard(s, -1), null);
  assert.equal(JSON.stringify(s), snapshot);
  play(s, "guard");
  const low = JSON.stringify(s);
  assert.equal(play(s, "heavy"), null);
  assert.equal(JSON.stringify(s), low);
  conserved(s);
});
test("support is once per battle, heals actual missing HP, and stays within the cap", () => {
  const s = createBattle();
  turn(s);
  assert.equal(s.player.hp, 62);
  assert.deepEqual(useSupport(s), { healing: 12, block: 8 });
  const snapshot = JSON.stringify(s);
  assert.equal(useSupport(s), null);
  assert.equal(JSON.stringify(s), snapshot);
  const full = createBattle();
  assert.deepEqual(useSupport(full), { healing: 0, block: 8 });
  assert.equal(full.player.hp, 76);
});
test("weapon choices affect actual combat and first-attack bonus resets per turn", () => {
  const katana = createBattle({ style: "katana" });
  assert.equal(play(katana, "slash").hit.lost, 15);
  assert.equal(attackValue(katana, CARDS.slash), 10);
  turn(katana);
  assert.equal(attackValue(katana, CARDS.slash), 15);
  const rapier = createBattle({ style: "rapier" });
  assert.equal(rapier.player.block, 4);
  turn(rapier);
  assert.equal(rapier.player.hp, 66);
  assert.equal(rapier.player.block, 4);
  assert.equal(play(createBattle(), "slash").hit.lost, 12);
});
test("stored focus survives a turn; piercing attack bypasses enemy block without consuming it", () => {
  const s = createBattle();
  play(s, "focus");
  turn(s);
  assert.equal(s.player.power, 8);
  s.enemy.block = 14;
  const r = play(s, "thrust");
  assert.equal(r.hit.lost, 17);
  assert.equal(r.hit.blocked, 0);
  assert.equal(s.enemy.block, 14);
  assert.equal(s.player.power, 0);
  conserved(s);
});
test("deck recycling preserves every card; all styles can finish the demo", () => {
  for (const style of ["sword", "katana", "rapier"]) {
    const s = createBattle({ style });
    for (let rounds = 0; rounds < 20 && s.phase === "player"; rounds++) {
      if (s.player.hp <= 64) useSupport(s);
      for (let actions = 0; actions < 10 && s.phase === "player"; actions++) {
        const options = s.hand.filter((c) => CARDS[c.kind].cost <= s.energy);
        options.sort((a, b) => {
          const score = (c) =>
            c.kind === "step"
              ? 80
              : c.kind === "focus" && s.energy === 3
                ? 70
                : CARDS[c.kind].damage
                  ? attackValue(s, CARDS[c.kind])
                  : 2;
          return score(b) - score(a);
        });
        if (!options.length) break;
        playCard(s, options[0].id);
        conserved(s);
      }
      if (s.phase === "player") turn(s);
      conserved(s);
    }
    assert.equal(s.phase, "won", style);
    assert.ok(s.reshuffles >= 1);
    const stopped = JSON.stringify(s);
    assert.equal(beginEnemy(s), null);
    assert.equal(useSupport(s), null);
    assert.equal(playCard(s, s.hand[0]?.id), null);
    assert.equal(JSON.stringify(s), stopped);
  }
});
test("defeat is final and restart starts a separate healthy battle", () => {
  const s = createBattle();
  for (let i = 0; i < 12 && s.phase === "player"; i++) turn(s);
  assert.equal(s.phase, "lost");
  assert.equal(s.player.hp, 0);
  assert.equal(nextTurn(s), false);
  assert.equal(useSupport(s), null);
  conserved(s);
  const fresh = createBattle();
  assert.equal(fresh.player.hp, 76);
  assert.equal(fresh.supportUsed, false);
  assert.equal(fresh.turn, 1);
});

test("custom device profile sanitizes arcana, pact, rank, and noble art fields", () => {
  const p = cleanProfile(PRESETS.crimson_dragon);
  assert.equal(p.arcana, "blaze");
  assert.equal(p.pact, "crimson_vow");
  assert.equal(p.rank, "A");
  assert.equal(p.deviceName, "煌炎大剑");
  const fallback = cleanProfile({ arcana: "invalid", pact: "bad", rank: "Z" });
  assert.equal(fallback.arcana, "insight");
  assert.equal(fallback.pact, "standard");
  assert.equal(fallback.rank, "F");
  assert.equal(fallback.deviceName, ARCANAS.insight.defaultDevice);
});

test("card evolution affixes persist on card instances and modify cost, damage, and effects", () => {
  const s = createBattle(PRESETS.worst_blade);
  assert.equal(s.evolveCharges, 1);
  const heavy = s.hand.find((c) => c.kind === "heavy");
  assert.equal(cardCost(CARDS.heavy, heavy), 2);
  const evolved = evolveCard(s, heavy.id, "zero_step");
  assert.ok(evolved);
  assert.equal(s.evolveCharges, 0);
  assert.equal(cardCost(CARDS.heavy, heavy), 1);

  // Give another charge via support and attach soul_edge to guard
  useSupport(s);
  assert.equal(s.evolveCharges, 1);
  const guard = s.hand.find((c) => c.kind === "guard");
  evolveCard(s, guard.id, "soul_edge");
  assert.equal(cardBlockValue(s, CARDS.guard, guard), 18);

  const res = playCard(s, guard.id);
  assert.equal(res.block, 18);
  conserved(s);
});

test("all four arcana resonances and noble arts trigger distinct build payoffs", () => {
  for (const arcana of Object.keys(ARCANAS)) {
    const s = createBattle({
      style: "katana",
      arcana,
      pact: arcana === "mirage" ? "aegis_flow" : "crimson_vow",
    });
    s.stacks = 3;
    s.enemy.block = 10;
    const attack = play(s, "slash");
    assert.ok(attack.resonance, `expected resonance for ${arcana}`);
    assert.equal(attack.resonance.arcana, arcana);
    assert.equal(s.resonancesTriggered, 1);

    // Charge sync to 100 and trigger Noble Art
    s.sync = 100;
    const noble = useNobleArt(s);
    assert.ok(noble, `expected noble art for ${arcana}`);
    assert.equal(s.sync, 0);
    assert.equal(s.nobleArtsUsed, 1);
    assert.equal(s.player.overdrive, true);
    if (arcana === "mirage") {
      assert.ok(intent(s).damage < 14);
    }
    conserved(s);
  }
});

test("aegis_flow pact reflects damage and builds sync when blocking enemy attacks", () => {
  const s = createBattle({ style: "sword", arcana: "scar", pact: "aegis_flow" });
  play(s, "guard");
  const enemyHpBefore = s.enemy.hp;
  beginEnemy(s);
  const enemyTurn = resolveEnemy(s);
  assert.equal(enemyTurn.counterDamage, 8);
  assert.equal(s.enemy.hp, enemyHpBefore - 8);
  conserved(s);
});
