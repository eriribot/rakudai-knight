import {
  STYLES,
  CARDS,
  cleanProfile,
  createBattle,
  intent,
  attackValue,
  playCard,
  useSupport,
  beginEnemy,
  resolveEnemy,
  nextTurn,
} from "./engine.mjs";

const $ = (id) => document.getElementById(id);
const game = $("game"),
  actor = $("stella-motion"),
  fx = $("stage-fx");
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
  shownResult = false;
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
  return `<svg viewBox="0 0 70 82" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}
function text(id, value) {
  $(id).textContent = value;
}
function log(message) {
  logs.unshift(message);
  logs = logs.slice(0, 3);
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
  $(fill).style.width = `${(hp / max) * 100}%`;
}
function canAct() {
  return !busy && battle.phase === "player";
}

function renderControls() {
  $("end-turn").disabled = !canAct();
  $("support").disabled = !canAct() || battle.supportUsed;
  $("support-from-card").disabled = !canAct() || battle.supportUsed;
  $("motion-preview").disabled = busy;
  document.querySelectorAll(".playing-card").forEach((button) => {
    const instance = battle.hand.find(
      (c) => c.id === Number(button.dataset.id),
    );
    button.disabled =
      !canAct() || !instance || CARDS[instance.kind].cost > battle.energy;
  });
}

function renderHand() {
  $("hand").replaceChildren(
    ...battle.hand.map((instance, index) => {
      const card = CARDS[instance.kind],
        button = document.createElement("button");
      const damage = attackValue(battle, card);
      const rule = card.damage
        ? `造成 <b>${damage}</b> 点伤害${card.pierce ? "<br>无视护盾" : ""}`
        : card.power
          ? `下次攻击 <b>+${card.power}</b><br>抽 ${card.draw} 张牌`
          : `获得 <b>${card.block}</b> 点护盾${card.draw ? `<br>抽 ${card.draw} 张牌` : ""}`;
      button.className = "playing-card";
      button.dataset.id = instance.id;
      button.dataset.kind = instance.kind;
      button.dataset.type = card.type;
      button.innerHTML = `<span class="card-cost">${card.cost}</span><span class="card-kana">${card.kana}</span><span class="card-art">${icon(card.icon)}</span><span class="card-content"><strong class="card-name">${card.name}</strong><span class="card-rule">${rule}</span></span><span class="card-type">${card.label}</span><span class="card-key">${index + 1}</span>`;
      button.setAttribute(
        "aria-label",
        `${card.name}，消耗 ${card.cost} 行动，${rule.replace(/<br>/g, "，").replace(/<[^>]+>/g, "")}`,
      );
      button.addEventListener("click", () => onCard(instance.id));
      return button;
    }),
  );
  renderControls();
}

function render() {
  text("player-name", battle.profile.name);
  text("player-style", STYLES[battle.profile.style].name);
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
  text("enemy-block", `护盾 ${battle.enemy.block}`);
  $("enemy-block").hidden = !battle.enemy.block;
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
  text("support-desc", battle.supportUsed ? "本场已支援" : "回复 12 · 护盾 8");
  text("support-from-card", battle.supportUsed ? "本场已支援" : "请绚濑支援");
  game.dataset.phase = battle.phase;
  game.dataset.turn = battle.turn;
  game.dataset.busy = String(busy);
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
      document.querySelectorAll(".afterimage").forEach((node) => node.remove());
      render();
      showResult();
    }
  }
}

async function onCard(id) {
  if (!canAct()) return;
  const target = battle.hand.find((c) => c.id === id);
  if (!target || CARDS[target.kind].cost > battle.energy) return;
  await runAction(async (signal) => {
    const result = playCard(battle, id);
    if (!result) return;
    message(result.name);
    render();
    if (result.hit) {
      slash(false, result.kind === "heavy");
      floatNumber(result.hit.lost || "格挡");
      animate(
        actor,
        [
          { transform: "translate(0,0)" },
          { transform: "translate(6px,-2px)", offset: 0.25 },
          { transform: "translate(0,0)" },
        ],
        { duration: 220, easing: "ease-out" },
      );
      log(
        `${result.name}命中 ${result.hit.lost}${result.hit.blocked ? `，护盾抵挡 ${result.hit.blocked}` : ""}。`,
      );
      if (result.kind === "heavy") shake();
    } else {
      effect("guard-fx");
      log(
        result.power
          ? `蓄力 +${result.power}，抽取一张牌。`
          : `${result.name}：护盾 +${result.block}${CARDS[result.kind].draw ? "，抽取一张牌" : ""}。`,
      );
    }
    if (!(await wait(reduced.matches ? 70 : 260, signal))) return;
    message(battle.phase === "player" ? "你的回合" : "对练结束");
  });
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
    if (!(await wait(240, signal))) return;
    let result;
    if (next.damage) {
      await stellaCut(signal, () => {
        result = resolveEnemy(battle);
        render();
        effect(`screen-flare${result.hit.lost ? "" : " soft"}`);
        floatNumber(result.hit.lost ? `−${result.hit.lost}` : "格挡", "player");
        log(
          `史黛菈${result.name}：${result.hit.lost} 伤害${result.hit.blocked ? `，格挡 ${result.hit.blocked}` : ""}。`,
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
      text(
        "enemy-speech",
        battle.turn % 3 === 0 ? "下一剑，我会认真一些。" : "继续吧。",
      );
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
    message("绚濑 · 并肩");
    log(`绚濑支援：回复 ${result.healing}，护盾 +8。`);
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
  message("对练结束");
  $("result-stats").innerHTML =
    `<span><b>${battle.turn}</b>回合</span><span><b>${battle.played}</b>出牌</span><span><b>${battle.damageDealt}</b>伤害</span>`;
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
  document.querySelectorAll(".afterimage").forEach((node) => node.remove());
  fx.replaceChildren();
  document.querySelector(".companion").classList.remove("supported");
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  profile = cleanProfile(nextProfile);
  battle = createBattle(profile);
  busy = false;
  shownResult = false;
  logs = ["史黛菈摆好了架势。"];
  message("你的回合");
  text("enemy-speech", "来吧，让我看看你的剑术。");
  render();
}

$("end-turn").addEventListener("click", endTurn);
$("support").addEventListener("click", support);
$("support-from-card").addEventListener("click", support);
$("view-bond").addEventListener("click", () => $("bond-dialog").showModal());
$("help").addEventListener("click", () => $("help-dialog").showModal());
$("reset").addEventListener("click", () => restart());
$("play-again").addEventListener("click", () => restart());
$("motion-preview").addEventListener("click", () =>
  runAction(async (signal) => {
    message("动作演示");
    text("enemy-speech", "看清楚了吗？");
    await stellaCut(signal);
    if (!signal.aborted)
      message(battle.phase === "player" ? "你的回合" : "对练结束");
  }),
);
$("customize").addEventListener("click", () => {
  $("name-input").value = profile.name;
  document.querySelectorAll("input[name=style]").forEach((input) => {
    input.checked = input.value === profile.style;
  });
  $("custom-dialog").showModal();
});
$("custom-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget),
    nextProfile = cleanProfile({
      name: form.get("name"),
      style: form.get("style"),
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
  if (event.code === "Space" && !event.target.closest("button")) {
    event.preventDefault();
    endTurn();
  }
});
render();
