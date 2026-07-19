import { Router } from 'express';
import * as personalExpenses from '../controllers/personalExpenseController';
import * as personalExport from '../controllers/personalExportController';
import { authenticate, validate } from '../middleware';
import { createPersonalExpenseSchema, updatePersonalExpenseSchema } from '../validators';

const router = Router();
router.use(authenticate);

// /calendar, /recurring, /budget-status, /export/* must be registered before /:id to avoid being matched as an id
router.get('/calendar',      personalExpenses.getPersonalExpensesByDay);
router.get('/recurring',     personalExpenses.getRecurringExpenses);
router.get('/budget-status', personalExpenses.getPersonalBudgetStatus);
router.get('/export/csv',    personalExport.exportPersonalCSV);
router.get('/export/pdf',    personalExport.exportPersonalPDF);
router.get('/',         personalExpenses.getPersonalExpenses);
router.post('/',        validate({ body: createPersonalExpenseSchema }), personalExpenses.createPersonalExpense);
router.get('/:id',      personalExpenses.getPersonalExpenseById);
router.put('/:id',      validate({ body: updatePersonalExpenseSchema }), personalExpenses.updatePersonalExpense);
router.delete('/:id',   personalExpenses.deletePersonalExpense);

export default router;
