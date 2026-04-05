const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://ju-sobamin-pos.vercel.app/');
    await page.waitForTimeout(2000);
    
    // Check if the "credit" button sets orderType
    const creditBtn = await page.$('.type-btn[data-type="credit"]');
    if (!creditBtn) {
        console.log("No credit button found!");
        process.exit(1);
    }
    
    await creditBtn.click();
    console.log("Clicked Credit button.");
    await page.waitForTimeout(500);

    // Evaluate what App is initialized with
    const orderType = await page.evaluate(() => window.App.state.orderType);
    console.log("Current orderType in window.App: " + orderType);
    
    // Add item to cart
    const pCard = await page.$('.product-card');
    await pCard.click();
    console.log("Clicked product card.");
    await page.waitForTimeout(500);
    
    // Check out
    const checkoutBtn = await page.$('#checkout-btn');
    await checkoutBtn.click();
    console.log("Clicked checkout.");
    await page.waitForTimeout(500);

    const isModalActive = await page.evaluate(() => document.getElementById('credit-checkout-modal').classList.contains('active'));
    console.log("Is Modal Active: " + isModalActive);
    
    const cartCount = await page.evaluate(() => window.App.state.cart.length);
    console.log("Cart count after clicking checkout: " + cartCount);
    
    await browser.close();
})();
