import * as dotenv from "dotenv";
import { Browser } from 'puppeteer';

import { delay } from './utils/common';
import { extractAllCompanyInfo } from './utils/extract_operations';
import { createNewPage, launchBrowser, loadThePageForExtraction } from './utils/puppeteer_operations';

dotenv.config()

interface CompanyInfo {
  url: string;
  companyName: string[] | null;
  phoneNumbers: string[];
  emails: string[];
  screenshotPath: string | null;
  error: string | null;
}

interface UrlsInfoRes {
  [key: string] : {
    info?: CompanyInfo,
    other_webiste_urls: string[],
    err?: any,
    err_code?: number,
    attempt: number,
  }
}

const PROXY_STRING = process.env.PROXIES
export const PROXIES = (typeof PROXY_STRING == 'string') ? PROXY_STRING.split(', ') : [];

export async function processUrls(given_urls: string[], prevUrlsInfo?: UrlsInfoRes, given_browser?: Browser | null, retry_attempt = 0, proxy_no: number | undefined = undefined): Promise<UrlsInfoRes | undefined> {
  let browser: Browser | null = null;
  let allUrlsInfo: UrlsInfoRes = {}

  //* Breaking condition if the function keeps failing
  if(retry_attempt > 2) {
    Object(prevUrlsInfo).keys().forEach((key: string)=> {
      if(prevUrlsInfo && !prevUrlsInfo[key].info) {
        prevUrlsInfo[key].err = 'Internal Server Error';
        prevUrlsInfo[key].err_code = 500;
      }
    })
    return prevUrlsInfo;
  }

  //* In retry attempt don't take URLs who has already been extracted 
  const urls = given_urls.filter(url=> {
    if(prevUrlsInfo && prevUrlsInfo[url] && (prevUrlsInfo[url].info || prevUrlsInfo[url].attempt > 2)){
      return false;
    } 
    allUrlsInfo[url] = {
      other_webiste_urls: [],
      attempt: 0
    }
    return true;
  })


  try {
    
    if(!given_browser) {
      browser = await launchBrowser(proxy_no);
    } else {
      browser = given_browser;
    }
    console.info('Browser Launched');

    let relaunch_browser, proxy_change, crawl_urls;

    //* Iterate for each URLs (that wasn't extracted before)
    for (const url of urls) {
      const { page, restart_browser, new_proxy } = await createNewPage(browser, proxy_no);
      console.info(url, 'page created for URL');
      
      if(new_proxy) proxy_change = true;
      if(restart_browser) relaunch_browser = true;

      if(page) {
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          if (['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
            request.abort();
          } else {
            request.continue();
          }
        });
        
        const { page: loaded_page, err, err_code, restart_browser, new_proxy } =  await loadThePageForExtraction(page, url);
        console.info(url, 'page loaded');
        
        if(new_proxy) proxy_change = true;
        if(restart_browser) relaunch_browser = true;

        if(loaded_page) {
          allUrlsInfo[url].info = await extractAllCompanyInfo(loaded_page) as any;
        }
        allUrlsInfo[url].attempt += 1;
        allUrlsInfo[url].err = err;
        allUrlsInfo[url].err_code = err_code;
  
        await page.close();
      }
    }
    //* Checking for failed URLs and need for recheck
    if(proxy_change) {
      if(PROXIES && PROXIES.length > (proxy_no ? proxy_no : 0)){
        if (browser) await browser.close();
        await delay(1000);
        const newUrlsInfo = await processUrls(urls, allUrlsInfo, null, retry_attempt+1, (proxy_no ? proxy_no + 1: 0));
        if(newUrlsInfo) return { ...allUrlsInfo, ...newUrlsInfo };
      } else {
        console.error(`out of proxies`)
      }
    } else if (relaunch_browser) {
      if (browser) await browser.close();
      await delay(1000);
      const newUrlsInfo =  await processUrls(urls, allUrlsInfo, null, retry_attempt+1, proxy_no);
      if(newUrlsInfo) return { ...allUrlsInfo, ...newUrlsInfo };
    }
  } catch (error: any) {
    console.error(`Error launching browser or during processing: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  return allUrlsInfo;
}