(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BattleEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Local training encounter: these calibrated numbers never write MVU stat_data.
  // hp is the fantasy-mode stamina pool, not a claim about canonical life points.
  const CARDS = Object.freeze({
    slash: Object.freeze({ id: 'slash', name: '斬擊', cost: 1, mpCost: 0, type: 'attack', keyword: '劍技', description: '造成 12 點傷害。交鋒增加 10% 解析。', damage: 12 }),
    guard: Object.freeze({ id: 'guard', name: '受身', cost: 1, mpCost: 0, type: 'skill', keyword: '防禦', description: '獲得 14 格擋。本回合下一次敵方攻擊，格擋後傷害最多 4。', block: 14, glancing: true }),
    insight: Object.freeze({ id: 'insight', name: '看破', cost: 0, mpCost: 0, type: 'skill', keyword: '解析', description: '解析 +20%，抽 1 張牌。本回合下一張攻擊傷害 +4。', draw: 1, bonus: 4, insight: 20 }),
    step: Object.freeze({ id: 'step', name: '疾步', cost: 1, mpCost: 0, type: 'skill', keyword: '步法', description: '獲得 7 格擋，抽 1 張牌。', block: 7, draw: 1 }),
    riposte: Object.freeze({ id: 'riposte', name: '返擊', cost: 1, mpCost: 0, type: 'attack', keyword: '反擊', description: '造成 10 點傷害；已有格擋時改為 18。交鋒增加 10% 解析。', damage: 10, guardedDamage: 18 }),
    shura: Object.freeze({ id: 'shura', name: '一刀修羅', cost: 2, mpCost: 10, type: 'attack', keyword: '奧義', description: '消耗 10 MP，造成 42 點傷害。失去 18 體力，本場移除。', damage: 42, selfDamage: 18, exhaust: true })
  });

  const INTENTS = Object.freeze([
    Object.freeze({ id: 'flame-slash', name: '烈焰斬', type: 'attack', amount: 22, mpCost: 60, description: '回合結束：傷害 22 · 60 MP' }),
    Object.freeze({ id: 'dragon-charge', name: '赤龍蓄勢', type: 'barrier', amount: 24, mpCost: 120, description: '回合結束：魔力護盾 24 · 120 MP' }),
    Object.freeze({ id: 'dragon-breath', name: '妃龍吐息', type: 'attack', amount: 42, mpCost: 240, description: '回合結束：傷害 42 · 240 MP' })
  ]);
  const PHYSICAL_INTENT = Object.freeze({ id: 'physical-slash', name: '斬擊', type: 'attack', amount: 10, mpCost: 0, description: '魔力不足：回合結束時造成 10 傷害' });

  function currentIntent(state) {
    const planned = INTENTS[state.intentIndex];
    return state.enemy.mp >= planned.mpCost ? planned : PHYSICAL_INTENT;
  }

  function createBattle(seed = 20261003) {
    let serial = 0;
    const card = id => ({ id, uid: 'card-' + (++serial) });
    return {
      player: { hp: 100, maxHp: 100, mp: 10, maxMp: 10, block: 0, glancing: false },
      enemy: { hp: 120, maxHp: 120, mp: 3000, maxMp: 3000, block: 0, barrier: 0 },
      turn: 1,
      energy: 3,
      maxEnergy: 3,
      hand: ['insight', 'guard', 'riposte', 'slash', 'shura'].map(card),
      // The next draw is index 0. The fixed opener teaches one readable combination.
      draw: ['step', 'slash', 'guard', 'slash', 'insight', 'riposte', 'step', 'guard', 'slash', 'riposte'].map(card),
      discard: [],
      exhaust: [],
      nextAttackBonus: 0,
      insight: 0,
      status: 'playing',
      intentIndex: 0,
      rngState: (Number(seed) >>> 0) || 20261003,
      logs: ['幻想形態模擬戰開始。']
    };
  }

  function emit(state, events, type, amount, target, text, extra) {
    const event = Object.assign({ type, amount, target, text }, extra || {});
    events.push(event);
    if (text) state.logs.push(text);
    return event;
  }

  function nextRandom(state) {
    // Seeded xorshift32 keeps replay, screenshots, and tests reproducible.
    let value = state.rngState >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    state.rngState = value >>> 0;
    return state.rngState / 4294967296;
  }

  function drawCards(state, count, events) {
    let drawn = 0;
    while (drawn < count && state.hand.length < 10) {
      if (state.draw.length === 0) {
        if (state.discard.length === 0) break;
        state.draw = state.discard.splice(0);
        for (let i = state.draw.length - 1; i > 0; i--) {
          const j = Math.floor(nextRandom(state) * (i + 1));
          [state.draw[i], state.draw[j]] = [state.draw[j], state.draw[i]];
        }
        emit(state, events, 'shuffle', state.draw.length, 'player', '棄牌重新洗入抽牌堆。');
      }
      const card = state.draw.shift();
      state.hand.push(card);
      drawn++;
      emit(state, events, 'draw', 1, 'player', '抽到「' + CARDS[card.id].name + '」。', { cardId: card.id, uid: card.uid });
    }
    return drawn;
  }

  function addBlock(state, target, amount, events) {
    state[target].block += amount;
    emit(state, events, 'block', amount, target, (target === 'player' ? '一輝' : '史黛菈') + '獲得 ' + amount + ' 點格擋。');
  }

  function clearBlock(state, target, events) {
    const amount = state[target].block;
    state[target].block = 0;
    if (amount) emit(state, events, 'blockExpired', amount, target, (target === 'player' ? '一輝' : '史黛菈') + '的剩餘格擋消退。');
  }

  function addInsight(state, amount, events) {
    const gained = Math.min(amount, 100 - state.insight);
    state.insight += gained;
    if (gained) emit(state, events, 'insight', gained, 'player', state.insight === 100 ? '解析完成：下一次攻擊穿透魔力護盾。' : '解析 +' + gained + '%。');
  }

  function damage(state, target, amount, events, isSelfDamage, pierceBarrier = false) {
    const actor = state[target];
    const barrierBlocked = isSelfDamage || pierceBarrier ? 0 : Math.min(actor.barrier || 0, amount);
    if (barrierBlocked) actor.barrier -= barrierBlocked;
    const blocked = isSelfDamage ? 0 : Math.min(actor.block, amount - barrierBlocked);
    actor.block -= blocked;
    let remaining = amount - barrierBlocked - blocked;
    const glancing = !isSelfDamage && target === 'player' && actor.glancing;
    const mitigated = glancing ? Math.max(0, remaining - 4) : 0;
    if (glancing) { remaining = Math.min(remaining, 4); actor.glancing = false; }
    const lost = Math.min(actor.hp, remaining);
    actor.hp -= lost;
    const name = target === 'player' ? '一輝' : '史黛菈';
    const text = isSelfDamage
      ? name + '失去 ' + lost + ' 體力。'
      : name + (barrierBlocked ? '護盾吸收 ' + barrierBlocked + '，' : '') + (blocked ? '格擋 ' + blocked + '，' : '') + (mitigated ? '受身卸去 ' + mitigated + '，' : '') + '受到 ' + lost + ' 傷害。';
    emit(state, events, isSelfDamage ? 'selfDamage' : 'damage', lost, target, text, { attempted: amount, blocked, barrierBlocked, mitigated, pierceBarrier });
    if (!isSelfDamage && target === 'player' && (blocked > 0 || glancing)) addInsight(state, 15, events);
  }

  function finishIfNeeded(state, events) {
    // Resolve the entire card, including self-damage, before judging the outcome.
    // Survival wins priority: a mutual knockout is a loss, so Shura cannot skip its cost.
    if (state.player.hp <= 0) {
      state.status = 'lost';
      emit(state, events, 'loss', 0, 'player', '一輝無法繼續戰鬥。模擬戰結束。');
    } else if (state.enemy.hp <= 0) {
      state.status = 'won';
      emit(state, events, 'win', 0, 'player', '史黛菈的體力歸零。模擬戰勝利。');
    }
    return state.status !== 'playing';
  }

  function invalid(reason) {
    return { ok: false, reason, events: [] };
  }

  function cardAvailability(state, uid) {
    if (state.status !== 'playing') return invalid('模擬戰已結束。');
    const index = state.hand.findIndex(card => card.uid === uid);
    if (index < 0) return invalid('這張牌已不在手牌中。');
    const instance = state.hand[index];
    const definition = CARDS[instance.id];
    if (!definition) return invalid('無法辨識這張牌。');
    if (state.energy < definition.cost) return invalid('行動點不足。');
    if (state.player.mp < definition.mpCost) return invalid('魔力不足。');
    return { ok: true, reason: null };
  }

  function playCard(state, uid) {
    const availability = cardAvailability(state, uid);
    if (!availability.ok) return availability;
    const index = state.hand.findIndex(card => card.uid === uid);
    const instance = state.hand[index];
    const definition = CARDS[instance.id];

    const events = [];
    state.hand.splice(index, 1);
    state.energy -= definition.cost;
    state.player.mp -= definition.mpCost;
    emit(state, events, 'play', definition.cost, 'player', '一輝使出「' + definition.name + '」。', { cardId: instance.id, uid });
    if (definition.block) addBlock(state, 'player', definition.block, events);
    if (definition.glancing) state.player.glancing = true;
    if (definition.insight) addInsight(state, definition.insight, events);
    if (definition.bonus) {
      state.nextAttackBonus += definition.bonus;
      emit(state, events, 'bonus', definition.bonus, 'player', '看破破綻：本回合下一張攻擊牌傷害 +' + definition.bonus + '。');
    }
    if (definition.type === 'attack') {
      const baseDamage = definition.guardedDamage && state.player.block > 0 ? definition.guardedDamage : definition.damage;
      const attackDamage = baseDamage + state.nextAttackBonus;
      state.nextAttackBonus = 0;
      const pierce = state.insight >= 100;
      if (pierce) {
        state.insight = 0;
        emit(state, events, 'pierce', 100, 'player', '看破生效：本次攻擊穿透魔力護盾。');
      }
      damage(state, 'enemy', attackDamage, events, false, pierce);
      if (!pierce) addInsight(state, 10, events);
    }
    if (definition.selfDamage) damage(state, 'player', definition.selfDamage, events, true);
    // A resolving card stays outside the discard pile until its draws complete.
    // This prevents a zero-cost draw card from immediately redrawing itself.
    if (definition.draw) drawCards(state, definition.draw, events);
    if (definition.exhaust) {
      state.exhaust.push(instance);
      emit(state, events, 'exhaust', 1, 'player', '「' + definition.name + '」已在本場戰鬥移除。', { cardId: instance.id, uid });
    } else {
      state.discard.push(instance);
      emit(state, events, 'discard', 1, 'player', '', { cardId: instance.id, uid });
    }
    finishIfNeeded(state, events);
    return { ok: true, reason: null, events };
  }

  function endTurn(state) {
    if (state.status !== 'playing') return invalid('模擬戰已結束。');
    const events = [];
    const discarded = state.hand.splice(0);
    state.discard.push(...discarded);
    if (discarded.length) emit(state, events, 'discard', discarded.length, 'player', '剩餘 ' + discarded.length + ' 張手牌進入棄牌堆。');
    state.nextAttackBonus = 0;
    // The enemy's old block lasts through our whole turn, then expires before it acts.
    clearBlock(state, 'enemy', events);
    const intent = currentIntent(state);
    state.enemy.mp -= intent.mpCost;
    emit(state, events, 'intent', intent.amount, 'enemy', '史黛菈發動「' + intent.name + '」。', { intentId: intent.id });
    if (intent.type === 'attack') damage(state, 'player', intent.amount, events, false);
    else {
      state.enemy.barrier += intent.amount;
      emit(state, events, 'barrier', intent.amount, 'enemy', '史黛菈獲得 ' + intent.amount + ' 魔力護盾。');
    }
    if (finishIfNeeded(state, events)) return { ok: true, reason: null, events };

    state.intentIndex = (state.intentIndex + 1) % INTENTS.length;
    state.turn++;
    state.energy = state.maxEnergy;
    clearBlock(state, 'player', events);
    state.player.glancing = false;
    emit(state, events, 'turn', state.turn, 'player', '第 ' + state.turn + ' 回合。行動點恢復至 ' + state.maxEnergy + '。');
    drawCards(state, 5, events);
    return { ok: true, reason: null, events };
  }

  function snapshot(state) {
    return JSON.parse(JSON.stringify(state));
  }

  return Object.freeze({ CARDS, INTENTS, createBattle, playCard, cardAvailability, currentIntent, endTurn, snapshot });
});
