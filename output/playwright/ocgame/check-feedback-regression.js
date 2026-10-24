async (page) => {
  const errors = [], failed = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  const check = (name, ok, detail) => { checks.push({name,ok,detail}); if(!ok) throw new Error(name+': '+JSON.stringify(detail)); };
  const idle = () => page.waitForFunction(() => document.querySelector('#game').dataset.busy === 'false');
  const clean = () => page.evaluate(() => ({hp:document.querySelector('#player-health').textContent,shield:document.querySelector('#player-block').textContent,support:document.querySelector('#support-count').textContent,sync:document.querySelector('#noble-sync').textContent,pose:document.querySelector('#stella-motion').dataset.pose,ghosts:document.querySelectorAll('.afterimage').length,cutin:document.querySelector('#support-cutin').hidden}));
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:4178/');
  await page.evaluate(()=>localStorage.removeItem('ocgame.profile.v1'));
  await page.reload();
  await page.locator('#reset').click();
  await page.waitForFunction(() => [...document.images].filter(i=>i.getAttribute('src')).every(i => i.complete && i.naturalWidth));
  check('VS opponent title', (await page.title()).startsWith('VS 史黛菈'));
  const cardArt = await page.locator('.playing-card .card-art svg').count();
  check('five opening cards restore emblem presentation', cardArt === 5, cardArt);
  check('one dialogue track', await page.locator('#battle-dialogue').count()===1 && await page.locator('#enemy-speech,#ln-callout').count()===0);
  await page.screenshot({path:'output/playwright/ocgame/feedback-final-desktop.png'});

  await page.locator('#customize').click();
  await page.locator('#name-input').fill('星野 凛');
  check('registration preview follows input', await page.locator('#passport-name').innerText() === '星野 凛');
  await page.locator('.preset-chip[data-preset=crimson_dragon]').click();
  check('preset updates preview', await page.locator('#passport-rank').innerText() === 'A');
  await page.screenshot({path:'output/playwright/ocgame/feedback-final-registration.png'});
  await page.keyboard.press('Escape');

  // Capture the real support reveal, then verify the original battle rules still apply once.
  await page.locator('#support').click();
  await page.waitForFunction(() => document.querySelector('#support-cutin').dataset.stage === 'portrait', {polling:'raf'});
  await page.waitForTimeout(190);
  await page.screenshot({path:'output/playwright/ocgame/feedback-final-support.png'});
  await idle();
  let state = await clean();
  check('support resolves once and hides cinematic', state.shield === '护盾 8' && state.support === '0 / 1' && state.sync === '50%' && state.cutin, state);
  check('repeat support disabled', await page.locator('#support').isDisabled());
  await page.locator('#reset').click();
  await page.locator('#support').click();
  await page.locator('#reset').click();
  await page.waitForTimeout(1500);
  state=await clean();
  check('reset during cut-in cancels support settlement', state.hp==='76 / 76' && state.shield==='护盾 0' && state.support==='1 / 1' && state.sync==='0%' && state.cutin, state);

  // Watch actual DOM motion stages. Preview must leave HP and round unchanged.
  await page.evaluate(() => {
    window.__visualStages=[];
    const actor=document.querySelector('#stella-motion');
    window.__motionObserver=new MutationObserver(() => window.__visualStages.push({t:performance.now(),pose:actor.dataset.pose,motion:actor.dataset.motion,fire:document.querySelectorAll('.fire-slash').length}));
    window.__motionObserver.observe(actor,{attributes:true,attributeFilter:['data-pose','data-motion']});
  });
  await page.locator('#motion-preview').click();
  await idle();
  const stages=await page.evaluate(()=>{window.__motionObserver.disconnect();return window.__visualStages;});
  state=await clean();
  check('front sprite changes at impact with flame', stages.some(s=>s.pose==='cut'&&s.motion==='impact'&&s.fire===1), stages);
  check('preview returns without damage', state.hp==='76 / 76' && state.pose==='ready' && state.ghosts===0, state);
  await page.locator('#end-turn').click();
  await idle();
  check('enemy attack resolves exactly once', await page.locator('#player-health').innerText()==='62 / 76');
  await page.locator('#reset').click();
  await page.locator('#end-turn').click();
  await page.locator('#reset').click();
  await page.waitForTimeout(900);
  check('enemy cancellation cannot damage new game', (await clean()).hp==='76 / 76');

  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#support').click(); await idle();
  state=await clean();
  check('reduced motion retains one support settlement', state.shield==='护盾 8'&&state.sync==='50%'&&state.cutin, state);
  await page.locator('#end-turn').click();await idle();
  check('reduced motion retains enemy damage after shield', (await clean()).hp==='70 / 76');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#reset').click();
  for(const size of [{width:799,height:764},{width:1024,height:768},{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(size);
    await page.screenshot({path:`output/playwright/ocgame/feedback-final-${size.width}.png`,fullPage:true});
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,cardFont:getComputedStyle(document.querySelector('.card-rule')).fontSize,stackVisible:document.querySelector('#arcana-stack-bar').getBoundingClientRect().height>0,ready:document.querySelector('#stella-motion .ready').getBoundingClientRect().width,cut:document.querySelector('#stella-motion .cut').getBoundingClientRect().width}));
    check(`layout ${size.width}: no page overflow, readable cards, equal sprite scale`, layout.scroll===layout.width&&parseFloat(layout.cardFont)>=11&&layout.stackVisible&&Math.abs(layout.ready-layout.cut)<.1,layout);
    if(size.width===390) {
      await page.locator('#customize').click();
      await page.screenshot({path:'output/playwright/ocgame/feedback-final-registration-mobile.png'});
      await page.keyboard.press('Escape');
      await page.locator('#support').click();
      await page.waitForFunction(()=>document.querySelector('#support-cutin').dataset.stage==='portrait');
      await page.waitForTimeout(190);
      await page.screenshot({path:'output/playwright/ocgame/feedback-final-support-mobile.png'});
      await idle();await page.locator('#reset').click();
    }
  }
  await page.setViewportSize({width:1440,height:900});
  check('no page errors or missing assets', errors.length===0&&failed.length===0,{errors,failed});
  return {checks,errors,failed};
}
