import { Router } from 'express';
import { body } from 'express-validator';
import { login, logout, refreshToken, forgotPassword, resetPassword, register, changePassword } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validator.js';

const router = Router();

router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Provide a valid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  ],
  validateRequest,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Provide a valid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  login
);

router.post('/logout', logout);

router.post('/refresh-token', refreshToken);

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Provide a valid email address')],
  validateRequest,
  forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  ],
  validateRequest,
  resetPassword
);

router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
  ],
  validateRequest,
  changePassword
);

export default router;

