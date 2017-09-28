'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _joi = require('joi');

var _joi2 = _interopRequireDefault(_joi);

var _boom = require('boom');

var _boom2 = _interopRequireDefault(_boom);

var _logger = require('../../../logger');

var _logger2 = _interopRequireDefault(_logger);

var _UserService = require('../../../service/UserService');

var _UserService2 = _interopRequireDefault(_UserService);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function () {
  return {
    method: 'POST',
    path: '/api/auth/creds',
    config: {
      auth: {
        strategies: ['jwt'],
        scope: ['post:creds']
      },
      description: 'Store token',
      tags: ['api'],
      validate: {
        payload: {
          user: _joi2.default.string().max(1000).allow('').default(''),
          key: _joi2.default.string().max(1000).allow('').default('')
        }
      }
    },
    handler: function handler(req, reply) {
      _logger2.default.info('Posting tokens for ', req.payload.user);

      var user = req.auth.credentials.usersMap[req.payload.user];

      if (!user) {
        return reply(_boom2.default.forbidden('You do not have permission to view \'' + req.payload.user + '\''));
      }

      var userService = new _UserService2.default();
      userService.encryptToken(user).then(function () {
        return reply({ message: 'success' });
      }).catch(function (err) {
        _logger2.default.error('Failed to encrypt because: ' + err.message);
        return reply(_boom2.default.badImplementation(err.message));
      });

      return null;
    }
  };
};