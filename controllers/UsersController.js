import { ObjectID } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const sha1 = require('sha1');

class UsersController {
  static postNew(request, response) {
    const { email } = request.body;
    let { password } = request.body;

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
        password = sha1(password);
        users.insertOne({ email, password })
          .then((result) => {
            console.log(`user added to database ${result}`);
            response.status(201).json({ id: result.insertedId, email });
          }).catch((error) => console.error(error));
      }
    });
  }

  static async getMe(request, response) {
    const token = request.headers['x-token'];
    if (!token) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    console.log(` token ===  ${token}`);
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    console.log(` user ID ===  ${userId}`);

    const idObject = new ObjectID(userId);
    const user = await dbClient.db.collection('users').findOne({ _id: idObject });
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    console.log(` user ===  ${user}`);

    return response.status(200).json({ email: user.email, id: user._id });
  }
}

module.exports = UsersController;
