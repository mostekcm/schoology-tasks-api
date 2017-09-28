import _ from 'lodash';
import moment from 'moment';
import uuid from 'uuid';
import request from 'superagent';

import logger from '../../../logger';
import config from '../../../config';
import TokenService from '../../../service/TokenService';

export default () => ({
  method: 'POST',
  path: '/api/auth/access_token',
  config: {
    auth: false,
    description: 'Create an access token.',
    tags: ['api']
  },
  handler: (req, reply) => {
    logger.info('Requesting a new access token: ', req.payload);

    const tokenService = new TokenService();
    return tokenService.getRefreshTokenSecret(req.payload.request_token)
      .then((secret) => {
        logger.info('got RT secret: ', secret);
        /* call schoology and get a request token */
        const headers = {
          realm: '""',
          oauth_consumer_key: config('SCHOOLOGY_KEY'),
          oauth_signature_method: 'PLAINTEXT',
          oauth_timestamp: moment().unix(),
          oauth_nonce: uuid.v4(),
          oauth_token: req.payload.request_token,
          oauth_version: '1.0',
          oauth_signature: `${config('SCHOOLOGY_SECRET')}&${secret}`
        };

        const oauthHeader = 'Oauth ' + _(headers).keys().map(key => `${key}=${headers[key]}`).join(', ');

        request
          .get('https://api.schoology.com/v1/oauth/access_token')
          .set('Authorization', oauthHeader)
          .end((err, result) => {
            if (err) {
              logger.error(`Could not get access tokens because: ${err.message}`);
              return reply(err);
            }
            return tokenService.addAccessToken(result.body)
              .then(() => reply({
                accessToken: result.body.oauth_token
              }));
          });
      })
      .catch((err) => {
        logger.error('Could not get RT secret because: ' + err.message);
        return reply(err);
      });
  }
});
