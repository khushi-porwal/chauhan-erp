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

// ── Purchase Requisitions ──────────────────────────────────────

export const createRequisition = async (req, res, next) => {
  try {
    const { department, items, notes, companyId } = req.body;
    const targetCompanyId = companyId || req.user.companyId;
    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    if (!items || items.length === 0) throw new BadRequestError('At least one item is required');

    const requisitionNo = `REQ-${Date.now()}`;

    const requisition = await prisma.purchaseRequisition.create({
      data: {
        requisitionNo,
        department: department || null,
        requestedById: req.user.id,
        companyId: targetCompanyId,
        branchId: req.user.branchId || null,
        status: 'SUBMITTED',
        notes: notes || null,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: parseFloat(item.quantity),
            estimatedPrice: parseFloat(item.estimatedPrice || 0),
          })),
        },
      },
      include: {
        items: { include: { product: { select: { name: true, sku: true } } } },
        requestedBy: { select: { name: true, email: true } },
      },
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { companyId: targetCompanyId, role: { in: ['COMPANY_ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true },
    });
    await Promise.all(
      admins.map(admin =>
        prisma.notification.create({
          data: {
            title: 'New Purchase Requisition',
            message: `Requisition ${requisitionNo} submitted by ${req.user.name}`,
            type: 'SYSTEM',
            userId: admin.id,
            companyId: targetCompanyId,
          },
        })
      )
    );

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_REQUISITION',
      module: 'PURCHASE',
      details: { requisitionId: requisition.id, requisitionNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Purchase Requisition created successfully', requisition, 201);
  } catch (err) {
    next(err);
  }
};

export const getRequisitions = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const requisitions = await prisma.purchaseRequisition.findMany({
      where: companyId ? { companyId } : {},
      include: {
        items: { include: { product: { select: { name: true, sku: true } } } },
        requestedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, 'Purchase Requisitions retrieved successfully', requisitions);
  } catch (err) {
    next(err);
  }
};

export const updateRequisitionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED_TO_PO'];
    if (!allowed.includes(status)) throw new BadRequestError('Invalid requisition status');

    const req_ = await prisma.purchaseRequisition.findUnique({ where: { id } });
    if (!req_) throw new NotFoundError('Purchase Requisition not found');

    if (req.user.role !== 'SUPER_ADMIN' && req_.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    const updated = await prisma.purchaseRequisition.update({
      where: { id },
      data: { status },
    });

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_REQUISITION_STATUS',
      module: 'PURCHASE',
      details: { requisitionId: id, status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: req_.companyId,
    });

    return successResponse(res, 'Requisition status updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const convertRequisitionToPO = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { vendorId, discount = 0, notes, expectedDeliveryDate } = req.body;

    if (!vendorId) throw new BadRequestError('Vendor ID is required to convert to PO');

    const requisition = await prisma.purchaseRequisition.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { purchasePrice: true } } } } },
    });

    if (!requisition) throw new NotFoundError('Requisition not found');
    if (req.user.role !== 'SUPER_ADMIN' && requisition.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }
    if (requisition.status !== 'APPROVED') {
      throw new BadRequestError('Only APPROVED requisitions can be converted to PO');
    }

    const orderNo = `PO-${Date.now()}`;
    let totalAmount = 0;
    let gstAmount = 0;

    const orderItems = requisition.items.map(item => {
      const price = item.estimatedPrice || item.product?.purchasePrice || 0;
      const subtotal = item.quantity * price;
      totalAmount += subtotal;
      return {
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity,
        receivedQuantity: 0,
        unitPrice: price,
        gstRate: 0,
        gstAmount: 0,
        discount: 0,
        total: subtotal,
      };
    });

    const netAmount = totalAmount + gstAmount - parseFloat(discount);

    const order = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          orderNo,
          vendorId,
          companyId: requisition.companyId,
          branchId: requisition.branchId,
          totalAmount,
          discount: parseFloat(discount),
          gstAmount,
          netAmount,
          status: 'PENDING',
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          notes: notes || `Converted from Requisition ${requisition.requisitionNo}`,
          items: { create: orderItems },
        },
        include: { items: true },
      });

      await tx.purchaseRequisition.update({
        where: { id },
        data: { status: 'CONVERTED_TO_PO' },
      });

      return po;
    });

    await logAudit({
      userId: req.user.id,
      action: 'CONVERT_REQUISITION_TO_PO',
      module: 'PURCHASE',
      details: { requisitionId: id, orderId: order.id, orderNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: requisition.companyId,
    });

    return successResponse(res, 'Requisition converted to Purchase Order successfully', order, 201);
  } catch (err) {
    next(err);
  }
};

