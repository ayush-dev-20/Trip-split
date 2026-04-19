import { Router } from 'express';
import * as checkpoint from '../controllers/checkpointController';
import { authenticate, validate } from '../middleware';
import {
  createCheckpointSchema,
  createCheckpointsBulkSchema,
  updateCheckpointSchema,
  reorderCheckpointsSchema,
} from '../validators';

const router = Router();

router.use(authenticate);

router.get('/:tripId/checkpoints', checkpoint.getCheckpoints);
router.post('/:tripId/checkpoints', validate({ body: createCheckpointSchema }), checkpoint.createCheckpoint);
router.post('/:tripId/checkpoints/bulk', validate({ body: createCheckpointsBulkSchema }), checkpoint.createCheckpointsBulk);
router.delete('/:tripId/checkpoints', checkpoint.deleteAllCheckpoints);
router.delete('/:tripId/checkpoints/day/:day', checkpoint.deleteDayCheckpoints);
router.patch('/:tripId/checkpoints/:id', validate({ body: updateCheckpointSchema }), checkpoint.updateCheckpoint);
router.delete('/:tripId/checkpoints/:id', checkpoint.deleteCheckpoint);
router.put('/:tripId/checkpoints/reorder', validate({ body: reorderCheckpointsSchema }), checkpoint.reorderCheckpoints);

export default router;
