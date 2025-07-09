import { Page } from "puppeteer";
import logger from "../logging";


export async function extractCompanyAddress(page: Page): Promise<string[]> {
  const addresses = await page.evaluate(() => {
    const addressKeywords = ['tower', 'floor', 'building', 'office', 'address', 'street', 'road', 'avenue', 'suite'];
    const addressSet = new Set<string>();


    const addressSelectors = [
      '[class*="address"]',
      '[class*="office"]',
      '[class*="location"]',
      '[class*="contact"]',
      '[id*="address"]',
      '[id*="office"]',
      '[id*="location"]'
    ];

    addressSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 20 && addressKeywords.some(keyword =>
          text.toLowerCase().includes(keyword))) {
          addressSet.add(text);
        }
      });
    });


    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const text = el.textContent?.trim();
      if (text) {

        if (/\b(office|address)\s*:/i.test(text)) {

          const match = text.match(/\b(?:office|address)\s*:\s*(.+)/i);
          if (match && match[1].length > 15) {
            addressSet.add(match[1].trim());
          }
        }


        const keywordMatches = addressKeywords.filter(keyword =>
          text.toLowerCase().includes(keyword)).length;
        if (keywordMatches >= 2 && text.length > 30) {
          addressSet.add(text);
        }
      }
    });


    const addressPatterns = [
      /\b\d{5,6}\b.*\b(india|usa|uk|canada|australia)\b/i,
      /\b(maharashtra|gujarat|karnataka|delhi|bangalore|mumbai|pune)\b/i,
      /\b\d+(?:st|nd|rd|th)?\s+(?:floor|level)\b/i
    ];

    allElements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && addressPatterns.some(pattern => pattern.test(text))) {
        if (text.length > 20 && text.length < 500) {
          addressSet.add(text);
        }
      }
    });

    return Array.from(addressSet);
  });


  return addresses
    .map(addr => addr.replace(/\s+/g, ' ').trim())
    .filter(addr => addr.length > 20 && addr.length < 500)
    .slice(0, 5);
}

export async function extractSocialMediaUrls(page: Page) {
  const socialUrls = await page.evaluate(() => {
    const socialPlatforms = {
      linkedin: ['linkedin.com', 'linkedin.in'],
      instagram: ['instagram.com', 'instagr.am'],
      reddit: ['reddit.com'],
      facebook: ['facebook.com', 'fb.com'],
      twitter: ['twitter.com', 'x.com']
    };

    const result: any = {};


    const links = document.querySelectorAll('a[href]');

    links.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;

      const url = href.startsWith('http') ? href : `https://${href}`;


      Object.entries(socialPlatforms).forEach(([platform, domains]) => {
        if (!result[platform] && domains.some(domain => url.includes(domain))) {
          try {
            const urlObj = new URL(url);
            if (urlObj.pathname.length > 1) {
              result[platform] = url;
            }
          } catch (e) {

          }
        }
      });
    });

    return result;
  });

  return socialUrls;
}

export async function extractEmails(page: Page): Promise<string[]> {
  const emails = await page.evaluate(() => {
    const emailSet = new Set<string>();

    const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
    mailtoLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0];
        if (isValidEmail(email)) {
          emailSet.add(email.toLowerCase());
        }
      }
    });

    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const allText = document.body.textContent || '';
    const matches = allText.match(emailRegex);

    if (matches) {
      matches.forEach(email => {
        if (isValidEmail(email)) {
          emailSet.add(email.toLowerCase());
        }
      });
    }

    function isValidEmail(email: string): boolean {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email) &&
        !email.includes('example.com') &&
        !email.includes('test.com') &&
        !email.includes('placeholder');
    }

    return Array.from(emailSet);
  });

  return emails;
}

