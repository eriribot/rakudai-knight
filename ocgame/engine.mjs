export const STYLES = Object.freeze({
  sword: {
    name: "长剑",
    glyph: "剣",
    title: "重装破军",
    description: "所有攻击伤害 +2；单次攻击 ≥18 伤害时获得 4 护盾",
  },
  katana: {
    name: "太刀",
    glyph: "刀",
    title: "居合拔刀",
    description: "每回合首次攻击伤害 +5，并额外获得 +15% 灵装同调",
  },
  rapier: {
    name: "细剑",
    glyph: "刺",
    title: "迅捷连刺",
    description: "每回合开始获得 4 护盾；单回合出满 3 张牌追击 5 点穿透伤害",
  },
});

export const ARCANAS = Object.freeze({
  insight: {
    name: "体能强化系",
    short: "完全掌握",
    markName: "看破",
    burstName: "完全掌握·秘剑",
    glyph: "眼",
    accent: "#38d9ff",
    description:
      "每次出牌累积 1 层【看破】；满 3 层后下次攻击伤害 +8、无视护盾并恢复 1 行动点",
    defaultDevice: "阴铁·改",
    defaultArt: "一刀修罗",
    defaultChant: "吞干我的血肉吧——把所有的力量，压进这一瞬！",
    nobleDesc:
      "造成 16 点无视护盾伤害，立即获得 3 层【看破】、+1 行动点并抽 1 张牌",
  },
  blaze: {
    name: "自然干涉系",
    short: "红莲劫火",
    markName: "残火",
    burstName: "爆燃共鸣·劫炎",
    glyph: "炎",
    accent: "#ff2a5f",
    description:
      "每次出牌附加 1 层【残火】；满 3 层后下次攻击引爆残火，追加 12 点穿透伤害并抽 1 张牌",
    defaultDevice: "煌炎·妃龙",
    defaultArt: "燃天焚地·龙王炎",
    defaultChant: "化作灰烬吧！这便是我灵魂燃烧殆尽的绯红之刃！",
    nobleDesc:
      "引爆红莲业火造成 20 点穿透伤害，赋予 3 层【残火】并获得 8 点护盾",
  },
  scar: {
    name: "概念干涉系",
    short: "空间爪痕",
    markName: "爪痕",
    burstName: "真空断层·裂空",
    glyph: "痕",
    accent: "#c77dff",
    description:
      "每次出牌刻下 1 道【爪痕】；满 3 层后下次攻击切开空间，追加 14 点穿透伤害并获得 6 护盾",
    defaultDevice: "绯爪·天风",
    defaultArt: "烈风爪痕·真空刃",
    defaultChant: "风是不留痕迹的——但当它吹过之时，胜负早已切开！",
    nobleDesc:
      "撕裂空间全部伏线造成 18 点无视护盾伤害，获得 3 层【爪痕】并抽 1 张牌",
  },
  mirage: {
    name: "因果干涉系",
    short: "幻象定轨",
    markName: "幻影",
    burstName: "因果偏转·蜃景",
    glyph: "幻",
    accent: "#ffd166",
    description:
      "每次出牌编织 1 重【幻影】；满 3 层后下次攻击追加 10 点穿透伤害、抽 1 张牌，并令敌方本回合伤害 -6",
    defaultDevice: "星轨·雾月",
    defaultArt: "蜃景·百鬼夜行",
    defaultChant: "你所看见的剑锋，不过是已经被我改写的过去！",
    nobleDesc:
      "改写因果造成 15 点穿透伤害，获得 10 护盾、3 层【幻影】，并削弱敌方本回合意图 6 点",
  },
});

export const PACTS = Object.freeze({
  standard: {
    name: "均衡魔力回路",
    tag: "均衡",
    description: "破军学园标准灵装回路；每次触发流派共鸣或绝技时回复 3 点生命",
  },
  overdrive: {
    name: "落第骑士·超限回路",
    tag: "超限",
    description:
      "极限精神御剑：打出「蓄力」或「步法」额外 +1 层流派印记与 +15% 同调率；共鸣爆发伤害 +4",
  },
  crimson_vow: {
    name: "修罗血契·强袭铭刻",
    tag: "强袭",
    description:
      "舍身强攻：流派共鸣与伐刀绝技伤害额外 +6，每张攻击牌额外提供 +10% 灵装同调率",
  },
  aegis_flow: {
    name: "天衣无缝·受流铭刻",
    tag: "受流",
    description:
      "受流反击：当护盾完全或部分抵挡敌方攻击时，反震敌方 8 点穿透伤害并获得 +1 印记与 +25% 同调",
  },
});

