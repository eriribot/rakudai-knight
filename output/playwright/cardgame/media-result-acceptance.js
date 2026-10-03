async (page) => {
  await page.goto('http://127.0.0.1:4177/');
  await page.waitForFunction(() => window.Cardgame?.assetsReady);
  const settled = () => page.waitForFunction(() => !Cardgame.busy);
  const play = async id => { await page.locator('.card[data-id="'+id+'"]').first().click(); await settled(); };
  const next = async () => { await page.locator('#end-turn').click(); await settled(); };
  for (const id of ['guard','insight','slash','riposte']) await play(id);
  await next();
  for (const id of ['insight','slash','slash','slash']) await play(id);
  await next();
  for (const id of ['riposte','insight','shura']) await play(id);
  await page.locator('#result').waitFor({state:'visible'});
  const result = await page.evaluate(() => ({
    status: Cardgame.state.status,
    hp: Cardgame.state.player.hp,
    bothPaused: document.getElementById('bgm-normal').paused && document.getElementById('bgm-shura').paused,
    playing: BattleMedia.state.playing,
    introActive: BattleMedia.state.introActive
  }));
  if (result.status !== 'won' || result.hp !== 42 || !result.bothPaused || result.introActive) throw Error(JSON.stringify(result));
  await page.getByRole('button', {name:'再戰一場 →'}).click();
  await settled();
  await page.waitForFunction(() => BattleMedia.state.mode === 'normal' && !document.getElementById('bgm-normal').paused && document.getElementById('bgm-shura').paused);
  // Leave the automated browser quiet; the user's preview has its own media state.
  await page.reload();
  await page.waitForFunction(() => window.Cardgame?.assetsReady);
  return {ok:true, victory:result, rematch:'normal BGM resumed'};
}
