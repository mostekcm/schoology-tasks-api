import _ from 'lodash';
import Joi from 'joi';
import moment from 'moment';
import uuid from 'uuid';
import request from 'superagent';
import logger from '../../../logger';
import config from '../../../config';

export default () => ({
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
        url: Joi.string().max(1000).allow('').default(''),
        q: Joi.string().max(1000).allow('').default(''),
        field: Joi.string().max(1000).allow('').default('')
      }
    }
  },
  handler: (req, reply) => {
    logger.info('Requesting tasks for me');

    /* call schoology and get a request token */
    const headers = {
      oauth_consumer_key: config('SCHOOLOGY_KEY'),
      oauth_signature_method: 'PLAINTEXT',
      oauth_timestamp: moment().unix(),
      oauth_nonce: uuid.v4(),
      oauth_version: '1.0'
    };

    const oauthHeader = 'Oauth realm="Schoology API", ' +
      _(headers)
        .keys()
        .sort()
        .map(key => `${key}=${headers[key]}`)
        .join(', ') +
      `, oauth_signature=${config('SCHOOLOGY_SECRET')}%26`;

    try {
      request
        .get('https://api.schoology.com/v1/' + req.query.url)
        // .get('https://api.schoology.com/v1/users/me')
        .set('Authorization', oauthHeader)
        .set('Accept', 'application/json')
        .end((err, result) => {
          if (err) {
            logger.error(`Could not get ${req.query.url} because: ${err.message}, ${result.body}`);
            return reply({ message: err.message, body: result.body, text: result.text });
          }
          return reply(result.body);
        });
    } catch (err) {
      logger.error('request threw exception: ' + err.message);
      return reply(err);
    }

    return null;
  }
});