export const CARD_MODS = Object.freeze({
  twin_fang: {
    id: "twin_fang",
    name: "二段连斩",
    badge: "★连斩",
    short: "追击6穿伤+1印记",
    description: "打出时额外追加 6 点无视护盾的剑气追击，并多叠 1 层流派印记",
  },
  zero_step: {
    id: "zero_step",
    name: "零式疾驱",
    badge: "★零式",
    short: "费用-1·同调+20%",
    description: "该牌行动消耗永久 -1（最低 0），打出时额外获得 +20% 灵装同调率",
  },
  soul_edge: {
    id: "soul_edge",
    name: "概念穿彻",
    badge: "★穿彻",
    short: "数值+6·无视护盾",
    description: "该牌伤害或护盾永久 +6；若为攻击牌则附带【无视护盾】",
  },
  wing_cycle: {
    id: "wing_cycle",
    name: "比翼回流",
    badge: "★回流",
    short: "抽1牌·回4血+4盾",
    description: "打出时额外抽 1 张牌，回复 4 点生命并获得 4 点护盾",
  },
});

export const PRESETS = Object.freeze({
  worst_blade: {
    label: "最弱剑鬼 · 一刀流",
    name: "黑铁 朔",
    rank: "F",
    style: "katana",
    arcana: "insight",
    pact: "overdrive",
    deviceName: "阴铁·折刃",
    nobleArtName: "一刀修罗·朔夜",
    nobleChant: "哪怕魔力居于最底端——我这把剑，也绝不退让半步！",
  },
  crimson_dragon: {
    label: "红莲暴君 · 劫火流",
    name: "不知火 炼",
    rank: "A",
    style: "sword",
    arcana: "blaze",
    pact: "crimson_vow",
    deviceName: "煌炎大剑",
    nobleArtName: "焦热·百鬼夜行",
    nobleChant: "燃尽一切踌躇吧，红莲的暴君！",
  },
  wind_scar: {
    label: "真空断层 · 爪痕流",
    name: "绫辻 弦",
    rank: "D",
    style: "katana",
    arcana: "scar",
    pact: "standard",
    deviceName: "绯爪·天风",
    nobleArtName: "秘剑·真空断层",
    nobleChant: "看不见的剑痕，早已布满你踏足的每一寸空间！",
  },
  phantom_star: {
    label: "因果蜃楼 · 幻影流",
    name: "星宫 零",
    rank: "B",
    style: "rapier",
    arcana: "mirage",
    pact: "aegis_flow",
    deviceName: "星轨细剑",
    nobleArtName: "因果篡改·蜃楼",
    nobleChant: "你挥剑落下的结局，在三步之前就已经被我改写了。",
  },
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

const VALID_RANKS = new Set(["F", "D", "B", "A"]);

export function cleanProfile(profile = {}) {
  const style = Object.hasOwn(STYLES, profile.style) ? profile.style : "sword";
  const arcana = Object.hasOwn(ARCANAS, profile.arcana)
    ? profile.arcana
    : "insight";
  const pact = Object.hasOwn(PACTS, profile.pact) ? profile.pact : "standard";
  const rank = VALID_RANKS.has(profile.rank) ? profile.rank : "F";
  const arcanaMeta = ARCANAS[arcana];
  return {
    name:
      String(profile.name || "")
        .trim()
        .slice(0, 16) || "无名剑士",
    style,
    arcana,
    pact,
    rank,
    deviceName:
      String(profile.deviceName || "")
        .trim()
        .slice(0, 18) || arcanaMeta.defaultDevice,
    nobleArtName:
      String(profile.nobleArtName || "")
        .trim()
        .slice(0, 20) || arcanaMeta.defaultArt,
    nobleChant:
      String(profile.nobleChant || "")
        .trim()
        .slice(0, 60) || arcanaMeta.defaultChant,
  };
}

export function createBattle(profile = {}) {
  const cleaned = cleanProfile(profile);
  const state = {
    profile: cleaned,
    turn: 1,
    phase: "player",
    energy: 3,
    player: { hp: 76, maxHp: 76, block: 0, power: 0, overdrive: false },
    enemy: { hp: 108, maxHp: 108, block: 0, weaken: 0 },
    hand: [],
    deck: [],
    discard: [],
    supportUsed: false,
    attacksThisTurn: 0,
    cardsThisTurn: 0,
    played: 0,
    damageDealt: 0,
    reshuffles: 0,
    stacks: 0,
    sync: 0,
    evolveCharges: 1,
    evolutionsDone: 0,
    nobleArtsUsed: 0,
    resonancesTriggered: 0,
    rng: 1729,
    nextId: 1,
  };
  state.deck = DECK.map((kind) => ({ kind, id: state.nextId++, mods: [] }));
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
      state.evolveCharges = Math.min(3, state.evolveCharges + 1);
    }
    if (!state.deck.length) break;
    state.hand.push(state.deck.shift());
  }
}

