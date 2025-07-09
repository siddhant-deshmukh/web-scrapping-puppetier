import * as dotenv from "dotenv";
import puppeteer, { Browser, Page } from "puppeteer";
import { delay } from "./common";
import { checkIfCaptchaPresent } from "./extract_operations";
import logger from "../logging";

dotenv.config()

const PROXY_STRING = process.env.PROXIES
export const PROXIES = (typeof PROXY_STRING == 'string') ? PROXY_STRING.split(', ') : [];
const PROXY_USER_NAME = process.env.PROXY_USER_NAME;
const PROXY_PASSWORD = process.env.PROXY_PASSWORD;

if(PROXIES && PROXIES.length > 0 && ( !PROXY_USER_NAME || !PROXY_PASSWORD )) {
  logger.error('For PROXIES also add vairables PROXY_USER_NAME, PROXY_PASSWORD')
  process.exit()
}

export type PuppeteerErrorResponse = {
  err?: string;
  err_code?: number;
  restart_browser?: boolean;
  new_proxy?: boolean;
};
export function handlePuppetierErrors(error: any): PuppeteerErrorResponse {
  try {
    if (error && error.err && typeof error.err_code == 'number') {
      logger.error('Error code', error);
      if(error.err_code === 403 || error.err_code == 429) {
        return { err: "Issue with proxy", err_code: 404, new_proxy: true, restart_browser: false };
      }
      return { err: "Invalid Page URL", err_code: 404, new_proxy: false, restart_browser: false };
    } else if (error.name === 'TimeoutError') {
      logger.error('Page navigation or rendering timed out.');
      return { err: "Internal Server Error", err_code: 500, new_proxy: false, restart_browser: false };
    } else if (error.message.includes('ERR_NAME_NOT_RESOLVED') || error.message.includes('net::ERR_DNS_UNRESOLVED')) {
      logger.error('Page not found or invalid domain.');
      return { err: "Internal Server Error", err_code: 500, new_proxy: false, restart_browser: false };
    } else if (error.message.includes('captcha') || error.message.includes('bot policy')) {
      logger.error('Blocked by CAPTCHA or bot policy.');
      return { err: "Internal Server Error", err_code: 500, new_proxy: false, restart_browser: false };
    } else if (error.message.includes('WebSocket closed: 1006') || error.message.includes('ECONNREFUSED')) {
      logger.error(`Browser Crash/Connection Lost: ${error.message}`);
      return { err: "Internal Server Error", err_code: 500, new_proxy: false, restart_browser: true };
    } else if (error.message.includes('ERR_NO_SUPPORTED_PROXIES') || error.message.includes('ERR_PROXY_CONNECTION_FAILED')) {
      logger.error(`Issue with PROXY: ${error.message}`);
      return { err: "Issue with Proxy", err_code: 404, new_proxy: true, restart_browser: false };
    } else {
      logger.error(`An unexpected error occurred: ${error.message}`);
      return { err: "Internal Server Error", err_code: 500, new_proxy: false, restart_browser: false };
    }
  } catch (err) {
    logger.error(`An unexpected error occurred: ${error.message}`);
    return { err: "Internal Server Error", err_code: 500, new_proxy: false, restart_browser: false };
  }
}

export async function loadThePageForExtraction(page: Page, url: string, retry_attempt = 0): Promise<PuppeteerErrorResponse & {page?: Page}> {
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = response?.status();
    if (status == 404) {
      return handlePuppetierErrors({ err: "Invalid Page URL", err_code: 404 });
    } else if (status == 403 || status == 429) {
      return handlePuppetierErrors({ err: "Proxy / Authentication Issue", err_code: 403 });
    } else if (status && status >= 500) {
      if (retry_attempt < 2) {
        await delay(1000);
        return loadThePageForExtraction(page, url, retry_attempt + 1);
      }
      return handlePuppetierErrors({ err: "Internal Server Error", err_code: 500 });
    }

    await safeNetworkIdle(page);

    if(await checkIfCaptchaPresent(page)){
      return { err: 'Asking for Captcha some info might be hidden', err_code: 422, page };
    }
    return { page };
  } catch (err) {
    if (retry_attempt < 2) {
      return loadThePageForExtraction(page, url, retry_attempt + 1);
    }
    return handlePuppetierErrors(err);
  }
}

export async function safeNetworkIdle(page: Page, idle = 1000, total = 60000) {
  try {
    await page.waitForNetworkIdle({ idleTime: idle, timeout: total });
    return true;
  } catch (err) {
    logger.warn('networkIdle timeout, falling back → selector wait');
    try {
      await page.waitForSelector('body', { timeout: 10000 });
      return false;
    } catch {
      logger.warn('networkIdle timeout, falling back → selector wait');
      // throw err;
    }
  }
}

export async function launchBrowser(proxy_no?: number) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu',
  ]
  if (typeof proxy_no == 'number' && proxy_no < PROXIES.length) {
    args.push(`--proxy-server=${PROXIES[proxy_no]}`)
  } else if (typeof proxy_no == 'number') {
    throw 'Run out of PROXIES'
  }

  const browser = await puppeteer.launch({
    headless: true,
    args,
  });
  return browser;
}

export async function createNewPage(browser: Browser, proxy_no?: number, retry_attempt = 0): Promise<PuppeteerErrorResponse & {page?: Page}> {
  try {
    const page = await browser.newPage();

    if(proxy_no && PROXY_USER_NAME && PROXY_PASSWORD) {
      await page.authenticate({
        username: PROXY_USER_NAME,
        password: PROXY_PASSWORD
      });
    }
    
    // Set a default timeout for all page operations
    page.setDefaultNavigationTimeout(60000); // 60 seconds
    page.setDefaultTimeout(60000); // 60 seconds for other operations

    // Set user-agent to mimic a regular browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    return {page};
  } catch (err) {
    logger.error('New page creation failed', err)
    if (retry_attempt < 3) {
      createNewPage(browser, proxy_no, retry_attempt + 1);
    }
    return handlePuppetierErrors(err);
  }
}