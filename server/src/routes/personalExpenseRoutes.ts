import { Router } from 'express';
import * as personalExpenses from '../controllers/personalExpenseController';
import { authenticate, validate } from '../middleware';
import { createPersonalExpenseSchema, updatePersonalExpenseSchema } from '../validators';

const router = Router();
router.use(authenticate);

// /calendar must be registered before /:id to avoid "calendar" being matched as an id
router.get('/calendar', personalExpenses.getPersonalExpensesByDay);
router.get('/',         personalExpenses.getPersonalExpenses);
router.post('/',        validate({ body: createPersonalExpenseSchema }), personalExpenses.createPersonalExpense);
router.get('/:id',      personalExpenses.getPersonalExpenseById);
router.put('/:id',      validate({ body: updatePersonalExpenseSchema }), personalExpenses.updatePersonalExpense);
router.delete('/:id',   personalExpenses.deletePersonalExpense);

export default router;
