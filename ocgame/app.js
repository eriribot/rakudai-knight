import {
  STYLES,
  ARCANAS,
  PACTS,
  CARD_MODS,
  ABILITY_CLASSES,
  STATUS_EFFECTS,
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
import { registerStella } from "./art.mjs";
import { cardIcon } from "./card-icons.mjs";
import { setupCustomization } from "./customization.mjs";
import { renderStatuses, statusIcon } from "./status-ui.mjs";

const $ = (id) => document.getElementById(id);
const game = $("game"),
  actor = $("stella-motion"),
  fx = $("stage-fx"),
  cutin = $("cutin-banner"),
  supportCutin = $("support-cutin");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
registerStella(actor);

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

      const status = card.damage && STATUS_EFFECTS[battle.profile.attackStatus];
      const statusTag = status
        ? `<span class="card-affliction" title="命中生命时附加 1 层${status.name}">${statusIcon(battle.profile.attackStatus)}${status.name} +1</span>`
        : "";
      button.className = `playing-card${mods.length ? " is-evolved" : ""}${burstReady && card.damage ? " is-burst-ready" : ""}`;
      button.dataset.id = instance.id;
      button.dataset.kind = instance.kind;
      button.dataset.type = card.type;
      button.dataset.cost = cost;
      button.innerHTML = `<span class="card-cost">${cost}</span><span class="card-kana">${card.kana}</span><span class="card-art">${cardIcon(card.icon)}${modBadges ? `<span class="card-mod-strip">${modBadges}</span>` : ""}</span><span class="card-content"><strong class="card-name">${card.name}${mods.length ? `<sup class="card-plus">+${mods.length}</sup>` : ""}</strong><span class="card-rule">${baseRule}</span>${synergyTag}${statusTag}</span><span class="card-type">${card.label}</span><span class="card-key">${index + 1}</span>`;
      button.setAttribute(
        "aria-label",
        `${card.name}，消耗 ${cost} 行动，${baseRule.replace(/<br>/g, "，").replace(/<[^>]+>/g, "")}${status ? `，命中生命时附加 1 层${status.name}` : ""}`,
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
    `《${p.deviceName}》 · ${ABILITY_CLASSES[p.abilityClass].name} · ${pact.name}`,
  );

  text("hud-rank-label", `RANK ${p.rank}`);
  text("hud-arcana-glyph", arcana.glyph);
  text(
    "hud-arcana-name",
    `${ABILITY_CLASSES[p.abilityClass].name} · ${pact.tag}`,
  );
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
  text("player-crest-symbol", STYLES[battle.profile.style].glyph);
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
  $("player-avatar").hidden = !battle.profile.avatarDataUrl;
  $("player-crest-symbol").hidden = Boolean(battle.profile.avatarDataUrl);
  if (
    battle.profile.avatarDataUrl &&
    $("player-avatar").getAttribute("src") !== battle.profile.avatarDataUrl
  )
    $("player-avatar").src = battle.profile.avatarDataUrl;
  renderStatuses(battle);
  for (const event of battle.statusEvents.splice(0)) {
    const owner = event.side === "player" ? battle.profile.name : "史黛菈",
      name = STATUS_EFFECTS[event.kind].name;
    log(
      event.type === "apply"
        ? `${owner}：${name} ${event.stacks} 层。`
        : `${owner}：${name}造成 ${event.lost} 伤害${event.remaining ? "" : "，状态解除"}。`,
    );
    if (event.type === "tick")
      floatNumber(
        `−${event.lost} ${name}`,
        event.side === "player" ? "player" : "",
      );
  }
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

function setDialogue(speaker, quote) {
  const name = speaker.includes("紅蓮")
    ? "史黛菈"
    : speaker.includes("绚濑")
      ? "绫辻绚濑"
      : battle.profile.name;
  text("dialogue-speaker", name);
  text("dialogue-text", quote.replace(/^[『「]|[』」]$/g, ""));
  $("battle-dialogue").dataset.voice = name === "绫辻绚濑" ? "ayase" : "stella";
}

async function showCutin(deviceName, artName, chant, signal) {
  text("cutin-device", `固有霊装解放 · 《${deviceName}》`);
  text("cutin-title", artName);
  text("cutin-chant", `「${chant}」`);
  cutin.hidden = false;
  cutin.classList.add("is-active");
  const ok = await wait(reduced.matches ? 90 : 720, signal);
  if (!ok) return false;
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
      supportCutin.hidden = true;
      delete supportCutin.dataset.stage;
      delete game.dataset.cinematic;
      delete actor.dataset.motion;
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
    message(
      result.resonance
        ? `${result.name} · ${result.resonance.name}`
        : result.name,
    );
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
        setDialogue(`〈${battle.profile.deviceName}〉`, "就是现在！");
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
    setDialogue(
      `〈${battle.profile.deviceName}〉`,
      battle.profile.nobleArtName + "！",
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
      btn.dataset.type = card.type;
      btn.innerHTML = `<span class="evolve-card-emblem">${cardIcon(card.icon)}</span><strong>${card.name}</strong><small>${cardCost(card, instance)} 费 · ${card.label}</small>${mods.length ? `<em>${mods.map((m) => CARD_MODS[m].badge).join(" ")}</em>` : "<em>未铭刻</em>"}`;
      btn.addEventListener("click", () => {
        selectedEvolveCardId = instance.id;
        renderEvolveOptions();
      });
      return btn;
    }),
  );

  const activeCard =
    eligible.find((c) => c.id === selectedEvolveCardId) || eligible[0];
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
  setDialogue(`〈${battle.profile.deviceName}〉`, "换个打法试试。");
  log(
    `临场变招：【${res.cardName}】永久铭刻${res.mod.badge}（+20%同调，+1印记）。`,
  );
  message(`铭刻完成 · ${res.cardName}`);
  render();
}

