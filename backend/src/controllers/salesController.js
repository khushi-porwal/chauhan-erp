import prisma from '../config/db.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

// Helper to get active financial year
const getActiveFinancialYear = async (companyId) => {
  const fy = await prisma.financialYear.findFirst({
    where: { companyId, isActive: true },
  });
  if (!fy) {
    throw new BadRequestError('No active financial year found for this company');
  }
  return fy;
};

// ── Quotations ────────────────────────────────────────────────
export const createQuotation = async (req, res, next) => {
  try {
    const { customerId, validUntil, items, notes, discount = 0, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    if (!customerId || !items || items.length === 0) throw new BadRequestError('Missing required fields');

    const quotationNo = `QT-${Date.now()}`;

    let totalAmount = 0;
    let gstAmount = 0;

    const quotationItems = items.map(item => {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice);
      const gstRate = parseFloat(item.gstRate || 0);
      const itemDiscount = parseFloat(item.discount || 0);

      const subtotal = qty * price - itemDiscount;
      const tax = subtotal * (gstRate / 100);
      const total = subtotal + tax;

      totalAmount += subtotal;
      gstAmount += tax;

      return {
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: qty,
        unitPrice: price,
        gstRate,
        gstAmount: tax,
        discount: itemDiscount,
        total,
      };
    });

    const netAmount = totalAmount + gstAmount - parseFloat(discount);

    const quotation = await prisma.quotation.create({
      data: {
        quotationNo,
        validUntil: validUntil ? new Date(validUntil) : null,
        customerId,
        companyId: targetCompanyId,
        branchId: req.user.branchId || null,
        totalAmount,
        discount: parseFloat(discount),
        gstAmount,
        netAmount,
        status: 'PENDING',
        notes,
        items: {
          create: quotationItems,
        },
      },
      include: { items: true },
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_QUOTATION',
      module: 'SALES',
      details: { quotationId: quotation.id, quotationNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Quotation created successfully', quotation, 201);
  } catch (err) {
    next(err);
  }
};

export const getQuotations = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const quotations = await prisma.quotation.findMany({
      where: companyId ? { companyId } : {},
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, 'Quotations retrieved successfully', quotations);
  } catch (err) {
    next(err);
  }
};

// ── Sales Orders ──────────────────────────────────────────────
export const createSalesOrder = async (req, res, next) => {
  try {
    const { customerId, items, notes, discount = 0, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    if (!customerId || !items || items.length === 0) throw new BadRequestError('Missing required fields');

    const orderNo = `SO-${Date.now()}`;
    let totalAmount = 0;
    let gstAmount = 0;

    const orderItems = items.map(item => {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice);
      const gstRate = parseFloat(item.gstRate || 0);
      const itemDiscount = parseFloat(item.discount || 0);

      const subtotal = qty * price - itemDiscount;
      const tax = subtotal * (gstRate / 100);
      const total = subtotal + tax;

      totalAmount += subtotal;
      gstAmount += tax;

      return {
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: qty,
        unitPrice: price,
        gstRate,
        gstAmount: tax,
        discount: itemDiscount,
        total,
      };
    });

    const netAmount = totalAmount + gstAmount - parseFloat(discount);

    const order = await prisma.salesOrder.create({
      data: {
        orderNo,
        customerId,
        companyId: targetCompanyId,
        branchId: req.user.branchId || null,
        totalAmount,
        discount: parseFloat(discount),
        gstAmount,
        netAmount,
        status: 'PENDING',
        notes,
        items: {
          create: orderItems,
        },
      },
      include: { items: true },
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_SALES_ORDER',
      module: 'SALES',
      details: { orderId: order.id, orderNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Sales Order created successfully', order, 201);
  } catch (err) {
    next(err);
  }
};

export const getSalesOrders = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const orders = await prisma.salesOrder.findMany({
      where: companyId ? { companyId } : {},
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, 'Sales Orders retrieved successfully', orders);
  } catch (err) {
    next(err);
  }
};

// ── Delivery Challans ──────────────────────────────────────────
export const createDeliveryChallan = async (req, res, next) => {
  try {
    const { customerId, warehouseId, items, notes, discount = 0, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    if (!customerId || !items || items.length === 0) throw new BadRequestError('Missing required fields');

    const challanNo = `DC-${Date.now()}`;
    let totalAmount = 0;
    let gstAmount = 0;

    const challanItems = items.map(item => {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice);
      const gstRate = parseFloat(item.gstRate || 0);
      const itemDiscount = parseFloat(item.discount || 0);

      const subtotal = qty * price - itemDiscount;
      const tax = subtotal * (gstRate / 100);
      const total = subtotal + tax;

      totalAmount += subtotal;
      gstAmount += tax;

      return {
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: qty,
        unitPrice: price,
        gstRate,
        gstAmount: tax,
        discount: itemDiscount,
        total,
      };
    });

    const netAmount = totalAmount + gstAmount - parseFloat(discount);

    const challan = await prisma.deliveryChallan.create({
      data: {
        challanNo,
        customerId,
        warehouseId: warehouseId || null,
        companyId: targetCompanyId,
        branchId: req.user.branchId || null,
        totalAmount,
        discount: parseFloat(discount),
        gstAmount,
        netAmount,
        status: 'PENDING',
        notes,
        items: {
          create: challanItems,
        },
      },
      include: { items: true },
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_DELIVERY_CHALLAN',
      module: 'SALES',
      details: { challanId: challan.id, challanNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Delivery Challan created successfully', challan, 201);
  } catch (err) {
    next(err);
  }
};

export const getDeliveryChallans = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const challans = await prisma.deliveryChallan.findMany({
      where: companyId ? { companyId } : {},
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, 'Delivery Challans retrieved successfully', challans);
  } catch (err) {
    next(err);
  }
};

// ── Sales Invoices ─────────────────────────────────────────────
export const createSalesInvoice = async (req, res, next) => {
  try {
    const { customerId, warehouseId, items, paidAmount = 0, paymentMode = 'CASH', notes, discount = 0, isPOS = false, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    if (!customerId || !warehouseId || !items || items.length === 0) throw new BadRequestError('Missing required fields');

    const invoiceNo = isPOS ? `POS-${Date.now()}` : `INV-${Date.now()}`;
    const pAmount = parseFloat(paidAmount || 0);

    // Run in atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      let gstAmount = 0;

      const invoiceItems = [];

      for (const item of items) {
        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.unitPrice);
        const gstRate = parseFloat(item.gstRate || 0);
        const itemDiscount = parseFloat(item.discount || 0);

        const subtotal = qty * price - itemDiscount;
        const tax = subtotal * (gstRate / 100);
        const total = subtotal + tax;

        totalAmount += subtotal;
        gstAmount += tax;

        invoiceItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: qty,
          unitPrice: price,
          gstRate,
          gstAmount: tax,
          discount: itemDiscount,
          total,
        });

        // ── INVENTORY DECREMENT ──
        // 1. Fetch current stock levels in warehouse
        const whStock = await tx.warehouseStock.findUnique({
          where: {
            warehouseId_productId_variantId: {
              warehouseId,
              productId: item.productId,
              variantId: item.variantId || null,
            },
          },
        });

        if (!whStock || whStock.quantity < qty) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          throw new BadRequestError(`Insufficient stock for product '${product?.name || item.productId}'. Available in warehouse: ${whStock?.quantity || 0}`);
        }

        // 2. Decrement warehouse stock
        await tx.warehouseStock.update({
          where: { id: whStock.id },
          data: { quantity: { decrement: qty } },
        });

        // 3. Decrement Product general stock
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: qty } },
        });

        // 4. Decrement variant stock if applicable
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: qty } },
          });
        }

        // 5. Create Stock Transaction log
        await tx.stockTransaction.create({
          data: {
            type: 'STOCK_OUT',
            referenceNo: invoiceNo,
            productId: item.productId,
            variantId: item.variantId || null,
            fromWarehouseId: warehouseId,
            quantity: qty,
            description: `Sold via Sales Invoice: ${invoiceNo}`,
            createdById: req.user.id,
            companyId: targetCompanyId,
          },
        });
      }

      const netAmount = totalAmount + gstAmount - parseFloat(discount);
      const balanceAmount = Math.max(0, netAmount - pAmount);
      const status = pAmount >= netAmount ? 'PAID' : pAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

      // Create Sales Invoice
      const invoice = await tx.salesInvoice.create({
        data: {
          invoiceNo,
          customerId,
          companyId: targetCompanyId,
          branchId: req.user.branchId || null,
          warehouseId,
          totalAmount,
          discount: parseFloat(discount),
          gstAmount,
          netAmount,
          paidAmount: pAmount,
          balanceAmount,
          paymentMode,
          status,
          isPOS,
          notes,
          items: {
            create: invoiceItems,
          },
        },
        include: { items: true },
      });

      // ── LEDGER & BALANCE RECORDINGS ──
      // 1. Debit the customer ledger for invoice net amount
      const currentCustomer = await tx.customer.findUnique({ where: { id: customerId } });
      const customerBalanceAfterInvoice = (currentCustomer?.balance || 0) + netAmount;

      await tx.customer.update({
        where: { id: customerId },
        data: { balance: customerBalanceAfterInvoice },
      });

      await tx.customerLedger.create({
        data: {
          customerId,
          type: 'DEBIT',
          amount: netAmount,
          balance: customerBalanceAfterInvoice,
          description: `Sales Invoice generated: ${invoiceNo}`,
          referenceNo: invoiceNo,
        },
      });

      // 2. If payment is made, log Payment and Ledger credit
      if (pAmount > 0) {
        const finalCustomerBalance = customerBalanceAfterInvoice - pAmount;
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: finalCustomerBalance },
        });

        // Customer Ledger Credit
        await tx.customerLedger.create({
          data: {
            customerId,
            type: 'CREDIT',
            amount: pAmount,
            balance: finalCustomerBalance,
            description: `Payment received for Invoice: ${invoiceNo}`,
            referenceNo: invoiceNo,
          },
        });

        const paymentNo = `PMT-${Date.now()}`;
        // Create Payment entry
        await tx.payment.create({
          data: {
            paymentNo,
            type: 'PAYMENT_IN',
            category: 'CUSTOMER',
            amount: pAmount,
            paymentMode,
            referenceNo: invoiceNo,
            description: `Invoice collection: ${invoiceNo}`,
            customerId,
            companyId: targetCompanyId,
            branchId: req.user.branchId || null,
            createdById: req.user.id,
          },
        });
      }

      return invoice;
    });

    await logAudit({
      userId: req.user.id,
      action: isPOS ? 'POS_CHECKOUT' : 'CREATE_SALES_INVOICE',
      module: 'SALES',
      details: { invoiceId: result.id, invoiceNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Sales Invoice created successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

export const getSalesInvoices = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const invoices = await prisma.salesInvoice.findMany({
      where: companyId ? { companyId } : {},
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, 'Sales Invoices retrieved successfully', invoices);
  } catch (err) {
    next(err);
  }
};

// ── Sales Returns ──────────────────────────────────────────────
export const createSalesReturn = async (req, res, next) => {
  try {
    const { invoiceId, customerId, warehouseId, items, notes, discount = 0, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    if (!customerId || !warehouseId || !items || items.length === 0) throw new BadRequestError('Missing required fields');

    const returnNo = `SR-${Date.now()}`;

    const result = await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      let gstAmount = 0;
      const returnItems = [];

      for (const item of items) {
        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.unitPrice);
        const gstRate = parseFloat(item.gstRate || 0);
        const itemDiscount = parseFloat(item.discount || 0);

        const subtotal = qty * price - itemDiscount;
        const tax = subtotal * (gstRate / 100);
        const total = subtotal + tax;

        totalAmount += subtotal;
        gstAmount += tax;

        returnItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: qty,
          unitPrice: price,
          gstRate,
          gstAmount: tax,
          discount: itemDiscount,
          total,
        });

        // ── INVENTORY INCREMENT (RETURNS) ──
        // 1. Upsert stock in selected warehouse
        const existingStock = await tx.warehouseStock.findUnique({
          where: {
            warehouseId_productId_variantId: {
              warehouseId,
              productId: item.productId,
              variantId: item.variantId || null,
            },
          },
        });

        if (existingStock) {
          await tx.warehouseStock.update({
            where: { id: existingStock.id },
            data: { quantity: { increment: qty } },
          });
        } else {
          await tx.warehouseStock.create({
            data: {
              warehouseId,
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: qty,
              companyId: targetCompanyId,
            },
          });
        }

        // 2. Increment Product general stock
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: qty } },
        });

        // 3. Increment variant stock if applicable
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: qty } },
          });
        }

        // 4. Create Stock Transaction log
        await tx.stockTransaction.create({
          data: {
            type: 'STOCK_IN',
            referenceNo: returnNo,
            productId: item.productId,
            variantId: item.variantId || null,
            toWarehouseId: warehouseId,
            quantity: qty,
            description: `Returned via Sales Return: ${returnNo}`,
            createdById: req.user.id,
            companyId: targetCompanyId,
          },
        });
      }

      const netAmount = totalAmount + gstAmount - parseFloat(discount);

      // Create Sales Return
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNo,
          invoiceId: invoiceId || null,
          customerId,
          companyId: targetCompanyId,
          branchId: req.user.branchId || null,
          warehouseId,
          totalAmount,
          discount: parseFloat(discount),
          gstAmount,
          netAmount,
          notes,
          items: {
            create: returnItems,
          },
        },
        include: { items: true },
      });

      // ── LEDGER & BALANCE RECORDINGS ──
      // Credit customer ledger (Sales return reduces what customer owes us)
      const currentCustomer = await tx.customer.findUnique({ where: { id: customerId } });
      const customerBalanceAfterReturn = (currentCustomer?.balance || 0) - netAmount;

      await tx.customer.update({
        where: { id: customerId },
        data: { balance: customerBalanceAfterReturn },
      });

      await tx.customerLedger.create({
        data: {
          customerId,
          type: 'CREDIT',
          amount: netAmount,
          balance: customerBalanceAfterReturn,
          description: `Sales Return logged: ${returnNo}`,
          referenceNo: returnNo,
        },
      });

      return salesReturn;
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_SALES_RETURN',
      module: 'SALES',
      details: { returnId: result.id, returnNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Sales Return logged successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

export const getSalesReturns = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const returns = await prisma.salesReturn.findMany({
      where: companyId ? { companyId } : {},
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, 'Sales Returns retrieved successfully', returns);
  } catch (err) {
    next(err);
  }
};
