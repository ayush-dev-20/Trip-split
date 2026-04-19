import { Router } from 'express';
import * as expenses from '../controllers/expenseController';
import { authenticate, validate } from '../middleware';
import {
  createExpenseSchema,
  updateExpenseSchema,
  idParamSchema,
  createCommentSchema,
  createReactionSchema,
} from '../validators';

const router = Router();

router.use(authenticate);

router.post('/', validate({ body: createExpenseSchema }), expenses.createExpense);
router.get('/', expenses.getExpenses);
router.get('/:id', validate({ params: idParamSchema }), expenses.getExpense);
router.put('/:id', validate({ params: idParamSchema, body: updateExpenseSchema }), expenses.updateExpense);
router.delete('/:id', validate({ params: idParamSchema }), expenses.deleteExpense);

// Receipt upload
router.post('/:id/receipts', expenses.uploadReceipt);

// Comments & Reactions
router.post('/:id/comments', validate({ body: createCommentSchema }), expenses.addComment);
router.post('/:id/reactions', validate({ body: createReactionSchema }), expenses.addReaction);

export default router;