function fireSlash() {
  const arc = effect("fire-slash");
  arc.innerHTML = `<svg viewBox="0 0 1000 650" preserveAspectRatio="none"><path class="fire-outer" d="M910 40C850 270 525 560 35 540C430 650 865 423 970 130L850 255Z"/><path class="fire-core" d="M910 40C820 325 470 565 35 540C420 585 785 425 910 40Z"/><path class="fire-tail" d="M843 112C730 363 405 510 126 516M880 176C679 456 489 481 321 507"/></svg>`;
  for (let i = 0; i < 12; i++) {
    const ember = effect("fire-ember");
    ember.style.left = `${27 + i * 4.2}%`;
    ember.style.top = `${64 - i * 2.5}%`;
    ember.style.setProperty("--angle", `${i * 29 + 8}deg`);
    ember.style.setProperty("--distance", `${60 + (i % 4) * 25}px`);
  }
}

async function stellaCut(signal, impact = () => {}) {
  if (signal.aborted) return;
  if (reduced.matches) {
    actor.dataset.pose = "cut";
    impact();
    if (await wait(100, signal)) actor.dataset.pose = "ready";
    return;
  }
  // Camera faces the opponent. Translate complete registered sprites; never scale the head.
  const advance = Math.min(72, Math.max(38, innerWidth * 0.07));
  actor.dataset.motion = "windup";
  animate(
    actor,
    [{ transform: "translate(0,0)" }, { transform: "translate(0,-6px)" }],
    { duration: 45, fill: "forwards", easing: "ease-out" },
  );
  if (!(await wait(45, signal))) return;
  const ghost = actor.cloneNode(true);
  ghost.removeAttribute("id");
  ghost.removeAttribute("data-motion");
  ghost.classList.add("afterimage");
  ghost.setAttribute("aria-hidden", "true");
  $("actor-root").append(ghost);
  animate(
    ghost,
    [{ opacity: 0.4 }, { opacity: 0, transform: "translate(0,-22px)" }],
    { duration: 180, fill: "forwards" },
  );
  actor.dataset.motion = "advance";
  animate(
    actor,
    [
      { transform: "translate(0,-6px)" },
      { transform: `translate(-12px,${advance}px)` },
    ],
    { duration: 55, fill: "forwards", easing: "cubic-bezier(.75,0,1,.5)" },
  );
  if (!(await wait(55, signal))) return;
  actor.dataset.pose = "cut";
  actor.dataset.motion = "impact";
  fireSlash();
  shake();
  impact();
  // Brief impact hold makes the second pose readable without slowing the approach.
  if (!(await wait(85, signal))) return;
  actor.dataset.motion = "return";
  animate(
    actor,
    [
      { transform: `translate(-12px,${advance}px)` },
      { transform: "translate(0,0)" },
    ],
    { duration: 100, fill: "forwards", easing: "cubic-bezier(.2,.8,.2,1)" },
  );
  if (!(await wait(100, signal))) return;
  ghost.remove();
  actor.dataset.pose = "ready";
  delete actor.dataset.motion;
  actor.getAnimations().forEach((a) => a.cancel());
}

