async (page) => {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:4177/motion.html');
  await page.locator('#attack-ikki').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.getElementById('attack-ikki').disabled);
  await page.locator('.pose-tile[data-side="player"][data-pose="slash"]').click();
  await page.screenshot({path:'output/playwright/cardgame/two-pose-viewer-1440-20261023.png',fullPage:true});
  const viewer={tiles:await page.locator('.pose-tile').count(),counter:await page.locator('#frame-counter').innerText()};
  await page.goto('http://127.0.0.1:4177/references.html');
  await page.screenshot({path:'output/playwright/cardgame/two-pose-references-1440-20261023.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'output/playwright/cardgame/two-pose-references-390-20261023.png',fullPage:true});
  const refsOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:4177/');
  await page.waitForFunction(()=>Cardgame.assetsReady);
  return {viewer,refsOverflow,errors};
}
