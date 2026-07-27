import { Router } from 'express';
import { body } from 'express-validator';
import {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  createBranch,
  getBranches,
  createFinancialYear,
  getFinancialYears
} from '../controllers/companyController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validator.js';

const router = Router();

// Protect all company routes
router.use(authenticate);

// Company endpoints
router.post(
  '/',
  authorizeRoles('SUPER_ADMIN'),
  [
    body('name').notEmpty().withMessage('Company name is required'),
    body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3-letter code'),
  ],
  validateRequest,
  createCompany
);

router.get('/', getCompanies);

router.get('/:id', getCompanyById);

router.put(
  '/:id',
  [
    body('name').notEmpty().withMessage('Company name is required'),
  ],
  validateRequest,
  updateCompany
);

// Branch endpoints
router.post(
  '/branches',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'),
  [
    body('name').notEmpty().withMessage('Branch name is required'),
    body('code').notEmpty().withMessage('Branch code is required'),
  ],
  validateRequest,
  createBranch
);

router.get('/branches/list', getBranches);

// Financial Year endpoints
router.post(
  '/financial-years',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'),
  [
    body('name').notEmpty().withMessage('Financial Year name is required (e.g. FY 2026-27)'),
    body('startDate').isISO8601().withMessage('Start date must be a valid ISO8601 date'),
    body('endDate').isISO8601().withMessage('End date must be a valid ISO8601 date'),
  ],
  validateRequest,
  createFinancialYear
);

router.get('/financial-years/list', getFinancialYears);

export default router;