export function cardCost(cardOrInstance, instance) {
  const inst = instance || (cardOrInstance?.mods ? cardOrInstance : null);
  const base = CARDS[inst?.kind || cardOrInstance?.kind]?.cost ?? cardOrInstance?.cost ?? 0;
  const discount = inst?.mods?.includes("zero_step") ? 1 : 0;
  return Math.max(0, base - discount);
}

export function cardBlockValue(state, cardOrInstance, instance) {
  const inst = instance || (cardOrInstance?.mods ? cardOrInstance : null);
  const card = CARDS[inst?.kind || cardOrInstance?.kind] || cardOrInstance;
  if (!card?.block) return 0;
  const bonus = inst?.mods?.includes("soul_edge") ? 6 : 0;
  return card.block + bonus;
}

export function intent(state) {
  const base = { ...INTENTS[(state.turn - 1) % INTENTS.length] };
  if (base.damage && state.enemy?.weaken) {
    base.baseDamage = base.damage;
    base.damage = Math.max(0, base.damage - state.enemy.weaken);
  }
  return base;
}

export function attackValue(state, cardOrInstance, instance) {
  const inst = instance || (cardOrInstance?.mods ? cardOrInstance : null);
  const card = CARDS[inst?.kind || cardOrInstance?.kind] || cardOrInstance;
  if (!card?.damage) return 0;
  const styleBonus =
    state.profile.style === "sword"
      ? 2
      : state.profile.style === "katana" && state.attacksThisTurn === 0
        ? 5
        : 0;
  const modBonus = inst?.mods?.includes("soul_edge") ? 6 : 0;
  const overdriveBonus = state.player.overdrive ? 4 : 0;
  const resonanceBonus =
    state.stacks >= 3 && state.profile.arcana === "insight"
      ? 8 +
        (state.profile.pact === "overdrive"
          ? 4
          : state.profile.pact === "crimson_vow"
            ? 6
            : 0)
      : 0;
  return (
    card.damage +
    state.player.power +
    styleBonus +
    modBonus +
    overdriveBonus +
    resonanceBonus
  );
}

function hit(target, amount, pierce = false) {
  const blocked = pierce ? 0 : Math.min(target.block, amount);
  target.block -= blocked;
  const lost = Math.min(target.hp, amount - blocked);
  target.hp -= lost;
  return { amount, blocked, lost };
}

function addSync(state, amount) {
  state.sync = Math.min(100, Math.max(0, state.sync + amount));
}

function healPlayer(state, amount) {
  const healed = Math.min(amount, state.player.maxHp - state.player.hp);
  state.player.hp += healed;
  return healed;
}

function settle(state) {
  if (state.enemy.hp <= 0) state.phase = "won";
  else if (state.player.hp <= 0) state.phase = "lost";
}

export function evolveCard(state, id, modId) {
  if (state.phase !== "player" || state.evolveCharges <= 0) return null;
  if (!Object.hasOwn(CARD_MODS, modId)) return null;
  const instance = state.hand.find((c) => c.id === id);
  if (!instance) return null;
  instance.mods = instance.mods || [];
  if (instance.mods.includes(modId) || instance.mods.length >= 2) return null;
  instance.mods.push(modId);
  state.evolveCharges--;
  state.evolutionsDone++;
  state.stacks = Math.min(6, state.stacks + 1);
  addSync(state, 20);
  return {
    id: instance.id,
    kind: instance.kind,
    cardName: CARDS[instance.kind].name,
    mod: CARD_MODS[modId],
    mods: [...instance.mods],
  };
}

