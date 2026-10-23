async (page) => {
  const checks = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = (label, ok) => { if (!ok) throw new Error(label); checks.push(label); };
  const idle = () => page.waitForFunction(() => document.querySelector('#game').dataset.busy === 'false');
  await page.reload();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: '重新对练', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/ocgame/tablet.png' });
  const sizes = [];
  for (const [w,h] of [[1024,768],[1440,900],[1920,1080],[768,900],[360,760],[390,844]]) {
    await page.setViewportSize({ width:w, height:h });
    const g = await page.evaluate(() => {
      const r = s => { const b=document.querySelector(s).getBoundingClientRect(); return { top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width,height:b.height }; };
      const sprite=r('.sprite-cell.ready'), badge=r('.enemy-status');
      // The atlas has 25 source pixels of transparent top margin before the first ribbon.
      return { width:innerWidth, pageWidth:document.documentElement.scrollWidth, spriteTop:sprite.top+25*sprite.height/1024,statusBottom:badge.bottom, energy:r('.energy'),hero:r('.player-status'),speech:r('.enemy-speech'),meta:r('.hand-meta') };
    });
    check(`${w}x${h} no page horizontal overflow`,g.width===g.pageWidth);
    check(`${w}x${h} sprite below status`,g.spriteTop>=g.statusBottom-3);
    check(`${w}x${h} energy separate from player HUD`,g.energy.left>g.hero.right);
    check(`${w}x${h} speech above hand metadata`,g.speech.bottom<=g.meta.top+2);
    sizes.push({w,h,...g});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.emulateMedia({reducedMotion:'reduce'});
  for(let round=0;round<16 && await page.locator('#game').getAttribute('data-phase')==='player';round++){
    const hp=Number((await page.locator('#player-health').textContent()).split('/')[0]);
    if(hp<=64 && await page.locator('#support').isEnabled()){await page.locator('#support').click();await idle();}
    for(let act=0;act<10 && await page.locator('#game').getAttribute('data-phase')==='player';act++){
      const choice=await page.locator('.playing-card:enabled').evaluateAll(cards=>cards.map(b=>({id:b.dataset.id,kind:b.dataset.kind,cost:Number(b.querySelector('.card-cost').textContent),damage:Number(b.querySelector('.card-rule b').textContent)})).sort((a,b)=>{
        const energy=Number(document.querySelector('#energy-count').textContent.split('/')[0]);
        const score=c=>c.kind==='step'?80:c.kind==='focus'&&energy===3?70:['slash','thrust','heavy'].includes(c.kind)?c.damage:2;
        return score(b)-score(a);
      })[0]);
      if(!choice)break;
      await page.locator(`.playing-card[data-id="${choice.id}"]`).click();await idle();
    }
    if(await page.locator('#game').getAttribute('data-phase')==='player'){await page.locator('#end-turn').click();await idle();}
  }
  check('victory dialog shown',await page.locator('#game').getAttribute('data-phase')==='won' && await page.locator('#result-dialog').evaluate(el=>el.open));
  check('victory title',await page.locator('#result-title').textContent()==='这一局，你赢了');
  await page.screenshot({path:'output/playwright/ocgame/victory.png'});
  await page.getByRole('button',{name:'再来一场',exact:true}).click();
  for(let round=0;round<12 && await page.locator('#game').getAttribute('data-phase')==='player';round++){await page.locator('#end-turn').click();await idle();}
  check('defeat dialog shown',await page.locator('#game').getAttribute('data-phase')==='lost' && await page.locator('#result-dialog').evaluate(el=>el.open));
  check('defeat HP stops at zero',await page.locator('#player-health').textContent()==='0 / 76');
  await page.getByRole('button',{name:'再来一场',exact:true}).click();
  check('restart from result resets battle',await page.locator('#player-health').textContent()==='76 / 76' && await page.locator('#game').getAttribute('data-turn')==='1');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.screenshot({path:'output/playwright/ocgame/desktop-final.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'output/playwright/ocgame/mobile-final.png'});
  check('no JS errors',errors.length===0);
  return {checks,sizes,errors};
}
