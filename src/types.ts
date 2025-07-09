interface CompanyInfo {
  url: string;
  companyName: string[] | null;
  phoneNumbers: string[];
  addresses: string[];
  emails: string[];
  screenshotPath: string | null;
  error: string | null;
  socialMedia?: {
    instagram?: string,
    facebook?: string,
    twitter?: string
  }
}

export interface UrlsInfoRes {
  [key: string]: {
    info?: CompanyInfo,
    other_webiste_urls: string[],
    err?: any,
    err_code?: number,
    attempt: number,
  }
}