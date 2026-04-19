import { Router } from 'express';
import * as trips from '../controllers/tripController';
import { authenticate, optionalAuth, validate } from '../middleware';
import { createTripSchema, updateTripSchema, idParamSchema } from '../validators';

const router = Router();

// Public route (no auth needed)
router.get('/:id/public', optionalAuth, trips.getPublicTrip);

// Protected routes
router.use(authenticate);

router.post('/', validate({ body: createTripSchema }), trips.createTrip);
router.get('/', trips.getTrips);
router.post('/sync-statuses', trips.syncTripStatuses);
router.get('/:id', validate({ params: idParamSchema }), trips.getTrip);
router.put('/:id', validate({ params: idParamSchema, body: updateTripSchema }), trips.updateTrip);
router.delete('/:id', validate({ params: idParamSchema }), trips.deleteTrip);

// Members
router.post('/:id/members', trips.addTripMember);
router.post('/join/:code', trips.joinTripByCode);

export default router;