// ── PO Approval ───────────────────────────────────────────────

export const approvePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'APPROVE' | 'REJECT'

    const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { vendor: { select: { name: true } } } });
    if (!po) throw new NotFoundError('Purchase Order not found');

    if (req.user.role !== 'SUPER_ADMIN' && po.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    if (!['APPROVE', 'REJECT'].includes(action)) throw new BadRequestError('Action must be APPROVE or REJECT');

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: newStatus,
        approvedById: action === 'APPROVE' ? req.user.id : null,
        approvedAt: action === 'APPROVE' ? new Date() : null,
      },
    });

    // Create notification for all company users
    await prisma.notification.create({
      data: {
        title: `Purchase Order ${newStatus}`,
        message: `PO ${po.orderNo} has been ${newStatus.toLowerCase()} by ${req.user.name}`,
        type: 'SYSTEM',
        companyId: po.companyId,
      },
    });

    await logAudit({
      userId: req.user.id,
      action: `${action}_PURCHASE_ORDER`,
      module: 'PURCHASE',
      details: { orderId: id, orderNo: po.orderNo, status: newStatus },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: po.companyId,
    });

    return successResponse(res, `Purchase Order ${newStatus.toLowerCase()} successfully`, updated);
  } catch (err) {
    next(err);
  }
};

// ── Partial GRN (Goods Receipt Note) ─────────────────────────

