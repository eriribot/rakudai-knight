async page => {
  const checks=[];
  await page.goto('http://127.0.0.1:4178/');
  await page.setViewportSize({width:1024,height:768});
  const layout=await page.evaluate(()=>{
    const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};
    return {player:box('.player-status'),companion:box('.companion'),hand:box('.hand-zone'),end:box('.turn-controls'),device:box('.device-hud'),notes:box('.turn-notes')};
  });
  if(layout.player.y<layout.companion.bottom||layout.hand.right>layout.end.x||layout.device.bottom>layout.notes.y)throw new Error(JSON.stringify(layout));
  await page.screenshot({path:'output/playwright/ocgame/feedback-final-1024.png',fullPage:true});
  await page.setViewportSize({width:799,height:764});
  await page.screenshot({path:'output/playwright/ocgame/feedback-final-799.png',fullPage:true});
  await page.setViewportSize({width:1440,height:900});
  return {nonoverlapAt1024:true,layout};
}
