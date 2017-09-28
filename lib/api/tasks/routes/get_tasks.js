'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _joi = require('joi');

var _joi2 = _interopRequireDefault(_joi);

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
    path: '/api/tasks',
    config: {
      auth: false,
      // auth: {
      //   strategies: ['jwt'],
      //   scope: ['read:tasks']
      // },
      description: 'Get all tasks in the system.',
      tags: ['api'],
      validate: {
        query: {
          q: _joi2.default.string().max(1000).allow('').default(''),
          field: _joi2.default.string().max(1000).allow('').default('')
        }
      }
    },
    handler: function handler(req, reply) {
      _logger2.default.info('Requesting tasks');

      var tokenService = new _TokenService2.default();
      return tokenService.getAccessTokenSecret(req.payload.accessToken).then(function (secret) {
        _logger2.default.info('got access token secret: ' + secret);
        /* call schoology and get a request token */
        var headers = {
          realm: '""',
          oauth_consumer_key: (0, _config2.default)('SCHOOLOGY_KEY'),
          oauth_signature_method: 'PLAINTEXT',
          oauth_timestamp: (0, _moment2.default)().unix(),
          oauth_nonce: _uuid2.default.v4(),
          oauth_token: req.payload.accessToken,
          oauth_version: '1.0',
          oauth_signature: (0, _config2.default)('SCHOOLOGY_SECRET') + '&' + secret
        };

        var oauthHeader = 'Oauth ' + (0, _lodash2.default)(headers).keys().map(function (key) {
          return key + '=' + headers[key];
        }).join(', ');

        try {
          _superagent2.default.get('https://api.schoology.com/v1/users/me').set('Authorization', oauthHeader).set('Accept', 'application/json').end(function (err, result) {
            if (err) {
              _logger2.default.error('Could not get tasks because: ' + err.message + ', ' + result.body);
              return reply(err);
            }
            return reply(result.body);
          });
        } catch (err) {
          _logger2.default.error('request threw exception: ' + err.message);
          return reply(err);
        }

        return null;
      });
    }
  };
};