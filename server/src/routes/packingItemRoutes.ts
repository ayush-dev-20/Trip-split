import { Router } from 'express';
import * as packing from '../controllers/packingItemController';
import { authenticate, validate, requireFeature } from '../middleware';
import { createPackingItemSchema, updatePackingItemSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.get('/:tripId/packing-items', packing.getPackingItems);
router.post('/:tripId/packing-items', validate({ body: createPackingItemSchema }), packing.createPackingItem);
router.post('/:tripId/packing-items/generate', requireFeature('aiPackingList'), packing.generatePackingItems);
router.delete('/:tripId/packing-items', packing.deleteAllPackingItems);
router.patch('/:tripId/packing-items/:id', validate({ body: updatePackingItemSchema }), packing.updatePackingItem);
router.delete('/:tripId/packing-items/:id', packing.deletePackingItem);

export default router;