export async function extractPhoneNumbers(page: Page): Promise<string[]> {
  const phoneNumbers = await page.evaluate(() => {
    const phoneSet = new Set<string>();


    const telLinks = document.querySelectorAll('a[href^="tel:"]');
    telLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        const phone = href.replace('tel:', '').trim();
        if (isValidPhone(phone)) {
          phoneSet.add(cleanPhoneNumber(phone));
        }
      }
    });


    const phoneIcons = document.querySelectorAll([
      'i[class*="phone"]',
      'i[class*="tel"]',
      'svg[class*="phone"]',
      '[class*="fa-phone"]'
    ].join(','));

    phoneIcons.forEach(icon => {
      const parent = icon.closest('li, div, span, p');
      if (parent) {
        const text = parent.textContent || '';
        const phoneMatch = text.match(/[\+]?[\d\s\-\(\)]{10,}/g);
        if (phoneMatch) {
          phoneMatch.forEach(phone => {
            const cleaned = cleanPhoneNumber(phone);
            if (isValidPhone(cleaned)) {
              phoneSet.add(cleaned);
            }
          });
        }
      }
    });


    const phonePatterns = [
      /\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
      /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g,
      /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g,
      /\+\d{1,3}\s?\d{8,14}/g
    ];

    const allText = document.body.textContent || '';
    phonePatterns.forEach(pattern => {
      const matches = allText.match(pattern);
      if (matches) {
        matches.forEach(phone => {
          const cleaned = cleanPhoneNumber(phone);
          if (isValidPhone(cleaned)) {
            phoneSet.add(cleaned);
          }
        });
      }
    });

    function cleanPhoneNumber(phone: string): string {
      return phone.replace(/[^\d+]/g, '');
    }

    function isValidPhone(phone: string): boolean {
      const digitsOnly = phone.replace(/[^\d]/g, '');
      return digitsOnly.length >= 10 && digitsOnly.length <= 15;
    }

    return Array.from(phoneSet);
  });

  return phoneNumbers;
}

export async function extractCompanyName(page: Page): Promise<string[]> {
  const companyNames = await page.evaluate(() => {
    const nameSet = new Set<string>();


    const title = document.title;
    if (title) {

      const cleanTitle = title.replace(/\s*[-|]\s*(Home|About|Contact|Welcome).*$/i, '');
      if (cleanTitle.length > 2 && cleanTitle.length < 100) {
        nameSet.add(cleanTitle.trim());
      }
    }


    const metaTags = [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[name="apple-mobile-web-app-title"]'
    ];

    metaTags.forEach(selector => {
      const meta = document.querySelector(selector);
      if (meta) {
        const content = meta.getAttribute('content');
        if (content && content.length > 2 && content.length < 100) {
          nameSet.add(content.trim());
        }
      }
    });


    const headerSelectors = [
      'header h1',
      'header .logo',
      'header [class*="brand"]',
      'header [class*="company"]',
      '.navbar-brand',
      '.logo',
      '[class*="company-name"]'
    ];

    headerSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 2 && text.length < 100) {
          nameSet.add(text);
        }
      });
    });


    const copyrightElements = document.querySelectorAll('*');
    copyrightElements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && /©.*?\d{4}/.test(text)) {
        const match = text.match(/©\s*(?:\d{4}\s*)?(.+?)(?:\s*\d{4})?\.?\s*(?:all rights reserved)?/i);
        if (match && match[1]) {
          const companyName = match[1].trim();
          if (companyName.length > 2 && companyName.length < 100) {
            nameSet.add(companyName);
          }
        }
      }
    });


    const aboutPatterns = [
      /about\s+(.+?)(?:\s*[-|]|\s*$)/i,
      /welcome\s+to\s+(.+?)(?:\s*[-|]|\s*$)/i
    ];

    const allText = document.body.textContent || '';
    aboutPatterns.forEach(pattern => {
      const match = allText.match(pattern);
      if (match && match[1]) {
        const companyName = match[1].trim();
        if (companyName.length > 2 && companyName.length < 50) {
          nameSet.add(companyName);
        }
      }
    });

    return Array.from(nameSet);
  });


  return companyNames
    .map(name => name.replace(/\s+/g, ' ').trim())
    .filter(name => name.length > 2 && name.length < 100)
    .slice(0, 5);
}

