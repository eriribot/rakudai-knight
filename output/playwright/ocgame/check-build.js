async (page) => {
  const checks = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = (label, ok) => { if (!ok) throw new Error(label); checks.push(label); };
  const idle = () => page.waitForFunction(() => document.querySelector('#game').dataset.busy === 'false');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: '重新对练', exact: true }).click();

  // 1. Test 3-axis Device Forge modal & one-click OC preset
  await page.getByRole('button', { name: '自定义主角', exact: true }).click();
  check('custom dialog opens', await page.locator('#custom-dialog').evaluate(el => el.open));
  await page.locator('.preset-chip[data-preset="crimson_dragon"]').click();
  check('preset populates device name', await page.locator('#device-input').inputValue() === '煌炎大剑');
  check('preset selects blaze arcana', await page.locator('input[name="arcana"][value="blaze"]').isChecked());
  check('preset selects crimson_vow pact', await page.locator('input[name="pact"][value="crimson_vow"]').isChecked());
  await page.screenshot({ path: 'output/playwright/ocgame/custom-forge.png' });
  await page.getByRole('button', { name: '保存并开始对练', exact: true }).click();

  check('arcana theme applied to stage', await page.locator('#game').getAttribute('data-arcana') === 'blaze');
  check('device name shown in HUD', (await page.locator('#hud-device-name').textContent()).includes('煌炎大剑'));

  // 2. Test in-battle Card Evolution (临场变招 · 词条铭刻)
  await page.locator('#evolve-btn').click();
  check('evolve dialog opens', await page.locator('#evolve-dialog').evaluate(el => el.open));
  await page.locator('.evolve-mod-item[data-mod="twin_fang"]').click();
  await page.screenshot({ path: 'output/playwright/ocgame/evolve-modal.png' });
  await page.locator('#confirm-evolve').click();
  check('evolve dialog closes after confirm', !(await page.locator('#evolve-dialog').evaluate(el => el.open)));
  check('evolved card shows ★连斩 badge in hand', await page.locator('.playing-card .card-mod-badge').first().textContent() === '★连斩');

  // 3. Test Arcana stack resonance & Noble Art (伐刀绝技) liberation + Cut-in banner
  await page.locator('#support').click();
  await idle();
  // Play two cheap cards to reach 100% Noble Gauge
  for (let i = 0; i < 2; i++) {
    const enabled = page.locator('.playing-card:enabled').first();
    if (await enabled.count() > 0) {
      await enabled.click();
      await idle();
    }
  }
  check('noble art button ready at 100%', await page.locator('#noble-art').isEnabled());
  const hpBefore = Number((await page.locator('#enemy-health').textContent()).split('/')[0]);
  const nobleClick = page.locator('#noble-art').click();
  await page.waitForSelector('#cutin-banner:not([hidden])', { timeout: 2000 });
  await page.screenshot({ path: 'output/playwright/ocgame/noble-cutin.png' });
  await nobleClick;
  await idle();
  const hpAfter = Number((await page.locator('#enemy-health').textContent()).split('/')[0]);
  check('noble art deals heavy damage', hpAfter < hpBefore - 18);

  // Restore default profile for subsequent checks
  await page.getByRole('button', { name: '自定义主角', exact: true }).click();
  await page.locator('.preset-chip[data-preset="worst_blade"]').click();
  await page.locator('input[name="pact"][value="standard"]').check();
  await page.getByLabel('主角姓名').fill('朝雾 凛');
  await page.getByRole('button', { name: '保存并开始对练', exact: true }).click();

  check('no JS errors in build check', errors.length === 0);
  return { checks, errors };
}
