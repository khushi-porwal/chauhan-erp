import { Router } from 'express';
import { body } from 'express-validator';
import {
  createCustomer,
  getCustomers,
  updateCustomer,
  getCustomerLedgers,
  createCustomerGroup,
  getCustomerGroups
} from '../controllers/customerController.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validator.js';

const router = Router();

// Protect all customer routes — only users with 'customers' permission (or admins) can proceed
router.use(authenticate, checkPermission('customers'));

// Groups
router.post(
  '/groups',
  [body('name').notEmpty().withMessage('Group name is required')],
  validateRequest,
  createCustomerGroup
);
router.get('/groups', getCustomerGroups);

// Customers
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Customer name is required'),
    body('email').optional().isEmail().withMessage('Provide a valid email address'),
  ],
  validateRequest,
  createCustomer
);
router.get('/', getCustomers);
router.put(
  '/:id',
  [body('name').notEmpty().withMessage('Customer name is required')],
  validateRequest,
  updateCustomer
);
router.get('/:id/ledger', getCustomerLedgers);

export default router;
