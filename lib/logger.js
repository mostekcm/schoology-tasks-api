'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var winston = require('winston');

winston.emitErrs = true;

var logger = new winston.Logger({
  transports: [new winston.transports.Console({
    timestamp: true,
    level: (0, _config2.default)('LOG_LEVEL'),
    handleExceptions: true,
    json: false,
    colorize: true
  })],
  exitOnError: false
});

exports.default = logger;