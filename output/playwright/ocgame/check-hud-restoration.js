async page => {
  const errors = [], failed = [], illustrations = [], checks = [], layouts = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    if (/\/assets\/cards\//.test(r.url())) illustrations.push(r.url());
  });
  const check = (name, ok, detail) => {
    checks.push({ name, ok, detail });
    if (!ok) throw new Error(name + ': ' + JSON.stringify(detail));
  };
  const idle = () => page.waitForFunction(() => document.querySelector('#game').dataset.busy === 'false');
  await page.goto('http://127.0.0.1:4178/');
  await page.evaluate(() => localStorage.removeItem('ocgame.profile.v1'));
  await page.reload();
  await page.setViewportSize({ width: 799, height: 764 });
  await page.locator('#evolve-btn').click();
  check('evolution picker uses five emblems and no illustration', await page.locator('#evolve-card-list svg').count() === 5 && await page.locator('#evolve-dialog img').count() === 0);
  await page.locator('.evolve-card-item').nth(1).click();
  const selectedId = await page.locator('.evolve-card-item.is-selected').getAttribute('data-card-id');
  await page.locator('.evolve-mod-item:not([disabled])').nth(1).click();
  const selectedBadge = await page.locator('.evolve-mod-item.is-selected .mod-item-top span').innerText();
  await page.screenshot({ path: 'output/playwright/ocgame/hud-restored-evolution.png', fullPage: true });
  await page.locator('#confirm-evolve').click();
  await idle();
  check('evolution consumes one charge and preserves chosen modification', await page.locator('#evolve-count').innerText() === '0' && await page.locator(`.playing-card[data-id="${selectedId}"]`).innerText().then(t => t.includes(selectedBadge)));
  await page.locator('#reset').click();
  await page.locator('#customize').click();
  check('default portrait is academy emblem', (await page.locator('#avatar-preview').getAttribute('src')).endsWith('knight-shield.svg'));
  check('five classes and free appearance retained', await page.locator('input[name=abilityClass]').count() === 5 && await page.locator('#appearance-input').count() === 1 && await page.locator('#avatar-input').count() === 1);
  await page.screenshot({ path: 'output/playwright/ocgame/hud-restored-registration.png', fullPage: true });
  await page.keyboard.press('Escape');
  await page.locator('#view-bond').click();
  check('accepted Ayase art still opens', await page.locator('#bond-dialog').isVisible());
  await page.keyboard.press('Escape');
  await page.locator('#player-statuses button').click();
  check('status rules remain accessible', await page.locator('#status-dialog').isVisible());
  await page.keyboard.press('Escape');
  await page.locator('#hand button').first().click();
  await idle();
  await page.locator('#end-turn').click();
  await idle();
  const health = await page.evaluate(() => {
    const bar = id => {
      const root = document.getElementById(id + '-meter');
      return { value: +root.getAttribute('aria-valuenow'), max: +root.getAttribute('aria-valuemax'), fraction: parseFloat(document.getElementById(id + '-fill').style.width) / 100 };
    };
    return { enemy: bar('enemy'), player: bar('player') };
  });
  check('both restored meters reflect damage', Object.values(health).every(h => h.value < h.max && Math.abs(h.fraction - h.value / h.max) < 0.001), health);
  await page.screenshot({ path: 'output/playwright/ocgame/hud-restored-damage.png', fullPage: true });
  await page.locator('#reset').click();
  await page.waitForTimeout(300);
  for (const [width, height] of [[1440, 900], [1024, 768], [799, 764], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const l = await page.evaluate(() => {
      const box = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      };
      return { overflow: document.documentElement.scrollWidth > innerWidth, player: box('.player-status'), companion: box('.companion'), hand: box('.hand-zone'), device: box('.device-hud'), end: box('.turn-controls'), notes: box('.turn-notes') };
    });
    const disjoint = (a, b) => a.right <= b.x || a.x >= b.right || a.bottom <= b.y || a.y >= b.bottom;
    check(`layout ${width}x${height}`, !l.overflow && disjoint(l.player, l.hand) && disjoint(l.player, l.companion) && disjoint(l.player, l.device) && disjoint(l.hand, l.end) && disjoint(l.device, l.notes) && disjoint(l.notes, l.end), l);
    layouts.push({ width, height, ...l });
    await page.screenshot({ path: `output/playwright/ocgame/hud-restored-${width}.png`, fullPage: true });
  }
  check('no old action art requested by battle, evolution or registration', illustrations.length === 0, illustrations);
  check('no runtime or asset failures', errors.length === 0 && failed.length === 0, { errors, failed });
  await page.setViewportSize({ width: 799, height: 764 });
  return { passed: checks.length, checks, layouts };
}
