import { Router } from 'express';
import * as settlements from '../controllers/settlementController';
import { authenticate, validate } from '../middleware';
import { createSettlementSchema, settleDebtSchema, settlePlanSchema, idParamSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.get('/overall-balances', settlements.getOverallBalances);
router.get('/balances/group/:groupId', settlements.getGroupBalances);
router.get('/balances/:tripId', settlements.getTripBalances);
router.post('/', validate({ body: createSettlementSchema }), settlements.createSettlement);
router.post('/settle-plan', validate({ body: settlePlanSchema }), settlements.settlePlan);
router.put('/:id/settle', validate({ params: idParamSchema, body: settleDebtSchema }), settlements.settleDebt);
router.delete('/:id', validate({ params: idParamSchema }), settlements.deleteSettlement);
router.get('/', settlements.getSettlements);

export default router;
