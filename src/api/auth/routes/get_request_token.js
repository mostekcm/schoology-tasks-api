import _ from 'lodash';
import moment from 'moment';
import uuid from 'uuid';
import request from 'superagent';

import logger from '../../../logger';
import config from '../../../config';
import TokenService from '../../../service/TokenService';

export default () => ({
  method: 'GET',
  path: '/api/auth/request_token',
  config: {
    auth: false,
    description: 'Get a request token.',
    tags: ['api']
  },
  handler: (req, reply) => {
    logger.info('Requesting a new request token');

    /* call schoology and get a request token */
    const headers = {
      realm: '""',
      oauth_consumer_key: config('SCHOOLOGY_KEY'),
      oauth_signature_method: 'PLAINTEXT',
      oauth_timestamp: moment().unix(),
      oauth_nonce: uuid.v4(),
      oauth_version: '1.0',
      oauth_signature: `${config('SCHOOLOGY_SECRET')}&`
    };

    const oauthHeader = 'Oauth ' + _(headers).keys().map(key => `${key}=${headers[key]}`).join(', ');

    request
      .get('https://api.schoology.com/v1/oauth/request_token')
      .set('Authorization', oauthHeader)
      .end((err, result) => {
        if (err) return reply(err);
        const tokenService = new TokenService();
        return tokenService.addRefreshToken(result.body)
          .then(() => reply({
            requestToken: result.body.oauth_token
          }));
      });
  }
});
