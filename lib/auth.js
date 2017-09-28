'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _jwksRsa = require('jwks-rsa');

var _jwksRsa2 = _interopRequireDefault(_jwksRsa);

var _jsonwebtoken = require('jsonwebtoken');

var _jsonwebtoken2 = _interopRequireDefault(_jsonwebtoken);

var _boom = require('boom');

var _boom2 = _interopRequireDefault(_boom);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var validateUser = function validateUser(decoded, request, callback) {
  _logger2.default.info('Validating user:', decoded);

  if (decoded && decoded.sub) {
    return callback(null, true);
  }

  return callback(null, false);
};

var jwtOptions = {
  // Dynamically provide a signing key based on the kid in the header and the singing keys provided by the JWKS endpoint.
  key: _jwksRsa2.default.hapiJwt2Key({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 2,
    jwksUri: 'https://' + (0, _config2.default)('AUTH0_DOMAIN') + '/.well-known/jwks.json'
  }),

  // Validate the audience and the issuer.
  verifyOptions: {
    audience: (0, _config2.default)('AUDIENCE'),
    issuer: 'https://' + (0, _config2.default)('AUTH0_DOMAIN') + '/',
    algorithms: ['RS256']
  }
};

var verifyFunc = function verifyFunc(decoded, req, callback) {
  if (!decoded) {
    return callback(null, false);
  }
  var header = req.headers.authorization;
  if (header && header.indexOf('Bearer ') === 0) {
    var token = header.split(' ')[1];
    if (decoded && decoded.payload && decoded.payload.iss === 'https://' + (0, _config2.default)('AUTH0_DOMAIN') + '/') {
      return jwtOptions.key(decoded, function (keyErr, key) {
        if (keyErr) {
          return callback(_boom2.default.wrap(keyErr), null, null);
        }

        return _jsonwebtoken2.default.verify(token, key, jwtOptions.verifyOptions, function (err) {
          if (err) {
            return callback(_boom2.default.unauthorized('Invalid token', 'Token'), null, null);
          }

          if (decoded.payload.scope && typeof decoded.payload.scope === 'string') {
            decoded.payload.scope = decoded.payload.scope.split(' '); // eslint-disable-line no-param-reassign
          }

          /* create the usersMap */
          decoded.payload.usersMap = {};
          var claimKey = 'http://schoology-tasks-api/key/';
          var claimUid = 'http://schoology-tasks-api/uid/';
          var claims = (0, _lodash2.default)(decoded.payload).keys().filter(function (claim) {
            return claim.startsWith(claimKey);
          }).value();
          claims.forEach(function (claim) {
            var userName = claim.substr(claimKey.length);
            var user = {
              uid: decoded.payload[claimUid + userName],
              key: decoded.payload[claimKey + userName]
            };

            /* decrypt the key */
            var decipher = _crypto2.default.createDecipher('aes192', (0, _config2.default)('USER_KEY_SECRET'));
            var decrypted = decipher.update(user.key, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            user.key = decrypted;

            decoded.payload.usersMap[userName] = user;
          });
          return callback(null, true, decoded.payload);
        });
      });
    }
  }

  return callback(null, false);
};

var register = function register(server, options, next) {
  server.auth.strategy('jwt', 'jwt', {
    // Get the complete decoded token, because we need info from the header (the kid)
    complete: true,

    // Your own logic to validate the user.
    validateFunc: validateUser,

    // Our own verify function because the hapi one is no good
    verifyFunc: verifyFunc

  });

  server.auth.default('jwt');

  next();
};

register.attributes = {
  name: 'auth'
};

exports.default = register;