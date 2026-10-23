(() => {
  'use strict';

  const animations = new Set();
  const effects = new Set();
  const delays = new Set();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const frameIndex = Object.freeze({ idle: 5, 'walk-a': 0, 'walk-b': 1, 'walk-c': 2, windup: 3, slash: 4, guard: 5 });
  const assetPaths = [
    'assets/ikki-anime-two-pose-v3.png', 'assets/stella-anime-motion-v2.png'
  ];
  let revision = 0;

  function preload(path) {
    return new Promise(resolve => {
      const image = new Image();
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        image.onload = image.onerror = null;
        resolve(Object.freeze({ path, ok: !error, width: image.naturalWidth, height: image.naturalHeight, error: error || null }));
      };
      const timeout = window.setTimeout(() => finish('圖片載入逾時'), 15000);
      image.onload = async () => {
        try {
          if (typeof image.decode === 'function') await image.decode();
          finish(image.naturalWidth && image.naturalHeight ? null : '圖片尺寸無效');
        } catch { finish('圖片解碼失敗'); }
      };
      image.onerror = () => finish('圖片載入失敗');
      image.src = path;
    });
  }

  // A fulfilled report lets the page explain missing assets before enabling input.
  // Idle and actions share the same sheet and source-pixel scale. Never switch
  // back to the differently proportioned portrait when an action completes.
  const ready = Promise.all(assetPaths.map(preload)).then(assets => Object.freeze({
    ok: assets.every(asset => asset.ok),
    assets: Object.freeze(assets),
    failures: Object.freeze(assets.filter(asset => !asset.ok))
  }));

  const getActor = side => document.getElementById(side === 'enemy' || side === 'stella' ? 'actor-enemy' : 'actor-player');
  const sprite = actor => actor?.querySelector('.actor-sprite');
  const aura = actor => actor?.querySelector('.actor-aura');
  const stage = () => document.getElementById('combat-stage');
  const current = token => token === revision;

  function pose(actor, value, phase = 'idle') {
    if (!actor) return;
    const changed = actor.dataset.pose !== value || actor.dataset.phase !== phase;
    actor.dataset.pose = value;
    actor.dataset.phase = phase;
    // Ikki now has two drawings; Stella uses the ready/slash pair of her sheet.
    const sourceFrame = actor.id === 'actor-player' ? (value === 'slash' ? 1 : 0) : frameIndex[value];
    if (changed) window.dispatchEvent(new CustomEvent('combat:pose', { detail: Object.freeze({
      side: actor.id === 'actor-enemy' ? 'enemy' : 'player',
      pose: value, frame: sourceFrame, phase, sequence: revision, time: performance.now()
    }) }));
  }

  function setPose(token, actor, value, phase) {
    if (!current(token)) return false;
    pose(actor, value, phase);
    return current(token);
  }

  async function prepared(token) {
    const report = await ready;
    if (!current(token)) return false;
    if (!report.ok) {
      const error = new Error('戰鬥動作素材未就緒：' + report.failures.map(asset => asset.path).join('、'));
      error.name = 'CombatAssetError';
      window.dispatchEvent(new CustomEvent('combat:asseterror', { detail: report }));
      throw error;
    }
    return true;
  }

  function impactOnce(token, callback) {
    let applied = false;
    return () => {
      if (applied || !current(token)) return false;
      applied = true;
      callback?.();
      return current(token);
    };
  }

  function clean() {
    for (const animation of animations) animation.cancel();
    animations.clear();
    for (const delay of delays) { window.clearTimeout(delay.timer); delay.resolve(); }
    delays.clear();
    for (const effect of effects) effect.remove();
    effects.clear();
    for (const actor of [getActor('player'), getActor('enemy')]) {
      if (!actor) continue;
      actor.classList.remove('is-active', 'is-attacking', 'is-charging');
      pose(actor, 'idle');
    }
  }

  function reset() { revision += 1; clean(); }
  function begin() { reset(); return revision; }
  function finish(token) { if (current(token)) clean(); }

  function wait(duration) {
    return new Promise(resolve => {
      const delay = { timer: 0, resolve };
      delay.timer = window.setTimeout(() => { delays.delete(delay); resolve(); }, duration);
      delays.add(delay);
    });
  }

  function animate(element, keyframes, options) {
    if (!element || typeof element.animate !== 'function') return Promise.resolve();
    const animation = element.animate(keyframes, { fill: 'forwards', easing: 'ease-out', ...options });
    animations.add(animation);
    return animation.finished.catch(() => {});
  }

  function point(actor) {
    const bounds = actor.getBoundingClientRect();
    const parent = stage().getBoundingClientRect();
    return { x: bounds.left + bounds.width / 2 - parent.left, y: bounds.top + bounds.height * .49 - parent.top, height: bounds.height, width: bounds.width };
  }

  function effect(kind, side, target, width, height) {
    const element = document.createElement('span');
    element.className = `combat-effect combat-${kind}`;
    element.dataset.side = side;
    element.setAttribute('aria-hidden', 'true');
    element.style.cssText = `left:${target.x}px;top:${target.y}px;width:${width}px;height:${height}px;margin-left:${-width / 2}px;margin-top:${-height / 2}px`;
    stage().append(element);
    effects.add(element);
    return element;
  }

  function shield(side, actor, duration = 350) {
    const at = point(actor);
    const ring = effect('shield', side, at, at.width * .95, at.height * .69);
    return animate(ring, [
      { opacity: 0, transform: 'scale(.7)' },
      { opacity: .95, transform: 'scale(1.04)', offset: .25 },
      { opacity: 0, transform: 'scale(1.16)' }
    ], { duration });
  }

  function slash(side, target, finisher, duration) {
    const at = point(target);
    const line = effect('slash', side, at, at.height * (finisher ? 1.4 : 1.05), finisher ? 8 : 6);
    if (finisher) line.classList.add('is-finisher');
    const rotation = side === 'player' ? -35 : 35;
    return animate(line, [
      { opacity: 0, transform: `rotate(${rotation}deg) scaleX(.12)` },
      { opacity: 1, transform: `rotate(${rotation}deg) scaleX(1)`, offset: .18 },
      { opacity: .95, transform: `rotate(${rotation}deg) scaleX(1.08)`, offset: .5 },
      { opacity: 0, transform: `rotate(${rotation}deg) scaleX(1.18)` }
    ], { duration });
  }

  function afterimages(actor, side, travel, duration) {
    const source = sprite(actor);
    if (!source || reducedMotion.matches) return Promise.resolve();
    // Clone the entire current sprite and its pose context. The two impressions
    // retain the exact source crop, body proportions and grounded anchor.
    return Promise.all([0, .42].map((fraction, index) => {
      const ghost = actor.cloneNode(false);
      ghost.removeAttribute('id');
      ghost.removeAttribute('role');
      ghost.removeAttribute('aria-label');
      ghost.classList.remove('is-active', 'is-attacking', 'is-charging');
      ghost.classList.add('combat-effect', 'combat-afterimage');
      ghost.dataset.side = side;
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.transform = `translate3d(${travel * fraction}px,0,0)`;
      ghost.append(source.cloneNode(true));
      stage().append(ghost);
      effects.add(ghost);
      return animate(ghost, [
        { opacity: 0 },
        { opacity: index === 0 ? .24 : .32, offset: .15 },
        { opacity: 0 }
      ], { duration: duration + 30, delay: index * 20 }).finally(() => {
        ghost.remove();
        effects.delete(ghost);
      });
    }));
  }

  async function attack(side, { finisher = false, blocked = false, onImpact } = {}) {
    side = side === 'enemy' || side === 'stella' ? 'enemy' : 'player';
    const attacker = getActor(side);
    const defenderSide = side === 'player' ? 'enemy' : 'player';
    const defender = getActor(defenderSide);
    if (!attacker || !defender || !stage()) return;
    const token = begin();
    const impact = impactOnce(token, onImpact);
    try {
      if (!await prepared(token)) return;
      attacker.classList.add('is-active', 'is-attacking');
      defender.classList.add('is-active');
      if (reducedMotion.matches) {
        if (!setPose(token, attacker, 'slash', 'strike')) return;
        if (!setPose(token, defender, 'guard', blocked ? 'block' : 'recoil')) return;
        if (!impact()) return;
        await animate(aura(blocked ? defender : attacker), [{ opacity: .65 }, { opacity: 0 }], { duration: 170 });
        return;
      }

      const timing = { prepare: finisher ? 90 : 40, approach: 80, slash: 90, retreat: 80 };
      if (!setPose(token, attacker, 'guard', finisher ? 'charge' : 'ready')) return;
      if (finisher) {
        attacker.classList.add('is-charging');
        await Promise.all([
          animate(aura(attacker), [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1.2)', offset: .8 }, { opacity: .25, transform: 'scale(1)' }], { duration: timing.prepare }),
          wait(timing.prepare)
        ]);
        if (!current(token)) return;
        attacker.classList.remove('is-charging');
      } else await wait(timing.prepare);
      if (!current(token)) return;

      const origin = point(attacker);
      const target = point(defender);
      const direction = Math.sign(target.x - origin.x);
      const distance = Math.abs(target.x - origin.x);
      const contactGap = Math.min(origin.height * .7, distance * .72);
      const travel = direction * Math.max(0, distance - contactGap);
      // Stop before the opponent's body; only weapons enter the contact area.
      // Dash in the ready stance; no walk cycle or whole-body scaling is used.
      if (!setPose(token, attacker, 'guard', 'approach')) return;
      const approachEffects = afterimages(attacker, side, travel, timing.approach);
      await Promise.all([
        animate(attacker, [{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${travel}px,0,0)` }], { duration: timing.approach, easing: 'cubic-bezier(.25,.65,.3,1)' }),
        wait(timing.approach)
      ]);
      if (!current(token)) return;

      // The damage callback belongs to the start of the visible hit effect, once.
      if (!setPose(token, attacker, 'slash', 'strike')) return;
      if (!setPose(token, defender, 'guard', blocked ? 'block' : 'recoil')) return;
      if (!impact()) return;
      const impactDuration = timing.slash;
      const impactPoint = point(defender);
      const spark = effect('spark', side, impactPoint, finisher ? 64 : 42, finisher ? 64 : 42);
      const recoil = direction * Math.min(blocked ? 6 : finisher ? 25 : 15, target.width * .22);
      const feedback = Promise.all([
        slash(side, defender, finisher, impactDuration),
        blocked ? shield(defenderSide, defender, impactDuration) : Promise.resolve(),
        animate(spark, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1.3)', offset: .15 }, { opacity: .95, transform: 'scale(1.15)', offset: .48 }, { opacity: 0, transform: 'scale(.6)' }], { duration: impactDuration }),
        animate(defender, [{ transform: 'translateX(0)' }, { transform: `translateX(${recoil}px)`, offset: .25 }, { transform: 'translateX(0)' }], { duration: impactDuration }),
        animate(sprite(defender), [{ filter: 'brightness(1)' }, { filter: `brightness(${blocked ? 1.35 : 1.9})`, offset: .2 }, { filter: 'brightness(1)' }], { duration: impactDuration })
      ]);
      // Hold the full slash pose at contact while the white impact core resolves.
      await Promise.all([wait(timing.slash), feedback, approachEffects]);
      if (!current(token)) return;

      if (!setPose(token, defender, 'idle', 'idle')) return;
      if (!setPose(token, attacker, 'guard', 'retreat')) return;
      await Promise.all([
        animate(attacker, [{ transform: `translate3d(${travel}px,0,0)` }, { transform: 'translate3d(0,0,0)' }], { duration: timing.retreat, easing: 'cubic-bezier(.2,.65,.3,1)' }),
        wait(timing.retreat)
      ]);
      if (!current(token)) return;
      setPose(token, attacker, 'idle', 'idle');

    } finally { finish(token); }
  }

  async function guard(side, { onImpact } = {}) {
    side = side === 'enemy' || side === 'stella' ? 'enemy' : 'player';
    const actor = getActor(side);
    if (!actor || !stage()) return;
    const token = begin();
    const impact = impactOnce(token, onImpact);
    try {
      if (!await prepared(token)) return;
      actor.classList.add('is-active');
      if (!setPose(token, actor, 'guard', 'guard')) return;
      if (!impact()) return;
      const duration = reducedMotion.matches ? 160 : 220;
      await Promise.all([
        reducedMotion.matches ? Promise.resolve() : shield(side, actor, duration),
        animate(aura(actor), [{ opacity: 0 }, { opacity: .8, offset: .25 }, { opacity: 0 }], { duration }),
        wait(duration)
      ]);
    } finally { finish(token); }
  }

  async function insight({ onImpact } = {}) {
    const actor = getActor('player');
    const target = getActor('enemy');
    if (!actor || !target || !stage()) return;
    const token = begin();
    const impact = impactOnce(token, onImpact);
    try {
      if (!await prepared(token)) return;
      actor.classList.add('is-active');
      if (!setPose(token, actor, 'guard', 'insight')) return;
      if (!impact()) return;
      if (reducedMotion.matches) {
        await Promise.all([
          animate(aura(actor), [{ opacity: .6 }, { opacity: 0 }], { duration: 170 }),
          wait(170)
        ]);
        return;
      }
      const at = point(target);
      const reticle = effect('read', 'player', at, at.width * 1.2, at.width * 1.2);
      await Promise.all([
        animate(reticle, [{ opacity: 0, transform: 'scale(1.6) rotate(-25deg)' }, { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: .4 }, { opacity: 0, transform: 'scale(.85) rotate(12deg)' }], { duration: 280 }),
        animate(aura(actor), [{ opacity: 0 }, { opacity: .85, offset: .35 }, { opacity: 0 }], { duration: 280 }),
        wait(280)
      ]);
    } finally { finish(token); }
  }

  window.CombatActors = Object.freeze({ attack, guard, insight, reset, ready });
})();
