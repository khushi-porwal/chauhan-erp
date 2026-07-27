import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';
import logger from '../config/logger.js';

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, companyId: user.companyId, branchId: user.branchId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

const generateRefreshToken = () => {
  return jwt.sign({}, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        company: true,
        branch: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const accessToken = generateAccessToken(user);
    const refreshTokenStr = generateRefreshToken();

    // Calculate expiry date
    const expiryDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Save refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshTokenStr,
        userId: user.id,
        expiresAt,
      },
    });

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshTokenStr, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: expiryDays * 24 * 60 * 60 * 1000,
    });

    // Log login audit
    await logAudit({
      userId: user.id,
      action: 'LOGIN',
      module: 'AUTH',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: user.companyId,
    });

    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
      company: user.company,
      branch: user.branch,
    };

    return successResponse(res, 'Login successful', {
      user: userResponse,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const refreshTokenStr = req.cookies?.refreshToken || req.body?.refreshToken;

    if (refreshTokenStr) {
      // Remove refresh token from DB
      await prisma.refreshToken.deleteMany({
        where: { token: refreshTokenStr },
      });
    }

    // Clear cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    if (req.user) {
      await logAudit({
        userId: req.user.id,
        action: 'LOGOUT',
        module: 'AUTH',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        companyId: req.user.companyId,
      });
    }

    return successResponse(res, 'Logout successful');
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const refreshTokenStr = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshTokenStr) {
      throw new UnauthorizedError('Refresh token is missing');
    }

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenStr },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date() || tokenRecord.user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Verify token matches signature
    try {
      jwt.verify(refreshTokenStr, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Generate new access token
    const accessToken = generateAccessToken(tokenRecord.user);

    return successResponse(res, 'Token refreshed successfully', {
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password, module: requestedModule, role: requestedRole } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new BadRequestError('Email address is already registered');
    }

    let company = await prisma.company.findFirst({ where: { status: 'ACTIVE' } });
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'Chauhan Enterprises',
          legalName: 'Chauhan Enterprises Pvt Ltd',
          email: 'admin@chauhanerp.com',
        },
      });
    }

    let branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          name: 'Main HQ',
          code: 'HQ01',
          companyId: company.id,
        },
      });
    }

    let role = requestedRole || 'USER';
    let permissions = [];

    if (requestedModule === 'finance') {
      permissions = ['finance'];
    } else if (requestedModule === 'sales') {
      permissions = ['sales', 'pos', 'customers'];
    } else if (requestedModule === 'purchases') {
      permissions = ['purchases', 'vendors'];
    } else if (requestedModule === 'inventory') {
      permissions = ['inventory', 'products', 'warehouses'];
    } else if (requestedModule === 'reports') {
      permissions = ['reports'];
    } else if (requestedModule === 'admin') {
      role = 'COMPANY_ADMIN';
      permissions = [
        'dashboard', 'sales', 'pos', 'purchases', 'customers', 'vendors',
        'products', 'warehouses', 'inventory', 'finance', 'reports',
        'settings', 'branches', 'financial_years'
      ];
    } else {
      permissions = Array.isArray(req.body.permissions) ? req.body.permissions : ['dashboard'];
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        permissions: JSON.stringify(permissions),
        companyId: company.id,
        branchId: branch.id,
      },
    });

    await logAudit({
      userId: newUser.id,
      action: 'REGISTER_USER',
      module: 'AUTH',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: company.id,
    });

    return successResponse(
      res,
      'Registration successful! Please log in with your credentials.',
      {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          permissions,
        },
      },
      201
    );
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Return 200/success to avoid email enumeration
      return successResponse(res, 'If the email exists, a password reset link has been generated.');
    }

    // Create a secure short-lived token for password reset (1 hour)
    const resetToken = jwt.sign(
      { id: user.id, email: user.email, action: 'RESET_PASSWORD' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
    logger.info(`
=========================================
PASSWORD RESET LINK GENERATED:
User: ${email}
Link: ${resetUrl}
=========================================
`);

    await logAudit({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUEST',
      module: 'AUTH',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: user.companyId,
    });

    return successResponse(res, 'If the email exists, a password reset link has been generated.', {
      resetToken,
      resetUrl,
    });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      throw new BadRequestError('Token and new password are required');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    if (decoded.action !== 'RESET_PASSWORD') {
      throw new BadRequestError('Invalid action for token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password & delete existing refresh tokens
    await prisma.$transaction([
      prisma.user.update({
        where: { id: decoded.id },
        data: { password: hashedPassword },
      }),
      prisma.refreshToken.deleteMany({
        where: { userId: decoded.id },
      }),
    ]);

    await logAudit({
      userId: decoded.id,
      action: 'PASSWORD_RESET_COMPLETE',
      module: 'AUTH',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return successResponse(res, 'Password has been reset successfully. Please log in with your new password.');
  } catch (err) {
    next(err);
  }
};