export async function extractCompanyTagline(page: Page): Promise<string[]> {
  const taglines = await page.evaluate(() => {
    const taglineSet = new Set<string>();


    const metaSelectors = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]'
    ];

    metaSelectors.forEach(selector => {
      const meta = document.querySelector(selector);
      if (meta) {
        const content = meta.getAttribute('content');
        if (content && content.length >= 10 && content.length <= 80) {
          taglineSet.add(content.trim());
        }
      }
    });


    const headerSelectors = [
      'header h2', 'header h3', 'header p',
      'header .tagline', 'header .slogan', 'header .subtitle',
      '.navbar .tagline', '.navbar .slogan',
      '.logo + *', '.brand + *'
    ];

    headerSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length >= 10 && text.length <= 80) {
          taglineSet.add(text);
        }
      });
    });


    const heroSelectors = [
      '.hero h2', '.hero h3', '.hero p',
      '.banner h2', '.banner h3', '.banner p',
      '.jumbotron h2', '.jumbotron h3', '.jumbotron p',
      '[class*="hero"] h2', '[class*="hero"] h3', '[class*="hero"] p'
    ];

    heroSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length >= 10 && text.length <= 80) {
          taglineSet.add(text);
        }
      });
    });


    const taglinePatterns = [
      /\b(?:your trusted|leading provider|we are|committed to|dedicated to|specializing in|experts in)\b.{10,70}/gi,
      /\b(?:innovative|professional|reliable|quality|excellence|solution)\b.{10,70}/gi
    ];

    const allText = document.body.textContent || '';
    taglinePatterns.forEach(pattern => {
      const matches = allText.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.trim();
          if (cleaned.length >= 10 && cleaned.length <= 80) {
            taglineSet.add(cleaned);
          }
        });
      }
    });


    const taglineClassSelectors = [
      '.tagline', '.slogan', '.subtitle', '.motto',
      '[class*="tagline"]', '[class*="slogan"]', '[class*="subtitle"]'
    ];

    taglineClassSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length >= 10 && text.length <= 80) {
          taglineSet.add(text);
        }
      });
    });

    return Array.from(taglineSet);
  });


  const genericPhrases = ['welcome to our website', 'home page', 'contact us', 'about us'];
  return taglines
    .filter(tagline => !genericPhrases.some(phrase =>
      tagline.toLowerCase().includes(phrase)))
    .slice(0, 3);
}

export async function extractCompanyDescription(page: Page): Promise<string[]> {
  const descriptions = await page.evaluate(() => {
    const descriptionSet = new Set<string>();


    const aboutSelectors = [
      '[class*="about"] p',
      '[id*="about"] p',
      'section[class*="about"] p',
      'div[class*="about"] p'
    ];

    aboutSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length >= 50 && text.length <= 500) {
          descriptionSet.add(text);
        }
      });
    });


    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      const content = metaDesc.getAttribute('content');
      if (content && content.length >= 50) {
        descriptionSet.add(content.trim());
      }
    }


    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '');
        if (data.description && data.description.length >= 50) {
          descriptionSet.add(data.description);
        }
        if (data['@type'] === 'Organization' && data.description) {
          descriptionSet.add(data.description);
        }
      } catch (e) {

      }
    });


    const descriptionPatterns = [
      /\b(?:we are|founded in|established in|our company|our mission)\b.{50,400}/gi,
      /\b(?:since \d{4}|for over \d+ years|leading provider|specializing in)\b.{50,400}/gi
    ];

    const allText = document.body.textContent || '';
    descriptionPatterns.forEach(pattern => {
      const matches = allText.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.trim();
          if (cleaned.length >= 50 && cleaned.length <= 500) {
            descriptionSet.add(cleaned);
          }
        });
      }
    });


    const mainParagraphs = document.querySelectorAll('main p, .content p, .main-content p');
    mainParagraphs.forEach(p => {
      const text = p.textContent?.trim();
      if (text && text.length >= 50 && text.length <= 500) {
        descriptionSet.add(text);
      }
    });

    return Array.from(descriptionSet);
  });

  return descriptions
    .filter(desc => desc.length >= 50 && desc.length <= 500)
    .slice(0, 3);
}

