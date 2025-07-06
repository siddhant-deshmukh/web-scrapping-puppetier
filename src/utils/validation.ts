export function checkURL(url: string) {
  try {
    const urlObj = new URL(url);
    const hasValidHostname = urlObj.hostname.includes('.') && urlObj.hostname.length > 0;
    if(hasValidHostname && (urlObj.protocol === 'http:' || urlObj.protocol === 'https:')) {
      
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

export function parseUrlDetails(givenUrls: string | string[]) {
  try {
    if(!(Array.isArray(givenUrls) || typeof givenUrls === 'string')) {
      return null;
    }
    let urls = Array.isArray(givenUrls) ? givenUrls : [givenUrls];
    
    const parsedUrls = urls.map(urlString => {
      try {
        const urlObj = new URL(urlString);
        const searchParams: { [key: string]: string | string[] } = {};
    
        urlObj.searchParams.forEach((value, key) => {
          if (searchParams[key]) {
            if (Array.isArray(searchParams[key])) {
              (searchParams[key] as string[]).push(value);
            } else {
              searchParams[key] = [searchParams[key] as string, value];
            }
          } else {
            searchParams[key] = value;
          }
        });
    
        return {
          url: urlString,
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          searchParams: searchParams,
          invalid: false,
        };
      } catch {
        return {
          url: urlString,
          invalid: true,
          hostname: '',
          path: '',
          searchParams: [],
        }
      }
    })
    return parsedUrls;
  } catch (error) {
    return null;
  }
}