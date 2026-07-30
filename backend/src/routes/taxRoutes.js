import { Router } from 'express';
import { body } from 'express-validator';
import {
  getHsnCodes, createHsnCode, updateHsnCode, deleteHsnCode,
  getGstSlabs, createGstSlab, updateGstSlab, deleteGstSlab
} from '../controllers/taxController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validator.js';

const router = Router();
router.use(authenticate);

// HSN Codes
router.get('/hsn', getHsnCodes);
router.post(
  '/hsn',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'),
  [body('code').notEmpty().withMessage('HSN Code is required')],
  validateRequest,
  createHsnCode
);
router.put('/hsn/:id', authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), updateHsnCode);
router.delete('/hsn/:id', authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), deleteHsnCode);

// GST Slabs
router.get('/gst', getGstSlabs);
router.post(
  '/gst',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'),
  [
    body('name').notEmpty().withMessage('GST slab name is required'),
    body('rate').isNumeric().withMessage('GST rate must be a number'),
  ],
  validateRequest,
  createGstSlab
);
router.put('/gst/:id', authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), updateGstSlab);
router.delete('/gst/:id', authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'), deleteGstSlab);

export default router;
