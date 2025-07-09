import cors from 'cors';
import * as dotenv from 'dotenv';
import express, { Request, Response } from 'express';

import { parseUrlDetails } from './utils/validation';
import { performGoogleSearch } from './utils/googleApi';
import { processUrls } from './extract';
import path from 'path';
import { LoggerModes } from 'jet-logger';


dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();

app.set('trust proxy', 1);
app.use(express.json());
app.use(cors());

const logFilePath = path.join(__dirname, '../sampleProject.log');
process.env.JET_LOGGER_MODE = LoggerModes.Custom; // Can also be Console, Custom, or Off
process.env.JET_LOGGER_FILEPATH = logFilePath;


app.post('/', async (req: Request, res: Response) => {
  try {
    const { scan } = req.body;

    //* Field validation 
    if (!scan || !((Array.isArray(scan) && scan.length > 0) || typeof scan == 'string')) {
      res.status(400).json({ msg: 'Invalid fields send in scan parameter' })
      return;
    }
    let urls = parseUrlDetails(scan);
    if (!urls) {
      res.status(400).json({ msg: 'Invalid fields send in scan parameter' })
      return;
    }
    if (typeof scan == 'string' && urls[0].invalid && (scan.length < 1 || scan.length > 100)) {
      res.status(400).json({ msg: 'Invalid fields send in scan parameter' })
      return;
    }


    if (typeof scan == 'string' && urls[0].invalid) {
      const googleSearchResults = await performGoogleSearch(scan);
      if(!googleSearchResults) {
        res.status(500).json({msg: 'Unable to search on Search Engine'});
        return;
      }
      urls = parseUrlDetails(googleSearchResults.map((ele)=> ele.link));
    }
    if(urls) {
      const extracted_data = await processUrls(urls.map((ele)=> ele.url));
      res.status(200).json({ extracted_data })
      return;
    }
    throw 'Something went wrong';
  } catch (err ){
    res.status(500).json({ msg: 'Something went wrong' });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});