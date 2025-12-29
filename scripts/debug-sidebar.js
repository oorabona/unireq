import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  // Capture console logs from the browser
  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));

  // Capture network failures
  page.on('requestfailed', (request) => {
    console.log(`REQUEST FAILED: ${request.url()} - ${request.failure().errorText}`);
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      console.log(`HTTP ERROR: ${response.url()} - ${response.status()}`);
    }
  });

  try {
    console.log('Navigating to http://localhost:8090...');
    await page.goto('http://localhost:8090', { waitUntil: 'networkidle0' });

    // Wait a bit for Docsify to render
    await new Promise((r) => setTimeout(r, 2000));

    // Check if sidebar exists
    const sidebarExists = await page.$('.sidebar');
    if (sidebarExists) {
      const sidebarHtml = await page.$eval('.sidebar', (el) => el.innerHTML);
      console.log('--- SIDEBAR HTML START ---');
      console.log(sidebarHtml);
      console.log('--- SIDEBAR HTML END ---');

      const sidebarNavHtml = await page.$eval('.sidebar-nav', (el) => el.innerHTML).catch(() => 'NOT FOUND');
      console.log('--- SIDEBAR NAV HTML START ---');
      console.log(sidebarNavHtml);
      console.log('--- SIDEBAR NAV HTML END ---');
    } else {
      console.log('ERROR: .sidebar element not found in DOM');
    }

    // Dump body html for context if sidebar is missing
    if (!sidebarExists) {
      const bodyHtml = await page.content();
      console.log('--- FULL PAGE HTML ---');
      console.log(bodyHtml);
    }
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();