export function useNobleArt(state) {
  if (state.phase !== "player" || state.sync < 100) return null;
  state.sync = 0;
  state.nobleArtsUsed++;
  state.player.overdrive = true;
  const arcana = state.profile.arcana;
  const pactBonus =
    state.profile.pact === "crimson_vow"
      ? 6
      : state.profile.pact === "overdrive"
        ? 4
        : 0;
  let baseDmg = 16;
  let blockGain = 0;
  let drawCount = 0;
  let energyGain = 0;
  let weakenGain = 0;

  if (arcana === "insight") {
    baseDmg = 16;
    energyGain = 1;
    drawCount = 1;
  } else if (arcana === "blaze") {
    baseDmg = 20;
    blockGain = 8;
  } else if (arcana === "scar") {
    baseDmg = 18;
    drawCount = 1;
  } else if (arcana === "mirage") {
    baseDmg = 15;
    blockGain = 10;
    weakenGain = 6;
  }

  const totalDamage = baseDmg + pactBonus;
  const hitResult = hit(state.enemy, totalDamage, true);
  state.damageDealt += hitResult.lost;
  state.stacks = Math.min(6, Math.max(3, state.stacks + 3));
  if (blockGain) state.player.block += blockGain;
  if (energyGain) state.energy = Math.min(3, state.energy + energyGain);
  if (weakenGain) state.enemy.weaken += weakenGain;
  const healed = state.profile.pact === "standard" ? healPlayer(state, 3) : 0;
  if (drawCount) draw(state, drawCount);
  settle(state);

  return {
    name: state.profile.nobleArtName,
    deviceName: state.profile.deviceName,
    chant: state.profile.nobleChant,
    arcana,
    hit: hitResult,
    block: blockGain,
    healed,
    weaken: weakenGain,
  };
}

