async page => {
  const f = page.frameLocator('#TH-message--0--0');
  // CLI 在原生确认框出现时交还控制；首次准备导入，第二次继续验收。
  if (!page._finalAsteriskPrepared) {
  await page.setViewportSize({ width: 1280, height: 900 });
  const old = await page.evaluate(() => SillyTavern.getContext().chatId);
  await page.locator('#options_button').click();
  await page.locator('#option_start_new_chat').press('Enter');
  await page.getByRole('button', { name: '確定', exact: true }).click();
  await page.waitForFunction(old => SillyTavern.getContext().chatId !== old && SillyTavern.getContext().chat[0]?.variables?.[0]?.stat_data?.系统?.开局状态 === '待建档', old);
  await f.getByRole('button', { name: 'CLICK TO SKIP', exact: true }).click();
  await f.getByRole('button', { name: 'PRESS ANY KEY TO CONTINUE', exact: true }).click();
  page.once('dialog', async d => {
    if (d.type() !== 'confirm' || !d.message().startsWith('用导入档案替换当前表单')) throw new Error('Unexpected import dialog');
    await d.accept();
  });
  page._finalAsteriskPrepared = true;
  await f.locator('#archive-file-input').setInputFiles('E:/web/落第/output/playwright/init-repair-20261107/asterisk-test-profile.json');
  return { prepared: true, next: '确认导入后再运行本脚本' };
  }
  await page.waitForFunction(() => document.getElementById('TH-message--0--0')?.contentDocument?.getElementById('card-name')?.textContent === '初始化验收学生');
  await f.getByRole('button', { name: '② 学生登记', exact: true }).click();
  await f.locator('#opening-greeting-panel > summary').click();
  await f.getByRole('checkbox', { name: '开场白的时间、地点与上方场景一致', exact: true }).check();
  await f.getByRole('button', { name: '下一步：确认学生档案 →', exact: true }).click();
  // 故障仅注入隔离聊天，保留原槽位用于恢复，不合成 stat_data。
  const backup = await page.evaluate(() => {
    const m = SillyTavern.getContext().chat[0], slot = m.swipe_id ?? 0;
    const before = structuredClone(m.variables[slot]); m.variables[slot] = {}; return before;
  });
  await f.locator('#opening-commit-button').evaluate(button => {
    button.addEventListener('click', () => {
      const start = performance.now();
      const observer = new MutationObserver(() => {
        if (!button.disabled) { window.__repairElapsed = performance.now() - start; observer.disconnect(); }
      });
      observer.observe(button, { attributes: true, attributeFilter: ['disabled'] });
    }, { once: true });
  });
  await f.locator('#opening-commit-button').click();
  await page.waitForFunction(() => !document.getElementById('TH-message--0--0').contentDocument.getElementById('opening-commit-button').disabled, {}, { timeout: 20000 });
  const missing = await page.evaluate(() => {
    const w = document.getElementById('TH-message--0--0').contentWindow;
    return { elapsedMs: w.__repairElapsed, feedback: w.document.getElementById('archive-feedback').textContent,
      disabled: w.document.getElementById('opening-commit-button').disabled, variables: SillyTavern.getContext().chat[0].variables[0], mvu: typeof Mvu };
  });
  if (!missing.feedback.includes('MVU 已启动') || missing.disabled || Object.keys(missing.variables).length) throw new Error('Missing-data timeout failed');
  page._finalEvidence.missingData = missing;
  await f.locator('#archive-feedback').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/init-repair-20261107/final-data-timeout.png' });
  const delayed = await page.evaluate(async before => {
    const w = document.getElementById('TH-message--0--0').contentWindow, m = SillyTavern.getContext().chat[0], slot = m.swipe_id ?? 0;
    const start = performance.now(), submission = w.RakudaiOpening.enterGame();
    const busy = { disabled: w.document.getElementById('opening-commit-button').disabled, copy: [...w.document.querySelectorAll('[data-opening-copy]')].map(x => x.disabled) };
    await w.RakudaiOpening.copyCardSummary(); await w.RakudaiOpening.copyCardSummary();
    setTimeout(() => { m.variables[slot] = before; }, 2000);
    await submission;
    return { elapsedMs: performance.now() - start, busy, system: m.variables[slot].stat_data?.系统,
      name: m.variables[slot].stat_data?.玩家?.姓名, feedback: w.document.getElementById('archive-feedback').textContent,
      preview: w.document.getElementById('opening-preview-title').textContent,
      disabled: w.document.getElementById('opening-commit-button').disabled,
      copy: [...w.document.querySelectorAll('[data-opening-copy]')].map(x => x.disabled) };
  }, backup);
  if (delayed.system?.作品 !== 'asterisk' || delayed.system?.开局状态 !== '已建档' || !delayed.feedback.includes('建档成功并已回读')) throw new Error('Delayed retry/copy test failed');
  page._finalEvidence.asteriskDelayedAndCopy = delayed;
  await page.setViewportSize({ width: 430, height: 932 });
  await f.locator('#archive-feedback').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/init-repair-20261107/final-asterisk-success.png' });
  return { missingData: missing, delayed };
}
