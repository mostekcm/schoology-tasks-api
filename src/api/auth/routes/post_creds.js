import Joi from 'joi';
import Boom from 'boom';

import logger from '../../../logger';
import UserService from '../../../service/UserService';

export default () => ({
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
        user: Joi.string().max(1000).allow('').default(''),
        key: Joi.string().max(1000).allow('').default('')
      }
    }
  },
  handler: (req, reply) => {
    logger.info('Posting tokens for ', req.payload.user);

    const user = req.auth.credentials.usersMap[req.payload.user];

    if (!user) {
      return reply(Boom.forbidden(`You do not have permission to view '${req.payload.user}'`));
    }

    const userService = new UserService();
    userService.encryptToken(user)
      .then(() => reply({ message: 'success' }))
      .catch((err) => {
        logger.error(`Failed to encrypt because: ${err.message}`);
        return reply(Boom.badImplementation(err.message));
      });

    return null;
  }
});
