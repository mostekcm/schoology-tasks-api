'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _logger = require('../../../logger');

var _logger2 = _interopRequireDefault(_logger);

var _config = require('../../../config');

var _config2 = _interopRequireDefault(_config);

var _TokenService = require('../../../service/TokenService');

var _TokenService2 = _interopRequireDefault(_TokenService);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function () {
  return {
    method: 'POST',
    path: '/api/auth/access_token',
    config: {
      auth: false,
      description: 'Create an access token.',
      tags: ['api']
    },
    handler: function handler(req, reply) {
      _logger2.default.info('Requesting a new access token: ', req.payload);

      var tokenService = new _TokenService2.default();
      return tokenService.getRefreshTokenSecret(req.payload.request_token).then(function (secret) {
        _logger2.default.info('got RT secret: ', secret);
        /* call schoology and get a request token */
        var headers = {
          realm: '""',
          oauth_consumer_key: (0, _config2.default)('SCHOOLOGY_KEY'),
          oauth_signature_method: 'PLAINTEXT',
          oauth_timestamp: (0, _moment2.default)().unix(),
          oauth_nonce: _uuid2.default.v4(),
          oauth_token: req.payload.request_token,
          oauth_version: '1.0',
          oauth_signature: (0, _config2.default)('SCHOOLOGY_SECRET') + '&' + secret
        };

        var oauthHeader = 'Oauth ' + (0, _lodash2.default)(headers).keys().map(function (key) {
          return key + '=' + headers[key];
        }).join(', ');

        _superagent2.default.get('https://api.schoology.com/v1/oauth/access_token').set('Authorization', oauthHeader).end(function (err, result) {
          if (err) {
            _logger2.default.error('Could not get access tokens because: ' + err.message);
            return reply(err);
          }
          return tokenService.addAccessToken(result.body).then(function () {
            return reply({
              accessToken: result.body.oauth_token
            });
          });
        });
      }).catch(function (err) {
        _logger2.default.error('Could not get RT secret because: ' + err.message);
        return reply(err);
      });
    }
  };
};