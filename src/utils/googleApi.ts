import axios from "axios";
import { checkURL } from "./validation";
import * as dotenv from 'dotenv';

dotenv.config();

const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

export async function performGoogleSearch(query: string) {
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    return false;
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=10`;

  try {
    const response = await axios.get(url);
    if (response.data && response.data.items) {
      return response.data.items.map((item: any) => {
        return {
          title: item.title,
          link: item.link,
          snippet: item.snippet,
        } 
      }) as {
        title: string,
        link: string,
        snippet: string
      }[];
    }
    return [];
  } catch (error) {
    return false;
  }
}
