'use strict';

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _server = require('./server');

var _server2 = _interopRequireDefault(_server);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var env = (0, _config2.default)('NODE_ENV');
var port = (0, _config2.default)('PORT');
_server2.default.start(function (err) {
  if (err) _logger2.default.error(err);else _logger2.default.info('Backend server listening on port ' + port + ' in ' + env + ' mode');
});