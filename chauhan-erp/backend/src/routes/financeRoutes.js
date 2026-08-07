import { Router } from 'express';
import { authenticate, checkPermission } from '../middleware/auth.js';
import {
  createPayment,
  getPayments,
  createExpense,
  getExpenses,
  getCashBook,
  getBankBook
} from '../controllers/financeController.js';

const router = Router();

// All finance routes require authentication + 'finance' permission
router.use(authenticate, checkPermission('finance'));

// Payments (In / Out)
router.post('/payments', createPayment);
router.get('/payments', getPayments);

// Expenses
router.post('/expenses', createExpense);
router.get('/expenses', getExpenses);

// Registers / Books
router.get('/cash-book', getCashBook);
router.get('/bank-book', getBankBook);

export default router;