export const partialReceivePO = async (req, res, next) => {
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
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
      throw new BadRequestError(`PO is already ${po.status}. Cannot receive more.`);
    }

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new NotFoundError('Warehouse not found');

    const result = await prisma.$transaction(async (tx) => {
      for (const receivedItem of items) {
        const qty = parseFloat(receivedItem.quantity);
        if (isNaN(qty) || qty <= 0) continue;

        // Find the PO line item
        const poItem = po.items.find(i => i.id === receivedItem.itemId || i.productId === receivedItem.productId);
        if (!poItem) continue;

        const remainingQty = poItem.quantity - poItem.receivedQuantity;
        const receiveQty = Math.min(qty, remainingQty);
        if (receiveQty <= 0) continue;

        // Update receivedQuantity on PO item
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQuantity: { increment: receiveQty } },
        });

        // Upsert WarehouseStock
        const existingStock = await tx.warehouseStock.findFirst({
          where: { warehouseId, productId: poItem.productId, variantId: poItem.variantId || null },
        });

        if (existingStock) {
          await tx.warehouseStock.update({
            where: { id: existingStock.id },
            data: { quantity: { increment: receiveQty } },
          });
        } else {
          await tx.warehouseStock.create({
            data: {
              warehouseId,
              productId: poItem.productId,
              variantId: poItem.variantId || null,
              quantity: receiveQty,
              companyId: po.companyId,
            },
          });
        }

        // Increment Product stock
        await tx.product.update({
          where: { id: poItem.productId },
          data: { currentStock: { increment: receiveQty } },
        });

        if (poItem.variantId) {
          await tx.productVariant.update({
            where: { id: poItem.variantId },
            data: { stock: { increment: receiveQty } },
          });
        }

        // Upsert Batch if provided
        if (receivedItem.batchNumber) {
          const existingBatch = await tx.batch.findFirst({
            where: { companyId: po.companyId, productId: poItem.productId, batchNumber: receivedItem.batchNumber },
          });
          if (existingBatch) {
            await tx.batch.update({
              where: { id: existingBatch.id },
              data: { quantity: { increment: receiveQty } },
            });
          } else {
            await tx.batch.create({
              data: {
                batchNumber: receivedItem.batchNumber,
                productId: poItem.productId,
                quantity: receiveQty,
                expiryDate: receivedItem.expiryDate ? new Date(receivedItem.expiryDate) : null,
                mfgDate: receivedItem.mfgDate ? new Date(receivedItem.mfgDate) : null,
                warehouseId,
                companyId: po.companyId,
              },
            });
          }
        }

        // Log StockTransaction
        await tx.stockTransaction.create({
          data: {
            type: 'STOCK_IN',
            referenceNo: po.orderNo,
            productId: poItem.productId,
            variantId: poItem.variantId || null,
            toWarehouseId: warehouseId,
            quantity: receiveQty,
            batchNumber: receivedItem.batchNumber || null,
            description: `Partial receipt from PO ${po.orderNo}`,
            createdById: req.user.id,
            companyId: po.companyId,
          },
        });
      }

      // Re-fetch PO items to determine new status
      const freshItems = await tx.purchaseOrderItem.findMany({ where: { orderId: id } });
      const allReceived = freshItems.every(i => i.receivedQuantity >= i.quantity);
      const anyReceived = freshItems.some(i => i.receivedQuantity > 0);
      const newStatus = allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status;

      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: { status: newStatus },
        include: { items: { include: { product: { select: { name: true } } } } },
      });

      return updatedPo;
    });

    if (result.status === 'RECEIVED' || result.status === 'PARTIALLY_RECEIVED') {
      await prisma.notification.create({
        data: {
          title: `PO ${result.status === 'RECEIVED' ? 'Fully' : 'Partially'} Received`,
          message: `Purchase Order ${po.orderNo} is now ${result.status}`,
          type: 'SYSTEM',
          companyId: po.companyId,
        },
      });
    }

    await logAudit({
      userId: req.user.id,
      action: 'PARTIAL_RECEIVE_PO',
      module: 'PURCHASE',
      details: { orderId: id, orderNo: po.orderNo, warehouseId, newStatus: result.status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: po.companyId,
    });

    return successResponse(res, 'Goods received and inventory updated successfully', result);
  } catch (err) {
    next(err);
  }
};

// ── Get Single PO ─────────────────────────────────────────────

export const getPurchaseOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        items: {
          include: {
            product: { select: { name: true, sku: true, barcode: true } },
            variant: { select: { name: true, sku: true } },
          },
        },
        approvedBy: { select: { name: true, email: true } },
      },
    });

    if (!po) throw new NotFoundError('Purchase Order not found');
    if (req.user.role !== 'SUPER_ADMIN' && po.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    return successResponse(res, 'Purchase Order retrieved successfully', po);
  } catch (err) {
    next(err);
  }
};

// ── PDF Purchase Order ────────────────────────────────────────

