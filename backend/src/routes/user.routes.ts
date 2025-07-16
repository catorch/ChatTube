import { Router } from 'express';
import { UsersController } from '../controllers/user.controller';
import { authenticateUser } from '../middlewares/user.middleware';

const router = Router();

// Apply authentication middleware to all routes in this file
router.use(authenticateUser);


export default router; 