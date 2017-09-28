import mongo from 'mongodb';
import crypto from 'crypto';

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

  getUser(user) {
    return this.getDb()
      .then(db => db.collection('users')
        .findOne({
          uid: user.uid
        }))
      .then((dbUser) => {
        const compKey = config('CORE_SECRET') + user.key;
        const decipher = crypto.createDecipher('aes192', compKey);
        let decrypted = decipher.update(dbUser.encSecret, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        dbUser.secret = decrypted;
        return dbUser;
      })
      .catch((err) => {
        logger.error('Error getting user tokens: ', err.message);
        logger.error(err);
      });
  }

  encryptToken(user) {
    return this.getDb()
      .then((db) => {
        const userFilter = {
          uid: user.uid
        };

        db.collection('users')
          .findOne(userFilter)
          .then((dbUser) => {
            if (dbUser.secret) {
              const compKey = config('CORE_SECRET') + user.key;
              const cipher = crypto.createCipher('aes192', compKey);
              let encrypted = cipher.update(dbUser.secret, 'utf8', 'hex');
              encrypted += cipher.final('hex');

              return db.collection('users')
                .updateOne(userFilter, { $set: { encSecret: encrypted }, $unset: { secret: 1 } });
            }

            return null;
          });
      });
  }
}
