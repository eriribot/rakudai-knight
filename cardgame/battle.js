(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BattleEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Independent concept-demo rules. These values do not amend the TRPG v0.3 draft.
  const CARDS = Object.freeze({
    slash: Object.freeze({ id: 'slash', name: '斬擊', cost: 1, type: 'attack', keyword: '攻擊', description: '造成 7 點傷害。', damage: 7 }),
    guard: Object.freeze({ id: 'guard', name: '受身', cost: 1, type: 'skill', keyword: '防禦', description: '獲得 8 點格擋。', block: 8 }),
    insight: Object.freeze({ id: 'insight', name: '看破', cost: 0, type: 'skill', keyword: '洞察', description: '抽 1 張牌。本回合下一張攻擊牌傷害 +4。', draw: 1, bonus: 4 }),
    step: Object.freeze({ id: 'step', name: '疾步', cost: 1, type: 'skill', keyword: '步法', description: '獲得 4 點格擋，抽 1 張牌。', block: 4, draw: 1 }),
    riposte: Object.freeze({ id: 'riposte', name: '返擊', cost: 1, type: 'attack', keyword: '連攜', description: '造成 6 點傷害。若已有格擋，改為 12 點。', damage: 6, guardedDamage: 12 }),
    shura: Object.freeze({ id: 'shura', name: '一刀修羅', cost: 2, type: 'attack', keyword: '終結', description: '造成 24 點傷害。失去 6 點生命。本場戰鬥移除。', damage: 24, selfDamage: 6, exhaust: true })
  });

  const INTENTS = Object.freeze([
    Object.freeze({ id: 'flame-slash', name: '烈焰斬', type: 'attack', amount: 8, description: '回合結束時造成 8 點傷害。' }),
    Object.freeze({ id: 'dragon-charge', name: '赤龍蓄勢', type: 'block', amount: 10, description: '回合結束時獲得 10 點格擋。下次將發動吐息。' }),
    Object.freeze({ id: 'dragon-breath', name: '妃龍吐息', type: 'attack', amount: 16, description: '回合結束時造成 16 點傷害。' })
  ]);

  function createBattle(seed = 20261003) {
    let serial = 0;
    const card = id => ({ id, uid: 'card-' + (++serial) });
    return {
      player: { hp: 48, maxHp: 48, block: 0 },
      enemy: { hp: 72, maxHp: 72, block: 0 },
      turn: 1,
      energy: 3,
      maxEnergy: 3,
      hand: ['insight', 'guard', 'riposte', 'slash', 'shura'].map(card),
      // The next draw is index 0. The fixed opener teaches one readable combination.
      draw: ['step', 'slash', 'guard', 'slash', 'guard'].map(card),
      discard: [],
      exhaust: [],
      nextAttackBonus: 0,
      status: 'playing',
      intentIndex: 0,
      rngState: (Number(seed) >>> 0) || 20261003,
      logs: ['模擬戰開始。先看她的意圖，再決定出哪張牌。']
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

  function damage(state, target, amount, events, isSelfDamage) {
    const actor = state[target];
    const blocked = isSelfDamage ? 0 : Math.min(actor.block, amount);
    actor.block -= blocked;
    const lost = Math.min(actor.hp, amount - blocked);
    actor.hp -= lost;
    const name = target === 'player' ? '一輝' : '史黛菈';
    const text = isSelfDamage
      ? name + '透支體力，失去 ' + lost + ' 點生命。'
      : name + (blocked ? '抵擋 ' + blocked + ' 點，' : '') + '受到 ' + lost + ' 點傷害。';
    emit(state, events, isSelfDamage ? 'selfDamage' : 'damage', lost, target, text, { attempted: amount, blocked });
  }

  function finishIfNeeded(state, events) {
    // Resolve the entire card, including self-damage, before judging the outcome.
    // Survival wins priority: a mutual knockout is a loss, so Shura cannot skip its cost.
    if (state.player.hp <= 0) {
      state.status = 'lost';
      emit(state, events, 'loss', 0, 'player', '一輝無法繼續戰鬥。模擬戰結束。');
    } else if (state.enemy.hp <= 0) {
      state.status = 'won';
      emit(state, events, 'win', 0, 'player', '勝負已分。這一劍，突破了烈焰。');
    }
    return state.status !== 'playing';
  }

  function invalid(reason) {
    return { ok: false, reason, events: [] };
  }

  function playCard(state, uid) {
    if (state.status !== 'playing') return invalid('模擬戰已結束。');
    const index = state.hand.findIndex(card => card.uid === uid);
    if (index < 0) return invalid('這張牌已不在手牌中。');
    const instance = state.hand[index];
    const definition = CARDS[instance.id];
    if (!definition) return invalid('無法辨識這張牌。');
    if (state.energy < definition.cost) return invalid('行動點不足。');

    const events = [];
    state.hand.splice(index, 1);
    state.energy -= definition.cost;
    emit(state, events, 'play', definition.cost, 'player', '一輝使出「' + definition.name + '」。', { cardId: instance.id, uid });
    if (definition.block) addBlock(state, 'player', definition.block, events);
    if (definition.bonus) {
      state.nextAttackBonus += definition.bonus;
      emit(state, events, 'bonus', definition.bonus, 'player', '看破破綻：本回合下一張攻擊牌傷害 +' + definition.bonus + '。');
    }
    if (definition.type === 'attack') {
      const baseDamage = definition.guardedDamage && state.player.block > 0 ? definition.guardedDamage : definition.damage;
      const attackDamage = baseDamage + state.nextAttackBonus;
      state.nextAttackBonus = 0;
      damage(state, 'enemy', attackDamage, events, false);
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
    const intent = INTENTS[state.intentIndex];
    emit(state, events, 'intent', intent.amount, 'enemy', '史黛菈發動「' + intent.name + '」。', { intentId: intent.id });
    if (intent.type === 'attack') damage(state, 'player', intent.amount, events, false);
    else addBlock(state, 'enemy', intent.amount, events);
    if (finishIfNeeded(state, events)) return { ok: true, reason: null, events };

    state.intentIndex = (state.intentIndex + 1) % INTENTS.length;
    state.turn++;
    state.energy = state.maxEnergy;
    clearBlock(state, 'player', events);
    emit(state, events, 'turn', state.turn, 'player', '第 ' + state.turn + ' 回合。行動點恢復至 ' + state.maxEnergy + '。');
    drawCards(state, 5, events);
    return { ok: true, reason: null, events };
  }

  function snapshot(state) {
    return JSON.parse(JSON.stringify(state));
  }

  return Object.freeze({ CARDS, INTENTS, createBattle, playCard, endTurn, snapshot });
});
