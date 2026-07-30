import { Router } from 'express';
import { body } from 'express-validator';
import {
  getRoles, createRole, updateRole, deleteRole, getSystemPermissions
} from '../controllers/roleController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validator.js';

const router = Router();

// All role routes require authentication
router.use(authenticate);

// Get system-wide available permissions list
router.get('/permissions', getSystemPermissions);

// Role CRUD
router.get('/', getRoles);

router.post(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'),
  [body('name').notEmpty().withMessage('Role name is required')],
  validateRequest,
  createRole
);

router.put(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'),
  [body('name').optional().notEmpty().withMessage('Role name cannot be empty')],
  validateRequest,
  updateRole
);

router.delete('/:id', authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), deleteRole);

export default router;
