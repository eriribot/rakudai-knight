import {
  STYLES,
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

const $ = (id) => document.getElementById(id);
const game = $("game"),
  actor = $("stella-motion"),
  fx = $("stage-fx"),
  cutin = $("cutin-banner");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

let profile;
try {
  profile = cleanProfile(
    JSON.parse(localStorage.getItem("ocgame.profile.v1") || "{}"),
  );
} catch {
  profile = cleanProfile();
}

let battle = createBattle(profile),
  busy = false,
  epoch = 0,
  controller = new AbortController();
let logs = ["史黛菈摆好了架势。"],
  shownResult = false,
  selectedEvolveCardId = null,
  selectedEvolveModId = "twin_fang";
const animations = new Set();

const icons = {
  sword:
    '<path d="m24 53 27-40 3 15-22 31M24 53l8 6m-14-2 17 10M23 61l-7 12m-5-2 9 5"/><path d="m29 49 19-28"/>',
  thrust:
    '<path d="m9 69 45-51 3-11-11 4L9 69Zm0 0 9-3M12 58l13 12M5 74l7-8"/><path d="m38 18 5-6m-6 16-9 10m21-1-10 11" opacity=".4"/>',
  shield:
    '<path d="M14 20 35 10l21 10v23c0 14-21 28-21 28S14 57 14 43Z"/><path d="M21 25 35 18l14 7v17c0 10-14 21-14 21S21 52 21 42ZM35 22v35m-10-23 10 10 10-10"/>',
  focus:
    '<circle cx="35" cy="41" r="22"/><path d="m35 8 4 27 21 6-21 5-4 28-4-28-21-5 21-6Z"/><path d="m15 19 5 7m32-7-4 7m-33 35 6-7m31 8-5-8" opacity=".5"/>',
  step: '<path d="M43 11c6 5 10 14 6 21l-8 15-14-6 4-18ZM24 47l14 7-5 10c-3 7-13 7-15 0Z"/><path d="m12 22 12 2M8 33l13 2M5 44l11 2M42 64l11 2" opacity=".5"/>',
  heavy:
    '<path d="m21 56 20-44 11 1 5 11-28 38ZM42 19l7 7-22 30M16 53l20 13M23 63l-7 12m-6-1 12 6"/><path d="m12 21 8 20m36 6-15 11" opacity=".4"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 70 82" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

function text(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function log(message) {
  logs.unshift(message);
  logs = logs.slice(0, 4);
  renderLog();
}

function renderLog() {
  $("battle-log").replaceChildren(
    ...logs.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    }),
  );
}

function setMeter(id, fill, hp, max) {
  $(id).setAttribute("aria-valuenow", String(hp));
  $(id).setAttribute("aria-valuemax", String(max));
  $(fill).style.width = `${Math.max(0, Math.min(100, (hp / max) * 100))}%`;
}

function canAct() {
  return !busy && battle.phase === "player";
}

function renderControls() {
  $("end-turn").disabled = !canAct();
  $("support").disabled = !canAct() || battle.supportUsed;
  $("support-from-card").disabled = !canAct() || battle.supportUsed;
  $("motion-preview").disabled = busy;
  $("noble-art").disabled = !canAct() || battle.sync < 100;
  const canEvolve =
    canAct() &&
    battle.evolveCharges > 0 &&
    battle.hand.some((c) => (c.mods || []).length < 2);
  $("evolve-btn").disabled = !canEvolve;
  $("open-evolve-top").disabled = !canEvolve;

  document.querySelectorAll(".playing-card").forEach((button) => {
    const instance = battle.hand.find(
      (c) => c.id === Number(button.dataset.id),
    );
    const cost = instance ? cardCost(CARDS[instance.kind], instance) : 99;
    button.disabled = !canAct() || !instance || cost > battle.energy;
  });
}

function renderHand() {
  const arcanaMeta = ARCANAS[battle.profile.arcana];
  const burstReady = battle.stacks >= 3;
  $("hand").replaceChildren(
    ...battle.hand.map((instance, index) => {
      const card = CARDS[instance.kind],
        mods = instance.mods || [],
        cost = cardCost(card, instance),
        button = document.createElement("button");
      button.type = "button";
      const damage = attackValue(battle, card, instance);
      const block = cardBlockValue(battle, card, instance);
      const isPierce =
        Boolean(card.pierce) ||
        mods.includes("soul_edge") ||
        (burstReady && battle.profile.arcana === "insight" && card.damage);

      const baseRule = card.damage
        ? `造成 <b>${damage}</b> 点伤害${isPierce ? "<br>无视护盾" : ""}`
        : card.power
          ? `下次攻击 <b>+${card.power}</b><br>抽 ${card.draw} 张牌`
          : `获得 <b>${block}</b> 点护盾${card.draw ? `<br>抽 ${card.draw} 张牌` : ""}`;

      const modBadges = mods
        .map((m) => `<i class="card-mod-badge">${CARD_MODS[m].badge}</i>`)
        .join("");
      const synergyTag =
        burstReady && card.damage
          ? `<span class="card-synergy-tag burst">⚡ 触发${arcanaMeta.short}</span>`
          : `<span class="card-synergy-tag">+1 ${arcanaMeta.markName}</span>`;

      button.className = `playing-card${mods.length ? " is-evolved" : ""}${burstReady && card.damage ? " is-burst-ready" : ""}`;
      button.dataset.id = instance.id;
      button.dataset.kind = instance.kind;
      button.dataset.type = card.type;
      button.dataset.cost = cost;
      button.innerHTML = `<span class="card-cost">${cost}</span><span class="card-kana">${card.kana}</span><span class="card-art">${icon(card.icon)}${modBadges ? `<span class="card-mod-strip">${modBadges}</span>` : ""}</span><span class="card-content"><strong class="card-name">${card.name}${mods.length ? `<sup class="card-plus">+${mods.length}</sup>` : ""}</strong><span class="card-rule">${baseRule}</span>${synergyTag}</span><span class="card-type">${card.label}</span><span class="card-key">${index + 1}</span>`;
      button.setAttribute(
        "aria-label",
        `${card.name}，消耗 ${cost} 行动，${baseRule.replace(/<br>/g, "，").replace(/<[^>]+>/g, "")}`,
      );
      button.addEventListener("click", () => onCard(instance.id));
      return button;
    }),
  );
  renderControls();
}

function renderDeviceHud() {
  const p = battle.profile;
  const arcana = ARCANAS[p.arcana];
  const pact = PACTS[p.pact];

  game.dataset.arcana = p.arcana;
  text("top-build-tag", `${p.rank}级 · 《${p.deviceName}》`);
  text("location-arcana", `${arcana.short} · ${pact.tag}回路`);
  text(
    "footer-build-summary",
    `《${p.deviceName}》 · ${arcana.name} × ${pact.name}`,
  );

  text("hud-rank-label", `RANK ${p.rank}`);
  text("hud-arcana-glyph", arcana.glyph);
  text("hud-arcana-name", `${arcana.name} · ${pact.tag}铭刻`);
  text("hud-device-name", `《${p.deviceName}》`);

  text("stack-label", `【${arcana.markName}】印记`);
  text("stack-count", `${battle.stacks} / 3`);
  const burstReady = battle.stacks >= 3;
  $("arcana-stack-bar").classList.toggle("is-ready", burstReady);
  $("stack-pips").replaceChildren(
    ...Array.from({ length: 3 }, (_, i) => {
      const pip = document.createElement("i");
      if (i < battle.stacks) pip.className = "filled";
      return pip;
    }),
  );
  text(
    "stack-hint",
    burstReady
      ? `⚡ 共鸣就绪：下张攻击触发【${arcana.burstName}】！`
      : `出牌叠满 3 层【${arcana.markName}】触发【${arcana.burstName}】`,
  );

  text("noble-name", p.nobleArtName);
  text("noble-sync", `${battle.sync}%`);
  $("noble-fill").style.width = `${battle.sync}%`;
  $("noble-art").classList.toggle("is-ready", battle.sync >= 100);

  text("evolve-count", String(battle.evolveCharges));
  text("top-evolve-count", String(battle.evolveCharges));
  text(
    "evolve-sub",
    battle.evolveCharges > 0
      ? `可用 ${battle.evolveCharges} 次 · 已铭刻 ${battle.evolutionsDone} 项词条`
      : `已铭刻 ${battle.evolutionsDone} 项 · 洗牌或支援+1`,
  );
}

function render() {
  text("player-name", battle.profile.name);
  text(
    "player-style",
    `${STYLES[battle.profile.style].name}·${ARCANAS[battle.profile.arcana].markName}`,
  );
  text("player-crest", STYLES[battle.profile.style].glyph);
  text("player-health", `${battle.player.hp} / ${battle.player.maxHp}`);
  text("enemy-health", `${battle.enemy.hp} / ${battle.enemy.maxHp}`);
  setMeter(
    "player-meter",
    "player-fill",
    battle.player.hp,
    battle.player.maxHp,
  );
  setMeter("enemy-meter", "enemy-fill", battle.enemy.hp, battle.enemy.maxHp);
  text("player-block", `护盾 ${battle.player.block}`);
  text("player-power", `蓄力 +${battle.player.power}`);
  $("player-power").hidden = !battle.player.power;
  $("player-overdrive").hidden = !battle.player.overdrive;

  text("enemy-block", `护盾 ${battle.enemy.block}`);
  $("enemy-block").hidden = !battle.enemy.block;
  text("enemy-weaken", `意图弱化 −${battle.enemy.weaken}`);
  $("enemy-weaken").hidden = !battle.enemy.weaken;

  text("energy-count", `${battle.energy} / 3`);
  $("energy-pips").replaceChildren(
    ...Array.from({ length: 3 }, (_, i) => {
      const pip = document.createElement("i");
      if (i >= battle.energy) pip.className = "empty";
      return pip;
    }),
  );
  $("energy-count").parentElement.setAttribute(
    "aria-label",
    `行动点 ${battle.energy}，上限 3`,
  );
  const next = intent(battle);
  text("intent-name", next.name);
  text("intent-value", next.damage || next.block);
  $("enemy-intent").classList.toggle("guard", !next.damage);
  $("enemy-intent").querySelector(".intent-symbol").textContent = next.damage
    ? "↘"
    : "◇";
  $("enemy-intent").setAttribute(
    "aria-label",
    `史黛菈下回合${next.name}，${next.damage ? `造成 ${next.damage} 点伤害` : `获得 ${next.block} 护盾`}`,
  );
  text("round-label", `ROUND ${String(battle.turn).padStart(2, "0")}`);
  text("deck-count", `抽牌堆 ${battle.deck.length}`);
  text("discard-count", `弃牌堆 ${battle.discard.length}`);
  text("support-count", battle.supportUsed ? "0 / 1" : "1 / 1");
  text(
    "support-desc",
    battle.supportUsed ? "本场已支援" : "回12血·8盾 · 同调+50%·变招+1",
  );
  text("support-from-card", battle.supportUsed ? "本场已支援" : "请绚濑支援");
  game.dataset.phase = battle.phase;
  game.dataset.turn = battle.turn;
  game.dataset.busy = String(busy);
  renderDeviceHud();
  renderHand();
  renderLog();
}

function wait(ms, signal = controller.signal) {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const finish = (ok) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve(ok);
    };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(true), ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

function animate(element, frames, options) {
  if (reduced.matches) return null;
  const a = element.animate(frames, options);
  animations.add(a);
  a.finished.catch(() => {}).finally(() => animations.delete(a));
  return a;
}

function effect(className, value) {
  const node = document.createElement("div");
  node.className = className;
  if (value !== undefined) node.textContent = value;
  fx.append(node);
  node.addEventListener("animationend", () => node.remove(), { once: true });
  return node;
}

function slash(incoming = false, heavy = false) {
  effect(`slash-fx${incoming ? " incoming" : ""}${heavy ? " heavy" : ""}`);
  if (!incoming && !reduced.matches) {
    effect("impact-ring");
    for (let i = 0; i < 9; i++)
      effect("spark").style.setProperty("--angle", `${i * 40 + 12}deg`);
  }
}

function floatNumber(value, kind = "") {
  if (value) effect(`floating-number ${kind}`, value);
}

function shake() {
  animate(
    document.querySelector(".scenery"),
    [
      { transform: "translate(0,0)" },
      { transform: "translate(-6px,3px)" },
      { transform: "translate(4px,-2px)" },
      { transform: "translate(0,0)" },
    ],
    { duration: 180 },
  );
}

function message(value) {
  text("turn-message", value);
}

function setCallout(speaker, quote) {
  const box = $("ln-callout");
  if (!box) return;
  box.querySelector(".callout-speaker").textContent = speaker;
  text("ln-callout-text", quote);
}

async function showCutin(deviceName, artName, chant, signal) {
  text("cutin-device", `固有霊装解放 · 《${deviceName}》`);
  text("cutin-title", artName);
  text("cutin-chant", `「${chant}」`);
  cutin.hidden = false;
  cutin.classList.add("is-active");
  const ok = await wait(reduced.matches ? 90 : 720, signal);
  cutin.classList.remove("is-active");
  cutin.hidden = true;
  return ok;
}

async function runAction(action) {
  if (busy) return;
  const token = epoch,
    signal = controller.signal;
  busy = true;
  game.dataset.busy = "true";
  renderControls();
  try {
    await action(signal);
  } catch (error) {
    if (!signal.aborted) {
      console.error(error);
      message("动作播放失败，可重新对练");
    }
  } finally {
    if (token === epoch) {
      busy = false;
      actor.dataset.pose = "ready";
      actor.style.transform = "";
      cutin.hidden = true;
      cutin.classList.remove("is-active");
      document.querySelectorAll(".afterimage").forEach((node) => node.remove());
      render();
      showResult();
    }
  }
}

async function onCard(id) {
  if (!canAct()) return;
  const target = battle.hand.find((c) => c.id === id);
  if (!target || cardCost(CARDS[target.kind], target) > battle.energy) return;
  await runAction(async (signal) => {
    const result = playCard(battle, id);
    if (!result) return;
    message(result.resonance ? `${result.name} · ${result.resonance.name}` : result.name);
    render();
    if (result.hit) {
      const isBig = result.kind === "heavy" || Boolean(result.resonance);
      slash(false, isBig);
      const totalDisplayed =
        (result.hit.lost || 0) +
        (result.resonance?.damage || 0) +
        (result.bonusHit || 0);
      floatNumber(totalDisplayed || "格挡");
      animate(
        actor,
        [
          { transform: "translate(0,0)" },
          { transform: "translate(6px,-2px)", offset: 0.25 },
          { transform: "translate(0,0)" },
        ],
        { duration: 220, easing: "ease-out" },
      );
      if (result.resonance) {
        effect("support-light");
        setCallout(
          `〈${battle.profile.deviceName}〉`,
          `『${result.resonance.name}——破！』`,
        );
        log(
          `【${result.resonance.name}】触发！${result.name}共造成 ${totalDisplayed} 伤害。`,
        );
      } else {
        log(
          `${result.name}命中 ${result.hit.lost}${result.hit.blocked ? `，护盾抵挡 ${result.hit.blocked}` : ""}${result.bonusHit ? `，追击 +${result.bonusHit}` : ""}。`,
        );
      }
      if (isBig) shake();
    } else {
      effect("guard-fx");
      if (result.bonusHit) {
        slash(false, false);
        floatNumber(`+${result.bonusHit}`);
      }
      log(
        result.power
          ? `蓄力 +${result.power}，抽取一张牌。`
          : `${result.name}：护盾 +${result.block}${CARDS[result.kind].draw ? "，抽取一张牌" : ""}${result.bonusHit ? `，连斩追击 ${result.bonusHit}` : ""}。`,
      );
    }
    if (!(await wait(reduced.matches ? 70 : 260, signal))) return;
    message(battle.phase === "player" ? "你的回合" : "对练结束");
  });
}

async function onNobleArt() {
  if (!canAct() || battle.sync < 100) return;
  await runAction(async (signal) => {
    setCallout(
      `〈${battle.profile.deviceName}〉`,
      `『${battle.profile.nobleArtName}！！』`,
    );
    message(`伐刀绝技 · ${battle.profile.nobleArtName}`);
    if (
      !(await showCutin(
        battle.profile.deviceName,
        battle.profile.nobleArtName,
        battle.profile.nobleChant,
        signal,
      ))
    )
      return;
    const result = useNobleArt(battle);
    if (!result) return;
    render();
    slash(false, true);
    effect("support-light");
    shake();
    floatNumber(result.hit.lost || "绝技");
    log(
      `解放《${result.deviceName}》·【${result.name}】！造成 ${result.hit.lost} 点穿透伤害！`,
    );
    if (!(await wait(reduced.matches ? 80 : 320, signal))) return;
    message(battle.phase === "player" ? "你的回合 · 灵装解放" : "对练结束");
  });
}

function openEvolveDialog() {
  if (!canAct() || battle.evolveCharges <= 0) return;
  const eligible = battle.hand.filter((c) => (c.mods || []).length < 2);
  if (!eligible.length) return;
  if (!eligible.some((c) => c.id === selectedEvolveCardId)) {
    selectedEvolveCardId = eligible[0].id;
  }
  renderEvolveOptions();
  $("evolve-dialog").showModal();
}

function renderEvolveOptions() {
  const eligible = battle.hand.filter((c) => (c.mods || []).length < 2);
  $("evolve-card-list").replaceChildren(
    ...eligible.map((instance) => {
      const card = CARDS[instance.kind];
      const mods = instance.mods || [];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.cardId = instance.id;
      btn.className = `evolve-card-item${instance.id === selectedEvolveCardId ? " is-selected" : ""}`;
      btn.innerHTML = `<strong>${card.name}</strong><small>${cardCost(card, instance)} 费 · ${card.label}</small>${mods.length ? `<em>${mods.map((m) => CARD_MODS[m].badge).join(" ")}</em>` : "<em>未铭刻</em>"}`;
      btn.addEventListener("click", () => {
        selectedEvolveCardId = instance.id;
        renderEvolveOptions();
      });
      return btn;
    }),
  );

  const activeCard = eligible.find((c) => c.id === selectedEvolveCardId) || eligible[0];
  const existingMods = activeCard?.mods || [];
  if (existingMods.includes(selectedEvolveModId)) {
    const firstAvailable = Object.keys(CARD_MODS).find(
      (k) => !existingMods.includes(k),
    );
    if (firstAvailable) selectedEvolveModId = firstAvailable;
  }

  $("evolve-mod-list").replaceChildren(
    ...Object.values(CARD_MODS).map((mod) => {
      const alreadyHas = existingMods.includes(mod.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.mod = mod.id;
      btn.disabled = alreadyHas;
      btn.className = `evolve-mod-item${mod.id === selectedEvolveModId && !alreadyHas ? " is-selected" : ""}`;
      btn.innerHTML = `<div class="mod-item-top"><strong>${mod.name}</strong><span>${mod.badge}</span></div><small>${mod.description}</small>`;
      btn.addEventListener("click", () => {
        selectedEvolveModId = mod.id;
        renderEvolveOptions();
      });
      return btn;
    }),
  );
}

async function confirmEvolve() {
  if (!canAct() || battle.evolveCharges <= 0) return;
  const res = evolveCard(battle, selectedEvolveCardId, selectedEvolveModId);
  if (!res) return;
  $("evolve-dialog").close();
  effect("guard-fx");
  setCallout(
    `〈${battle.profile.deviceName}〉`,
    `『剑技推演——【${res.cardName}·${res.mod.name}】！』`,
  );
  log(`临场变招：【${res.cardName}】永久铭刻${res.mod.badge}（+20%同调，+1印记）。`);
  message(`铭刻完成 · ${res.cardName}`);
  render();
}

async function stellaCut(signal, impact = () => {}) {
  if (reduced.matches) {
    actor.dataset.pose = "cut";
    impact();
    await wait(90, signal);
    if (!signal.aborted) actor.dataset.pose = "ready";
    return;
  }
  // Rigid full-character poses. No part of the face or weapon is independently scaled.
  if (!(await wait(35, signal))) return;
  const ghost = actor.cloneNode(true);
  ghost.removeAttribute("id");
  ghost.classList.add("afterimage");
  ghost.setAttribute("aria-hidden", "true");
  $("actor-root").append(ghost);
  animate(
    ghost,
    [
      { opacity: 0.24, transform: "translate(-8px,-8px)" },
      { opacity: 0, transform: "translate(-14px,-12px)" },
    ],
    { duration: 150, fill: "forwards" },
  );
  animate(
    actor,
    [{ transform: "translate(0,0)" }, { transform: "translate(10px,20px)" }],
    { duration: 65, fill: "forwards", easing: "cubic-bezier(.15,.7,.25,1)" },
  );
  if (!(await wait(65, signal))) return;
  actor.dataset.pose = "cut";
  const ghost2 = actor.cloneNode(true);
  ghost2.removeAttribute("id");
  ghost2.classList.add("afterimage");
  ghost2.setAttribute("aria-hidden", "true");
  $("actor-root").append(ghost2);
  animate(
    ghost2,
    [
      { opacity: 0.17, transform: "translate(15px,12px)" },
      { opacity: 0, transform: "translate(22px,8px)" },
    ],
    { duration: 100, fill: "forwards" },
  );
  animate(
    actor,
    [
      { transform: "translate(10px,20px)" },
      { transform: "translate(-7px,27px)" },
    ],
    { duration: 85, fill: "forwards", easing: "ease-out" },
  );
  slash(true);
  shake();
  impact();
  if (!(await wait(85, signal))) return;
  animate(
    actor,
    [{ transform: "translate(-7px,27px)" }, { transform: "translate(0,0)" }],
    { duration: 90, fill: "forwards", easing: "ease-out" },
  );
  if (!(await wait(90, signal))) return;
  ghost.remove();
  ghost2.remove();
  actor.dataset.pose = "ready";
  actor.getAnimations().forEach((a) => a.cancel());
}

async function endTurn() {
  if (!canAct()) return;
  await runAction(async (signal) => {
    const next = beginEnemy(battle);
    render();
    message("史黛菈的回合");
    text("enemy-speech", next.cue);
    setCallout("〈紅蓮の皇女〉", `『${next.cue}』`);
    if (!(await wait(240, signal))) return;
    let result;
    if (next.damage) {
      await stellaCut(signal, () => {
        result = resolveEnemy(battle);
        render();
        effect(`screen-flare${result.hit.lost ? "" : " soft"}`);
        floatNumber(result.hit.lost ? `−${result.hit.lost}` : "格挡", "player");
        if (result.counterDamage) {
          floatNumber(`反震 −${result.counterDamage}`);
        }
        log(
          `史黛菈${result.name}：${result.hit.lost} 伤害${result.hit.blocked ? `，格挡 ${result.hit.blocked}` : ""}${result.counterDamage ? `，天衣受流反震 ${result.counterDamage}` : ""}。`,
        );
      });
    } else {
      effect("guard-fx enemy");
      result = resolveEnemy(battle);
      render();
      log(`史黛菈摆出架势，获得 ${result.block} 护盾。`);
      if (!(await wait(300, signal))) return;
    }
    if (signal.aborted || !(await wait(240, signal))) return;
    if (nextTurn(battle)) {
      message(`第 ${battle.turn} 回合 · 你的回合`);
      const nextCue =
        battle.turn % 3 === 0 ? "下一剑，我会认真一些。" : "继续吧。";
      text("enemy-speech", nextCue);
      setCallout("〈紅蓮の皇女〉", `『${nextCue}』`);
    }
  });
}

async function support() {
  if (!canAct() || battle.supportUsed) return;
  $("bond-dialog").close();
  await runAction(async (signal) => {
    const result = useSupport(battle);
    render();
    document.querySelector(".companion").classList.add("supported");
    effect("support-light");
    effect("guard-fx");
    floatNumber(result.healing ? `+${result.healing}` : "护盾 +8", "support");
    setCallout("〈真命天女〉绫辻绚濑", "『我也会……与你并肩到最后一剑！』");
    message("绚濑 · 并肩共鸣");
    log(
      `绚濑支援：回复 ${result.healing}，护盾 +8，同调 +50%，印记 +2，变招 +1。`,
    );
    if (!(await wait(reduced.matches ? 90 : 650, signal))) return;
    document.querySelector(".companion").classList.remove("supported");
    message("你的回合");
  });
}

function showResult() {
  if (!["won", "lost"].includes(battle.phase) || shownResult) return;
  shownResult = true;
  const won = battle.phase === "won";
  text("result-title", won ? "这一局，你赢了" : "胜负已分");
  text(
    "result-copy",
    won
      ? "「不错嘛。下次，我可不会再输了。」"
      : "「别急，再把刚才那一剑练好。」",
  );
  text("enemy-speech", won ? "这一局，算你赢了。" : "再来吧。我等着你。");
  setCallout(
    "〈紅蓮の皇女〉",
    won ? "『这一局，算你赢了。』" : "『再来吧。我等着你。』",
  );
  message("对练结束");
  $("result-stats").innerHTML =
    `<span><b>${battle.turn}</b>回合</span><span><b>${battle.played}</b>出牌</span><span><b>${battle.damageDealt}</b>伤害</span><span><b>${battle.resonancesTriggered + battle.nobleArtsUsed}</b>流派爆发</span>`;
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  $("result-dialog").showModal();
}

function populateCustomDialog(p = profile) {
  $("name-input").value = p.name;
  $("rank-input").value = p.rank || "F";
  $("device-input").value = p.deviceName || ARCANAS[p.arcana].defaultDevice;
  $("noble-input").value = p.nobleArtName || ARCANAS[p.arcana].defaultArt;
  $("chant-input").value = p.nobleChant || ARCANAS[p.arcana].defaultChant;
  document.querySelectorAll("input[name=style]").forEach((input) => {
    input.checked = input.value === p.style;
  });
  document.querySelectorAll("input[name=arcana]").forEach((input) => {
    input.checked = input.value === p.arcana;
  });
  document.querySelectorAll("input[name=pact]").forEach((input) => {
    input.checked = input.value === p.pact;
  });
}

function restart(nextProfile = profile) {
  epoch++;
  controller.abort();
  controller = new AbortController();
  animations.forEach((a) => a.cancel());
  animations.clear();
  actor.getAnimations().forEach((a) => a.cancel());
  actor.dataset.pose = "ready";
  actor.style.transform = "";
  cutin.hidden = true;
  cutin.classList.remove("is-active");
  document.querySelectorAll(".afterimage").forEach((node) => node.remove());
  fx.replaceChildren();
  document.querySelector(".companion").classList.remove("supported");
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  profile = cleanProfile(nextProfile);
  battle = createBattle(profile);
  busy = false;
  shownResult = false;
  selectedEvolveCardId = null;
  logs = [
    `《${profile.deviceName}》同调完毕（${ARCANAS[profile.arcana].short}）。`,
    "史黛菈摆好了架势。",
  ];
  message("你的回合");
  text("enemy-speech", "来吧，让我看看你的剑术。");
  setCallout("〈紅蓮の皇女〉", "『来吧——让我见识你的灵装！』");
  render();
}

$("end-turn").addEventListener("click", endTurn);
$("support").addEventListener("click", support);
$("support-from-card").addEventListener("click", support);
$("noble-art").addEventListener("click", onNobleArt);
$("evolve-btn").addEventListener("click", openEvolveDialog);
$("open-evolve-top").addEventListener("click", openEvolveDialog);
$("confirm-evolve").addEventListener("click", confirmEvolve);
$("view-bond").addEventListener("click", () => $("bond-dialog").showModal());
$("help").addEventListener("click", () => $("help-dialog").showModal());
$("reset").addEventListener("click", () => restart());
$("play-again").addEventListener("click", () => restart());
$("motion-preview").addEventListener("click", () =>
  runAction(async (signal) => {
    message("动作演示");
    text("enemy-speech", "看清楚了吗？");
    setCallout("〈紅蓮の皇女〉", "『看清楚这一剑的轨迹了吗？』");
    await stellaCut(signal);
    if (!signal.aborted)
      message(battle.phase === "player" ? "你的回合" : "对练结束");
  }),
);
$("customize").addEventListener("click", () => {
  populateCustomDialog(profile);
  $("custom-dialog").showModal();
});

document.querySelectorAll(".preset-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    const preset = PRESETS[btn.dataset.preset];
    if (preset) populateCustomDialog(cleanProfile(preset));
  });
});

