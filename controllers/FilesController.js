import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { ObjectID } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name, type, isPublic, data, parentId,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }

    const filesCollection = dbClient.db.collection('files');
    if (parentId) {
      const parentObject = new ObjectID(parentId);
      const parent = await filesCollection.findOne({ _id: parentObject });
      if (!parent) {
        res.status(400).json({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    if (type === 'folder') {
      filesCollection.insertOne({
        name,
        type,
        parentId: parentId || 0,
        isPublic: isPublic || false,
        userId,
      }).then((result) => {
        res.status(201).json({
          id: result.insertedId,
          userId,
          name,
          type,
          isPublic: isPublic || false,
          parentId: parentId || 0,
        });
      }).catch((error) => console.log(error));
    }
    const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const fileName = `${filePath}/${uuidv4()}`;
    const buff = Buffer.from(data, 'base64');

    try {
      try {
        await fs.mkdir(filePath, { recursive: true });
      } catch (error) {
        console.log('file exists');
      }
      await fs.writeFile(fileName, buff, 'utf-8');
    } catch (error) {
      console.log(error);
    }

    filesCollection.insertOne({
      name,
      type,
      parentId: parentId || 0,
      isPublic,
      userId,
      localPath: fileName,
    }).then((result) => res.status(201).json({
      id: result.insertedId,
      userId,
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId || 0,
    })).catch((error) => console.log(error));
    return null;
  }

  static async getIndex(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const {
      parentId,
      page,
    } = request.query;
    const pageNum = page || 0;
    const files = dbClient.db.collection('files');
    let query;
    if (!parentId) {
      query = { userId: user._id };
    } else {
      query = { userId: user._id, parentId: ObjectID(parentId) };
    }
    files.aggregate(
      [
        { $match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }, { $addFields: { page: parseInt(pageNum, 10) } }],
            data: [{ $skip: 20 * parseInt(pageNum, 10) }, { $limit: 20 }],
          },
        },
      ],
    ).toArray((err, result) => {
      if (result) {
        const final = result[0].data.map((file) => {
          const tmpFile = {
            ...file,
            id: file._id,
          };
          delete tmpFile._id;
          delete tmpFile.localPath;
          return tmpFile;
        });
        return response.status(200).json(final);
      }
      console.log('Error occured');
      return response.status(404).json({ error: 'Not found' });
    });
    return null;
  }

  static async getShow(request, response) {
    const token = request.header('X-Token');
    if (!token) return response.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = request.params.id;
    const files = dbClient.db.collection('files');
    const idObject = new ObjectID(fileId);
    const file = await files.findOne({ _id: idObject, userId });
    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }
    return response.status(200).json(file);
  }
}

export default FilesController;
