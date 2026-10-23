async (page) => {
  const checks = [], errors = [], failures = [], cases = [];
  const assert = (ok, text) => { if (!ok) throw new Error(text); checks.push(text); };
  page.on('pageerror', e=>errors.push(e.message));
  page.on('response', r=>{if(r.status()>=400) failures.push(r.status()+' '+r.url());});
  const ready=()=>page.waitForFunction(()=>Cardgame.assetsReady&&!Cardgame.busy);
  async function recorder() {
    await page.evaluate(()=>{
      window.__motion={events:[],samples:[],running:true};
      const inspect=()=>{
        const stage=document.getElementById('combat-stage').getBoundingClientRect();
        return ['player','enemy'].map(side=>{
          const a=document.getElementById('actor-'+side),s=a.querySelector('.actor-sprite'),r=a.getBoundingClientRect(),sr=s.getBoundingClientRect(),cs=getComputedStyle(s),as=getComputedStyle(a),prefix=side==='player'?'--ikki-':'--stella-';
          const sourceWidth=parseFloat(as.getPropertyValue('--motion-source-width')),baseHeight=parseFloat(as.getPropertyValue('--motion-base-height'));
          const unit=parseFloat(cs.backgroundSize)/sourceWidth;
          return {side,pose:a.dataset.pose,phase:a.dataset.phase,x:r.x+r.width/2,height:r.height,image:cs.backgroundImage,unit,baseHeight,transform:cs.transform,rootTransform:as.transform,foot:sr.y+(parseFloat(as.getPropertyValue(prefix+'anchor-y'))-parseFloat(as.getPropertyValue(prefix+'src-y')))*unit,ground:stage.bottom-r.height*.004};
        });
      };
      window.__motionHandler=e=>__motion.events.push({...e.detail,rows:inspect()});
      window.addEventListener('combat:pose',__motionHandler);
      const tick=()=>{__motion.samples.push({rows:inspect(),effects:[...document.querySelectorAll('.combat-effect')].map(el=>({kind:el.className,opacity:Number(getComputedStyle(el).opacity)}))});if(__motion.running)requestAnimationFrame(tick);};tick();
    });
  }
  const stop=()=>page.evaluate(()=>{__motion.running=false;window.removeEventListener('combat:pose',__motionHandler);return __motion;});
  for(const size of [{width:1440,height:900},{width:390,height:844}]) {
    await page.setViewportSize(size); await page.emulateMedia({reducedMotion:'no-preference'});
    await page.goto('http://127.0.0.1:4177/');await ready();
    await page.screenshot({path:'output/playwright/cardgame/anime-motion-v2-idle-'+size.width+'-20261023.png'});
    for(const side of ['player','enemy']) {
      await recorder();
      if(side==='player') await page.locator('.card[data-id="slash"]').click();
      else await page.locator('#end-turn').click();
      await page.waitForFunction(s=>document.getElementById('actor-'+s).dataset.phase==='strike',side,{polling:'raf'});
      await page.screenshot({path:'output/playwright/cardgame/anime-motion-v2-'+side+'-'+size.width+'-20261023.png'});
      await ready();const log=await stop();
      const actions=log.events.filter(e=>e.side===side),rows=log.samples.flatMap(s=>s.rows.filter(r=>r.side===side));
      assert(['walk-a','walk-b','walk-c','windup','slash','guard'].every(p=>actions.some(e=>e.pose===p)),size.width+' '+side+': all six logical action phases play');
      assert(actions.filter(e=>e.phase==='approach').map(e=>e.pose).join(',')==='walk-a,walk-b,walk-c',size.width+' '+side+': three steps approach');
      assert(actions.filter(e=>e.phase==='retreat').map(e=>e.pose).join(',')==='walk-c,walk-b,walk-a',size.width+' '+side+': three steps retreat');
      const travel=Math.max(...rows.map(r=>r.x))-Math.min(...rows.map(r=>r.x));
      assert(travel>(size.width>400?250:40),size.width+' '+side+': visible near-contact travel');
      assert(Math.abs(rows[0].x-rows.at(-1).x)<1,size.width+' '+side+': returns to original ground position');
      assert(rows.every(r=>r.image.includes(side==='player'?'ikki-anime-motion-v2.png':'stella-anime-motion-v2.png')&&Math.abs(r.unit-r.height/r.baseHeight)<.001&&r.transform==='none'),size.width+' '+side+': same sheet and uniform pixel scale, no head transform');
      assert(rows.every(r=>Math.abs(r.foot-r.ground)<.2),size.width+' '+side+': source foot anchors remain grounded');
      const strike=actions.find(e=>e.phase==='strike'), own=strike.rows.find(r=>r.side===side),other=strike.rows.find(r=>r.side!==side);
      assert((side==='player'?own.x<other.x:own.x>other.x)&&Math.abs(own.x-other.x)>own.height*.5,size.width+' '+side+': bodies remain on their side at contact');
      assert(log.samples.some(s=>s.effects.some(e=>e.kind.includes('combat-slash')&&e.opacity>.7))&&log.samples.some(s=>s.effects.some(e=>e.kind.includes('combat-trail')&&e.opacity>.2)),size.width+' '+side+': visible slash and dash trail');
      assert(await page.locator('.combat-effect').count()===0,size.width+' '+side+': effects cleaned after return');
      const start=actions.find(e=>e.phase==='approach'),end=actions.find(e=>e.phase==='settle');
      assert(end.time-start.time<600,size.width+' '+side+': fast attack reaches settlement within 600ms');
      if(side==='player') assert(actions.filter(e=>e.pose==='windup').every(e=>e.frame===5),'Ikki anticipation excludes short-blade source frame');
      cases.push({size,side,travel,durationToSettle:end.time-start.time,sourceUnit:own.unit,contactGap:Math.abs(own.x-other.x),poseSequence:actions.map(e=>({pose:e.pose,phase:e.phase,frame:e.frame})),samples:rows.length});
    }
    const state=await page.evaluate(()=>Cardgame.state);
    assert(state.enemy.hp===108&&state.player.hp===78&&state.turn===2,size.width+': actual card and enemy attack settle once');
  }
  await page.setViewportSize({width:1440,height:900});await page.keyboard.press('r');await ready();
  await page.locator('.card[data-id="guard"]').click();await ready();await page.locator('#end-turn').click();await ready();
  assert(await page.evaluate(()=>Cardgame.state.player.hp===96),'Guard and enemy attack preserve mitigation');
  await page.keyboard.press('r');await ready();await page.locator('.card[data-id="slash"]').click();
  await page.waitForFunction(()=>document.getElementById('actor-player').dataset.phase==='approach',null,{polling:'raf'});
  await page.keyboard.press('r');await page.waitForTimeout(1100);await ready();
  assert(await page.evaluate(()=>Cardgame.state.player.hp===100&&Cardgame.state.enemy.hp===120&&document.querySelectorAll('.combat-effect').length===0&&getComputedStyle(document.getElementById('actor-player')).transform==='none'),'Restart during run cancels pending hits and clears transforms/effects');
  await page.emulateMedia({reducedMotion:'reduce'});await recorder();
  await page.locator('.card[data-id="slash"]').click();await ready();const reduced=await stop();
  assert(!reduced.events.some(e=>e.phase==='approach')&&await page.evaluate(()=>Cardgame.state.enemy.hp===108),'Reduced motion preserves damage without running');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.keyboard.press('r');await ready();
  await page.locator('.card[data-id="shura"]').click();await page.waitForFunction(()=>BattleMedia.state.introActive);
  await page.locator('#shura-skip').click();
  await page.waitForFunction(()=>document.getElementById('actor-player').dataset.phase==='strike',null,{polling:'raf'});
  assert(await page.locator('#cutin').evaluate(el=>getComputedStyle(el).animationDuration==='1.15s'&&Number(getComputedStyle(el).opacity)>.5),'Shura keeps user-approved 1.15s overlapping cut-in');
  await ready();
  assert(await page.evaluate(()=>Cardgame.state.player.hp===82&&Cardgame.state.player.mp===0&&Cardgame.state.enemy.hp===78&&Cardgame.state.exhaust.length===1),'Shura still pays costs and settles once');
  await page.goto('http://127.0.0.1:4177/motion.html');await page.locator('#attack-ikki').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.getElementById('attack-ikki').disabled);
  assert(await page.locator('.pose-tile').count()===12&&await page.locator('.pose-tile.is-current').count()===2,'Motion preview loads twelve pose controls and both guard idle frames');
  await page.locator('.pose-tile[data-side="player"][data-pose="walk-a"]').click();
  assert(await page.locator('#actor-player').getAttribute('data-pose')==='walk-a','Manual frame inspection remains functional');
  await page.locator('#slow-frames').click();await page.waitForTimeout(900);
  assert(await page.locator('#actor-player').getAttribute('data-pose')==='walk-b','Slow playback advances actual pose');
  await page.locator('#reset-pose').click();
  await page.locator('#attack-stella').click();await page.waitForFunction(()=>document.getElementById('mode-tag').textContent==='演練完成');
  assert(await page.locator('#actor-enemy').getAttribute('data-pose')==='idle','Motion preview enemy attack returns to idle');
  assert(!errors.length&&!failures.length,'No page errors or asset HTTP errors');
  await page.goto('http://127.0.0.1:4177/');await ready();
  const report={status:'passed',completedAt:new Date().toISOString(),checks,cases,errors,failures};
  await page.evaluate(value=>{window.__motionAcceptance=value;},report);
  return report;
}
