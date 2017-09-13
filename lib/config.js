'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (key) {
  return nconf.get(key);
};

var _dotenv = require('dotenv');

var dotenv = _interopRequireWildcard(_dotenv);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var nconf = require('nconf');

/* Make sure you process dotenv before nconf! */
/*
 config.js just simplifies and encapsulates the access to
 */

// Initialize process.env to have anything stored in .env
dotenv.config();
nconf.env().defaults({
  PORT: 3002,
  NODE_ENV: 'dev',
  BFD_LOG_LEVEL: 'info'
});