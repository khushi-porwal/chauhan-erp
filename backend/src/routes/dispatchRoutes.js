import { Router } from 'express';
import { body } from 'express-validator';
import {
  createDispatch,
  getDispatches,
  getDispatchById,
  updateDispatchStatus
} from '../controllers/dispatchController.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validator.js';

const router = Router();

// All dispatch routes require authentication and 'inventory' or 'sales' permission
router.use(authenticate, checkPermission('inventory'));

// List all dispatch notes
router.get('/', getDispatches);

// Get single dispatch note
router.get('/:id', getDispatchById);

// Create new dispatch (triggers auto stock-out)
router.post(
  '/',
  [
    body('warehouseId').notEmpty().withMessage('Warehouse ID is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productId').notEmpty().withMessage('Product ID required for each item'),
    body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be positive'),
  ],
  validateRequest,
  createDispatch
);

// Update dispatch status (delivered, in transit, returned)
router.put('/:id/status', updateDispatchStatus);

export default router;
