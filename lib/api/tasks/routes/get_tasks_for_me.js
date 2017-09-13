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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function () {
  return {
    method: 'GET',
    path: '/api/tasks/me',
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
          url: _joi2.default.string().max(1000).allow('').default(''),
          q: _joi2.default.string().max(1000).allow('').default(''),
          field: _joi2.default.string().max(1000).allow('').default('')
        }
      }
    },
    handler: function handler(req, reply) {
      _logger2.default.info('Requesting tasks for me');

      /* call schoology and get a request token */
      var headers = {
        oauth_consumer_key: (0, _config2.default)('SCHOOLOGY_KEY'),
        oauth_signature_method: 'PLAINTEXT',
        oauth_timestamp: (0, _moment2.default)().unix(),
        oauth_nonce: _uuid2.default.v4(),
        oauth_version: '1.0'
      };

      var oauthHeader = 'Oauth realm="Schoology API", ' + (0, _lodash2.default)(headers).keys().sort().map(function (key) {
        return key + '=' + headers[key];
      }).join(', ') + (', oauth_signature=' + (0, _config2.default)('SCHOOLOGY_SECRET') + '%26');

      console.log('oauth header: ' + oauthHeader);
      try {
        _superagent2.default.get('https://api.schoology.com/v1/' + req.query.url)
        // .get('https://api.schoology.com/v1/users/me')
        .set('Authorization', oauthHeader).set('Accept', 'application/json').end(function (err, result) {
          if (err) {
            _logger2.default.error('Could not get ' + req.query.url + ' because: ' + err.message + ', ' + result.body);
            console.log('result: ', result.body, result.text);
            return reply({ message: err.message, body: result.body, text: result.text });
          }
          return reply(result.body);
        });
      } catch (err) {
        _logger2.default.error('request threw exception: ' + err.message);
        return reply(err);
      }

      return null;
    }
  };
};