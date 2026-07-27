import prisma from '../config/db.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

// ── Helper to resolve target Company ID ──────────────────────
const resolveCompanyId = async (providedCompanyId, user, vendorId, warehouseId) => {
  if (providedCompanyId) return providedCompanyId;
  if (user?.companyId) return user.companyId;
  if (vendorId) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (vendor?.companyId) return vendor.companyId;
  }
  if (warehouseId) {
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (warehouse?.companyId) return warehouse.companyId;
  }
  return null;
};

// ── Purchase Orders ───────────────────────────────────────────
export const createPurchaseOrder = async (req, res, next) => {
  try {
    const { vendorId, items, notes, discount = 0, companyId } = req.body;
    const targetCompanyId = await resolveCompanyId(companyId, req.user, vendorId, null);

    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    if (!vendorId || !items || items.length === 0) throw new BadRequestError('Missing required fields');

    const orderNo = `PO-${Date.now()}`;
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

    const order = await prisma.purchaseOrder.create({
      data: {
        orderNo,
        vendorId,
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
      action: 'CREATE_PURCHASE_ORDER',
      module: 'PURCHASE',
      details: { orderId: order.id, orderNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Purchase Order created successfully', order, 201);
  } catch (err) {
    next(err);
  }
};

export const getPurchaseOrders = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const orders = await prisma.purchaseOrder.findMany({
      where: companyId ? { companyId } : {},
      include: {
        vendor: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, 'Purchase Orders retrieved successfully', orders);
  } catch (err) {
    next(err);
  }
};

// ── Purchase Invoices ──────────────────────────────────────────
export const createPurchaseInvoice = async (req, res, next) => {
  try {
    const { vendorId, warehouseId, items, paidAmount = 0, paymentMode = 'CASH', notes, discount = 0, companyId } = req.body;
    const targetCompanyId = await resolveCompanyId(companyId, req.user, vendorId, warehouseId);

    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    if (!vendorId || !warehouseId || !items || items.length === 0) throw new BadRequestError('Missing required fields');

    const billNo = `BILL-${Date.now()}`;
    const pAmount = parseFloat(paidAmount || 0);

    const result = await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      let gstAmount = 0;
      const invoiceItems = [];

      for (const item of items) {
        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.unitPrice);
        let gstRate = parseFloat(item.gstRate || 0);
        if (gstRate === 0 && item.productId) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          if (prod?.gstRate) gstRate = prod.gstRate;
        }
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

        // ── INVENTORY INCREMENT (PURCHASE INWARD) ──
        // 1. Upsert warehouse stock levels safely using findFirst
        const existingStock = await tx.warehouseStock.findFirst({
          where: {
            warehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
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

        // 2. Increment general product stock
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
            referenceNo: billNo,
            productId: item.productId,
            variantId: item.variantId || null,
            toWarehouseId: warehouseId,
            quantity: qty,
            description: `Received via Purchase Invoice: ${billNo}`,
            createdById: req.user.id,
            companyId: targetCompanyId,
          },
        });
      }

      const netAmount = totalAmount + gstAmount - parseFloat(discount);
      const balanceAmount = Math.max(0, netAmount - pAmount);
      const status = pAmount >= netAmount ? 'PAID' : pAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

      // Create Purchase Invoice
      const invoice = await tx.purchaseInvoice.create({
        data: {
          billNo,
          vendorId,
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
          notes,
          items: {
            create: invoiceItems,
          },
        },
        include: { items: true },
      });

      // ── LEDGER & BALANCE RECORDINGS ──
      // 1. Credit the vendor ledger (we owe them more)
      const currentVendor = await tx.vendor.findUnique({ where: { id: vendorId } });
      const vendorBalanceAfterBill = (currentVendor?.balance || 0) + netAmount;

      await tx.vendor.update({
        where: { id: vendorId },
        data: { balance: vendorBalanceAfterBill },
      });

      await tx.vendorLedger.create({
        data: {
          vendorId,
          type: 'CREDIT',
          amount: netAmount,
          balance: vendorBalanceAfterBill,
          description: `Purchase Invoice generated: ${billNo}`,
          referenceNo: billNo,
        },
      });

      // 2. If payment is made, log Payment Out and Ledger debit (we owe them less)
      if (pAmount > 0) {
        const finalVendorBalance = vendorBalanceAfterBill - pAmount;
        await tx.vendor.update({
          where: { id: vendorId },
          data: { balance: finalVendorBalance },
        });

        await tx.vendorLedger.create({
          data: {
            vendorId,
            type: 'DEBIT',
            amount: pAmount,
            balance: finalVendorBalance,
            description: `Paid for Purchase Bill: ${billNo}`,
            referenceNo: billNo,
          },
        });

        const paymentNo = `PMT-${Date.now()}`;
        await tx.payment.create({
          data: {
            paymentNo,
            type: 'PAYMENT_OUT',
            category: 'VENDOR',
            amount: pAmount,
            paymentMode,
            referenceNo: billNo,
            description: `Bill settlement: ${billNo}`,
            vendorId,
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
      action: 'CREATE_PURCHASE_INVOICE',
      module: 'PURCHASE',
      details: { invoiceId: result.id, billNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Purchase Invoice created successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

export const getPurchaseInvoices = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const invoices = await prisma.purchaseInvoice.findMany({
      where: companyId ? { companyId } : {},
      include: {
        vendor: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, 'Purchase Invoices retrieved successfully', invoices);
  } catch (err) {
    next(err);
  }
};

// ── Purchase Returns ───────────────────────────────────────────
export const createPurchaseReturn = async (req, res, next) => {
  try {
    const { invoiceId, vendorId, warehouseId, items, notes, discount = 0, companyId } = req.body;
    const targetCompanyId = await resolveCompanyId(companyId, req.user, vendorId, warehouseId);

    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    if (!vendorId || !warehouseId || !items || items.length === 0) throw new BadRequestError('Missing required fields');

    const returnNo = `PR-${Date.now()}`;

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

        // ── INVENTORY DECREMENT (RETURNS) ──
        // 1. Fetch current stock in warehouse
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
          throw new BadRequestError(`Insufficient stock for product '${product?.name || item.productId}' to return. Available in warehouse: ${whStock?.quantity || 0}`);
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
            referenceNo: returnNo,
            productId: item.productId,
            variantId: item.variantId || null,
            fromWarehouseId: warehouseId,
            quantity: qty,
            description: `Returned via Purchase Return: ${returnNo}`,
            createdById: req.user.id,
            companyId: targetCompanyId,
          },
        });
      }

      const netAmount = totalAmount + gstAmount - parseFloat(discount);

      // Create Purchase Return
      const prReturn = await tx.purchaseReturn.create({
        data: {
          returnNo,
          invoiceId: invoiceId || null,
          vendorId,
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
      // Debit vendor ledger (reduces balance we owe them)
      const currentVendor = await tx.vendor.findUnique({ where: { id: vendorId } });
      const vendorBalanceAfterReturn = (currentVendor?.balance || 0) - netAmount;

      await tx.vendor.update({
        where: { id: vendorId },
        data: { balance: vendorBalanceAfterReturn },
      });

      await tx.vendorLedger.create({
        data: {
          vendorId,
          type: 'DEBIT',
          amount: netAmount,
          balance: vendorBalanceAfterReturn,
          description: `Purchase Return logged: ${returnNo}`,
          referenceNo: returnNo,
        },
      });

      return prReturn;
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_PURCHASE_RETURN',
      module: 'PURCHASE',
      details: { returnId: result.id, returnNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Purchase Return logged successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

export const getPurchaseReturns = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const returns = await prisma.purchaseReturn.findMany({
      where: companyId ? { companyId } : {},
      include: {
        vendor: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, 'Purchase Returns retrieved successfully', returns);
  } catch (err) {
    next(err);
  }
};

export const updatePurchaseOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'APPROVED', 'RECEIVED', 'CANCELLED'].includes(status)) {
      throw new BadRequestError('Invalid PO status');
    }

    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundError('Purchase Order not found');

    if (req.user.role !== 'SUPER_ADMIN' && order.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this Purchase Order');
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status },
    });

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_PO_STATUS',
      module: 'PURCHASE',
      details: { orderId: id, status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: order.companyId,
    });

    return successResponse(res, 'Purchase Order status updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const convertPoToInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { warehouseId, paidAmount = 0, paymentMode = 'CASH', notes } = req.body;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!po) throw new NotFoundError('Purchase Order not found');

    if (req.user.role !== 'SUPER_ADMIN' && po.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this Purchase Order');
    }

    if (!warehouseId) throw new BadRequestError('Warehouse ID is required for stock receiving');

    const billNo = `BILL-${Date.now()}`;
    const pAmount = parseFloat(paidAmount || 0);

    const result = await prisma.$transaction(async (tx) => {
      const invoiceItems = [];

      for (const item of po.items) {
        invoiceItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstRate: item.gstRate,
          gstAmount: item.gstAmount,
          discount: item.discount,
          total: item.total,
        });

        // 1. Warehouse stock increment safely
        const existingStock = await tx.warehouseStock.findFirst({
          where: {
            warehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
          },
        });

        if (existingStock) {
          await tx.warehouseStock.update({
            where: { id: existingStock.id },
            data: { quantity: { increment: item.quantity } },
          });
        } else {
          await tx.warehouseStock.create({
            data: {
              warehouseId,
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              companyId: po.companyId,
            },
          });
        }

        // 2. Product general stock increment
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: item.quantity } },
        });

        // 3. Stock transaction log
        await tx.stockTransaction.create({
          data: {
            type: 'STOCK_IN',
            referenceNo: billNo,
            productId: item.productId,
            variantId: item.variantId || null,
            toWarehouseId: warehouseId,
            quantity: item.quantity,
            description: `Converted from PO: ${po.orderNo}`,
            createdById: req.user.id,
            companyId: po.companyId,
          },
        });
      }

      const balanceAmount = Math.max(0, po.netAmount - pAmount);
      const status = pAmount >= po.netAmount ? 'PAID' : pAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

      // Create Purchase Invoice
      const invoice = await tx.purchaseInvoice.create({
        data: {
          billNo,
          vendorId: po.vendorId,
          companyId: po.companyId,
          branchId: po.branchId,
          warehouseId,
          totalAmount: po.totalAmount,
          discount: po.discount,
          gstAmount: po.gstAmount,
          netAmount: po.netAmount,
          paidAmount: pAmount,
          balanceAmount,
          paymentMode,
          status,
          notes: notes || `Converted from Purchase Order ${po.orderNo}`,
          items: { create: invoiceItems },
        },
        include: { items: true },
      });

      // Update PO status to RECEIVED
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED' },
      });

      // Vendor ledger & balance
      const currentVendor = await tx.vendor.findUnique({ where: { id: po.vendorId } });
      const vendorBalanceAfterBill = (currentVendor?.balance || 0) + po.netAmount;

      await tx.vendor.update({
        where: { id: po.vendorId },
        data: { balance: vendorBalanceAfterBill },
      });

      await tx.vendorLedger.create({
        data: {
          vendorId: po.vendorId,
          type: 'CREDIT',
          amount: po.netAmount,
          balance: vendorBalanceAfterBill,
          description: `Purchase Invoice from PO ${po.orderNo}: ${billNo}`,
          referenceNo: billNo,
        },
      });

      if (pAmount > 0) {
        const finalVendorBalance = vendorBalanceAfterBill - pAmount;
        await tx.vendor.update({
          where: { id: po.vendorId },
          data: { balance: finalVendorBalance },
        });

        await tx.vendorLedger.create({
          data: {
            vendorId: po.vendorId,
            type: 'DEBIT',
            amount: pAmount,
            balance: finalVendorBalance,
            description: `Payment for Bill: ${billNo}`,
            referenceNo: billNo,
          },
        });

        await tx.payment.create({
          data: {
            paymentNo: `PMT-${Date.now()}`,
            type: 'PAYMENT_OUT',
            category: 'VENDOR',
            amount: pAmount,
            paymentMode,
            referenceNo: billNo,
            description: `Bill settlement: ${billNo}`,
            vendorId: po.vendorId,
            companyId: po.companyId,
            branchId: po.branchId,
            createdById: req.user.id,
          },
        });
      }

      return invoice;
    });

    await logAudit({
      userId: req.user.id,
      action: 'CONVERT_PO_TO_INVOICE',
      module: 'PURCHASE',
      details: { orderId: id, invoiceId: result.id, billNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: po.companyId,
    });

    return successResponse(res, 'Purchase Order converted to Invoice successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

// ── Goods Receiving (GRN Workflow) ───────────────────────────
export const receivePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { warehouseId, items } = req.body;

    if (!warehouseId || !items || items.length === 0) {
      throw new BadRequestError('Warehouse ID and received items are required');
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!po) throw new NotFoundError('Purchase Order not found');
    if (req.user.role !== 'SUPER_ADMIN' && po.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new NotFoundError('Warehouse not found');

    const result = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const qty = parseFloat(item.quantity);
        if (isNaN(qty) || qty <= 0) continue;

        // 1. Upsert WarehouseStock
        const existingStock = await tx.warehouseStock.findFirst({
          where: {
            warehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
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
              companyId: po.companyId,
            },
          });
        }

        // 2. Increment Product & Variant Stock
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: qty } },
        });

        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: qty } },
          });
        }

        // 3. Upsert Batch if batchNumber provided
        if (item.batchNumber) {
          const existingBatch = await tx.batch.findFirst({
            where: {
              companyId: po.companyId,
              productId: item.productId,
              batchNumber: item.batchNumber,
            },
          });

          if (existingBatch) {
            await tx.batch.update({
              where: { id: existingBatch.id },
              data: {
                quantity: { increment: qty },
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : existingBatch.expiryDate,
                mfgDate: item.mfgDate ? new Date(item.mfgDate) : existingBatch.mfgDate,
                warehouseId: warehouseId || existingBatch.warehouseId,
              },
            });
          } else {
            await tx.batch.create({
              data: {
                batchNumber: item.batchNumber,
                productId: item.productId,
                quantity: qty,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
                warehouseId,
                companyId: po.companyId,
              },
            });
          }
        }

        // 4. Log StockTransaction (STOCK_IN)
        await tx.stockTransaction.create({
          data: {
            type: 'STOCK_IN',
            referenceNo: po.orderNo,
            productId: item.productId,
            variantId: item.variantId || null,
            toWarehouseId: warehouseId,
            quantity: qty,
            batchNumber: item.batchNumber || null,
            description: `Goods Received from PO ${po.orderNo}`,
            createdById: req.user.id,
            companyId: po.companyId,
          },
        });
      }

      // Update PO Status
      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED' },
        include: { items: true },
      });

      return updatedPo;
    });

    await logAudit({
      userId: req.user.id,
      action: 'RECEIVE_PURCHASE_ORDER',
      module: 'PURCHASE',
      details: { orderId: id, orderNo: po.orderNo, warehouseId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: po.companyId,
    });

    return successResponse(res, 'Goods received and inventory updated successfully', result);
  } catch (err) {
    next(err);
  }
};

// ── Vendor History & Pricing ──────────────────────────────────
export const getVendorHistory = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        purchaseOrders: {
          orderBy: { date: 'desc' },
          take: 20,
          include: { items: { include: { product: { select: { name: true, sku: true } } } } },
        },
        purchaseInvoices: {
          orderBy: { date: 'desc' },
          take: 20,
          include: { items: { include: { product: { select: { name: true, sku: true } } } } },
        },
        ledgers: {
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });

    if (!vendor) throw new NotFoundError('Vendor not found');
    if (req.user.role !== 'SUPER_ADMIN' && vendor.companyId !== companyId) {
      throw new ForbiddenError('Access denied');
    }

    return successResponse(res, 'Vendor history retrieved successfully', vendor);
  } catch (err) {
    next(err);
  }
};
