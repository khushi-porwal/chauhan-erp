import prisma from '../config/db.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

export const createVendor = async (req, res, next) => {
  try {
    const { name, email, phone, address, openingBalance, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    const balance = openingBalance ? parseFloat(openingBalance) : 0;

    const result = await prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.create({
        data: {
          name,
          email,
          phone,
          address,
          balance: balance,
          companyId: targetCompanyId
        }
      });

      if (balance !== 0) {
        await tx.vendorLedger.create({
          data: {
            vendorId: vendor.id,
            type: balance > 0 ? 'CREDIT' : 'DEBIT', // Typically, positive opening balance for supplier means we owe them (Credit)
            amount: Math.abs(balance),
            balance: balance,
            description: 'Opening Balance Entry',
            referenceNo: 'OPENING'
          }
        });
      }

      return vendor;
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_VENDOR',
      module: 'VENDOR',
      details: { vendorId: result.id, name: result.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Vendor created successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

export const getVendors = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const vendors = await prisma.vendor.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { name: 'asc' }
    });

    return successResponse(res, 'Vendors retrieved successfully', vendors);
  } catch (err) {
    next(err);
  }
};

export const updateVendor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address } = req.body;

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    if (req.user.role !== 'SUPER_ADMIN' && vendor.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this vendor');
    }

    const updated = await prisma.vendor.update({
      where: { id },
      data: { name, email, phone, address }
    });

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_VENDOR',
      module: 'VENDOR',
      details: { vendorId: updated.id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: vendor.companyId
    });

    return successResponse(res, 'Vendor updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const getVendorLedgers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vendor = await prisma.vendor.findUnique({ where: { id } });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    if (req.user.role !== 'SUPER_ADMIN' && vendor.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this ledger');
    }

    const ledgers = await prisma.vendorLedger.findMany({
      where: { vendorId: id },
      orderBy: { date: 'asc' }
    });

    return successResponse(res, 'Vendor ledgers retrieved successfully', ledgers);
  } catch (err) {
    next(err);
  }
};

export const getVendorPricingHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vendor = await prisma.vendor.findUnique({ where: { id } });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    if (req.user.role !== 'SUPER_ADMIN' && vendor.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this vendor');
    }

    // Fetch past purchase order items and purchase invoice items for this vendor
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrder: { vendorId: id } },
      include: {
        product: { select: { name: true, sku: true, barcode: true, gstRate: true } },
        purchaseOrder: { select: { orderNo: true, date: true } },
      },
      orderBy: { purchaseOrder: { date: 'desc' } },
    });

    const billItems = await prisma.purchaseInvoiceItem.findMany({
      where: { invoice: { vendorId: id } },
      include: {
        product: { select: { name: true, sku: true, barcode: true, gstRate: true } },
        invoice: { select: { billNo: true, date: true } },
      },
      orderBy: { invoice: { date: 'desc' } },
    });

    const history = [
      ...poItems.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || 'Product',
        sku: item.product?.sku,
        barcode: item.product?.barcode,
        sourceType: 'PURCHASE_ORDER',
        referenceNo: item.purchaseOrder?.orderNo || '—',
        date: item.purchaseOrder?.date,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: (item.gstRate && item.gstRate > 0) ? item.gstRate : (item.product?.gstRate || 0),
        total: item.total,
      })),
      ...billItems.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || 'Product',
        sku: item.product?.sku,
        barcode: item.product?.barcode,
        sourceType: 'PURCHASE_BILL',
        referenceNo: item.invoice?.billNo || '—',
        date: item.invoice?.date,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: (item.gstRate && item.gstRate > 0) ? item.gstRate : (item.product?.gstRate || 0),
        total: item.total,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return successResponse(res, 'Vendor pricing history retrieved successfully', history);
  } catch (err) {
    next(err);
  }
};

export const getVendorDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        ledgers: { orderBy: { date: 'desc' }, take: 50 },
        purchaseOrders: { orderBy: { date: 'desc' }, take: 20, include: { items: { include: { product: true } } } },
        purchaseInvoices: { orderBy: { date: 'desc' }, take: 20, include: { items: { include: { product: true } } } },
      },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    if (req.user.role !== 'SUPER_ADMIN' && vendor.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this vendor');
    }

    return successResponse(res, 'Vendor details retrieved successfully', vendor);
  } catch (err) {
    next(err);
  }
};

