async page => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:4178/');
  await page.locator('#motion-preview').click();
  await page.waitForFunction(() => document.querySelector('#stella-motion').dataset.motion === 'impact');
  await page.screenshot({path:'output/playwright/ocgame/visual-20261024-impact.png'});
  return await page.locator('#stella-motion').getAttribute('data-pose');
}
