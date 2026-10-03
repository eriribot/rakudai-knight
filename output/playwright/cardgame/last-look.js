async (page) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:4177/references.html');
  await page.getByRole('button',{name:'臉部',exact:true}).click();
  await page.waitForFunction(()=>new DOMMatrixReadOnly(getComputedStyle(document.getElementById('ikki-preview')).transform).a >= 2.99);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'output/playwright/cardgame/face-reference-preview.png'});
  await page.goto('file:///E:/web/%E8%90%BD%E7%AC%AC/cardgame/index.html');
  await page.waitForFunction(()=>window.Cardgame && window.CombatActors);
  await page.locator('.card[data-id="guard"]').click();
  await page.waitForFunction(()=>!Cardgame.busy);
  if((await page.evaluate(()=>Cardgame.state.player.block))!==8)throw new Error('Offline file launch failed');
  await page.goto('http://127.0.0.1:4177/');
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:'cardgame/preview.png'});
  return {offlineFileLaunch:true,faceZoom:3,preview:'http://127.0.0.1:4177/'};
}