export async function extractProductsServices(page: Page): Promise<string[]> {
  const services = await page.evaluate(() => {
    const serviceSet = new Set<string>();


    const navSelectors = [
      'nav ul li a', 'nav ol li a',
      '.navbar ul li a', '.navbar ol li a',
      '.menu ul li a', '.menu ol li a',
      'header nav a', 'header ul li a'
    ];

    navSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && !isGenericNavItem(text)) {
          serviceSet.add(text);
        }
      });
    });

    const serviceSelectors = [
      '[class*="service"] h2', '[class*="service"] h3',
      '[class*="product"] h2', '[class*="product"] h3',
      '[class*="solution"] h2', '[class*="solution"] h3',
      '[class*="offering"] h2', '[class*="offering"] h3',
      'section[class*="services"] h2', 'section[class*="services"] h3',
      'section[class*="products"] h2', 'section[class*="products"] h3'
    ];

    serviceSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length >= 3 && text.length <= 50) {
          serviceSet.add(text);
        }
      });
    });

    // Strategy 3: List detection
    const listSelectors = [
      'section[class*="services"] ul li',
      'section[class*="products"] ul li',
      '.services-list li',
      '.products-list li'
    ];

    listSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length >= 3 && text.length <= 50) {
          serviceSet.add(text);
        }
      });
    });

    // Strategy 4: Card/tile patterns
    const cardSelectors = [
      '.card h2', '.card h3', '.card-title',
      '.tile h2', '.tile h3', '.tile-title',
      '[class*="card"] h2', '[class*="card"] h3',
      '[class*="tile"] h2', '[class*="tile"] h3'
    ];

    cardSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length >= 3 && text.length <= 50) {
          serviceSet.add(text);
        }
      });
    });

    function isGenericNavItem(text: string): boolean {
      const genericItems = [
        'home', 'about', 'about us', 'contact', 'contact us',
        'blog', 'news', 'careers', 'login', 'register',
        'privacy', 'terms', 'support', 'help', 'faq'
      ];
      return genericItems.includes(text.toLowerCase());
    }

    return Array.from(serviceSet);
  });

  return services
    .filter(service => service.length >= 3 && service.length <= 50)
    .slice(0, 10);
}

export async function extractIndustryMarketSector(page: Page): Promise<string[]> {
  const industries = await page.evaluate(() => {
    const industryKeywords = {
      'Technology': ['software', 'development', 'tech', 'digital', 'IT', 'programming', 'coding'],
      'Healthcare': ['medical', 'healthcare', 'hospital', 'clinical', 'pharmaceutical', 'health'],
      'Finance': ['financial', 'banking', 'investment', 'fintech', 'insurance', 'accounting'],
      'Manufacturing': ['manufacturing', 'industrial', 'production', 'factory', 'automotive'],
      'Education': ['education', 'learning', 'training', 'academic', 'school', 'university'],
      'Retail': ['retail', 'ecommerce', 'shopping', 'store', 'merchandise', 'commerce'],
      'Real Estate': ['real estate', 'property', 'construction', 'architecture', 'building'],
      'Marketing': ['marketing', 'advertising', 'branding', 'promotion', 'digital marketing'],
      'Consulting': ['consulting', 'advisory', 'strategy', 'business consulting', 'management'],
      'Legal': ['legal', 'law', 'attorney', 'lawyer', 'litigation', 'compliance']
    };

    const industryScores: { [key: string]: number } = {};
    const allText = document.body.textContent?.toLowerCase() || '';

    // Score each industry based on keyword frequency
    Object.entries(industryKeywords).forEach(([industry, keywords]) => {
      let score = 0;
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = allText.match(regex);
        if (matches) {
          score += matches.length;
        }
      });
      if (score > 0) {
        industryScores[industry] = score;
      }
    });

    // Strategy 2: Direct industry mentions
    const industryPatterns = [
      /\b(?:industry|sector|market|field|domain)\b.{0,50}\b(?:technology|healthcare|finance|manufacturing|education|retail|legal|consulting|marketing|construction)\b/gi,
      /\b(?:we serve|our clients|working with|specializing in|experts in)\b.{0,50}\b(?:technology|healthcare|finance|manufacturing|education|retail|legal|consulting|marketing|construction)\b/gi
    ];

    industryPatterns.forEach(pattern => {
      const matches = allText.match(pattern);
      if (matches) {
        matches.forEach(match => {
          Object.keys(industryKeywords).forEach(industry => {
            if (match.toLowerCase().includes(industry.toLowerCase())) {
              industryScores[industry] = (industryScores[industry] || 0) + 5;
            }
          });
        });
      }
    });

    // Sort by score and return top industries
    return Object.entries(industryScores)
      .sort(([, a], [, b]) => b - a)
      .map(([industry]) => industry);
  });

  return industries.slice(0, 3);
}

