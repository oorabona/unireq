import puppeteer from 'puppeteer';

const TARGET_URL = 'http://192.168.1.193:3000';

(async () => {
  let browser;

  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));

    page.on('requestfailed', (request) => {
      console.log(`REQUEST FAILED: ${request.url()} - ${request.failure().errorText}`);
    });

    console.log(`Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });

    // 1. Check Docsify Config
    const docsifyConfig = await page.evaluate(() => window.docsify);
    console.log('--- DOCSIFY CONFIG ---');
    console.log(JSON.stringify(docsifyConfig, null, 2));

    // 2. Try to fetch _sidebar.md manually from browser
    const sidebarFetch = await page.evaluate(async () => {
      try {
        const res = await fetch('_sidebar.md');
        return {
          ok: res.ok,
          status: res.status,
          text: await res.text(),
        };
      } catch (e) {
        return { error: e.toString() };
      }
    });

    console.log('--- MANUAL FETCH _sidebar.md ---');
    console.log(JSON.stringify(sidebarFetch, null, 2));

    // 3. Dump Sidebar HTML
    const sidebarHtml = await page.evaluate(() => {
      const el = document.querySelector('.sidebar');
      return el ? el.innerHTML : 'NOT FOUND';
    });
    console.log('--- SIDEBAR HTML ---');
    console.log(sidebarHtml);

    // 4. Take a screenshot
    await page.screenshot({ path: 'debug-sidebar-remote.png' });
    console.log('Screenshot saved to debug-sidebar-remote.png');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    if (browser) await browser.close();
  }
})();
