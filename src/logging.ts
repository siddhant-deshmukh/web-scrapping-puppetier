import { createLogger, format, transports } from 'winston';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.printf(({ timestamp, level, message, stack }) => {
      return stack
        ? `${timestamp} [${level.toUpperCase()}] ${message} - ${stack}`
        : `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: path.join(LOG_DIR, 'app.log') }),
  ],
  exitOnError: false,
});

export default logger;
