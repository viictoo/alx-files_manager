// import mongodb from 'mongodb';
const { MongoClient } = require('mongodb');
const process = require('process')
// import { MongoClient } from 'mongodb/lib/mongo_client';
// import Collection from 'mongodb/lib/collection';
// import envLoader from './env_loader';

class DBClient {
  constructor () {
    // envLoader();
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const dbName = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}/${dbName}`;

    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.client.connect();
  }

  // returns true when the connection to MongoDB is a success otherwise, false
  isAlive () {
    return this.client.isConnected();
  }

  // returns the number of documents in the collection users
  async nbUsers () {
    return this.client.db().collection('users').countDocuments();
  }

  // returns the number of documents in the collection files
  async nbFiles () {
    return this.client.db().collection('files').countDocuments();
  }
}

// create and export an instance of DBClient called dbClient
export const dbClient = new DBClient();
export default dbClient;
