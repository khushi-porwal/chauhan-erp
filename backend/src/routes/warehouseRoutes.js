import { Router } from 'express';
import { body } from 'express-validator';
import { createWarehouse, getWarehouses, updateWarehouse, deleteWarehouse } from '../controllers/warehouseController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validator.js';

const router = Router();

// Protect all warehouse routes
router.use(authenticate);

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Warehouse name is required'),
    body('code').notEmpty().withMessage('Warehouse code is required'),
  ],
  validateRequest,
  createWarehouse
);

router.get('/', getWarehouses);

router.put(
  '/:id',
  [
    body('name').optional().notEmpty().withMessage('Warehouse name cannot be empty'),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  ],
  validateRequest,
  updateWarehouse
);

router.delete('/:id', deleteWarehouse);

export default router;
