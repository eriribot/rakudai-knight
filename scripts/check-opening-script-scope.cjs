// Browser regression for standalone scripts and host-converted module scripts.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../第一卷-世界书整理/开局页面/index.html'), 'utf8');
const output = path.join(__dirname, '../output/playwright/script-scope');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const results = [];
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const mode of ['classic', 'module']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      page.setDefaultTimeout(7000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().isNavigationRequest()
        ? route.fulfill({ contentType: 'text/html', body: mode === 'module'
          ? html.replace(/<script\b/g, '<script type="module"') : html })
        : route.abort());
      await page.goto('http://opening.test/', { waitUntil: 'load' });
      await page.locator('#lkOpSkip').click();
      await page.locator('#lkContinuePrompt').click();

      assert.deepEqual(errors, [], mode + ' initialization');
      const handlers = await page.evaluate(() => Array.from(document.querySelectorAll('[onclick],[oninput],[onchange]'))
        .flatMap(el => ['onclick', 'oninput', 'onchange'].flatMap(attr =>
          Array.from((el.getAttribute(attr) || '').matchAll(/RakudaiOpening\.(\w+)/g), m => m[1])))
        .filter(name => typeof window.RakudaiOpening[name] !== 'function'));
      assert.deepEqual(handlers, [], mode + ' event interfaces');
      assert.equal(await page.locator('#archive-slots button').count(), 6);
      assert.equal(await page.locator('#cardScene .illustration-card').count() > 0, true);
      await page.locator('.btn-narrative-skip').click();
      assert.equal(await page.locator('#input-name').inputValue(), '黑铁一辉');
      await page.locator('#nav-step-3').click();
      assert.match(await page.locator('#opening-message').inputValue(), /黑铁一辉/);
      await page.locator('#nav-step-2').click();
      await page.getByRole('button', { name: '玩家 U', exact: true }).click();
      for (const field of ['name','personality','conduct','school','device','noble-art','desc','ability','limits','style']) {
        await page.locator('#input-' + field).fill(field === 'name' ? '作用域测试' : '测试资料');
      }
      for (const axis of ['attack','defense','magic','control','physical','luck']) await page.locator('#stat-' + axis).selectOption('C');
      await page.getByRole('combobox', { name: '魔力量', exact: true }).selectOption('B+');
      await page.locator('#nav-step-3').click();
      assert.match(await page.locator('#opening-message').inputValue(), /作用域测试/);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('#scene-confirm').isVisible(), true);
      await page.screenshot({ path: path.join(output, mode + '.png'), animations: 'disabled' });
      assert.deepEqual(errors, [], mode + ' interactions');
      results.push({ mode, status: 'PASS', errors, checks: ['initialization', 'inline interfaces', 'archive slots', 'illustrations', 'canon shortcut', 'three steps', 'custom input', 'mobile width'] });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ results, sillyTavernVerified: false }, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
