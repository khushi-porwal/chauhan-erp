import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import prisma from '../config/db.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token is missing or invalid');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Access token has expired');
      }
      throw new UnauthorizedError('Invalid access token');
    }

    // Fetch live user status and details
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        companyId: true,
        branchId: true,
        permissions: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is inactive');
    }

    // Assign to req.user
    req.user = {
      ...user,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
    };
    
    next();
  } catch (err) {
    next(err);
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to access this resource'));
    }
    next();
  };
};

/**
 * checkPermission(permKey)
 * ─────────────────────────────────────────────────
 * SUPER_ADMIN and COMPANY_ADMIN always pass.
 * BRANCH_MANAGER passes only if permKey is in their permissions[].
 * USER passes only if permKey is in their permissions[].
 *
 * Usage: router.get('/finance', authenticate, checkPermission('finance'), handler)
 */
export const checkPermission = (permKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }

    // Admins bypass all granular checks
    const adminRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];
    if (adminRoles.includes(req.user.role)) {
      return next();
    }

    const userPerms = Array.isArray(req.user.permissions)
      ? req.user.permissions
      : (typeof req.user.permissions === 'string'
          ? JSON.parse(req.user.permissions || '[]')
          : []);

    if (!userPerms.includes(permKey)) {
      return next(
        new ForbiddenError(
          `Access denied. You need the "${permKey}" permission to use this resource.`
        )
      );
    }

    next();
  };
};
