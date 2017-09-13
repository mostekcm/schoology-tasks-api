'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _hapi = require('hapi');

var _hapi2 = _interopRequireDefault(_hapi);

var _hapiAuthJwt = require('hapi-auth-jwt2');

var _hapiAuthJwt2 = _interopRequireDefault(_hapiAuthJwt);

var _hapiCors = require('hapi-cors');

var _hapiCors2 = _interopRequireDefault(_hapiCors);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

var _routes = require('./routes');

var _routes2 = _interopRequireDefault(_routes);

var _auth = require('./auth');

var _auth2 = _interopRequireDefault(_auth);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var corsPlugin = {
  register: _hapiCors2.default,
  options: {
    methods: ['POST, GET, OPTIONS, DELETE, PUT, PATCH'],
    origins: JSON.parse((0, _config2.default)('STA_CORS_ORIGINS'))
  }
};

// Start the server.
var server = new _hapi2.default.Server();
server.connection({
  host: '0.0.0.0',
  port: (0, _config2.default)('PORT'),
  routes: {
    cors: true
  }
});

server.register([_hapiAuthJwt2.default, corsPlugin, _auth2.default, _routes2.default], function (err) {
  _logger2.default.debug('origins: ', (0, _config2.default)('STA_CORS_ORIGINS'));
  if (err) {
    _logger2.default.error(err);
  }

  try {
    server.route([{
      method: 'GET',
      path: '/',
      config: {
        cors: true,
        auth: 'jwt'
      },
      handler: function handler(request, reply) {
        // This is the user object
        // TODO: Is this leaking the token?
        reply(request.auth.credentials);
      }
    }]);
  } catch (e) {
    _logger2.default.error(e.message);
    _logger2.default.error(e.stack);
  }
});

exports.default = server;