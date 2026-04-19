import { Router } from 'express';
import * as groups from '../controllers/groupController';
import { authenticate, validate } from '../middleware';
import { createGroupSchema, updateGroupSchema, idParamSchema, inviteCodeSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.post('/', validate({ body: createGroupSchema }), groups.createGroup);
router.get('/', groups.getGroups);
router.get('/:id', validate({ params: idParamSchema }), groups.getGroup);
router.put('/:id', validate({ params: idParamSchema, body: updateGroupSchema }), groups.updateGroup);
router.delete('/:id', validate({ params: idParamSchema }), groups.deleteGroup);

// Invites
router.post('/:id/invite', groups.inviteToGroup);
router.post('/join/:code', groups.joinGroupByCode);

// Members
router.delete('/:id/members/:userId', groups.removeMember);

export default router;
