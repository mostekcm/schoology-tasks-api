import mongo from 'mongodb';
import moment from 'moment';

import logger from '../logger';
import config from '../config';

export default class TaskService {
  constructor() {
    this.db = null;
  }

  getDb() {
    if (this.db !== null) {
      logger.debug('Using cached db');
      return Promise.resolve(this.db);
    }

    const me = this;

    return mongo.MongoClient.connect(config('MONGODB_URI'))
      .then((db) => {
        me.db = db;
        return db;
      });
  }

  init() {
    return this.getDb().then(() => true);
  }

  getRefreshTokenSecret(token) {
    return this.getDb()
      .then(db => db.collection('refreshTokens')
        .deleteMany({
          expiresAt: { $gt: moment().unix() }
        })
        .then(() => {
          const tokens = db.collection('refreshTokens')
            .findOne({
              oauth_token: token
            });
          return tokens;
        }))
      .then(obj => obj.oauth_token_secret);
  }

  addRefreshToken(token) {
    token.expiresAt = moment().unix() + token.xoauth_token_ttl;
    return this.getDb()
      .then(db => db.collection('refreshTokens')
        .insertOne(token));
  }

  getAccessTokenSecret(token) {
    return this.getDb()
      .then(db => db.collection('accessTokens')
        .deleteMany({
          expiresAt: { $gt: moment().unix() }
        })
        .then(() => db.collection('accessTokens').findOne({
          oauth_token: token
        })))
      .then(obj => obj.oauth_token_secret);
  }

  addAccessToken(token) {
    token.expiresAt = moment().unix() + token.xoauth_token_ttl;
    return this.getDb()
      .then(db => db.collection('accessTokens')
        .insertOne(token));
  }
}
