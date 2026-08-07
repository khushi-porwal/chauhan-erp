import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

export const createUser = async (req, res, next) => {
  try {
    const { email, password, name, role, permissions, companyId, branchId } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestError('User with this email already exists');
    }

    let targetCompanyId = companyId;
    let targetBranchId = branchId;

    if (req.user.role !== 'SUPER_ADMIN') {
      targetCompanyId = req.user.companyId;
      if (role === 'SUPER_ADMIN') {
        throw new ForbiddenError('Only superadmins can create superadmin users');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        permissions: permissions || [],
        companyId: targetCompanyId,
        branchId: targetBranchId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        status: true,
        companyId: true,
        branchId: true,
        createdAt: true,
      },
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_USER',
      module: 'USER',
      details: { createdUserId: newUser.id, email: newUser.email, role: newUser.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: req.user.companyId,
    });

    return successResponse(res, 'User created successfully', newUser, 201);
  } catch (err) {
    next(err);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const users = await prisma.user.findMany({
      where: companyId ? { companyId } : {},
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        status: true,
        companyId: true,
        branchId: true,
        createdAt: true,
        branch: { select: { name: true, code: true } },
        company: { select: { name: true } },
      },
    });

    const parsedUsers = users.map((u) => ({
      ...u,
      permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions,
    }));

    return successResponse(res, 'Users retrieved successfully', parsedUsers);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role, permissions, branchId, status } = req.body;

    const userToUpdate = await prisma.user.findUnique({ where: { id } });
    if (!userToUpdate) {
      throw new NotFoundError('User not found');
    }

    if (req.user.role !== 'SUPER_ADMIN' && userToUpdate.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this user');
    }

    if (userToUpdate.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You cannot update a superadmin user');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name,
        role: req.user.role === 'SUPER_ADMIN' || req.user.role === 'COMPANY_ADMIN' ? role : undefined,
        permissions: req.user.role === 'SUPER_ADMIN' || req.user.role === 'COMPANY_ADMIN' ? permissions : undefined,
        branchId,
        status,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        status: true,
        companyId: true,
        branchId: true,
      },
    });

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_USER',
      module: 'USER',
      details: { updatedUserId: updated.id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: req.user.companyId,
    });

    return successResponse(res, 'User updated successfully', {
      ...updated,
      permissions: typeof updated.permissions === 'string' ? JSON.parse(updated.permissions) : updated.permissions,
    });
  } catch (err) {
    next(err);
  }
};

export const getAuditLogs = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const logs = await prisma.auditLog.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    return successResponse(res, 'Audit logs retrieved successfully', logs);
  } catch (err) {
    next(err);
  }
};
