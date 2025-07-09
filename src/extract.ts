import * as dotenv from "dotenv";
import { Browser, Page } from 'puppeteer';

import logger from "./logging";
import { UrlsInfoRes } from "./types";
import { delay } from './utils/common';
import { extractAllCompanyInfo, extractContactLinks } from './utils/extract_operations';
import { createNewPage, handlePuppetierErrors, launchBrowser, loadThePageForExtraction } from './utils/puppeteer_operations';

dotenv.config()

const DELAY_IN_MS = 1000
const BROWSER_CRASH_PROXY_RECOVERY_ATTEMPTS = 2

const PROXY_STRING = process.env.PROXIES
export const PROXIES = (typeof PROXY_STRING == 'string') ? PROXY_STRING.split(', ') : [];

//****                                                                                  ************************* */
//****                                                                                  ************************* */
//****                  Main Scrapping Function Starting Point                           */
//****                                                                                  ************************* */
//****                                                                                  ************************* */
export async function processUrls(given_urls: string[], prevUrlsInfo?: UrlsInfoRes, given_browser?: Browser | null, retry_attempt = 0, proxy_no: number | undefined = undefined): Promise<UrlsInfoRes | undefined> {
  let browser: Browser | null = null;
  let allUrlsInfo: UrlsInfoRes = {}

  //* Breaking condition if the function keeps failing
  if (retry_attempt > BROWSER_CRASH_PROXY_RECOVERY_ATTEMPTS) {
    Object(prevUrlsInfo).keys().forEach((key: string) => {
      if (prevUrlsInfo && !prevUrlsInfo[key].info) {
        prevUrlsInfo[key].err = 'Internal Server Error';
        prevUrlsInfo[key].err_code = 500;
      }
    })
    return prevUrlsInfo;
  }

  //* In retry attempt don't take URLs who has already been extracted 
  const urls = given_urls.filter(url => {
    if (prevUrlsInfo && prevUrlsInfo[url] && (prevUrlsInfo[url].info || prevUrlsInfo[url].attempt > BROWSER_CRASH_PROXY_RECOVERY_ATTEMPTS)) {
      return false;
    }
    allUrlsInfo[url] = {
      other_webiste_urls: [],
      attempt: 0
    }
    return true;
  })

  try {

    if (!given_browser) {
      browser = await launchBrowser(proxy_no);
    } else {
      browser = given_browser;
    }
    logger.info('Browser Launched');

    let relaunch_browser, proxy_change;

    //* Iterate for each URLs (that wasn't extracted before)
    for (const url of urls) {
      const { page, restart_browser, new_proxy } = await createNewPage(browser, proxy_no);
      logger.info(url, 'page created for URL');

      if (new_proxy) proxy_change = true;
      if (restart_browser) relaunch_browser = true;

      if(page) {
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          if (['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
            request.abort();
          } else {
            request.continue();
          }
        });
    
        const { restart_browser, new_proxy } =  await extractPage(page, url, allUrlsInfo);
        if (new_proxy) proxy_change = true;
        if (restart_browser) relaunch_browser = true;

        await page.close();
      }
    }

    //* Checking for failed URLs and need for recheck
    if (proxy_change) {
      if (PROXIES && PROXIES.length > (proxy_no ? proxy_no : 0)) {
        if (browser) await browser.close();
        await delay(DELAY_IN_MS);
        const newUrlsInfo = await processUrls(urls, allUrlsInfo, null, retry_attempt + 1, (proxy_no ? proxy_no + 1 : 0));
        if (newUrlsInfo) return { ...allUrlsInfo, ...newUrlsInfo };
      } else {
        logger.error(`out of proxies`)
      }
    } else if (relaunch_browser) {
      if (browser) await browser.close();
      await delay(DELAY_IN_MS);
      const newUrlsInfo = await processUrls(urls, allUrlsInfo, null, retry_attempt + 1, proxy_no);
      if (newUrlsInfo) return { ...allUrlsInfo, ...newUrlsInfo };
    }
  } catch (error: any) {
    logger.error(`Error launching browser or during processing: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  return allUrlsInfo;
}

async function extractPage(page: Page, url: string, allUrlsInfo: UrlsInfoRes) {
  let proxy_change: boolean = false, relaunch_browser: boolean = false, crawl_urls: string[] =[];

  try {
    const { page: loaded_page, err, err_code, restart_browser, new_proxy } = await loadThePageForExtraction(page, url);
    logger.info(url, 'page loaded');

    if (new_proxy) proxy_change = true;
    if (restart_browser) relaunch_browser = true;

    if (loaded_page) {
      allUrlsInfo[url].info = await extractAllCompanyInfo(loaded_page) as any;
    }
    allUrlsInfo[url].attempt += 1;
    allUrlsInfo[url].err = err;
    allUrlsInfo[url].err_code = err_code;
    
    
    //* Crawling for contact info
    const extracted_data = allUrlsInfo[url].info;
    if(extracted_data && ( 
      (!extracted_data.addresses || extracted_data.addresses.length == 0 ) ||
      (!extracted_data.emails || extracted_data.emails.length == 0 ) ||
      (!extracted_data.phoneNumbers || extracted_data.phoneNumbers.length == 0 ) 
    )) {
      await contactPageCrawler(page, url, allUrlsInfo);
    }

    return { new_proxy: proxy_change, restart_browser: relaunch_browser }
  } catch (err) {
    const { restart_browser, new_proxy } = handlePuppetierErrors(err);
    if (new_proxy) proxy_change = true;
    if (restart_browser) relaunch_browser = true;

    return { new_proxy: proxy_change, restart_browser: relaunch_browser }
  }
}

async function contactPageCrawler(page: Page, url: string, allUrlsInfo: UrlsInfoRes) {
  const crawl_urls = (await extractContactLinks(page)).map(ele=> ele.href);
  allUrlsInfo[url].other_webiste_urls = crawl_urls;

  if(crawl_urls) {
    const crawling_operations = crawl_urls.map(async (crawl_url)=> {
      if(!allUrlsInfo[crawl_url]) {
        logger.info( url, 'Crawling for Contact Details in URL:', crawl_url)
        allUrlsInfo[crawl_url] = {
          other_webiste_urls: [],
          attempt: 1
        }
        return await extractPage(page, crawl_url, allUrlsInfo);
      }
    });
    await Promise.all(crawling_operations);
  }
}