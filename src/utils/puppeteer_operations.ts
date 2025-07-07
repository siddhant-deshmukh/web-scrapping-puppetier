import puppeteer, { Browser, Page } from "puppeteer";

export async function handlePuppetierErrors(err: any) {

}

export async function loadThePageForExtraction(page: Page, url: string, retry_attempt = 0){
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = response?.status();
    if(status == 404) {

    } else if (status == 403 || status == 429) {

    } else if (status && status >= 500 ){

    }
    
    await safeNetworkIdle(page);
    return page;
  } catch (err) { 
    if(retry_attempt < 2) {
      return loadThePageForExtraction(page, url, retry_attempt + 1);
    }
    throw err;
  }
}

export async function safeNetworkIdle(page: Page, idle = 1000, total = 60000) {
  try {
    await page.waitForNetworkIdle({ idleTime: idle, timeout: total });
    return true;
  } catch (err) {
    console.warn('networkIdle timeout, falling back → selector wait');
    try {
      await page.waitForSelector('body', { timeout: 10000 });
      return false;
    } catch {
      console.warn('networkIdle timeout, falling back → selector wait');
      return false;
    }
  }
}

export async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  });
  return browser;
}

export async function createNewPage(browser: Browser, retry_attempt = 0) {
  try {
    const page = await browser.newPage();
    // Set a default timeout for all page operations
    page.setDefaultNavigationTimeout(60000); // 60 seconds
    page.setDefaultTimeout(60000); // 60 seconds for other operations

    // Set user-agent to mimic a regular browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    return page;
  } catch (err) {
    console.error('New page creation failed', err)
    if(retry_attempt < 3){
      createNewPage(browser, retry_attempt + 1);
    }
    throw err;
  }
}

export async function checkIfCaptchaPresent(page: Page) {
  const captchaSelectors = [
      'iframe[src*="captcha"]',
      'div[id*="g-recaptcha"]',
      'div[class*="h-captcha"]',
      '.cf-browser-verification', // Cloudflare's browser check
      '#bot-detection-page',
  ];

  for (const selector of captchaSelectors) {
      const element = await page.$(selector);
      if (element) {
          console.warn(`CAPTCHA/Anti-bot element found: ${selector}`);
          return true;
      }
  }

  // Check for common text content
  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText.includes('verify you\'re human') || pageText.includes('Please complete the security check')) {
      console.warn('CAPTCHA/Anti-bot text found on page.');
      return true;
  }

  return false;
}