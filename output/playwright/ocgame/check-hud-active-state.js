async page => {
  await page.goto('http://127.0.0.1:4178/');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#customize').click();
  await page.locator('#name-input').fill('自定义主角');
  await page.locator('#avatar-input').setInputFiles('ocgame/assets/references/ayase-official.jpg');
  await page.locator('#avatar-message').filter({ hasText: '头像已预览' }).waitFor();
  await page.locator('#profile-submit').click();
  for (let i = 0; i < 3; i++) {
    await page.locator('#end-turn').click();
    await page.locator('#game[data-busy=false]').waitFor();
  }
  await page.waitForTimeout(300);
  const layout = await page.evaluate(() => {
    const box = s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; };
    return { player: box('.player-status'), device: box('.device-hud'), hand: box('.hand-zone'), badge: box('#player-statuses [data-status=burn]'), avatar: box('#player-avatar') };
  });
  if (layout.player.y < layout.device.bottom || layout.player.bottom > layout.hand.y || layout.badge.right > layout.player.right || layout.avatar.y < layout.player.y) throw new Error(JSON.stringify(layout));
  await page.screenshot({ path: 'output/playwright/ocgame/hud-restored-mobile-avatar-burn.png', fullPage: true });
  await page.evaluate(() => localStorage.removeItem('ocgame.profile.v1'));
  await page.reload();
  await page.setViewportSize({ width: 799, height: 764 });
  return { activeMobileLayoutPassed: true, layout };
}
