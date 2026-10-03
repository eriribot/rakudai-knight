async (page) => {
  await page.goto('http://127.0.0.1:4177/');
  await page.waitForFunction(()=>window.Cardgame);
  await page.getByRole('button',{name:'▷ 演示連招'}).click();
  await page.waitForFunction(()=>!Cardgame.demonstrating&&!Cardgame.busy);
  await page.getByRole('button',{name:'↻ 重新開局 R'}).click();
  await page.locator('.card[data-id="shura"]').click();
  await page.waitForFunction(()=>!Cardgame.busy);
}
