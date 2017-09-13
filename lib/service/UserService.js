'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _mongodb = require('mongodb');

var _mongodb2 = _interopRequireDefault(_mongodb);

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
    value: function getUser(uid) {
      return this.getDb().then(function (db) {
        return db.collection('users').findOne({
          uid: uid
        });
      });
    }
  }]);

  return UserService;
}();

exports.default = UserService;