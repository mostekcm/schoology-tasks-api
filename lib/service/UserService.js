'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _mongodb = require('mongodb');

var _mongodb2 = _interopRequireDefault(_mongodb);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _logger = require('../logger');

var _logger2 = _interopRequireDefault(_logger);

var _config = require('../config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var UserService = function () {
  function UserService() {
    _classCallCheck(this, UserService);

    this.db = null;
  }

  _createClass(UserService, [{
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
    key: 'getUser',
    value: function getUser(user) {
      return this.getDb().then(function (db) {
        return db.collection('users').findOne({
          uid: user.uid
        });
      }).then(function (dbUser) {
        var compKey = (0, _config2.default)('CORE_SECRET') + user.key;
        var decipher = _crypto2.default.createDecipher('aes192', compKey);
        var decrypted = decipher.update(dbUser.encSecret, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        dbUser.secret = decrypted;
        return dbUser;
      }).catch(function (err) {
        _logger2.default.error('Error getting user tokens: ', err.message);
        _logger2.default.error(err);
      });
    }
  }, {
    key: 'encryptToken',
    value: function encryptToken(user) {
      return this.getDb().then(function (db) {
        var userFilter = {
          uid: user.uid
        };

        db.collection('users').findOne(userFilter).then(function (dbUser) {
          if (dbUser.secret) {
            var compKey = (0, _config2.default)('CORE_SECRET') + user.key;
            var cipher = _crypto2.default.createCipher('aes192', compKey);
            var encrypted = cipher.update(dbUser.secret, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            return db.collection('users').updateOne(userFilter, { $set: { encSecret: encrypted }, $unset: { secret: 1 } });
          }

          return null;
        });
      });
    }
  }]);

  return UserService;
}();

exports.default = UserService;