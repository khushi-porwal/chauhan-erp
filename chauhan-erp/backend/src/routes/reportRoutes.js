import { Router } from 'express';
import { authenticate, checkPermission } from '../middleware/auth.js';
import {
  getSalesReport,
  getPurchaseReport,
  getStockReport,
  getGstReport,
  getProfitLossReport
} from '../controllers/reportController.js';

const router = Router();

// All report routes require authentication + 'reports' permission
router.use(authenticate, checkPermission('reports'));

router.get('/sales',        getSalesReport);
router.get('/purchases',    getPurchaseReport);
router.get('/stock',        getStockReport);
router.get('/gst',          getGstReport);
router.get('/profit-loss',  getProfitLossReport);

export default router;
