import jwks from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import Boom from 'boom';
import _ from 'lodash';
import crypto from 'crypto';
import logger from './logger';
import config from './config';

const validateUser = (decoded, request, callback) => {
  logger.info('Validating user:', decoded);

  if (decoded && decoded.sub) {
    return callback(null, true);
  }

  return callback(null, false);
};

const jwtOptions = {
  // Dynamically provide a signing key based on the kid in the header and the singing keys provided by the JWKS endpoint.
  key: jwks.hapiJwt2Key({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 2,
    jwksUri: `https://${config('AUTH0_DOMAIN')}/.well-known/jwks.json`
  }),

  // Validate the audience and the issuer.
  verifyOptions: {
    audience: config('AUDIENCE'),
    issuer: `https://${config('AUTH0_DOMAIN')}/`,
    algorithms: ['RS256']
  }
};

const verifyFunc = (decoded, req, callback) => {
  if (!decoded) {
    return callback(null, false);
  }
  const header = req.headers.authorization;
  if (header && header.indexOf('Bearer ') === 0) {
    const token = header.split(' ')[1];
    if (decoded && decoded.payload && decoded.payload.iss === `https://${config('AUTH0_DOMAIN')}/`) {
      return jwtOptions.key(decoded, (keyErr, key) => {
        if (keyErr) {
          return callback(Boom.wrap(keyErr), null, null);
        }

        return jwt.verify(token, key, jwtOptions.verifyOptions, (err) => {
          if (err) {
            return callback(Boom.unauthorized('Invalid token', 'Token'), null, null);
          }

          if (decoded.payload.scope && typeof decoded.payload.scope === 'string') {
            decoded.payload.scope = decoded.payload.scope.split(' '); // eslint-disable-line no-param-reassign
          }

          /* create the usersMap */
          decoded.payload.usersMap = {};
          const claimKey = 'http://schoology-tasks-api/key/';
          const claimUid = 'http://schoology-tasks-api/uid/';
          const claims = _(decoded.payload).keys().filter(claim => claim.startsWith(claimKey)).value();
          claims.forEach((claim) => {
            const userName = claim.substr(claimKey.length);
            const user = {
              uid: decoded.payload[claimUid + userName],
              key: decoded.payload[claimKey + userName]
            };

            /* decrypt the key */
            const decipher = crypto.createDecipher('aes192', config('USER_KEY_SECRET'));
            let decrypted = decipher.update(user.key, 'hex', 'utf8');
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

const register = (server, options, next) => {
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

export default register;
