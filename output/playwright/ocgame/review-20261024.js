async (page) => {
  const errors = [], actions = [];
  page.on('pageerror', error => errors.push(error.message));
  const idle = () => page.waitForFunction(() => document.querySelector('#game').dataset.busy === 'false');
  const status = async name => actions.push({name, ...(await page.evaluate(() => ({round:document.querySelector('#game').dataset.turn,phase:document.querySelector('#game').dataset.phase,enemy:document.querySelector('#enemy-health').textContent,player:document.querySelector('#player-health').textContent,energy:document.querySelector('#energy-count').textContent,sync:document.querySelector('#noble-sync').textContent,stack:document.querySelector('#stack-count').textContent})))});
  const evolve = async (kind, mod) => {
    if(!await page.locator('#evolve-dialog').evaluate(el=>el.open)) await page.locator('#evolve-btn').click();
    await page.locator('.evolve-card-item').filter({hasText:kind}).click();
    await page.locator(`.evolve-mod-item[data-mod="${mod}"]`).click();
    await page.locator('#confirm-evolve').click();
    await status(`${kind}: ${mod}`);
  };
  const card = async kind => { if(await page.locator('#game').getAttribute('data-phase')!=='player')return; await page.locator(`.playing-card[data-kind="${kind}"]`).first().click(); await idle(); await status(kind); };
  const art = async () => { if(await page.locator('#noble-art').isEnabled()){await page.locator('#noble-art').click();await idle();await status('noble');} };
  await evolve('重斩','zero_step');
  await page.locator('#support').click();await idle();await status('support');
  await evolve('蓄力','zero_step');
  await card('step'); await art(); await card('focus'); await card('heavy'); await card('slash'); await card('slash'); await art();
  await page.screenshot({path:'output/playwright/ocgame/review-20261024-turn1-win.png'});
  const won=await page.locator('#result-dialog').evaluate(el=>el.open);
  await page.getByRole('button',{name:'再来一场',exact:true}).click();
  await page.getByRole('button',{name:'自定义主角',exact:true}).click();
  await page.screenshot({path:'output/playwright/ocgame/review-20261024-forge.png'});
  await page.keyboard.press('Escape');
  await evolve('蓄力','wing_cycle');
  const focusBefore=await page.locator('.playing-card[data-kind=focus]').innerText();
  const handBefore=await page.locator('.playing-card').count();
  await card('focus');
  const modifiedCard={text:focusBefore,handBefore,handAfter:await page.locator('.playing-card').count(),block:await page.locator('#player-block').textContent()};
  await page.locator('#reset').click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'output/playwright/ocgame/review-20261024-mobile.png'});
  const mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,ruleSize:getComputedStyle(document.querySelector('.card-rule')).fontSize,stackHintVisible:getComputedStyle(document.querySelector('.stack-hint')).display,deviceHeight:document.querySelector('.device-hud').getBoundingClientRect().height}));
  return {actions,won,modifiedCard,mobile,errors};
}
