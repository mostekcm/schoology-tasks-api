import logger from '../src/logger';

describe('#logger', () => {
  it('should write log', (done) => {
    logger.debug('some info');
    logger.info('some info');
    logger.warn('some info');
    logger.error('some info');
    done();
  });
});
