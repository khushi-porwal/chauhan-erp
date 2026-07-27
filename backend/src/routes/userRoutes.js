import { Router } from 'express';
import { body } from 'express-validator';
import { createUser, getUsers, updateUser, getAuditLogs } from '../controllers/userController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validator.js';

const router = Router();

router.use(authenticate);

// Manage Users
router.post(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'),
  [
    body('email').isEmail().withMessage('Provide a valid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('name').notEmpty().withMessage('Name is required'),
    body('role').isIn(['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER', 'USER']).withMessage('Invalid role'),
  ],
  validateRequest,
  createUser
);

router.get('/', authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'), getUsers);

router.put(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'),
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('role').optional().isIn(['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER', 'USER']).withMessage('Invalid role'),
  ],
  validateRequest,
  updateUser
);

// Audit logs
router.get('/audit-logs/list', authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), getAuditLogs);

export default router;
