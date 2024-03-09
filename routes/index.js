import { Router } from 'express';
import AppController from '../controllers/AppController';

const router = Router();

router.get('/status', AppController.status);

router.get('/stats', AppController.stats);

export default Router;
