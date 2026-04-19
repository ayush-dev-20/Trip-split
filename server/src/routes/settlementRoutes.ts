import { Router } from 'express';
import * as settlements from '../controllers/settlementController';
import { authenticate, validate } from '../middleware';
import { createSettlementSchema, settleDebtSchema, idParamSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.get('/overall-balances', settlements.getOverallBalances);
router.get('/balances/:tripId', settlements.getTripBalances);
router.post('/', validate({ body: createSettlementSchema }), settlements.createSettlement);
router.put('/:id/settle', validate({ params: idParamSchema, body: settleDebtSchema }), settlements.settleDebt);
router.get('/', settlements.getSettlements);

export default router;
