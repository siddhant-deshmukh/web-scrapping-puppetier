# 🌐 Web‑Scraping Lead‑Gen Tool

A headless‑browser scraper built with **Node.js**, **TypeScript**, **Puppeteer**, and **Morgan** that turns a search query or a list of URLs into structured company intelligence for lead generation.

---

## ✨ Features & Assignment Mapping

### Minimal Requirements (Core Features)

| Requirement | Status |
|-------------|--------|
| **Input Handling & Query Execution** – Accept query or seed URLs, validate & reach them | ✅ |
| **Basic Data Extraction (Level 1)** – Company name, website, basic contact info | ✅ |
| **Structured Output (CSV / JSON)** | ✅ |
| **Error Handling & Clear Logs** | ✅ |

### Optional Enhancements

| Enhancement | Status |
|-------------|--------|
| **Level 2 – Extended Details**<br>• Social media links  • Physical address  • Tagline / description  • Year founded  • Products / services  • Industry / sector | ✅ |
| **Dynamic Content Handling** – Headless Chromium with `waitForNetworkIdle` | ✅ |
| **URL Discovery** – Contact‑page crawler (looks for `/contact`, `/contact‑us`, etc.) | ✅ |
| **Proxy Rotation & Retry Logic** | ✅ |
| **Centralised Logging (console + file)** – Morgan | ✅ |

> **Not implemented:** Deep tech‑stack parsing, competitor analysis, pagination, external data‑enrichment APIs, CLI/UI configuration files, formal test suite.

---

## 🛠️ Tech Stack

| Layer | Tool |
|-------|------|
| Runtime | Node.js (v18+) |
| Language | TypeScript |
| Headless Browser | Puppeteer |
| Logging | Morgan |
| Build | ts‑node‑dev / tsc |

---

## 🚀 Quick Start

1. **Clone & install**

   ```bash
   git clone https://github.com/siddhant-deshmukh/web-scrapping-puppetier.git
   cd web-scrapping-puppetier
   npm install



### 1. Configure env vars

Create a `.env` file (all variables are **optional**):

```javascript
dotenv
CopyEditPORT=3000

# Google Custom Search (enables plain‑text queries)
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=

# Comma‑separated proxies (http(s)://host:port)
PROXIES=

# If your proxies need auth
PROXY_USER_NAME=
PROXY_PASSWORD=

```

### 2. Run

```javascript
bash
CopyEdit# Development (hot reload)
npm run dev

# Production
npm run build
npm start

```

***

---

## What This Tool Does

This tool takes either a list of URLs or a plain-text search query (like “cloud computing startups in Europe”) and tries to extract company information such as name, email, phone number, address, and other details. It does this using a headless browser (Puppeteer) to handle modern websites that rely heavily on JavaScript for rendering content.

---

## Input Handling Logic

When the user sends a request, the input is checked to determine whether it’s a direct URL (or list of URLs), or a normal text query.

- If it’s a plain text query, and if Google Search API credentials are provided, the tool uses Google’s Custom Search Engine API to get the top 2 URLs for that query.
- If URLs are provided directly, they are processed as-is.

This allows flexibility depending on how technical the user is — both technical users and non-technical users can use the tool effectively.

---

## Browser Automation and Page Handling

Puppeteer is used to launch a headless Chromium browser. For each URL:

- A new page is created.
- The tool uses `waitForNetworkIdle` to ensure all JavaScript-rendered content has fully loaded.
- If a page fails to load or crashes, retry logic is in place — the page is retried twice.
- If the browser crashes completely, it is relaunched and resumes scraping remaining URLs.

This setup ensures the tool is resilient to common issues like network failures or resource-intensive sites.

---

## Proxy Support and Rotation

Proxies can be provided via an environment variable. If any of the following issues occur:

- Proxy connection fails
- Proxy not supported
- HTTP response status is 429 or 403

Then the proxy is rotated. If proxy credentials are needed, they can also be provided through environment variables.

This helps avoid rate limiting or region-based restrictions on target websites.

---

## Data Extraction

Once the page is loaded, a series of regex patterns and hardcoded selectors are used to extract:

- Company name
- Website
- Email addresses
- Phone numbers
- Social media links
- Tagline
- Description
- Products or services
- Industry or market sector
- Year founded
- Address
- Operational status

All extraction logic is written in modular utility functions under `utils/extract_operations.ts`.

If the current page doesn’t have contact info, a limited crawler checks for internal links like `/contact`, `/contact-us`, or `/get-in-touch`, and visits those pages to try to find the missing details. To prevent infinite crawling, already-visited URLs are skipped.

---

## Logging and Error Handling

Morgan is used for logging. Logs are written to the console and also saved to files for later analysis.

Every step of the process includes error handling. If a URL fails, the error is logged, but the rest of the process continues — one bad page won’t stop the entire batch.

---

## Output

The tool returns structured JSON output in the API response. It also writes the result to a CSV file inside a `data/` folder with a timestamped filename.

---

***

## API Reference

| Method | Endpoint | Body | Description |
| --- | --- | --- | --- |
| `POST` | `/` | \`\`\`json { "scan": "<query | url |

### Example Request

```javascript
bash
CopyEditcurl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"scan":"cloud computing startups in Europe"}'

