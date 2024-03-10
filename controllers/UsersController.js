import { ObjectID } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const sha1 = require('sha1');

class UsersController {
  static postNew(request, response) {
    const { email } = request.body;
    const { password } = request.body;

    if (!email) {
      response.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      response.status(400).json({ error: 'Missing password' });
      return;
    }

    const users = dbClient.db.collection('users');
    users.findOne({ email }, (err, user) => {
      if (user) {
        response.status(400).json({ error: 'Already exist' });
      } else {
        const hashpassword = sha1(password);
        users.insertOne({ email, password: hashpassword })
          .then((newUser) => {
            console.log(`user added to database ${newUser}`);
            response.status(201).json({ id: newUser.insertedId, email });
          }).catch((error) => console.error(error));
      }
    });
  }

  static async getMe(request, response) {
    const token = request.headers('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const idObject = new ObjectID(userId);
    const user = await dbClient.db.collection('users').findOne({ _id: idObject });
    if (!user) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }
    response.status(200).json({ id: user._id, email: user.email });
  }
}

module.exports = UsersController;
