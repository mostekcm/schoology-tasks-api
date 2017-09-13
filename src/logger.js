import config from './config';

const winston = require('winston');

winston.emitErrs = true;

const logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp: true,
      level: config('LOG_LEVEL'),
      handleExceptions: true,
      json: false,
      colorize: true
    })
  ],
  exitOnError: false
});

export default logger;
