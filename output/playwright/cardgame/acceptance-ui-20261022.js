async (page) => {
  const errors = [], failures = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.status()+' '+response.url()); });
  const assert = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  const settled = () => page.waitForFunction(() => Cardgame.assetsReady && !Cardgame.busy && !Cardgame.demonstrating);
  const read = () => page.evaluate(() => Cardgame.state);
  const play = async id => { await page.locator('.card[data-id="'+id+'"]').first().click(); await settled(); };
  const next = async () => { await page.locator('#end-turn').click(); await settled(); };
  const restart = async () => { await page.keyboard.press('r'); await settled(); };
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:4177/');
  await settled();
  await page.evaluate(async () => {
    await Promise.all(['assets/arena-duel.png', ...['slash','guard','insight','step','riposte','shura'].map(x=>'assets/cards/'+x+'.jpg')].map(src=>{const i=new Image();i.src=src;return i.decode();}));
    window.__poseChecks=[];
    window.addEventListener('combat:pose', event => {
      for (const side of ['player','enemy']) {
        const actor=document.getElementById('actor-'+side), sprite=actor.querySelector('.actor-sprite');
        const rect=sprite.getBoundingClientRect(), style=getComputedStyle(sprite);
        __poseChecks.push({side, phase:event.detail.phase, width:rect.width, height:rect.height, image:style.backgroundImage, transform:style.transform});
      }
    });
  });
  let state=await read();
  assert(state.player.hp===100 && state.enemy.hp===120 && state.player.mp===10 && state.enemy.mp===3000 && state.draw.length===10, 'Initial TRPG resources and 15-card deck');
  assert(await page.locator('#intent-amount').textContent()==='22', 'Visible intent uses adopted 22-damage rules');
  await page.screenshot({path:'output/playwright/cardgame/ui-update-desktop-20261022.png'});
  await page.locator('#battle-menu summary').click();
  await page.locator('#autoplay').click();
  await settled();
  state=await read();
  assert(state.turn===2 && state.player.hp===96 && state.enemy.hp===86 && state.insight===55 && state.enemy.mp===2940, 'Demo settles costs, glancing damage and analysis');
  assert(!await page.locator('#battle-menu').evaluate(el=>el.open), 'Demo closes tools menu');
  await restart();
  for(const id of ['insight','guard','riposte','slash']) await play(id);
  assert(await page.locator('.card[data-id="shura"]').isDisabled(), 'AP prevents unaffordable Shura');
  await next();
  for(const id of ['insight','slash','slash','riposte']) await play(id);
  await next();
  state=await read();
  assert(state.insight===100 && state.enemy.barrier===24 && state.enemy.mp===2820, 'Analysis ready against a persistent 24-point barrier');
  assert(await page.locator('#player-insight-meter').evaluate(el=>el.classList.contains('is-ready')), 'Ready analysis visible in HUD');
  await page.screenshot({path:'output/playwright/cardgame/ui-update-insight-20261022.png'});
  for(const id of ['guard','riposte','slash']) await play(id);
  state=await read();
  assert(state.enemy.hp===30 && state.enemy.barrier===12 && state.insight===10, 'Full analysis pierces barrier once then ordinary slash damages barrier');
  await next();
  await play('insight');
  await page.locator('.card[data-id="shura"]').click();
  await page.waitForFunction(()=>BattleMedia.state.introActive);
  assert(await page.evaluate(()=>BattleMedia.state.mode)==='shura', 'Shura starts dedicated music and intro');
  await page.screenshot({path:'output/playwright/cardgame/ui-update-shura-20261022.png'});
  await settled();
  state=await read();
  assert(state.status==='won' && state.player.hp===74 && state.player.mp===0 && state.enemy.hp===0 && state.exhaust.length===1, 'Four-round victory after full Shura intro');
  assert(await page.locator('#result').isVisible() && await page.locator('.command-zone').evaluate(el=>el.inert), 'Victory locks background controls');
  await page.screenshot({path:'output/playwright/cardgame/ui-update-victory-20261022.png'});
  const poseChecks=await page.evaluate(()=>__poseChecks);
  for(const side of ['player','enemy']) {
    const rows=poseChecks.filter(x=>x.side===side), first=rows[0];
    assert(rows.length>10 && rows.every(x=>Math.abs(x.width-first.width)<0.1 && Math.abs(x.height-first.height)<0.1 && x.image===first.image && x.transform==='none'), side+' full-body art and geometry stay invariant through actual actions');
  }
  await page.locator('#play-again').click(); await settled();
  await page.locator('.card[data-id="shura"]').click();
  await page.waitForFunction(()=>BattleMedia.state.introActive);
  await page.locator('#shura-skip').click(); await settled();
  state=await read();
  assert(state.player.hp===82 && state.player.mp===0 && state.enemy.hp===78 && state.exhaust.length===1, 'Skipping intro applies Shura exactly once');
  await restart();
  await page.locator('.card[data-id="shura"]').click();
  await page.waitForFunction(()=>BattleMedia.state.introActive);
  await restart();
  assert(await page.evaluate(()=>!BattleMedia.state.introActive && BattleMedia.state.mode==='normal'), 'Restart cancels Shura and restores normal music mode');
  state=await read();
  assert(state.player.hp===100 && state.player.mp===10 && state.enemy.hp===120 && !state.exhaust.length, 'Restart restores all battle resources');
  for(let i=0;i<9 && (await read()).status==='playing';i++) await next();
  state=await read();
  assert(state.status==='lost' && state.player.hp===0 && await page.locator('#result-title').textContent()==='敗北', 'Enemy actions can cause defeat');
  await restart();
  await page.locator('#battle-menu summary').click(); await page.locator('#card-library').click();
  await page.locator('[data-card-id="rasetsu"] img').evaluate(img=>img.decode());
  assert(await page.locator('.codex-card').count()===7 && await page.locator('[data-card-id="rasetsu"]').getAttribute('class')==='codex-card is-locked', 'Rasetsu reference exists only as locked catalogue entry');
  assert(await page.evaluate(()=>!BattleEngine.CARDS.rasetsu && ['hand','draw','discard','exhaust'].every(k=>Cardgame.state[k].every(c=>c.id!=='rasetsu'))), 'Rasetsu is absent from definitions and all piles');
  await page.locator('[data-card-id="rasetsu"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/playwright/cardgame/ui-update-rasetsu-locked-20261022.png'});
  await page.locator('#modal-close').click();
  const layout=[];
  for (const size of [{width:1280,height:720},{width:390,height:844}]) {
    await page.setViewportSize(size); await restart();
    const geometry=await page.evaluate(()=>{
      const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      // Check card-local layout: rotated screen-axis bounding boxes overlap even
      // when two parallel card rows are correctly separated in the card itself.
      return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,end:rect('end-turn'),energy:rect('energy'),cardText:[...document.querySelectorAll('.card')].map(c=>{const description=c.querySelector('.card-description'),footer=c.querySelector('.card-bottom');return {descriptionBottom:description.offsetTop+description.offsetHeight,footerTop:footer.offsetTop,cardBottom:c.clientHeight,footerBottom:footer.offsetTop+footer.offsetHeight};})};
    });
    assert(geometry.pageWidth<=size.width && geometry.end.right<=size.width && geometry.end.bottom<=size.height && geometry.energy.bottom<=size.height, size.width+'px main controls visible without page overflow');
    assert(geometry.cardText.every(c=>c.descriptionBottom<=c.footerTop+2 && c.footerBottom<=c.cardBottom+2), size.width+'px card rules do not overlap footer or clip');
    await page.screenshot({path:'output/playwright/cardgame/ui-update-'+size.width+'-20261022.png'});
    layout.push({size,geometry});
  }
  await play('insight');
  state=await read();
  assert(state.insight===20 && state.hand.length===5, 'Mobile card tap updates rules and draw');
  await page.emulateMedia({reducedMotion:'reduce'});
  await restart(); await play('guard'); await next();
  assert((await read()).player.hp===96, 'Reduced motion keeps settlement contract');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1440,height:900}); await restart();
  assert(errors.length===0 && failures.length===0, 'No page exceptions or failed assets');
  const report={status:'passed',completedAt:new Date().toISOString(),checks,errors,failures,poseSamples:poseChecks.length,layout};
  await page.evaluate(value=>{window.__acceptanceReport=value;},report);
  return report;
}
