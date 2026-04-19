import { Router } from 'express';
import * as notifications from '../controllers/notificationController';
import { authenticate } from '../middleware';

const router = Router();

router.use(authenticate);

router.get('/', notifications.getNotifications);
router.put('/:id/read', notifications.markAsRead);
router.put('/read-all', notifications.markAllAsRead);
router.get('/activity/:tripId', notifications.getActivityFeed);

export default router;
