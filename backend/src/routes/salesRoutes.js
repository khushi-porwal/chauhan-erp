import { Router } from 'express';
import { authenticate, checkPermission } from '../middleware/auth.js';
import {
  createQuotation,
  getQuotations,
  createSalesOrder,
  getSalesOrders,
  createDeliveryChallan,
  getDeliveryChallans,
  createSalesInvoice,
  getSalesInvoices,
  createSalesReturn,
  getSalesReturns
} from '../controllers/salesController.js';

const router = Router();

// All sales routes require authentication + 'sales' permission
router.use(authenticate, checkPermission('sales'));

// Quotations
router.post('/quotations', createQuotation);
router.get('/quotations', getQuotations);

// Sales Orders
router.post('/orders', createSalesOrder);
router.get('/orders', getSalesOrders);

// Delivery Challans
router.post('/challans', createDeliveryChallan);
router.get('/challans', getDeliveryChallans);

// Sales Invoices
router.post('/invoices', createSalesInvoice);
router.get('/invoices', getSalesInvoices);

// Sales Returns
router.post('/returns', createSalesReturn);
router.get('/returns', getSalesReturns);

export default router;
