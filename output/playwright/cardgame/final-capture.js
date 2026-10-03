async (page) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4177/');
  await page.waitForFunction(()=>!!window.Cardgame);
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  const mobile = await page.evaluate(()=>{
    const actor=document.getElementById('actor-player').getBoundingClientRect();
    const intent=document.getElementById('intent').getBoundingClientRect();
    const end=document.getElementById('end-turn').getBoundingClientRect();
    const footer=document.querySelector('.bottom-bar').getBoundingClientRect();
    return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,actorTop:actor.top,intentBottom:intent.bottom,buttonBottom:end.bottom,footerTop:footer.top};
  });
  if(mobile.scrollWidth>mobile.width || mobile.actorTop<mobile.intentBottom || mobile.buttonBottom>mobile.footerTop) throw new Error(JSON.stringify(mobile));
  await page.screenshot({path:'output/playwright/cardgame/mobile-preview.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:4177/references.html');
  await page.getByRole('button',{name:'臉部',exact:true}).click();
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'output/playwright/cardgame/face-reference-preview.png'});
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:4177/');
  await page.screenshot({path:'cardgame/preview.png'});
  console.log(JSON.stringify({mobileVisualCheck:mobile,ok:true}));
}
