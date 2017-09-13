import Hapi from 'hapi';
import jwt from 'hapi-auth-jwt2';
import cors from 'hapi-cors';

import logger from './logger';
import config from './config';
import routes from './routes';
import auth from './auth';

const corsPlugin = {
  register: cors,
  options: {
    methods: ['POST, GET, OPTIONS, DELETE, PUT, PATCH'],
    origins: JSON.parse(config('STA_CORS_ORIGINS'))
  }
};

// Start the server.
const server = new Hapi.Server();
server.connection({
  host: '0.0.0.0',
  port: config('PORT'),
  routes: {
    cors: true
  }
});

server.register([jwt, corsPlugin, auth, routes], (err) => {
  logger.debug('origins: ', config('STA_CORS_ORIGINS'));
  if (err) {
    logger.error(err);
  }

  try {
    server.route([
      {
        method: 'GET',
        path: '/',
        config: {
          cors: true,
          auth: 'jwt'
        },
        handler: (request, reply) => {
          // This is the user object
          // TODO: Is this leaking the token?
          reply(request.auth.credentials);
        }
      }
    ]);
  } catch (e) {
    logger.error(e.message);
    logger.error(e.stack);
  }
});

export default server;
