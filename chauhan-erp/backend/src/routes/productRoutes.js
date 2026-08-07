import { Router } from 'express';
import { body } from 'express-validator';
import {
  createCategory, getCategories, updateCategory, deleteCategory,
  createBrand, getBrands, updateBrand, deleteBrand,
  createUnit, getUnits, updateUnit, deleteUnit,
  createProduct, getProducts, updateProduct, deleteProduct,
  getVariants, createVariant, updateVariant, deleteVariant,
  generateBarcode, lookupByBarcode
} from '../controllers/productController.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validator.js';

const router = Router();

// Protect all product catalog routes
router.use(authenticate, checkPermission('products'));

// Barcode Lookup
router.get('/barcode-lookup/:code', lookupByBarcode);

// ── Categories ──────────────────────────────────────────────
router.post('/categories',
  [body('name').notEmpty().withMessage('Category name is required')],
  validateRequest, createCategory
);
router.get('/categories', getCategories);
router.put('/categories/:id',
  [body('name').notEmpty().withMessage('Category name is required')],
  validateRequest, updateCategory
);
router.delete('/categories/:id', deleteCategory);

// ── Brands ──────────────────────────────────────────────────
router.post('/brands',
  [body('name').notEmpty().withMessage('Brand name is required')],
  validateRequest, createBrand
);
router.get('/brands', getBrands);
router.put('/brands/:id',
  [body('name').notEmpty().withMessage('Brand name is required')],
  validateRequest, updateBrand
);
router.delete('/brands/:id', deleteBrand);

// ── Units ───────────────────────────────────────────────────
router.post('/units',
  [body('name').notEmpty().withMessage('Unit name is required')],
  validateRequest, createUnit
);
router.get('/units', getUnits);
router.put('/units/:id',
  [body('name').notEmpty().withMessage('Unit name is required')],
  validateRequest, updateUnit
);
router.delete('/units/:id', deleteUnit);

// ── Barcode Generator ───────────────────────────────────────
router.get('/generate-barcode', generateBarcode);

// ── Products ────────────────────────────────────────────────
router.post('/',
  [
    body('name').notEmpty().withMessage('Product name is required'),
    body('purchasePrice').optional().isFloat({ min: 0 }).withMessage('Purchase price must be positive number'),
    body('salesPrice').optional().isFloat({ min: 0 }).withMessage('Sales price must be positive number'),
  ],
  validateRequest, createProduct
);
router.get('/', getProducts);
router.put('/:id',
  [body('name').notEmpty().withMessage('Product name is required')],
  validateRequest, updateProduct
);
router.delete('/:id', deleteProduct);

// ── Product Variants ────────────────────────────────────────
router.get('/:id/variants', getVariants);
router.post('/:id/variants',
  [body('name').notEmpty().withMessage('Variant name is required')],
  validateRequest, createVariant
);
router.put('/:id/variants/:variantId',
  [body('name').notEmpty().withMessage('Variant name is required')],
  validateRequest, updateVariant
);
router.delete('/:id/variants/:variantId', deleteVariant);

export default router;
