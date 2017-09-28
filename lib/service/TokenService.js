'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _mongodb = require('mongodb');

var _mongodb2 = _interopRequireDefault(_mongodb);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _logger = require('../logger');

var _logger2 = _interopRequireDefault(_logger);

var _config = require('../config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TaskService = function () {
  function TaskService() {
    _classCallCheck(this, TaskService);

    this.db = null;
  }

  _createClass(TaskService, [{
    key: 'getDb',
    value: function getDb() {
      if (this.db !== null) {
        _logger2.default.debug('Using cached db');
        return Promise.resolve(this.db);
      }

      var me = this;

      return _mongodb2.default.MongoClient.connect((0, _config2.default)('MONGO_URI')).then(function (db) {
        me.db = db;
        return db;
      });
    }
  }, {
    key: 'init',
    value: function init() {
      return this.getDb().then(function () {
        return true;
      });
    }
  }, {
    key: 'getRefreshTokenSecret',
    value: function getRefreshTokenSecret(token) {
      return this.getDb().then(function (db) {
        return db.collection('refreshTokens').deleteMany({
          expiresAt: { $gt: (0, _moment2.default)().unix() }
        }).then(function () {
          var tokens = db.collection('refreshTokens').findOne({
            oauth_token: token
          });
          return tokens;
        });
      }).then(function (obj) {
        return obj.oauth_token_secret;
      });
    }
  }, {
    key: 'addRefreshToken',
    value: function addRefreshToken(token) {
      token.expiresAt = (0, _moment2.default)().unix() + token.xoauth_token_ttl;
      return this.getDb().then(function (db) {
        return db.collection('refreshTokens').insertOne(token);
      });
    }
  }, {
    key: 'getAccessTokenSecret',
    value: function getAccessTokenSecret(token) {
      return this.getDb().then(function (db) {
        return db.collection('accessTokens').deleteMany({
          expiresAt: { $gt: (0, _moment2.default)().unix() }
        }).then(function () {
          return db.collection('accessTokens').findOne({
            oauth_token: token
          });
        });
      }).then(function (obj) {
        return obj.oauth_token_secret;
      });
    }
  }, {
    key: 'addAccessToken',
    value: function addAccessToken(token) {
      token.expiresAt = (0, _moment2.default)().unix() + token.xoauth_token_ttl;
      return this.getDb().then(function (db) {
        return db.collection('accessTokens').insertOne(token);
      });
    }
  }]);

  return TaskService;
}();

exports.default = TaskService;