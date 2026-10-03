async (page) => {
  const errors = [];
  const failures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.status() + ' ' + response.url()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4177/');
  await page.waitForFunction(() => window.Cardgame && window.CombatActors);
  const read = () => page.evaluate(() => Cardgame.state);
  const settled = () => page.waitForFunction(() => !Cardgame.busy && !Cardgame.demonstrating);
  const play = async id => {
    await page.locator('.card[data-id="'+id+'"]').first().click();
    await settled();
  };
  const next = async () => { await page.locator('#end-turn').click(); await settled(); };
  const restart = async () => { await page.keyboard.press('r'); await settled(); };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };

  await page.evaluate(async () => {
    await CombatActors.ready;
    for (const src of ['assets/ikki-unified-profile.png','assets/stella-idle.png','assets/arena-duel.png','assets/ikki-unified-motion.png','assets/stella-motion.png',...['slash','guard','insight','step','riposte','shura'].map(id=>'assets/cards/'+id+'.jpg')]) {
      const image = new Image(); image.src=src; await image.decode();
    }
  });
  await page.screenshot({ path: 'output/playwright/cardgame/desktop-preview.png' });
  await page.getByRole('button', {name:'▷ 演示連招'}).click();
  await settled();
  const opener=await read();
  assert(opener.turn===2 && opener.player.hp===48 && opener.enemy.hp===49, 'Opening combo failed');

  await restart();
  // These are real rendered button clicks, not mutations to engine state.
  for(const id of ['guard','insight','slash','riposte']) await play(id);
  assert(await page.locator('.card[data-id="shura"]').isDisabled(), 'Unaffordable card stayed enabled');
  await next();
  for(const id of ['insight','slash','slash','slash']) await play(id);
  await next();
  for(const id of ['riposte','insight','shura']) await play(id);
  const victory=await read();
  assert(victory.status==='won' && victory.player.hp===42 && victory.enemy.hp===0, 'Victory witness failed');
  assert(victory.exhaust.some(card=>card.id==='shura'), 'Shura not exhausted');
  assert(await page.locator('#result').isVisible(), 'Result missing');
  assert(await page.locator('.command-zone').evaluate(el=>el.inert), 'Background controls not inert at result');
  await page.screenshot({path:'output/playwright/cardgame/victory.png'});
  await page.getByRole('button',{name:'再戰一場 →'}).click();
  await settled();
  assert((await read()).player.hp===48, 'Restart did not reset HP');
  for(let n=0;n<6;n++) await next();
  const defeat=await read();
  assert(defeat.status==='lost' && defeat.player.hp===0, 'Defeat witness failed');
  await restart();

  await page.getByRole('button',{name:'玩法說明'}).click();
  assert(await page.locator('#modal').isVisible(), 'Help failed');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'▱ 抽牌堆 5'}).click();
  assert(await page.locator('.pile-row').count()===5, 'Draw pile mismatch');
  await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});
  await play('guard');
  assert((await read()).player.block===8, 'Reduced motion stalled game');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await restart();

  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'Mobile page overflows');
  await page.screenshot({path:'output/playwright/cardgame/mobile-preview.png',fullPage:true});
  await play('insight');
  assert((await read()).hand.length===5, 'Mobile draw failed');
  await page.locator('#end-turn').click();
  await settled();
  assert((await read()).turn===2, 'Mobile end turn failed');
  await restart();

  await page.goto('http://127.0.0.1:4177/references.html');
  await page.waitForFunction(()=>document.getElementById('ikki-preview').dataset.assetState==='ready');
  assert(await page.locator('#ikki-preview').evaluate(el=>el.naturalWidth===1024 && el.currentSrc.includes('ikki-unified-profile.png')), 'Unified figure not used in comparison');
  assert(await page.locator('.reference-card').count()===9, 'Reference count mismatch');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'Mobile references overflow');
  await page.getByRole('button',{name:'臉部',exact:true}).click();
  assert(await page.locator('#view-face').getAttribute('aria-pressed')==='true', 'Face zoom failed');
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'output/playwright/cardgame/face-reference-preview.png'});
  await page.goto('http://127.0.0.1:4177/');
  await page.setViewportSize({width:1440,height:900});
  assert(errors.length===0, 'Browser exceptions: '+errors.join('\n'));
  assert(failures.filter(item=>!item.endsWith('/favicon.ico')).length===0, 'Asset failures: '+failures.join('\n'));
  return {ok:true,opener:{player:opener.player.hp,enemy:opener.enemy.hp,turn:opener.turn},victory:{player:victory.player.hp,enemy:victory.enemy.hp,turn:victory.turn},defeat:{player:defeat.player.hp,status:defeat.status},references:9,mobile:'390x844 passed',browserErrors:errors,assetFailures:failures};
}
