import mongo from 'mongodb';

import logger from '../logger';
import config from '../config';

export default class UserService {
  constructor() {
    this.db = null;
  }

  getDb() {
    if (this.db !== null) {
      logger.debug('Using cached db');
      return Promise.resolve(this.db);
    }

    const me = this;

    return mongo.MongoClient.connect(config('MONGO_URI'))
      .then((db) => {
        me.db = db;
        return db;
      });
  }

  init() {
    return this.getDb().then(() => true);
  }

  getUser(uid) {
    return this.getDb()
      .then(db => db.collection('users')
        .findOne({
          uid
        }));
  }
}
