const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox']
        });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
        page.on('pageerror', error => console.log('BROWSER_ERROR:', error));
        page.on('requestfailed', request => console.log('REQUEST_FAIL:', request.url(), request.failure().errorText));

        await page.goto('http://127.0.0.1:5500', { waitUntil: 'networkidle0', timeout: 10000 });
        
        await browser.close();
    } catch(e) {
        console.error(e);
    }
})();