export async function extractYearFounded(page: Page): Promise<number | null> {
  const foundedYear = await page.evaluate(() => {
    const currentYear = new Date().getFullYear();
    const yearCandidates: number[] = [];

    const foundedPatterns = [
      /\b(?:founded|established|since|est\.?)\s+(?:in\s+)?(\d{4})\b/gi,
      /\b(?:since|est\.?)\s+(\d{4})\b/gi,
      /\b(\d{4})\s*-\s*present\b/gi
    ];

    const allText = document.body.textContent || '';
    foundedPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(allText)) !== null) {
        const year = parseInt(match[1]);
        if (year >= 1800 && year <= currentYear) {
          yearCandidates.push(year);
        }
      }
    });

    const copyrightPattern = /©\s*(\d{4})/gi;
    let match;
    while ((match = copyrightPattern.exec(allText)) !== null) {
      const year = parseInt(match[1]);
      if (year >= 1900 && year <= currentYear - 2) {
        yearCandidates.push(year);
      }
    }

    const anniversaryPatterns = [
      /\b(\d+)\s+years?\s+(?:of\s+)?(?:experience|service|excellence|operation)\b/gi,
      /\bcelebrating\s+(\d+)\s+years?\b/gi
    ];

    anniversaryPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(allText)) !== null) {
        const yearsInBusiness = parseInt(match[1]);
        if (yearsInBusiness >= 1 && yearsInBusiness <= 100) {
          const foundedYear = currentYear - yearsInBusiness;
          if (foundedYear >= 1800) {
            yearCandidates.push(foundedYear);
          }
        }
      }
    });

    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '');
        if (data.foundingDate) {
          const year = new Date(data.foundingDate).getFullYear();
          if (year >= 1800 && year <= currentYear) {
            yearCandidates.push(year);
          }
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    });

    if (yearCandidates.length === 0) return null;

    const yearCounts = yearCandidates.reduce((acc, year) => {
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    }, {} as { [key: number]: number });

    return parseInt(Object.entries(yearCounts)
      .sort(([, a], [, b]) => b - a)[0][0]);
  });

  return foundedYear;
}

export async function extractOperationalStatus(page: Page) {
  const operationalInfo = await page.evaluate(() => {
    const currentYear = new Date().getFullYear();
    const indicators: string[] = [];
    let activeScore = 0;
    let inactiveScore = 0;


    const activePatterns = [
      /\b(?:currently|now|today|this year|2024|2025)\b/gi,
      /\b(?:hiring|careers|job openings|apply now)\b/gi,
      /\b(?:contact us|get in touch|reach out)\b/gi,
      /\b(?:latest news|recent|upcoming|new)\b/gi
    ];

    const allText = document.body.textContent || '';
    activePatterns.forEach(pattern => {
      const matches = allText.match(pattern);
      if (matches) {
        activeScore += matches.length;
        indicators.push(`Active language patterns found (${matches.length})`);
      }
    });

    const inactivePatterns = [
      /\b(?:was|were|used to|formerly|previously)\b/gi,
      /\b(?:under construction|coming soon|temporarily closed)\b/gi,
      /\b(?:out of business|closed|discontinued)\b/gi
    ];

    inactivePatterns.forEach(pattern => {
      const matches = allText.match(pattern);
      if (matches) {
        inactiveScore += matches.length;
        indicators.push(`Inactive language patterns found (${matches.length})`);
      }
    });

    const currentYearMentions = allText.match(new RegExp(`\\b${currentYear}\\b`, 'g'));
    if (currentYearMentions) {
      activeScore += currentYearMentions.length * 2;
      indicators.push(`Current year mentioned ${currentYearMentions.length} times`);
    }

    const contactForms = document.querySelectorAll('form[action*="contact"], form[class*="contact"]');
    if (contactForms.length > 0) {
      activeScore += 5;
      indicators.push('Contact forms present');
    }

    const socialLinks = document.querySelectorAll('a[href*="facebook"], a[href*="twitter"], a[href*="linkedin"], a[href*="instagram"]');
    if (socialLinks.length > 0) {
      activeScore += 3;
      indicators.push('Social media links present');
    }

    const maintenancePatterns = [
      /\b(?:under maintenance|temporarily unavailable|site update)\b/gi,
      /\b(?:404|page not found|broken link)\b/gi
    ];

    let maintenanceScore = 0;
    maintenancePatterns.forEach(pattern => {
      const matches = allText.match(pattern);
      if (matches) {
        maintenanceScore += matches.length;
        indicators.push(`Maintenance indicators found (${matches.length})`);
      }
    });

    let status: 'active' | 'inactive' | 'maintenance' | 'uncertain';
    let confidence: number;

    if (maintenanceScore > 0) {
      status = 'maintenance';
      confidence = Math.min(maintenanceScore * 20, 100);
    } else if (activeScore > inactiveScore * 2) {
      status = 'active';
      confidence = Math.min((activeScore / (activeScore + inactiveScore)) * 100, 100);
    } else if (inactiveScore > activeScore * 2) {
      status = 'inactive';
      confidence = Math.min((inactiveScore / (activeScore + inactiveScore)) * 100, 100);
    } else {
      status = 'uncertain';
      confidence = 50;
    }

    return { status, confidence, indicators };
  });

  return operationalInfo;
}

