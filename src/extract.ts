import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// Interface to define the structure of extracted company information
interface CompanyInfo {
    url: string;
    companyName: string | null;
    phoneNumbers: string[];
    emails: string[];
    screenshotPath: string | null;
    error: string | null;
}


async function extractInformation(url: string, page: Page): Promise<CompanyInfo> {
    const companyInfo: CompanyInfo = {
        url,
        companyName: null,
        phoneNumbers: [],
        emails: [],
        screenshotPath: null,
        error: null,
    };

    try {
        // Navigate to the URL with a timeout
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for all network connections to be idle (indicating page has rendered most JS)
        await page.waitForNetworkIdle({ idleTime: 1000, timeout: 60000 }); // Wait for 1 second of network idle or 60 seconds total

        // Take a screenshot
        const siteName = url.replace(/(^\w+:|^)\/\//, '').replace(/[^a-zA-Z0-9]/g, '_');
        const screenshotDir = path.join(__dirname, '../screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
        const screenshotPath = path.join(screenshotDir, `${siteName}.png`);
        //@ts-ignore
        await page.screenshot({ path: screenshotPath, fullPage: true });
        companyInfo.screenshotPath = screenshotPath;

        // Extract Company Name
        companyInfo.companyName = await extractCompanyName(page);

        // Extract Phone Numbers
        companyInfo.phoneNumbers = await extractPhoneNumbers(page);

        // Extract Emails
        companyInfo.emails = await extractEmails(page);

    } catch (error: any) {
        console.error(`Error processing ${url}: ${error.message}`);
        if (error.name === 'TimeoutError') {
            companyInfo.error = 'Page navigation or rendering timed out.';
        } else if (error.message.includes('ERR_NAME_NOT_RESOLVED') || error.message.includes('net::ERR_DNS_UNRESOLVED')) {
            companyInfo.error = 'Page not found or invalid domain.';
        } else if (error.message.includes('captcha') || error.message.includes('bot policy')) {
            companyInfo.error = 'Blocked by CAPTCHA or bot policy.';
        } else {
            companyInfo.error = `An unexpected error occurred: ${error.message}`;
        }
    }
    return companyInfo;
}

async function extractCompanyName(page: Page): Promise<string | null> {
    try {
        // Try common selectors for company name, e.g., in title, h1, or specific meta tags
        let companyName: string | null | undefined = await page.title(); // Often company name is in the title
        if (companyName) {
            // Simple cleaning: remove common suffixes like "| Official Website"
            companyName = companyName.split('|')[0]?.trim() || companyName;
            companyName = companyName.split('-')[0]?.trim() || companyName;
            return companyName;
        }

        // Look for common meta tags for site name or organization name
        companyName = await page.$eval('meta[property="og:site_name"]', el => el.getAttribute('content'))
            .catch(() => null);
        if (companyName) return companyName;

        companyName = await page.$eval('meta[name="application-name"]', el => el.getAttribute('content'))
            .catch(() => null);
        if (companyName) return companyName;

        // Try to find a prominent H1 element
        companyName = await page.$eval('h1', el => el.textContent?.trim())
            .catch(() => null);
        if (companyName) return companyName;

    } catch (error) {
        // console.warn("Could not extract company name using common selectors.", error);
    }
    return null;
}


async function extractPhoneNumbers(page: Page): Promise<string[]> {
    const pageContent = await page.evaluate(() => document.body.innerText);
    const phoneRegex = /(?:\+?(\d{1,3})[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})(?:\s*(?:x|ext)\s*(\d+))?/g;
    const phoneNumbers: string[] = [];
    let match;
    while ((match = phoneRegex.exec(pageContent)) !== null) {
        const phoneNumber = match[0].replace(/\s+/g, '').replace(/[-()]/g, '');
        phoneNumbers.push(phoneNumber);
    }
    return [...new Set(phoneNumbers)];
}

async function extractEmails(page: Page): Promise<string[]> {
    const pageContent = await page.evaluate(() => document.body.innerText);
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails: string[] = [];
    let match;
    while ((match = emailRegex.exec(pageContent)) !== null) {
        emails.push(match[0]);
    }
    return [...new Set(emails)]; 
}


export async function processUrls(urls: string[]): Promise<CompanyInfo[]> {
    let browser: Browser | null = null;
    const allCompanyInfo: CompanyInfo[] = [];

    try {
        browser = await puppeteer.launch({
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

        for (const url of urls) {
            const page = await browser.newPage();
            // Set a default timeout for all page operations
            page.setDefaultNavigationTimeout(60000); // 60 seconds
            page.setDefaultTimeout(60000); // 60 seconds for other operations

            // Set user-agent to mimic a regular browser
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

            // Optionally block resource types to speed up navigation and save bandwidth
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            const info = await extractInformation(url, page);
            allCompanyInfo.push(info);
            await page.close(); // Close the page after processing
        }
    } catch (error: any) {
        console.error(`Error launching browser or during processing: ${error.message}`);
        // If browser fails to launch, add an error entry for all URLs not yet processed
        if (allCompanyInfo.length < urls.length) {
            const processedUrls = new Set(allCompanyInfo.map(info => info.url));
            for (const url of urls) {
                if (!processedUrls.has(url)) {
                    allCompanyInfo.push({
                        url,
                        companyName: null,
                        phoneNumbers: [],
                        emails: [],
                        screenshotPath: null,
                        error: `Failed to process due to browser issue: ${error.message}`,
                    });
                }
            }
        }
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    return allCompanyInfo;
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