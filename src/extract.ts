import puppeteer, { Browser, Page } from 'puppeteer';
import { extractAllCompanyInfo, extractCompanyName, extractEmails, extractPhoneNumbers } from './utils/extract_operations';
import { createNewPage, launchBrowser, loadThePageForExtraction } from './utils/puppeteer_operations';

// Interface to define the structure of extracted company information
interface CompanyInfo {
  url: string;
  companyName: string[] | null;
  phoneNumbers: string[];
  emails: string[];
  screenshotPath: string | null;
  error: string | null;
}

async function extractInformation(url: string, page: Page): Promise<CompanyInfo> {
  let companyInfo: CompanyInfo = {
    url,
    companyName: null,
    phoneNumbers: [],
    emails: [],
    screenshotPath: null,
    error: null,
  };

  try {
    const loaded_page =  await loadThePageForExtraction(page, url)
    companyInfo = await extractAllCompanyInfo(loaded_page) as any;
  } catch (error: any) {
    console.error(`Error processing ${url}: ${error.message}`);
    if (error.name === 'TimeoutError') {
      companyInfo.error = 'Page navigation or rendering timed out.';
    } else if (error.message.includes('ERR_NAME_NOT_RESOLVED') || error.message.includes('net::ERR_DNS_UNRESOLVED')) {
      companyInfo.error = 'Page not found or invalid domain.';
    } else if (error.message.includes('captcha') || error.message.includes('bot policy')) {
      companyInfo.error = 'Blocked by CAPTCHA or bot policy.';
    } else if (error.message.includes('WebSocket closed: 1006') || error.message.includes('ECONNREFUSED')) {
      console.error(`Browser Crash/Connection Lost: ${error.message}`);
      // The entire browser process has likely died.
    }
      else {
      companyInfo.error = `An unexpected error occurred: ${error.message}`;
    }
  }
  return companyInfo;
}



export async function processUrls(urls: string[]) {
  let browser: Browser | null = null;
  let allUrlsInfo: {
    [key: string] : {
      info?: CompanyInfo,
      other_webiste_urls: string[],
      err?: any,
      err_code?: number,
    }
  } = {}
  urls.forEach(url=> {
    allUrlsInfo[url] = {
      other_webiste_urls: []
    }
  })


  try {
    
    browser = await launchBrowser();
    console.info('Browser Launched');

    for (const url of urls) {
      const page = await createNewPage(browser);
      console.info(url, 'page created for URL');
      
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      const loaded_page =  await loadThePageForExtraction(page, url);
      console.info(url, 'page loaded');

      allUrlsInfo[url].info = await extractAllCompanyInfo(loaded_page) as any;


      await page.close(); // Close the page after processing
    }
  } catch (error: any) {
    console.error(`Error launching browser or during processing: ${error.message}`);
    // If browser fails to launch, add an error entry for all URLs not yet processed
    // if (allUrlsInfo.length < urls.length) {
    //   const processedUrls = new Set(allUrlsInfo.map(info => info.url));
    //   for (const url of urls) {
    //     if (!processedUrls.has(url)) {
    //       allUrlsInfo.push({
    //         url,
    //         companyName: null,
    //         phoneNumbers: [],
    //         emails: [],
    //         screenshotPath: null,
    //         error: `Failed to process due to browser issue: ${error.message}`,
    //       });
    //     }
    //   }
    // }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  return allUrlsInfo;
}



// Example Usage:
// (async () => {
//     const urlsToSearch = [
//         'https://www.google.com',
//         'https://www.example.com', // A hypothetical example
//         'https://www.amazon.in',
//         'https://www.nonexistentwebsite12345.com', // To test page not found
//         'https://www.tcs.com',
//         'https://www.infosys.com'
//     ];

//     console.log("Starting URL processing...");
//     const results = await processUrls(urlsToSearch);
//     console.log("\n--- Extraction Results ---");
//     results.forEach(result => {
//         console.log(`\nURL: ${result.url}`);
//         console.log(`  Company Name: ${result.companyName || 'N/A'}`);
//         console.log(`  Phone Numbers: ${result.phoneNumbers.length > 0 ? result.phoneNumbers.join(', ') : 'N/A'}`);
//         console.log(`  Emails: ${result.emails.length > 0 ? result.emails.join(', ') : 'N/A'}`);
//         console.log(`  Screenshot Path: ${result.screenshotPath || 'N/A'}`);
//         console.log(`  Error: ${result.error || 'None'}`);
//     });
//     console.log("\nProcessing complete. Screenshots are saved in the 'screenshots' directory.");
// })();