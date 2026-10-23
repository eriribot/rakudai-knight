// Run with the existing playwright-cli cardgame-update session after the browser
// owner releases it. This script observes real-time playback; it does not pause,
// stretch, or replace the production animations to make assertions pass.
async (page) => {
  const checks = [], errors = [], failures = [], cases = [], screenshots = [];
  const root = 'output/playwright/cardgame/simple-motion-';
  const onError = error => errors.push(error.message);
  const onResponse = response => {
    if (response.status() >= 400) failures.push(response.status() + ' ' + response.url());
  };
  page.on('pageerror', onError);
  page.on('response', onResponse);
  const assert = (condition, label) => {
    if (!condition) throw new Error(label);
    checks.push(label);
  };
  const ready = () => page.waitForFunction(() => Cardgame.assetsReady && !Cardgame.busy && !Cardgame.demonstrating);
  const read = () => page.evaluate(() => Cardgame.state);
  const restart = async () => { await page.keyboard.press('r'); await ready(); };
  const screenshot = async name => {
    const path = root + name + '-20261023.png';
    await page.screenshot({ path, animations: 'allow' });
    screenshots.push(path);
  };

  async function record() {
    await page.evaluate(() => {
      window.__simpleMotion?.stop?.();
      const trace = { events: [], samples: [], ghosts: [], floats: [], running: true, started: performance.now() };
      const actors = ['player', 'enemy'];
      const seenGhosts = new WeakSet();
      const fingerprint = value => {
        let hash = 2166136261;
        for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
        return value.length + ':' + (hash >>> 0).toString(16);
      };
      const inspect = (actor, side) => {
        const sprite = actor.querySelector('.actor-sprite');
        const rect = actor.getBoundingClientRect(), body = sprite.getBoundingClientRect();
        const style = getComputedStyle(actor), wrapper = getComputedStyle(sprite);
        const before = getComputedStyle(sprite, '::before');
        const art = before.backgroundImage !== 'none' ? before : wrapper;
        const after = getComputedStyle(sprite, '::after');
        let blade = null;
        if (after.backgroundImage !== 'none' && after.content !== 'none') {
          const matrix = after.transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(after.transform);
          blade = {
            image: after.backgroundImage, backgroundSize: after.backgroundSize,
            width: parseFloat(after.width), height: parseFloat(after.height),
            left: after.left, top: after.top, origin: after.transformOrigin,
            crop: fingerprint(after.clipPath), transform: after.transform,
            is2D: matrix.is2D, scaleX: Math.hypot(matrix.a, matrix.b),
            scaleY: Math.hypot(matrix.c, matrix.d),
            axisDot: matrix.a * matrix.c + matrix.b * matrix.d,
            determinant: matrix.a * matrix.d - matrix.b * matrix.c
          };
        }
        const prefix = side === 'player' ? '--ikki-' : '--stella-';
        const sourceWidth = parseFloat(style.getPropertyValue('--motion-source-width'));
        const unit = parseFloat(art.backgroundSize) / sourceWidth;
        const anchor = parseFloat(style.getPropertyValue(prefix + 'anchor-y'));
        const sourceY = parseFloat(style.getPropertyValue(prefix + 'src-y'));
        return {
          side, pose: actor.dataset.pose, phase: actor.dataset.phase,
          x: rect.x + rect.width / 2, y: rect.y, width: rect.width, height: rect.height,
          spriteWidth: body.width, spriteHeight: body.height,
          foot: body.y + (anchor - sourceY) * unit, unit,
          image: art.backgroundImage, backgroundSize: art.backgroundSize, crop: fingerprint(art.clipPath),
          bodyLayer: art === before ? 'before' : 'sprite', bodyTransform: art.transform,
          spriteTransform: wrapper.transform, rootTransform: style.transform, blade,
          animations: actor.getAnimations().map(animation => ({
            duration: animation.effect.getTiming().duration,
            transforms: animation.effect.getKeyframes().map(frame => frame.transform).filter(Boolean)
          }))
        };
      };
      const rows = () => actors.map(side => inspect(document.getElementById('actor-' + side), side));
      const registerGhost = ghost => {
        if (seenGhosts.has(ghost)) return;
        seenGhosts.add(ghost);
        const side = ghost.dataset.side;
        const own = inspect(ghost, side);
        const source = inspect(document.getElementById('actor-' + side), side);
        trace.ghosts.push({
          time: performance.now(), side, pose: ghost.dataset.pose,
          hasId: Boolean(ghost.id), hidden: ghost.getAttribute('aria-hidden'),
          pointerEvents: getComputedStyle(ghost).pointerEvents,
          children: ghost.children.length,
          spriteCount: ghost.querySelectorAll('.actor-sprite').length,
          headCount: ghost.querySelectorAll('.actor-head').length,
          own, source
        });
      };
      const observer = new MutationObserver(records => {
        for (const change of records) for (const node of change.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches('.combat-afterimage')) registerGhost(node);
          if (node.matches('.float-number')) trace.floats.push({
            time: performance.now(), text: node.textContent, className: node.className
          });
        }
      });
      observer.observe(document.getElementById('combat-stage'), { childList: true });
      observer.observe(document.getElementById('float-layer'), { childList: true });
      const handler = event => trace.events.push({ ...event.detail, rows: rows() });
      window.addEventListener('combat:pose', handler);
      let raf;
      const sample = () => {
        const cutin = getComputedStyle(document.getElementById('cutin'));
        trace.samples.push({ time: performance.now(), rows: rows(), effects: [...document.querySelectorAll('.combat-effect')].map(effect => {
          const style = getComputedStyle(effect);
          return { kind: effect.className, opacity: Number(style.opacity), pointerEvents: style.pointerEvents, transform: style.transform };
        }), cutin: { duration: cutin.animationDuration, opacity: Number(cutin.opacity) } });
      };
      const tick = () => {
        // The GIF is a separate intro; avoid duplicating idle geometry on every
        // frame while still sampling the complete subsequent live action.
        if (!BattleMedia.state.introActive) sample();
        if (trace.running) raf = requestAnimationFrame(tick);
      };
      trace.stop = () => {
        if (!trace.running) return;
        trace.running = false;
        cancelAnimationFrame(raf);
        sample();
        observer.disconnect();
        window.removeEventListener('combat:pose', handler);
      };
      window.__simpleMotion = trace;
      tick();
    });
  }
  const stop = () => page.evaluate(() => {
    __simpleMotion.stop();
    const { stop, ...trace } = __simpleMotion;
    return trace;
  });

  function checkAttack(trace, size, side, finisher = false) {
    const label = size.width + ' ' + side + (finisher ? ' shura' : ' normal');
    const actions = trace.events.filter(event => event.side === side);
    const rows = trace.samples.flatMap(sample => sample.rows.filter(row => row.side === side));
    const initial = rows[0], last = rows.at(-1);
    const forbidden = ['walk-a', 'walk-b', 'walk-c', 'windup'];
    assert(!actions.some(event => forbidden.includes(event.pose) || ['windup', 'recovery', 'settle'].includes(event.phase)), label + ': no walk, windup, recovery or settle sequence');
    assert(actions.filter(event => event.phase === 'strike').length === 1, label + ': exactly one slash impact phase');
    assert(actions.filter(event => event.phase === 'approach').length === 1 && actions.filter(event => event.phase === 'retreat').length === 1, label + ': one direct approach and return');
    assert(actions.every(event => ['idle', 'guard', 'slash'].includes(event.pose)), label + ': live poses limited to stand and slash');
    const phase = name => actions.find(event => event.phase === name);
    const beginning = phase(finisher ? 'charge' : 'ready');
    const approach = phase('approach'), strike = phase('strike'), retreat = phase('retreat');
    const end = actions.find(event => event.phase === 'idle' && event.time > retreat?.time);
    assert(Boolean(beginning && approach && strike && retreat && end), label + ': all four stages and final idle recorded');
    const actual = [approach.time - beginning.time, strike.time - approach.time, retreat.time - strike.time, end.time - retreat.time];
    const nominal = [finisher ? 90 : 40, 80, 90, 80];
    assert(actual.every((duration, index) => duration >= nominal[index] - 5 && duration <= nominal[index] + 85), label + ': real-time stage durations follow ' + nominal.join('+') + ' ms (85 ms scheduling tolerance per stage)');
    assert(end.time - beginning.time <= nominal.reduce((a, b) => a + b) + 200, label + ': no long idle or run loop');
    const movement = rows.flatMap(row => row.animations).filter(animation => animation.transforms.length);
    assert(movement.length > 0 && movement.every(animation => animation.duration === 80 && animation.transforms.every(transform => !transform.includes('scale'))), label + ': body movement uses 80 ms translation without scaling');
    const travel = Math.max(...rows.map(row => row.x)) - Math.min(...rows.map(row => row.x));
    assert(travel > (size.width > 400 ? 100 : 15), label + ': visible close-range dash');
    assert(Math.abs(initial.x - last.x) < .5 && last.pose === 'idle' && last.rootTransform === 'none', label + ': returns to original idle location');
    assert(rows.every(row => Number.isFinite(row.foot) && Math.abs(row.foot - initial.foot) < .5), label + ': shoe anchor stays on its starting floor through both poses');
    assert(rows.every(row => Math.abs(row.height - initial.height) < .1 && Math.abs(row.unit - initial.unit) < .001 && row.spriteTransform === 'none' && row.image === initial.image), label + ': actor scale and full-body source remain consistent');
    if (side === 'player') {
      assert(rows.every(row => row.blade && Number.isFinite(row.blade.width) && Number.isFinite(row.blade.height) && row.blade.width > 0 && row.blade.height > 0), label + ': shared blade pseudo-element is present in both poses');
      const reference = initial.blade;
      assert(rows.every(({ blade }) => blade.image === reference.image && blade.backgroundSize === reference.backgroundSize && blade.crop === reference.crop && Math.abs(blade.width - reference.width) < .1 && Math.abs(blade.height - reference.height) < .1), label + ': both poses use exactly the same blade source and unrotated dimensions');
      assert(rows.every(({ blade }) => blade.is2D && Math.abs(blade.scaleX - 1) < .001 && Math.abs(blade.scaleY - 1) < .001 && Math.abs(blade.axisDot) < .001 && Math.abs(blade.determinant - 1) < .001), label + ': blade transform rotates without scaling, skewing or mirroring');
    }
    const ghosts = trace.ghosts.filter(ghost => ghost.side === side);
    assert(ghosts.length === 2, label + ': exactly two afterimages created');
    assert(ghosts.every(ghost => !ghost.hasId && ghost.hidden === 'true' && ghost.pointerEvents === 'none' && ghost.children === 1 && ghost.spriteCount === 1 && ghost.headCount === 0), label + ': afterimages contain only one complete sprite and do not capture input');
    assert(ghosts.every(({ own, source }) => own.image === source.image && own.backgroundSize === source.backgroundSize && own.crop === source.crop && Math.abs(own.spriteWidth - source.spriteWidth) < .1 && Math.abs(own.spriteHeight - source.spriteHeight) < .1 && Math.abs(own.foot - source.foot) < .5 && own.spriteTransform === 'none'), label + ': afterimages preserve source crop, dimensions and foot anchor');
    if (side === 'player') assert(ghosts.every(({ own, source }) => own.blade && source.blade && own.blade.image === source.blade.image && own.blade.backgroundSize === source.blade.backgroundSize && own.blade.crop === source.blade.crop && Math.abs(own.blade.width - source.blade.width) < .1 && Math.abs(own.blade.height - source.blade.height) < .1 && own.blade.transform === source.blade.transform && own.blade.origin === source.blade.origin && own.blade.left === source.blade.left && own.blade.top === source.blade.top), label + ': afterimages retain the same complete blade and rotation as their source');
    assert(trace.samples.some(sample => sample.effects.filter(effect => effect.kind.includes('combat-afterimage') && effect.opacity > .05).length === 2), label + ': both afterimages are visibly rendered');
    assert(trace.samples.some(sample => sample.effects.some(effect => effect.kind.includes('combat-slash') && effect.opacity > .7)), label + ': slash has a visible bright impact');
    assert(trace.samples.at(-1).effects.length === 0, label + ': transient effects removed after return');
    const hitFloats = trace.floats.filter(float => float.className.split(' ').includes(side === 'player' ? 'enemy' : 'player') && float.text.startsWith('−'));
    assert(hitFloats.length === 1, label + ': actual application renders damage feedback once');
    if (finisher) assert(trace.samples.some(sample => sample.rows.some(row => row.side === side && row.phase === 'strike') && sample.cutin.duration === '1.15s' && sample.cutin.opacity > .5), label + ': user-approved 1.15 s Shura banner remains visible across impact');
    return { size, side, finisher, nominalMs: nominal, actualMs: actual, totalMs: end.time - beginning.time, travel, source: initial.image, trace };
  }

  let report;
  try {
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.goto('http://127.0.0.1:4177/');
      await ready();
      await screenshot('idle-' + size.width);
      for (const side of ['player', 'enemy']) {
        await record();
        if (side === 'player') await page.locator('.card[data-id="slash"]').click();
        else await page.locator('#end-turn').click();
        await ready();
        cases.push(checkAttack(await stop(), size, side));
      }
      let state = await read();
      assert(state.enemy.hp === 108 && state.player.hp === 78 && state.turn === 2, size.width + ': normal card and enemy action retain exact rule results');
      await screenshot('after-exchange-' + size.width);

      await restart();
      await record();
      await page.locator('.card[data-id="slash"]').click();
      await page.waitForFunction(() => document.getElementById('actor-player').dataset.phase === 'approach', null, { polling: 'raf', timeout: 2000 });
      await page.keyboard.press('r');
      await page.waitForTimeout(400);
      await ready();
      const cancelled = await stop();
      state = await read();
      assert(cancelled.ghosts.length === 2 && !cancelled.events.some(event => event.side === 'player' && event.phase === 'strike'), size.width + ': real R shortcut cancels during the dash before impact');
      assert(state.player.hp === 100 && state.enemy.hp === 120 && state.energy === 3 && cancelled.floats.length === 0, size.width + ': restart restores costs and prevents stale damage feedback');
      assert(cancelled.samples.at(-1).effects.length === 0 && cancelled.samples.at(-1).rows.every(row => row.pose === 'idle' && row.rootTransform === 'none'), size.width + ': reset removes afterimages and all movement');
      cases.push({ size, kind: 'R-cancel', trace: cancelled });

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await record();
      await page.locator('.card[data-id="slash"]').click();
      await ready();
      const reduced = await stop();
      state = await read();
      assert(reduced.ghosts.length === 0 && reduced.samples.every(sample => sample.effects.length === 0), size.width + ': reduced motion creates no afterimages or traveling effects');
      assert(reduced.events.filter(event => event.side === 'player' && event.phase === 'strike').length === 1 && !reduced.events.some(event => ['approach', 'retreat'].includes(event.phase)), size.width + ': reduced motion has one hit without dash phases');
      assert(reduced.samples.every(sample => sample.rows.every(row => row.rootTransform === 'none')), size.width + ': reduced motion never translates either actor');
      assert(state.enemy.hp === 108 && reduced.floats.filter(float => float.className.includes('enemy')).length === 1, size.width + ': reduced motion preserves one damage result');
      cases.push({ size, kind: 'reduced-motion', trace: reduced });
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      await restart();
      await record();
      await page.locator('.card[data-id="shura"]').click();
      await page.waitForFunction(() => BattleMedia.state.introActive);
      // Desktop exercises skip; mobile allows the actual 2.25 s intro to finish.
      if (size.width > 400) await page.locator('#shura-skip').click();
      await ready();
      const shura = await stop();
      cases.push(checkAttack(shura, size, 'player', true));
      state = await read();
      assert(state.player.hp === 82 && state.player.mp === 0 && state.enemy.hp === 78 && state.exhaust.length === 1, size.width + ': Shura retains its costs, damage and one removal');
      assert(await page.locator('#cutin').evaluate(element => getComputedStyle(element).animationDuration === '1.15s'), size.width + ': Shura cut-in CSS duration remains 1.15 s');
      await screenshot('shura-banner-' + size.width);

      await restart();
      await page.locator('.card[data-id="shura"]').click();
      await page.waitForFunction(() => BattleMedia.state.introActive);
      await restart();
      await page.waitForTimeout(400);
      assert(await page.evaluate(() => !BattleMedia.state.introActive && BattleMedia.state.mode === 'normal' && Cardgame.state.player.mp === 10 && Cardgame.state.enemy.hp === 120 && !Cardgame.state.exhaust.length && document.querySelectorAll('.combat-effect').length === 0), size.width + ': restart also cancels the Shura intro without a delayed hit');

      await page.locator('#battle-menu summary').click();
      await page.locator('#card-library').click();
      const locked = page.locator('[data-card-id="rasetsu"]');
      await locked.locator('img').evaluate(image => image.decode());
      assert(await locked.evaluate(element => element.classList.contains('is-locked') && element.textContent.includes('未解鎖')), size.width + ': Rasetsu remains visibly locked');
      assert(await page.evaluate(() => !BattleEngine.CARDS.rasetsu && ['hand', 'draw', 'discard', 'exhaust'].every(pile => Cardgame.state[pile].every(card => card.id !== 'rasetsu'))), size.width + ': Rasetsu is absent from all definitions and piles');
      await locked.scrollIntoViewIfNeeded();
      await screenshot('rasetsu-locked-' + size.width);
      await page.locator('#modal-close').click();
    }
    assert(errors.length === 0 && failures.length === 0, 'No page errors or failed HTTP resources');
    report = { status: 'passed', completedAt: new Date().toISOString(), checks, cases, screenshots, errors, failures };
  } catch (error) {
    const partial = await stop().catch(() => null);
    await screenshot('failure').catch(() => {});
    report = { status: 'failed', completedAt: new Date().toISOString(), failure: error.message, checks, cases, partial, screenshots, errors, failures };
  } finally {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    page.off('pageerror', onError);
    page.off('response', onResponse);
  }
  await page.evaluate(value => { window.__simpleMotionAcceptance = value; }, report);
  const reportPath = root + '20261023-result.json';
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(json => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'simple-motion-20261023-result.json';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, JSON.stringify(report, null, 2))
  ]);
  await download.saveAs(reportPath);
  return { status: report.status, failure: report.failure, checks: checks.length, cases: cases.length, errors, failures, reportPath, screenshots };
}
