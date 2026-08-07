import prisma from '../config/db.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

// Predefined system modules & permissions list for reference
export const SYSTEM_PERMISSIONS = [
  { code: 'dashboard.read', name: 'View Dashboard', module: 'DASHBOARD' },
  { code: 'products.read', name: 'View Products', module: 'PRODUCTS' },
  { code: 'products.create', name: 'Create Product', module: 'PRODUCTS' },
  { code: 'products.update', name: 'Update Product', module: 'PRODUCTS' },
  { code: 'products.delete', name: 'Delete Product', module: 'PRODUCTS' },
  
  { code: 'categories.manage', name: 'Manage Categories', module: 'CATEGORIES' },
  { code: 'brands.manage', name: 'Manage Brands', module: 'BRANDS' },
  { code: 'units.manage', name: 'Manage Units', module: 'UNITS' },
  { code: 'taxes.manage', name: 'Manage Tax & HSN', module: 'TAXES' },

  { code: 'inventory.read', name: 'View Inventory', module: 'INVENTORY' },
  { code: 'inventory.stock_in', name: 'Perform Stock In', module: 'INVENTORY' },
  { code: 'inventory.stock_out', name: 'Perform Stock Out', module: 'INVENTORY' },
  { code: 'inventory.transfer', name: 'Inter-Warehouse Transfer', module: 'INVENTORY' },
  { code: 'inventory.adjust', name: 'Stock Adjustment', module: 'INVENTORY' },

  { code: 'warehouses.manage', name: 'Manage Warehouses', module: 'WAREHOUSES' },
  { code: 'batch.manage', name: 'Manage Batches & Expiry', module: 'BATCH' },
  { code: 'barcode.print', name: 'Print Barcodes', module: 'BARCODE' },
  
  { code: 'users.manage', name: 'Manage Users', module: 'USERS' },
  { code: 'roles.manage', name: 'Manage Roles & Permissions', module: 'ROLES' },
];

export const getSystemPermissions = async (req, res, next) => {
  try {
    return successResponse(res, 'System permissions retrieved', SYSTEM_PERMISSIONS);
  } catch (err) {
    next(err);
  }
};

export const getRoles = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    const roles = await prisma.role.findMany({
      where: companyId ? { OR: [{ companyId }, { isSystem: true }] } : { isSystem: true },
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' }
    });

    return successResponse(res, 'Roles retrieved successfully', roles);
  } catch (err) {
    next(err);
  }
};

export const createRole = async (req, res, next) => {
  try {
    const { name, description, permissions, companyId } = req.body;
    let targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      const firstCompany = await prisma.company.findFirst();
      if (firstCompany) targetCompanyId = firstCompany.id;
    }

    if (!name) throw new BadRequestError('Role name is required');
    if (!targetCompanyId) throw new BadRequestError('Company ID is required');

    const role = await prisma.role.create({
      data: {
        name,
        description,
        permissions: permissions || [],
        companyId: targetCompanyId,
        isSystem: false
      }
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_ROLE',
      module: 'ROLES',
      details: { roleId: role.id, name: role.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Role created successfully', role, 201);
  } catch (err) {
    next(err);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundError('Role not found');
    if (role.isSystem) throw new ForbiddenError('System roles cannot be edited');

    if (req.user.role !== 'SUPER_ADMIN' && role.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    const updated = await prisma.role.update({
      where: { id },
      data: {
        name: name || role.name,
        description: description !== undefined ? description : role.description,
        permissions: permissions || role.permissions
      }
    });

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_ROLE',
      module: 'ROLES',
      details: { roleId: updated.id, name: updated.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: role.companyId
    });

    return successResponse(res, 'Role updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!role) throw new NotFoundError('Role not found');
    if (role.isSystem) throw new ForbiddenError('System roles cannot be deleted');
    if (role._count.users > 0) throw new BadRequestError('Cannot delete role assigned to active users');

    if (req.user.role !== 'SUPER_ADMIN' && role.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    await prisma.role.delete({ where: { id } });

    await logAudit({
      userId: req.user.id,
      action: 'DELETE_ROLE',
      module: 'ROLES',
      details: { roleId: id, name: role.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: role.companyId
    });

    return successResponse(res, 'Role deleted successfully');
  } catch (err) {
    next(err);
  }
};
