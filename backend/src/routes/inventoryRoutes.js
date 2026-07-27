import { Router } from 'express';
import { body } from 'express-validator';
import {
  stockIn,
  stockOut,
  stockTransfer,
  stockAdjustment,
  getWarehouseStock,
  getLowStockAlerts,
  getStockHistory,
  createBatch,
  getBatches,
  deleteBatch,
  reconcileStock
} from '../controllers/inventoryController.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validator.js';

const router = Router();

// Protect all inventory routes — only users with 'inventory' permission (or admins) can proceed
router.use(authenticate, checkPermission('inventory'));

// Reconciliation
router.post('/reconcile', reconcileStock);

// Transactions
router.post(
  '/stock-in',
  [
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('warehouseId').notEmpty().withMessage('Warehouse ID is required'),
    body('quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be a positive number'),
  ],
  validateRequest,
  stockIn
);

router.post(
  '/stock-out',
  [
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('warehouseId').notEmpty().withMessage('Warehouse ID is required'),
    body('quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be a positive number'),
  ],
  validateRequest,
  stockOut
);

router.post(
  '/stock-transfer',
  [
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('fromWarehouseId').notEmpty().withMessage('Source warehouse ID is required'),
    body('toWarehouseId').notEmpty().withMessage('Destination warehouse ID is required'),
    body('quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be a positive number'),
  ],
  validateRequest,
  stockTransfer
);

router.post(
  '/stock-adjustment',
  [
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('warehouseId').notEmpty().withMessage('Warehouse ID is required'),
    body('quantity').isFloat({ min: 0 }).withMessage('Adjusted quantity must be non-negative number'),
  ],
  validateRequest,
  stockAdjustment
);

// Lookups
router.get('/stocks', getWarehouseStock);
router.get('/low-stock', getLowStockAlerts);
router.get('/history', getStockHistory);

// Batches
router.post(
  '/batches',
  [
    body('batchNumber').notEmpty().withMessage('Batch number is required'),
    body('productId').notEmpty().withMessage('Product ID is required'),
  ],
  validateRequest,
  createBatch
);
router.get('/batches', getBatches);
router.delete('/batches/:id', deleteBatch);

export default router;