document.querySelectorAll("input[name=arcana]").forEach((radio) => {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    const meta = ARCANAS[radio.value];
    if (!meta) return;
    const allDefaultDevices = new Set(
      Object.values(ARCANAS).map((a) => a.defaultDevice),
    );
    const allDefaultArts = new Set(
      Object.values(ARCANAS).map((a) => a.defaultArt),
    );
    const allDefaultChants = new Set(
      Object.values(ARCANAS).map((a) => a.defaultChant),
    );
    if (allDefaultDevices.has($("device-input").value.trim())) {
      $("device-input").value = meta.defaultDevice;
    }
    if (allDefaultArts.has($("noble-input").value.trim())) {
      $("noble-input").value = meta.defaultArt;
    }
    if (allDefaultChants.has($("chant-input").value.trim())) {
      $("chant-input").value = meta.defaultChant;
    }
  });
});

$("custom-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget),
    nextProfile = cleanProfile({
      name: form.get("name"),
      rank: form.get("rank"),
      style: form.get("style"),
      arcana: form.get("arcana"),
      pact: form.get("pact"),
      deviceName: form.get("deviceName"),
      nobleArtName: form.get("nobleArtName"),
      nobleChant: form.get("nobleChant"),
    });
  try {
    localStorage.setItem("ocgame.profile.v1", JSON.stringify(nextProfile));
  } catch {
    /* The demo remains usable when storage is unavailable. */
  }
  restart(nextProfile);
});

document
  .querySelectorAll("[data-close]")
  .forEach((button) =>
    button.addEventListener("click", () => button.closest("dialog").close()),
  );
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      dialog.close();
  }),
);
document.addEventListener("keydown", (event) => {
  if (
    event.repeat ||
    document.querySelector("dialog[open]") ||
    event.target.closest("input, textarea, select, [contenteditable=true]") ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return;
  if (/^[1-5]$/.test(event.key)) {
    event.preventDefault();
    const card = battle.hand[Number(event.key) - 1];
    if (card) onCard(card.id);
  }
  if (event.key === "e" || event.key === "E") {
    event.preventDefault();
    openEvolveDialog();
  }
  if (event.key === "q" || event.key === "Q") {
    event.preventDefault();
    onNobleArt();
  }
  if (event.code === "Space" && !event.target.closest("button")) {
    event.preventDefault();
    endTurn();
  }
});
render();
