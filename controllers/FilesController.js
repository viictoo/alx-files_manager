import { ObjectID } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async getUser(request) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const sessionID = await redisClient.get(key);
    if (sessionID) {
      const users = dbClient.db.collection('users');
      const mongoID = new ObjectID(sessionID);
      const user = users.findOne({ _id: mongoID });
      if (user) return user;
      return null;
    }
    return null;
  }

  static async postUpload(req, res) {
    const user = await FilesController.getUser(req, res);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
    }
    // eslint demands new line object-curly-newline: ["error", "never"]
    const {
      name, parentId, type, data,
    } = req.body;
    const { isPublic } = req.body.isPublic || false;

    if (!name) {
      res.status(400).json({ error: 'Missing name' });
    }
    if (!type) {
      res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      res.status(400).json({ error: 'Missing data' });
    }

    const dbfiles = dbClient.db.collection('files');
    if (parentId) {
      const mongoObj = new ObjectID(parentId);
      const parent = await dbfiles.findOne({ _id: mongoObj });
      if (!parent) {
        res.status(400).json({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    if (type === 'folder') {
      dbfiles.insertOne({
        userId: user._id,
        name,
        type,
        parentId: parentId || 0,
        isPublic,
      }).then((file) => {
        res.status(201).json({
          id: file.insertedId,
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
        });
      }).catch((error) => console.log(error));
    } else {
      const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const fileName = `${filePath}/${uuidv4()}`;
      const buff = Buffer.from(data, 'base64');

      try {
        try {
          await fs.mkdir(filePath, { recursive: true });
        } catch (error) {
          console.error(`file exists ${error}`);
        }
        await fs.writeFile(fileName, buff, 'utf-8');
      } catch (error) {
        console.log(error);
      }

      dbfiles.insertOne({
        userId: user._id,
        name,
        type,
        parentId: parentId || 0,
        isPublic,
        localPath: fileName,
      }).then((result) => {
        res.status(201).json({
          id: result.insertedId,
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
        });
      }).catch((error) => console.log(error));
    }
    return null;
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { parentId = 0, page = 0 } = req.query;
    const files = dbClient.db.collection('files');
    const result = await files.aggregate([
      { $match: { userId, parentId: new ObjectID(parentId) } },
      { $skip: page * 20 },
      { $limit: 20 },
    ]).toArray();
    res.status(200).json(result);
  }

  static async getShow(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params;
    const files = dbClient.db.collection('files');
    const mongoID = new ObjectID(id);
    const file = await files.findOne({ _id: mongoID, userId: user._id });
    if (!file) return response.status(404).json({ error: 'Not found' });
    return response.status(200).json(file);
  }
}

export default FilesController;