async function endTurn() {
  if (!canAct()) return;
  await runAction(async (signal) => {
    const next = beginEnemy(battle);
    render();
    if (!next) return;
    message("史黛菈的回合");
    setDialogue("〈紅蓮の皇女〉", `『${next.cue}』`);
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
      setDialogue("〈紅蓮の皇女〉", `『${nextCue}』`);
    }
  });
}

async function support() {
  if (!canAct() || battle.supportUsed) return;
  $("bond-dialog").close();
  await runAction(async (signal) => {
    game.dataset.cinematic = "support";
    supportCutin.hidden = false;
    supportCutin.dataset.stage = reduced.matches ? "portrait" : "eyes";
    message("绫辻绚濑 · 支援");
    if (!(await wait(reduced.matches ? 100 : 200, signal))) return;
    supportCutin.dataset.stage = "portrait";
    if (!(await wait(reduced.matches ? 100 : 520, signal))) return;
    // Apply support once, at the reveal. Aborted presentations cannot mutate a new battle.
    const result = useSupport(battle);
    if (!result) return;
    render();
    text("support-reward", `生命 +${result.healing} · 护盾 +8 · 同调 +50%`);
    supportCutin.dataset.stage = "resolve";
    document.querySelector(".companion").classList.add("supported");
    setDialogue("绫辻绚濑", "这一次，让我来帮你。");
    log(
      `绚濑支援：回复 ${result.healing}，护盾 +8，同调 +50%，印记 +2，变招 +1。`,
    );
    if (!(await wait(reduced.matches ? 150 : 360, signal))) return;
    supportCutin.dataset.stage = "exit";
    if (!(await wait(reduced.matches ? 30 : 200, signal))) return;
    supportCutin.hidden = true;
    delete game.dataset.cinematic;
    effect("support-light");
    effect("guard-fx");
    floatNumber(result.healing ? `+${result.healing}` : "护盾 +8", "support");
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
  setDialogue(
    "〈紅蓮の皇女〉",
    won ? "『这一局，算你赢了。』" : "『再来吧。我等着你。』",
  );
  message("对练结束");
  $("result-stats").innerHTML =
    `<span><b>${battle.turn}</b>回合</span><span><b>${battle.played}</b>出牌</span><span><b>${battle.damageDealt}</b>伤害</span><span><b>${battle.resonancesTriggered + battle.nobleArtsUsed}</b>流派爆发</span>`;
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  $("result-dialog").showModal();
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
  supportCutin.hidden = true;
  delete supportCutin.dataset.stage;
  delete game.dataset.cinematic;
  delete actor.dataset.motion;
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
  setDialogue("〈紅蓮の皇女〉", "来吧，让我看看你的剑术。");
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
    setDialogue("〈紅蓮の皇女〉", "看好了！");
    await stellaCut(signal);
    if (!signal.aborted)
      message(battle.phase === "player" ? "你的回合" : "对练结束");
  }),
);
setupCustomization({ getProfile: () => profile, onSave: restart });

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
