import prisma from '../config/db.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

// ── Payments (In / Out) ───────────────────────────────────────
export const createPayment = async (req, res, next) => {
  try {
    const { type, category, amount, paymentMode = 'CASH', referenceNo, description, customerId, vendorId, expenseId, companyId, branchId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new BadRequestError('Amount must be positive');
    if (!['PAYMENT_IN', 'PAYMENT_OUT'].includes(type)) throw new BadRequestError('Invalid payment type');

    const paymentNo = `PMT-${Date.now()}`;
    const targetBranchId = branchId || req.user.branchId || null;

    const result = await prisma.$transaction(async (tx) => {
      // ── Customer Payment (Inward collection) ──
      if (type === 'PAYMENT_IN' && category === 'CUSTOMER' && customerId) {
        const customer = await tx.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw new NotFoundError('Customer not found');

        const newBalance = customer.balance - amt;
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: newBalance },
        });

        await tx.customerLedger.create({
          data: {
            customerId,
            type: 'CREDIT',
            amount: amt,
            balance: newBalance,
            description: description || `Payment Inward: ${paymentNo}`,
            referenceNo,
          },
        });
      }

      // ── Vendor Payout (Outward payment) ──
      if (type === 'PAYMENT_OUT' && category === 'VENDOR' && vendorId) {
        const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
        if (!vendor) throw new NotFoundError('Vendor not found');

        const newBalance = vendor.balance - amt;
        await tx.vendor.update({
          where: { id: vendorId },
          data: { balance: newBalance },
        });

        await tx.vendorLedger.create({
          data: {
            vendorId,
            type: 'DEBIT',
            amount: amt,
            balance: newBalance,
            description: description || `Payment Outward: ${paymentNo}`,
            referenceNo,
          },
        });
      }

      // Create Payment
      const payment = await tx.payment.create({
        data: {
          paymentNo,
          type,
          category,
          amount: amt,
          paymentMode,
          referenceNo,
          description,
          customerId: category === 'CUSTOMER' ? customerId : null,
          vendorId: category === 'VENDOR' ? vendorId : null,
          expenseId: category === 'EXPENSE' ? expenseId : null,
          companyId: targetCompanyId,
          branchId: targetBranchId,
          createdById: req.user.id,
        },
        include: {
          customer: { select: { name: true } },
          vendor: { select: { name: true } },
          expense: { select: { title: true } },
          createdBy: { select: { name: true, email: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      return payment;
    });

    await logAudit({
      userId: req.user.id,
      action: type,
      module: 'FINANCE',
      details: { paymentId: result.id, paymentNo, amount: amt },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Payment registered successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

export const getPayments = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const payments = await prisma.payment.findMany({
      where: companyId ? { companyId } : {},
      include: {
        customer: { select: { name: true } },
        vendor: { select: { name: true } },
        expense: { select: { title: true } },
        createdBy: { select: { name: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, 'Payments retrieved successfully', payments);
  } catch (err) {
    next(err);
  }
};

// ── Expenses ──────────────────────────────────────────────────
export const createExpense = async (req, res, next) => {
  try {
    const { title, category, amount, paymentMode = 'CASH', description, companyId, branchId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new BadRequestError('Amount must be positive');
    if (!title || !category) throw new BadRequestError('Title and Category are required');

    const expenseNo = `EXP-${Date.now()}`;
    const paymentNo = `PMT-${Date.now()}`;
    const targetBranchId = branchId || req.user.branchId || null;

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          expenseNo,
          title,
          category,
          amount: amt,
          paymentMode,
          description,
          companyId: targetCompanyId,
          branchId: targetBranchId,
          createdById: req.user.id,
        },
        include: {
          createdBy: { select: { name: true, email: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      // Create matching Payment Outward log
      await tx.payment.create({
        data: {
          paymentNo,
          type: 'PAYMENT_OUT',
          category: 'EXPENSE',
          amount: amt,
          paymentMode,
          referenceNo: expenseNo,
          description: `Expense payout: ${title} (${category})`,
          expenseId: expense.id,
          companyId: targetCompanyId,
          branchId: targetBranchId,
          createdById: req.user.id,
        },
      });

      return expense;
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_EXPENSE',
      module: 'FINANCE',
      details: { expenseId: result.id, expenseNo, amount: amt },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Expense recorded successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

export const getExpenses = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const expenses = await prisma.expense.findMany({
      where: companyId ? { companyId } : {},
      include: {
        createdBy: { select: { name: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, 'Expenses retrieved successfully', expenses);
  } catch (err) {
    next(err);
  }
};

// ── Cash & Bank Books ──────────────────────────────────────────
export const getCashBook = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const payments = await prisma.payment.findMany({
      where: {
        companyId: companyId || undefined,
        paymentMode: 'CASH',
      },
      include: {
        customer: { select: { name: true } },
        vendor: { select: { name: true } },
        expense: { select: { title: true } },
        createdBy: { select: { name: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, 'Cash book transactions retrieved', payments);
  } catch (err) {
    next(err);
  }
};

export const getBankBook = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const payments = await prisma.payment.findMany({
      where: {
        companyId: companyId || undefined,
        paymentMode: { in: ['BANK', 'UPI', 'CARD'] },
      },
      include: {
        customer: { select: { name: true } },
        vendor: { select: { name: true } },
        expense: { select: { title: true } },
        createdBy: { select: { name: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, 'Bank book transactions retrieved', payments);
  } catch (err) {
    next(err);
  }
};
