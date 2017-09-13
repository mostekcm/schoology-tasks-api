/*
 config.js just simplifies and encapsulates the access to
 */

// Initialize process.env to have anything stored in .env
import * as dotenv from 'dotenv';

var nconf = require('nconf');

/* Make sure you process dotenv before nconf! */
dotenv.config();
nconf
  .env()
  .defaults({
    PORT: 3002,
    NODE_ENV: 'dev',
    BFD_LOG_LEVEL: 'info'
  });

export default function(key) {
  return nconf.get(key);
}
