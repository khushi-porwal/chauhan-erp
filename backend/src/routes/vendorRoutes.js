import { Router } from 'express';
import { body } from 'express-validator';
import {
  createVendor,
  getVendors,
  updateVendor,
  getVendorLedgers,
  getVendorPricingHistory,
  getVendorDetails
} from '../controllers/vendorController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validator.js';

const router = Router();

// Protect all vendor routes
router.use(authenticate);

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Vendor name is required'),
    body('email').optional().isEmail().withMessage('Provide a valid email address'),
  ],
  validateRequest,
  createVendor
);
router.get('/', getVendors);
router.get('/:id/details', getVendorDetails);
router.get('/:id/pricing-history', getVendorPricingHistory);
router.put(
  '/:id',
  [body('name').notEmpty().withMessage('Vendor name is required')],
  validateRequest,
  updateVendor
);
router.get('/:id/ledger', getVendorLedgers);

export default router;