export async function extractAllCompanyInfo(page: Page): Promise<{
  addresses: string[];
  socialMedia: {
    linkedin?: string;
    instagram?: string;
    reddit?: string;
    facebook?: string;
    twitter?: string;
  };
  emails: string[];
  phoneNumbers: string[];
  companyNames: string[];
  taglines: string[];
  descriptions: string[];
  productsServices: string[];
  industries: string[];
  yearFounded: number | null;
  operationalStatus: {
    status: 'active' | 'inactive' | 'maintenance' | 'uncertain';
    confidence: number;
    indicators: string[];
  };
}> {
  const [
    addresses,
    socialMedia,
    emails,
    phoneNumbers,
    companyNames,
    taglines,
    descriptions,
    productsServices,
    industries,
    yearFounded,
    operationalStatus
  ] = await Promise.all([
    extractCompanyAddress(page),
    extractSocialMediaUrls(page),
    extractEmails(page),
    extractPhoneNumbers(page),
    extractCompanyName(page),
    extractCompanyTagline(page),
    extractCompanyDescription(page),
    extractProductsServices(page),
    extractIndustryMarketSector(page),
    extractYearFounded(page),
    extractOperationalStatus(page)
  ]);

  return {
    addresses,
    socialMedia,
    emails,
    phoneNumbers,
    companyNames,
    taglines,
    descriptions,
    productsServices,
    industries,
    yearFounded,
    operationalStatus
  };
}

export async function checkIfCaptchaPresent(page: Page) {
  try {
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
        logger.warn(`CAPTCHA/Anti-bot element found: ${selector}`);
        return true;
      }
    }

    // Check for common text content
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes('verify you\'re human') || pageText.includes('Please complete the security check')) {
      logger.warn('CAPTCHA/Anti-bot text found on page.');
      return true;
    }

    return false;
  } catch (err) {
    logger.error(err);
  }
}

export async function extractContactLinks(page: Page) {
  // Simple keywords to match
  const keywords: string[] = [
    'contact',
    // 'support',
    // 'help',
    // 'feedback',
    // 'about',
    'reach',
    'connect',
    'touch'
  ];

  // Regex patterns for URLs
  const urlPatterns: RegExp[] = [
    /\/contact/i,
    // /\/support/i,
    // /\/help/i,
    // /\/feedback/i,
    // /\/about/i,
    /contact-us/i,
    /contactus/i,
    /get-in-touch/i
  ];

  // Regex patterns for link text
  const textPatterns: RegExp[] = [
    /contact\s*us/i,
    /get\s*in\s*touch/i,
    /reach\s*out/i,
    /talk\s*to\s*us/i,
    /customer\s*support/i,
    /help\s*center/i,
    // /feedback/i,
    // /support/i,
    /contact/i
  ];

  return await page.evaluate((keywords: string[], urlPatterns: { source: string; flags: string }[], textPatterns: { source: string; flags: string }[]) => {
    const links: {href: string, title: string, text: string}[] = [];
    const allLinks = document.querySelectorAll('a[href]');

    allLinks.forEach((link) => {
      const href = link.getAttribute('href') || '';
      const text = link.textContent?.trim().toLowerCase() || '';
      const title = (link.getAttribute('title') || '').toLowerCase();

      let isMatch = false;

      // Check URL patterns
      for (const pattern of urlPatterns) {
        if (new RegExp(pattern.source, pattern.flags).test(href)) {
          isMatch = true;
          break;
        }
      }

      // Check text patterns
      if (!isMatch) {
        for (const pattern of textPatterns) {
          if (new RegExp(pattern.source, pattern.flags).test(text) ||
            new RegExp(pattern.source, pattern.flags).test(title)) {
            isMatch = true;
            break;
          }
        }
      }

      // Check simple keywords
      if (!isMatch) {
        for (const keyword of keywords) {
          if (text.includes(keyword) || href.toLowerCase().includes(keyword)) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        links.push({
          href: href,
          text: link.textContent?.trim() || '',
          title: link.getAttribute('title') || ''
        });
      }
    });

    return links;
  }, keywords, urlPatterns.map(p => ({ source: p.source, flags: p.flags })),
    textPatterns.map(p => ({ source: p.source, flags: p.flags })));
}