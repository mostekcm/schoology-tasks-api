import _ from 'lodash';
import Joi from 'joi';
import moment from 'moment';
import uuid from 'uuid';
import request from 'superagent';
import logger from '../../../logger';
import config from '../../../config';
import TokenService from '../../../service/TokenService';

export default () => ({
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
        q: Joi.string().max(1000).allow('').default(''),
        field: Joi.string().max(1000).allow('').default('')
      }
    }
  },
  handler: (req, reply) => {
    logger.info('Requesting tasks');

    const tokenService = new TokenService();
    return tokenService.getAccessTokenSecret(req.payload.accessToken)
      .then((secret) => {
        logger.info('got access token secret: ' + secret);
        /* call schoology and get a request token */
        const headers = {
          realm: '""',
          oauth_consumer_key: config('SCHOOLOGY_KEY'),
          oauth_signature_method: 'PLAINTEXT',
          oauth_timestamp: moment().unix(),
          oauth_nonce: uuid.v4(),
          oauth_token: req.payload.accessToken,
          oauth_version: '1.0',
          oauth_signature: `${config('SCHOOLOGY_SECRET')}&${secret}`
        };

        const oauthHeader = 'Oauth ' + _(headers).keys().map(key => `${key}=${headers[key]}`).join(', ');

        console.log('oauth header: ' + oauthHeader);
        try {
          request
            .get('https://api.schoology.com/v1/users/me')
            .set('Authorization', oauthHeader)
            .set('Accept', 'application/json')
            .end((err, result) => {
              if (err) {
                logger.error(`Could not get tasks because: ${err.message}, ${result.body}`);
                console.log('result: ', result.body, result.text);
                return reply(err);
              }
              return reply(result.body);
            });
        } catch (err) {
          logger.error('request threw exception: ' + err.message);
          return reply(err);
        }

        return null;
      });
  }
});