```

### Example Response (truncated)

```javascript
{
	"extracted_data": {
		"https://getitsms.com": {
			"other_webiste_urls": [
				"https://getitsms.com/blogs/track-whatsapp-marketing-campaigns/",
				"https://getitsms.com/support/",
				"https://getitsms.com/contact-us",
				"https://getitsms.com/about-us"
			],
			"attempt": 1,
			"info": {
				"addresses": [],
				"socialMedia": {
					"instagram": "https://www.instagram.com/getitsms/",
					"facebook": "https://www.facebook.com/getitsms/",
					"twitter": "https://twitter.com/GetItSMS"
				},
				"emails": [
					"info@getitsms.com"
				],
				"phoneNumbers": [
					"+918209204221",
					"8209204221",
					"9186966922",
					"1146049519"
				],
				"companyNames": [
					"GetItSMS: Cloud Messaging Platform for SMS, Voice, Email & WhatsApp",
					"Get it SMS"
				],
				"taglines": [
					"Solution to Optimize Marketing Campaigns",
					"solution. Optimize your outreach and engagement by utilizing this powerful too",
					"solution that can be tailored to your specific business needs."
				],
				"descriptions": [
					"GetItSMS is the best bulk SMS service provider in India. Test Free SMS Online. Send Promotional, Transactional, OTP, WhatsApp Messages & API SMS. Free Bulk SMS on Signup !!",
					"Any firm searching for powerful SMS that is also very simple to use must have this. GetItSMS is one of the top leading text messaging services.If you are looking for grow your business you should go with GETITSMS.",
					"I appreciate the GetItSMS. Without GetItSMS, we would be unable to respond when it mattered, contact clients immediately, and maintain control of everything. We would notice a significant drop in our conversion rate."
				],
				"productsServices": [
					"Pricing",
					"Products",
					"Bulk SMS Service",
					"OTP Verification",
					"Marketing Automation",
					"International Bulk SMS Price",
					"International OTP",
					"Promotional SMS",
					"Transactional SMS",
					"Best WhatsApp Chatbot Platform"
				],
				"industries": [
					"Marketing",
					"Technology",
					"Finance"
				],
				"yearFounded": null,
				"operationalStatus": {
					"status": "active",
					"confidence": 97.05882352941177,
					"indicators": [
						"Active language patterns found (15)",
						"Active language patterns found (1)",
						"Active language patterns found (8)",
						"Inactive language patterns found (1)",
						"Current year mentioned 3 times",
						"Social media links present"
					]
				}
			}
		},
		"https://getitsms.com/contact-us": {
			"other_webiste_urls": [
				"https://getitsms.com/support/",
				"https://getitsms.com/contact-us",
				"https://getitsms.com/about-us"
			],
			"attempt": 1,
			"info": {
				"addresses": [
					"Branch Office: G7, Near, Apex Circle, Usha Colony, Malviya Nagar Industrial Area, Malviya Nagar, Jaipur, Rajasthan 302017",
					"Head Office: Cessna Business Park, Tower 1, Umiya Business Bay, Marathahalli - Sarjapur Outer Ring Rd, Kaverappa Layout, Kadubeesanahalli, Kadabeesanahalli, Bengaluru, Karnataka 560103 Branch Office: G7, Near, Apex Circle, Usha Colony, Malviya Nagar Industrial Area, Malviya Nagar, Jaipur, Rajasthan 302017 Phone: +91-79767 24242 Email: Info@getitsms.com By submitting the above information you agree to the Privacy Policy .",
					"Cessna Business Park, Tower 1, Umiya Business Bay, Marathahalli - Sarjapur Outer Ring Rd, Kaverappa Layout, Kadubeesanahalli, Kadabeesanahalli, Bengaluru, Karnataka 560103 Branch Office: G7, Near, Apex Circle, Usha Colony, Malviya Nagar Industrial Area, Malviya Nagar, Jaipur, Rajasthan 302017",
					"Cessna Business Park, Tower 1, Umiya Business Bay, Marathahalli - Sarjapur Outer Ring Rd, Kaverappa Layout, Kadubeesanahalli, Kadabeesanahalli, Bengaluru, Karnataka 560103",
					"Head Office: Cessna Business Park, Tower 1, Umiya Business Bay, Marathahalli - Sarjapur Outer Ring Rd, Kaverappa Layout, Kadubeesanahalli, Kadabeesanahalli, Bengaluru, Karnataka 560103"
				],
				"socialMedia": {
					"instagram": "https://www.instagram.com/getitsms/",
					"facebook": "https://www.facebook.com/getitsms/",
					"twitter": "https://twitter.com/GetItSMS"
				},
				"emails": [
					"info@getitsms.com"
				],
				"phoneNumbers": [
					"+918209204221",
					"+917976724242",
					"8209204221",
					"9186966922",
					"1146049519"
				],
				"companyNames": [
					"Contact Us - Get it SMS",
					"Get it SMS"
				],
				"taglines": [],
				"descriptions": [],
				"productsServices": [
					"Pricing",
					"Products",
					"Bulk SMS Service",
					"OTP Verification",
					"Marketing Automation",
					"International Bulk SMS Price",
					"International OTP",
					"Promotional SMS",
					"Transactional SMS",
					"Best WhatsApp Chatbot Platform"
				],
				"industries": [
					"Marketing",
					"Technology",
					"Manufacturing"
				],
				"yearFounded": null,
				"operationalStatus": {
					"status": "active",
					"confidence": 100,
					"indicators": [
						"Active language patterns found (9)",
						"Active language patterns found (3)",
						"Active language patterns found (5)",
						"Social media links present"
					]
				}
			}
		}
	}
}
```


***

## 🧩 How It Works — Summary

1. **Input Router** – decides whether to call Google CSE or use provided URLs.
2. **Browser Pool** – Puppeteer pages with `waitForNetworkIdle`, retry & proxy rotation.
3. **Extraction Pipeline** – regex/DOM queries pull contact & company data.
4. **Contact‑Page Crawler** – follows links like `/contact`, `contact-us`, `get-in-touch`.
5. **Formatter** – returns JSON and writes a timestamped CSV to `/data`.
