async (page) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:4177/motion.html');
  await page.waitForFunction(()=>CombatActors.ready.then(r=>r.ok));
  const poses=['踏出','蓄勢','斬擊','收勢・格擋'];
  const indices=[1,4,5,6];
  for(let i=0;i<poses.length;i++){
    await page.getByRole('button',{name:'黑鐵一輝：第 '+indices[i]+' 格，'+poses[i],exact:true}).click();
    await page.locator('.motion-scene').screenshot({path:'output/playwright/cardgame/profile-pose-'+indices[i]+'.png'});
  }
  await page.evaluate(()=>{window.poseEvents=[];window.addEventListener('combat:pose',e=>poseEvents.push(e.detail));});
  await page.getByRole('button',{name:'▷ 一輝出擊',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('mode-tag').textContent==='演練完成');
  const events=await page.evaluate(()=>poseEvents);
  await page.goto('http://127.0.0.1:4177/');
  await page.waitForFunction(()=>Cardgame.assetsReady);
  await page.screenshot({path:'output/playwright/cardgame/profile-battle.png'});
  return {events,sprite:await page.locator('#actor-player .actor-sprite').evaluate(el=>getComputedStyle(el).backgroundImage),separateHeads:await page.locator('#actor-player .actor-head').count()};
}
