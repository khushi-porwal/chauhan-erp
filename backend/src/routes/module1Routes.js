import { Router } from 'express';
import {
  getDashboardStats,
  getLowStockProducts,
  getBatchesWithExpiryStatus,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  generateBulkBarcodes,
  getStockHistory,
  createStockAdjustment,
  getStockAdjustments
} from '../controllers/notificationController.js';
import { authenticate, authorizeRoles, checkPermission } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Inventory Dashboard
router.get('/dashboard', getDashboardStats);

// Low Stock Engine
router.get('/low-stock', getLowStockProducts);

// Batch & Expiry Engine
router.get('/batch-expiry', getBatchesWithExpiryStatus);

// Notifications
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.patch('/notifications/mark-all-read', markAllNotificationsRead);

// Barcode bulk print
router.post('/barcode/bulk', generateBulkBarcodes);

// Enhanced stock history
router.get('/history', getStockHistory);

// Stock Adjustments
router.post('/adjustments', createStockAdjustment);
router.get('/adjustments', getStockAdjustments);

export default router;
