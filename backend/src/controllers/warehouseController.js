import prisma from '../config/db.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

export const createWarehouse = async (req, res, next) => {
  try {
    const { name, code, address, branchId, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    const existing = await prisma.warehouse.findUnique({
      where: {
        companyId_code: {
          companyId: targetCompanyId,
          code: code.toUpperCase().trim()
        }
      }
    });

    if (existing) {
      throw new BadRequestError(`Warehouse with code '${code}' already exists in this company`);
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        code: code.toUpperCase().trim(),
        address,
        branchId: branchId || null,
        companyId: targetCompanyId
      }
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_WAREHOUSE',
      module: 'INVENTORY',
      details: { warehouseId: warehouse.id, name: warehouse.name, code: warehouse.code },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Warehouse created successfully', warehouse, 201);
  } catch (err) {
    next(err);
  }
};

export const getWarehouses = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const warehouses = await prisma.warehouse.findMany({
      where: companyId ? { companyId } : {},
      include: {
        branch: {
          select: { name: true, code: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return successResponse(res, 'Warehouses retrieved successfully', warehouses);
  } catch (err) {
    next(err);
  }
};

export const updateWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, branchId, status } = req.body;

    const warehouse = await prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    if (req.user.role !== 'SUPER_ADMIN' && warehouse.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this warehouse');
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data: {
        name,
        address,
        branchId: branchId !== undefined ? (branchId || null) : undefined,
        status
      }
    });

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_WAREHOUSE',
      module: 'INVENTORY',
      details: { warehouseId: updated.id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: warehouse.companyId
    });

    return successResponse(res, 'Warehouse updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const deleteWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const warehouse = await prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    if (req.user.role !== 'SUPER_ADMIN' && warehouse.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this warehouse');
    }

    // Check if warehouse has active stock records
    const stockCount = await prisma.warehouseStock.aggregate({
      where: { warehouseId: id },
      _sum: { quantity: true }
    });

    if (stockCount._sum.quantity && stockCount._sum.quantity > 0) {
      throw new BadRequestError(`Cannot delete warehouse '${warehouse.name}' because it contains ${stockCount._sum.quantity} items in stock. Transfer stock out first or mark warehouse as INACTIVE.`);
    }

    await prisma.warehouse.delete({ where: { id } });

    await logAudit({
      userId: req.user.id,
      action: 'DELETE_WAREHOUSE',
      module: 'INVENTORY',
      details: { warehouseId: id, name: warehouse.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: warehouse.companyId
    });

    return successResponse(res, 'Warehouse deleted successfully');
  } catch (err) {
    next(err);
  }
};
