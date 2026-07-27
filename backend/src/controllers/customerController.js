import prisma from '../config/db.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

// ── Customer Groups ──────────────────────────────────────────
export const createCustomerGroup = async (req, res, next) => {
  try {
    const { name, description, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    const group = await prisma.customerGroup.create({
      data: {
        name,
        description,
        companyId: targetCompanyId
      }
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_CUSTOMER_GROUP',
      module: 'CUSTOMER',
      details: { groupId: group.id, name: group.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Customer Group created successfully', group, 201);
  } catch (err) {
    next(err);
  }
};

export const getCustomerGroups = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const groups = await prisma.customerGroup.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { name: 'asc' }
    });

    return successResponse(res, 'Customer Groups retrieved successfully', groups);
  } catch (err) {
    next(err);
  }
};

// ── Customers ────────────────────────────────────────────────
export const createCustomer = async (req, res, next) => {
  try {
    const { name, customerGroupId, email, phone, address, creditLimit, openingBalance, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    const limit = creditLimit ? parseFloat(creditLimit) : 0;
    const balance = openingBalance ? parseFloat(openingBalance) : 0;

    // Use transaction to create customer and ledger entries atomically
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          name,
          customerGroupId: customerGroupId || null,
          email,
          phone,
          address,
          creditLimit: limit,
          balance: balance,
          companyId: targetCompanyId
        }
      });

      if (balance !== 0) {
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            type: balance > 0 ? 'DEBIT' : 'CREDIT',
            amount: Math.abs(balance),
            balance: balance,
            description: 'Opening Balance Entry',
            referenceNo: 'OPENING'
          }
        });
      }

      return customer;
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_CUSTOMER',
      module: 'CUSTOMER',
      details: { customerId: result.id, name: result.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Customer created successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

export const getCustomers = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const customers = await prisma.customer.findMany({
      where: companyId ? { companyId } : {},
      include: {
        customerGroup: {
          select: { name: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return successResponse(res, 'Customers retrieved successfully', customers);
  } catch (err) {
    next(err);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, customerGroupId, email, phone, address, creditLimit } = req.body;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    if (req.user.role !== 'SUPER_ADMIN' && customer.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this customer');
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name,
        customerGroupId: customerGroupId || null,
        email,
        phone,
        address,
        creditLimit: creditLimit ? parseFloat(creditLimit) : undefined
      }
    });

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_CUSTOMER',
      module: 'CUSTOMER',
      details: { customerId: updated.id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: customer.companyId
    });

    return successResponse(res, 'Customer updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const getCustomerLedgers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({ where: { id } });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    if (req.user.role !== 'SUPER_ADMIN' && customer.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this ledger');
    }

    const ledgers = await prisma.customerLedger.findMany({
      where: { customerId: id },
      orderBy: { date: 'asc' }
    });

    return successResponse(res, 'Customer ledgers retrieved successfully', ledgers);
  } catch (err) {
    next(err);
  }
};
