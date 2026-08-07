import { Router } from 'express';
import { authenticate, checkPermission } from '../middleware/auth.js';
import {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  approvePurchaseOrder,
  convertPoToInvoice,
  receivePurchaseOrder,
  partialReceivePO,
  generatePoPdf,
  getVendorHistory,
  createPurchaseInvoice,
  getPurchaseInvoices,
  payInvoice,
  createPurchaseReturn,
  getPurchaseReturns,
  createRequisition,
  getRequisitions,
  updateRequisitionStatus,
  convertRequisitionToPO,
  getVendorLedger,
} from '../controllers/purchaseController.js';

const router = Router();

// All purchase routes require authentication + 'purchases' permission
router.use(authenticate, checkPermission('purchases'));

// ── Purchase Requisitions ──────────────────────────────────────
router.post('/requisitions', createRequisition);
router.get('/requisitions', getRequisitions);
router.put('/requisitions/:id/status', updateRequisitionStatus);
router.post('/requisitions/:id/convert-to-po', convertRequisitionToPO);

// ── Purchase Orders ────────────────────────────────────────────
router.post('/orders', createPurchaseOrder);
router.get('/orders', getPurchaseOrders);
router.get('/orders/:id', getPurchaseOrderById);
router.put('/orders/:id/status', updatePurchaseOrderStatus);
router.post('/orders/:id/approve', approvePurchaseOrder);
router.post('/orders/:id/convert', convertPoToInvoice);
router.post('/orders/:id/receive', receivePurchaseOrder);
router.post('/orders/:id/receive-partial', partialReceivePO);
router.get('/orders/:id/pdf', generatePoPdf);

// ── Vendor History & Ledger ────────────────────────────────────
router.get('/vendors/:vendorId/history', getVendorHistory);
router.get('/vendors/:vendorId/ledger', getVendorLedger);

// ── Purchase Invoices ──────────────────────────────────────────
router.post('/invoices', createPurchaseInvoice);
router.get('/invoices', getPurchaseInvoices);
router.post('/invoices/:id/pay', payInvoice);

// ── Purchase Returns ───────────────────────────────────────────
router.post('/returns', createPurchaseReturn);
router.get('/returns', getPurchaseReturns);

export default router;