export function playCard(state, id) {
  if (state.phase !== "player") return null;
  const index = state.hand.findIndex((c) => c.id === id);
  if (index < 0) return null;
  const instance = state.hand[index],
    card = CARDS[instance.kind],
    mods = instance.mods || [],
    cost = cardCost(card, instance);
  if (state.energy < cost) return null;
  state.energy -= cost;
  state.hand.splice(index, 1);

  const blockAmount = cardBlockValue(state, card, instance);
  const result = {
    kind: instance.kind,
    name: card.name,
    type: card.type,
    block: blockAmount,
    power: card.power || 0,
    hit: null,
    resonance: null,
    bonusHit: null,
    mods: [...mods],
  };

  if (card.damage) {
    const isInsightBurst =
      state.stacks >= 3 && state.profile.arcana === "insight";
    const isPierce =
      Boolean(card.pierce) ||
      mods.includes("soul_edge") ||
      isInsightBurst;
    const dmg = attackValue(state, card, instance);
    const isFirstKatana =
      state.profile.style === "katana" && state.attacksThisTurn === 0;
    result.hit = hit(state.enemy, dmg, isPierce);
    state.damageDealt += result.hit.lost;
    state.player.power = 0;
    state.attacksThisTurn++;

    if (state.profile.style === "sword" && dmg >= 18) {
      state.player.block += 4;
      result.swordGuard = 4;
    }
    if (isFirstKatana) {
      addSync(state, 15);
    }
    if (state.profile.pact === "crimson_vow") {
      addSync(state, 10);
    }

    // Trigger Arcana Resonance when stacks >= 3 on attack!
    if (state.stacks >= 3) {
      state.stacks -= 3;
      state.resonancesTriggered++;
      const arcana = state.profile.arcana;
      const pactBonus =
        state.profile.pact === "overdrive"
          ? 4
          : state.profile.pact === "crimson_vow"
            ? 6
            : 0;
      const resonanceHeal =
        state.profile.pact === "standard" ? healPlayer(state, 3) : 0;

      if (arcana === "insight") {
        state.energy = Math.min(3, state.energy + 1);
        result.resonance = {
          arcana,
          name: ARCANAS.insight.burstName,
          damage: 0,
          energy: 1,
          healed: resonanceHeal,
        };
      } else if (arcana === "blaze") {
        const burst = hit(state.enemy, 12 + pactBonus, true);
        state.damageDealt += burst.lost;
        draw(state, 1);
        result.resonance = {
          arcana,
          name: ARCANAS.blaze.burstName,
          damage: burst.lost,
          draw: 1,
          healed: resonanceHeal,
        };
      } else if (arcana === "scar") {
        const burst = hit(state.enemy, 14 + pactBonus, true);
        state.damageDealt += burst.lost;
        state.player.block += 6;
        result.resonance = {
          arcana,
          name: ARCANAS.scar.burstName,
          damage: burst.lost,
          block: 6,
          healed: resonanceHeal,
        };
      } else if (arcana === "mirage") {
        const burst = hit(state.enemy, 10 + pactBonus, true);
        state.damageDealt += burst.lost;
        state.enemy.weaken += 6;
        draw(state, 1);
        result.resonance = {
          arcana,
          name: ARCANAS.mirage.burstName,
          damage: burst.lost,
          weaken: 6,
          draw: 1,
          healed: resonanceHeal,
        };
      }
    }
  }

  if (blockAmount) state.player.block += blockAmount;
  if (card.power) state.player.power += card.power;

  // Card Mod Effects
  if (mods.includes("twin_fang")) {
    const extra = hit(state.enemy, 6, true);
    state.damageDealt += extra.lost;
    state.stacks = Math.min(6, state.stacks + 1);
    result.bonusHit = (result.bonusHit || 0) + extra.lost;
  }
  if (mods.includes("zero_step")) {
    addSync(state, 20);
  }
  if (mods.includes("wing_cycle")) {
    healPlayer(state, 4);
    state.player.block += 4;
    draw(state, 1);
  }

  // Draw before discarding this card: a zero-cost draw cannot draw itself immediately.
  if (card.draw) draw(state, card.draw);
  state.discard.push(instance);
  state.played++;
  state.cardsThisTurn++;

  // Gain Arcana stack & Sync for playing a card
  let stackGain = 1;
  if (
    state.profile.pact === "overdrive" &&
    (instance.kind === "focus" || instance.kind === "step")
  ) {
    stackGain++;
    addSync(state, 15);
  }
  state.stacks = Math.min(6, state.stacks + stackGain);
  addSync(state, 20);

  // Rapier 3-card chain follow-up
  if (state.profile.style === "rapier" && state.cardsThisTurn === 3) {
    const chain = hit(state.enemy, 5, true);
    state.damageDealt += chain.lost;
    result.bonusHit = (result.bonusHit || 0) + chain.lost;
  }

  settle(state);
  return result;
}

export function useSupport(state) {
  if (state.phase !== "player" || state.supportUsed) return null;
  const healing = Math.min(12, state.player.maxHp - state.player.hp);
  state.player.hp += healing;
  state.player.block += 8;
  state.supportUsed = true;
  state.stacks = Math.min(6, state.stacks + 2);
  addSync(state, 50);
  state.evolveCharges = Math.min(3, state.evolveCharges + 1);
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
  const hitResult = next.damage ? hit(state.player, next.damage) : null;
  const result = {
    ...next,
    hit: hitResult,
    counterDamage: 0,
  };
  if (hitResult && hitResult.blocked > 0) {
    addSync(state, 15);
    if (state.profile.pact === "aegis_flow") {
      const counter = hit(state.enemy, 8, true);
      state.damageDealt += counter.lost;
      result.counterDamage = counter.lost;
      state.stacks = Math.min(6, state.stacks + 1);
      addSync(state, 25);
    }
  }
  state.enemy.block = next.block;
  state.enemy.weaken = 0;
  settle(state);
  return result;
}

export function nextTurn(state) {
  if (state.phase !== "enemy") return false;
  state.turn++;
  state.phase = "player";
  state.energy = 3;
  state.player.block = state.profile.style === "rapier" ? 4 : 0;
  state.player.overdrive = false;
  state.attacksThisTurn = 0;
  state.cardsThisTurn = 0;
  draw(state, 5);
  return true;
}
