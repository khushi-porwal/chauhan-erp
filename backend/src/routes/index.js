import { Router } from 'express';
import authRoutes from './authRoutes.js';
import companyRoutes from './companyRoutes.js';
import userRoutes from './userRoutes.js';
import customerRoutes from './customerRoutes.js';
import vendorRoutes from './vendorRoutes.js';
import productRoutes from './productRoutes.js';
import warehouseRoutes from './warehouseRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';
import salesRoutes from './salesRoutes.js';
import purchaseRoutes from './purchaseRoutes.js';
import financeRoutes from './financeRoutes.js';
import reportRoutes from './reportRoutes.js';
import dispatchRoutes from './dispatchRoutes.js';
import roleRoutes from './roleRoutes.js';
import taxRoutes from './taxRoutes.js';
import module1Routes from './module1Routes.js';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

router.use('/auth', authRoutes);
router.use('/companies', companyRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/vendors', vendorRoutes);
router.use('/products', productRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sales', salesRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/finance', financeRoutes);
router.use('/reports', reportRoutes);
router.use('/dispatch', dispatchRoutes);
router.use('/roles', roleRoutes);
router.use('/taxes', taxRoutes);
router.use('/m1', module1Routes);

export default router;
