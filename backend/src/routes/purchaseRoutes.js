import { Router } from 'express';
import { authenticate, checkPermission } from '../middleware/auth.js';
import {
  createPurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrderStatus,
  convertPoToInvoice,
  receivePurchaseOrder,
  getVendorHistory,
  createPurchaseInvoice,
  getPurchaseInvoices,
  createPurchaseReturn,
  getPurchaseReturns
} from '../controllers/purchaseController.js';

const router = Router();

// All purchase routes require authentication + 'purchases' permission
router.use(authenticate, checkPermission('purchases'));

// Purchase Orders
router.post('/orders', createPurchaseOrder);
router.get('/orders', getPurchaseOrders);
router.put('/orders/:id/status', updatePurchaseOrderStatus);
router.post('/orders/:id/convert', convertPoToInvoice);
router.post('/orders/:id/receive', receivePurchaseOrder);

// Vendor History & Pricing
router.get('/vendors/:vendorId/history', getVendorHistory);

// Purchase Invoices
router.post('/invoices', createPurchaseInvoice);
router.get('/invoices', getPurchaseInvoices);

// Purchase Returns
router.post('/returns', createPurchaseReturn);
router.get('/returns', getPurchaseReturns);

export default router;
