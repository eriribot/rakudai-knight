export const STYLES = Object.freeze({
  sword: { name: "长剑", glyph: "剣", description: "所有攻击伤害 +2" },
  katana: { name: "太刀", glyph: "刀", description: "每回合首次攻击伤害 +5" },
  rapier: { name: "细剑", glyph: "刺", description: "每回合开始获得 4 护盾" },
});

export const CARDS = Object.freeze({
  slash: {
    name: "斩击",
    type: "attack",
    label: "攻击",
    cost: 1,
    damage: 10,
    icon: "sword",
    kana: "斬撃",
  },
  thrust: {
    name: "突刺",
    type: "attack",
    label: "攻击",
    cost: 1,
    damage: 7,
    pierce: true,
    icon: "thrust",
    kana: "刺突",
  },
  guard: {
    name: "招架",
    type: "guard",
    label: "防御",
    cost: 1,
    block: 12,
    icon: "shield",
    kana: "受け流し",
  },
  focus: {
    name: "蓄力",
    type: "skill",
    label: "技巧",
    cost: 1,
    power: 8,
    draw: 1,
    icon: "focus",
    kana: "精神統一",
  },
  step: {
    name: "步法",
    type: "guard",
    label: "身法",
    cost: 0,
    block: 4,
    draw: 1,
    icon: "step",
    kana: "足運び",
  },
  heavy: {
    name: "重斩",
    type: "attack",
    label: "攻击",
    cost: 2,
    damage: 24,
    icon: "heavy",
    kana: "一振り",
  },
});

const INTENTS = [
  { name: "斩击", damage: 14, block: 0, cue: "接住这一剑！" },
  { name: "架势", damage: 0, block: 14, cue: "那么，这一招你会怎么接？" },
  { name: "烈焰斩", damage: 23, block: 0, cue: "可别大意了！" },
];
const DECK = [
  "slash",
  "guard",
  "focus",
  "step",
  "heavy",
  "slash",
  "thrust",
  "guard",
  "slash",
  "guard",
  "heavy",
  "step",
];

export function cleanProfile(profile = {}) {
  return {
    name:
      String(profile.name || "")
        .trim()
        .slice(0, 16) || "无名剑士",
    style: Object.hasOwn(STYLES, profile.style) ? profile.style : "sword",
  };
}

export function createBattle(profile = {}) {
  const state = {
    profile: cleanProfile(profile),
    turn: 1,
    phase: "player",
    energy: 3,
    player: { hp: 76, maxHp: 76, block: 0, power: 0 },
    enemy: { hp: 108, maxHp: 108, block: 0 },
    hand: [],
    deck: [],
    discard: [],
    supportUsed: false,
    attacksThisTurn: 0,
    played: 0,
    damageDealt: 0,
    reshuffles: 0,
    rng: 1729,
    nextId: 1,
  };
  state.deck = DECK.map((kind) => ({ kind, id: state.nextId++ }));
  if (state.profile.style === "rapier") state.player.block = 4;
  draw(state, 5);
  return state;
}

function shuffle(state, cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    state.rng = (1664525 * state.rng + 1013904223) >>> 0;
    const j = state.rng % (i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function draw(state, count) {
  for (let i = 0; i < count && state.hand.length < 7; i++) {
    if (!state.deck.length && state.discard.length) {
      state.deck = shuffle(state, state.discard.splice(0));
      state.reshuffles++;
    }
    if (!state.deck.length) break;
    state.hand.push(state.deck.shift());
  }
}

export function intent(state) {
  return { ...INTENTS[(state.turn - 1) % INTENTS.length] };
}
export function attackValue(state, card) {
  if (!card.damage) return 0;
  const bonus =
    state.profile.style === "sword"
      ? 2
      : state.profile.style === "katana" && state.attacksThisTurn === 0
        ? 5
        : 0;
  return card.damage + state.player.power + bonus;
}
function hit(target, amount, pierce = false) {
  const blocked = pierce ? 0 : Math.min(target.block, amount);
  target.block -= blocked;
  const lost = Math.min(target.hp, amount - blocked);
  target.hp -= lost;
  return { amount, blocked, lost };
}
function settle(state) {
  if (state.enemy.hp <= 0) state.phase = "won";
  else if (state.player.hp <= 0) state.phase = "lost";
}

export function playCard(state, id) {
  if (state.phase !== "player") return null;
  const index = state.hand.findIndex((c) => c.id === id);
  if (index < 0) return null;
  const instance = state.hand[index],
    card = CARDS[instance.kind];
  if (state.energy < card.cost) return null;
  state.energy -= card.cost;
  state.hand.splice(index, 1);
  const result = {
    kind: instance.kind,
    name: card.name,
    type: card.type,
    block: card.block || 0,
    power: card.power || 0,
    hit: null,
  };
  if (card.damage) {
    result.hit = hit(state.enemy, attackValue(state, card), card.pierce);
    state.damageDealt += result.hit.lost;
    state.player.power = 0;
    state.attacksThisTurn++;
  }
  if (card.block) state.player.block += card.block;
  if (card.power) state.player.power += card.power;
  // Draw before discarding this card: a zero-cost draw cannot draw itself immediately.
  if (card.draw) draw(state, card.draw);
  state.discard.push(instance);
  state.played++;
  settle(state);
  return result;
}

export function useSupport(state) {
  if (state.phase !== "player" || state.supportUsed) return null;
  const healing = Math.min(12, state.player.maxHp - state.player.hp);
  state.player.hp += healing;
  state.player.block += 8;
  state.supportUsed = true;
  return { healing, block: 8 };
}

export function beginEnemy(state) {
  if (state.phase !== "player") return null;
  state.phase = "enemy";
  state.discard.push(...state.hand.splice(0));
  state.enemy.block = 0;
  return intent(state);
}

export function resolveEnemy(state) {
  if (state.phase !== "enemy") return null;
  const next = intent(state);
  const result = {
    ...next,
    hit: next.damage ? hit(state.player, next.damage) : null,
  };
  state.enemy.block = next.block;
  settle(state);
  return result;
}

export function nextTurn(state) {
  if (state.phase !== "enemy") return false;
  state.turn++;
  state.phase = "player";
  state.energy = 3;
  state.player.block = state.profile.style === "rapier" ? 4 : 0;
  state.attacksThisTurn = 0;
  draw(state, 5);
  return true;
}
