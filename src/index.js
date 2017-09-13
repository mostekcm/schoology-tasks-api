import config from './config';
import logger from './logger';
import backend from './server';

const env = config('NODE_ENV');
const port = config('PORT');
backend.start(function(err) {
  if (err) logger.error(err);
  else logger.info(`Backend server listening on port ${port} in ${env} mode`);
});