export const generatePoPdf = async (req, res, next) => {
  try {
    const { id } = req.params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        company: { select: { name: true, address: true, phone: true, gstin: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true, barcode: true } },
            variant: { select: { name: true, sku: true } },
          },
        },
        approvedBy: { select: { name: true } },
      },
    });

    if (!po) throw new NotFoundError('Purchase Order not found');
    if (req.user.role !== 'SUPER_ADMIN' && po.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    const itemRows = po.items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.product?.name}${item.variant ? ` (${item.variant.name})` : ''}<br/><small style="color:#64748b">${item.product?.sku || ''}</small></td>
        <td class="text-right">${item.quantity}</td>
        <td class="text-right">₹${item.unitPrice.toFixed(2)}</td>
        <td class="text-right">${item.gstRate}%</td>
        <td class="text-right">₹${item.gstAmount.toFixed(2)}</td>
        <td class="text-right">₹${item.discount.toFixed(2)}</td>
        <td class="text-right"><strong>₹${item.total.toFixed(2)}</strong></td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Order ${po.orderNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 40px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
    .company-name { font-size: 22px; font-weight: 700; color: #0f172a; }
    .company-details { font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.6; }
    .po-badge { background: #6366f1; color: white; padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .po-title { font-size: 20px; font-weight: 700; color: #0f172a; }
    .po-no { font-size: 13px; color: #64748b; margin-top: 2px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .info-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .info-box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 8px; }
    .info-box p { font-size: 13px; color: #334155; line-height: 1.6; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-PENDING { background: #fef9c3; color: #854d0e; }
    .status-APPROVED { background: #dcfce7; color: #14532d; }
    .status-REJECTED { background: #fee2e2; color: #7f1d1d; }
    .status-PARTIALLY_RECEIVED { background: #dbeafe; color: #1e3a8a; }
    .status-RECEIVED { background: #d1fae5; color: #064e3b; }
    .status-CANCELLED { background: #f1f5f9; color: #475569; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { border: 1px solid #e2e8f0; padding: 10px 12px; font-size: 12px; }
    th { background: #f8fafc; font-weight: 600; color: #374151; text-transform: uppercase; font-size: 11px; letter-spacing: 0.3px; }
    tr:nth-child(even) td { background: #f8fafc; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 300px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .totals table { margin: 0; }
    .totals td { font-size: 13px; }
    .totals .grand-total td { background: #0f172a; color: white; font-weight: 700; font-size: 14px; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; }
    .sign-box { border-top: 1px solid #cbd5e1; width: 180px; padding-top: 8px; text-align: center; font-size: 11px; color: #64748b; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${po.company?.name || 'Company Name'}</div>
      <div class="company-details">
        ${po.company?.address || ''}<br/>
        ${po.company?.phone ? `Phone: ${po.company.phone}` : ''}
        ${po.company?.gstin ? ` | GSTIN: ${po.company.gstin}` : ''}
      </div>
    </div>
    <div style="text-align:right">
      <div class="po-badge">PURCHASE ORDER</div>
      <div class="po-title" style="margin-top:8px">${po.orderNo}</div>
      <div class="po-no">Date: ${new Date(po.date).toLocaleDateString('en-IN')}</div>
      <div style="margin-top:6px"><span class="status-badge status-${po.status}">${po.status.replace(/_/g,' ')}</span></div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Vendor Details</h3>
      <p><strong>${po.vendor?.name || 'N/A'}</strong><br/>
      ${po.vendor?.address || ''}<br/>
      ${po.vendor?.phone ? `Phone: ${po.vendor.phone}` : ''}${po.vendor?.gstin ? `<br/>GSTIN: ${po.vendor.gstin}` : ''}</p>
    </div>
    <div class="info-box">
      <h3>Order Details</h3>
      <p>
        <strong>PO No:</strong> ${po.orderNo}<br/>
        <strong>Order Date:</strong> ${new Date(po.date).toLocaleDateString('en-IN')}<br/>
        ${po.expectedDeliveryDate ? `<strong>Expected Delivery:</strong> ${new Date(po.expectedDeliveryDate).toLocaleDateString('en-IN')}<br/>` : ''}
        ${po.approvedBy ? `<strong>Approved By:</strong> ${po.approvedBy.name}<br/>` : ''}
        ${po.notes ? `<strong>Notes:</strong> ${po.notes}` : ''}
      </p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Product</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">GST%</th>
        <th class="text-right">GST Amt</th>
        <th class="text-right">Discount</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Sub Total</td><td class="text-right">₹${po.totalAmount.toFixed(2)}</td></tr>
      <tr><td>GST Amount</td><td class="text-right">₹${po.gstAmount.toFixed(2)}</td></tr>
      <tr><td>Discount</td><td class="text-right">- ₹${po.discount.toFixed(2)}</td></tr>
      <tr class="grand-total"><td>Net Amount</td><td class="text-right">₹${po.netAmount.toFixed(2)}</td></tr>
    </table>
  </div>

  <div class="footer">
    <div>
      <div class="sign-box">Authorised Signatory</div>
    </div>
    <div style="text-align:right; font-size:11px; color:#94a3b8">
      Generated by Chauhan ERP &bull; ${new Date().toLocaleString('en-IN')}
    </div>
  </div>
</body>
</html>`;

    await logAudit({
      userId: req.user.id,
      action: 'GENERATE_PO_PDF',
      module: 'PURCHASE',
      details: { orderId: id, orderNo: po.orderNo },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: po.companyId,
    });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="PO-${po.orderNo}.html"`);
    return res.status(200).send(html);
  } catch (err) {
    next(err);
  }
};

// ── Vendor Ledger ─────────────────────────────────────────────

export const getVendorLedger = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { ledgers: { orderBy: { date: 'desc' } } },
    });

    if (!vendor) throw new NotFoundError('Vendor not found');
    if (req.user.role !== 'SUPER_ADMIN' && vendor.companyId !== companyId) {
      throw new ForbiddenError('Access denied');
    }

    return successResponse(res, 'Vendor ledger retrieved successfully', {
      vendor: { id: vendor.id, name: vendor.name, balance: vendor.balance },
      ledger: vendor.ledgers,
    });
  } catch (err) {
    next(err);
  }
};

// ── Pay Invoice ───────────────────────────────────────────────

export const payInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, paymentMode = 'CASH', notes } = req.body;

    const pAmount = parseFloat(amount);
    if (isNaN(pAmount) || pAmount <= 0) throw new BadRequestError('Valid payment amount is required');

    const invoice = await prisma.purchaseInvoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundError('Purchase Invoice not found');

    if (req.user.role !== 'SUPER_ADMIN' && invoice.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    if (invoice.balanceAmount <= 0) throw new BadRequestError('Invoice is already fully paid');

    const actualPayment = Math.min(pAmount, invoice.balanceAmount);

    const result = await prisma.$transaction(async (tx) => {
      const newPaidAmount = invoice.paidAmount + actualPayment;
      const newBalanceAmount = invoice.netAmount - newPaidAmount;
      const newStatus = newBalanceAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';

      const updatedInvoice = await tx.purchaseInvoice.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: Math.max(0, newBalanceAmount),
          paymentMode,
          status: newStatus,
        },
      });

      // Vendor ledger debit
      const currentVendor = await tx.vendor.findUnique({ where: { id: invoice.vendorId } });
      const newVendorBalance = (currentVendor?.balance || 0) - actualPayment;

      await tx.vendor.update({ where: { id: invoice.vendorId }, data: { balance: newVendorBalance } });

      await tx.vendorLedger.create({
        data: {
          vendorId: invoice.vendorId,
          type: 'DEBIT',
          amount: actualPayment,
          balance: newVendorBalance,
          description: `Payment for Bill ${invoice.billNo}: ₹${actualPayment.toFixed(2)}`,
          referenceNo: invoice.billNo,
        },
      });

      const paymentNo = `PMT-${Date.now()}`;
      await tx.payment.create({
        data: {
          paymentNo,
          type: 'PAYMENT_OUT',
          category: 'VENDOR',
          amount: actualPayment,
          paymentMode,
          referenceNo: invoice.billNo,
          description: notes || `Payment for Invoice ${invoice.billNo}`,
          vendorId: invoice.vendorId,
          companyId: invoice.companyId,
          branchId: invoice.branchId || null,
          createdById: req.user.id,
        },
      });

      return updatedInvoice;
    });

    await logAudit({
      userId: req.user.id,
      action: 'PAY_INVOICE',
      module: 'PURCHASE',
      details: { invoiceId: id, billNo: invoice.billNo, amount: actualPayment },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: invoice.companyId,
    });

    return successResponse(res, 'Payment recorded successfully', result);
  } catch (err) {
    next(err);
  }
};

