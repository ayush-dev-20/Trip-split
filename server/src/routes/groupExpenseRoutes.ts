import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  createGroupExpenseSchema,
  updateGroupExpenseSchema,
} from '../validators';
import {
  getGroupExpenses,
  getGroupExpensesByDay,
  createGroupExpense,
  getGroupExpenseById,
  updateGroupExpense,
  deleteGroupExpense,
} from '../controllers/groupExpenseController';

const router = Router({ mergeParams: true }); // mergeParams to inherit :groupId

router.use(authenticate);

// /calendar must come before /:id to avoid matching "calendar" as an expense id
router.get('/calendar', getGroupExpensesByDay);

router.get('/',       getGroupExpenses);
router.post('/',      validate({ body: createGroupExpenseSchema }), createGroupExpense);
router.get('/:id',    getGroupExpenseById);
router.put('/:id',    validate({ body: updateGroupExpenseSchema }), updateGroupExpense);
router.delete('/:id', deleteGroupExpense);

export default router;
