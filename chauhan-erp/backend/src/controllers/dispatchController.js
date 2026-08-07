import prisma from '../config/db.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

// ── Auto-incrementing dispatch note number ────────────────────
const generateDispatchNo = async (companyId) => {
  const count = await prisma.dispatchNote.count({ where: { companyId } });
  const num = String(count + 1).padStart(5, '0');
  return `DSP-${num}`;
};

// ── Create Dispatch Note (with automatic STOCK_OUT) ───────────
export const createDispatch = async (req, res, next) => {
  try {
    const {
      warehouseId, customerId, salesOrderId, salesInvoiceId,
      courierName, vehicleNo, lrNumber, trackingNo,
      dispatchDate, expectedDeliveryDate,
      notes, items, companyId
    } = req.body;

    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;
    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    if (!warehouseId || !items || items.length === 0)
      throw new BadRequestError('Warehouse and at least one item are required');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new NotFoundError('Warehouse not found');

    const dispatchNo = await generateDispatchNo(targetCompanyId);

    const dispatch = await prisma.$transaction(async (tx) => {
      // 1. Create the dispatch note
      const note = await tx.dispatchNote.create({
        data: {
          dispatchNo,
          status: 'DISPATCHED',
          warehouseId,
          customerId: customerId || null,
          salesOrderId: salesOrderId || null,
          salesInvoiceId: salesInvoiceId || null,
          courierName: courierName || null,
          vehicleNo: vehicleNo || null,
          lrNumber: lrNumber || null,
          trackingNo: trackingNo || null,
          dispatchDate: dispatchDate ? new Date(dispatchDate) : new Date(),
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          notes: notes || null,
          createdById: req.user.id,
          companyId: targetCompanyId,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: parseFloat(item.quantity),
              description: item.description || null,
            }))
          }
        },
        include: {
          items: { include: { product: true } }
        }
      });

      // 2. For each item: reduce warehouse stock and update product total
      for (const item of items) {
        const qty = parseFloat(item.quantity);
        if (isNaN(qty) || qty <= 0) continue;

        // Find and decrement warehouse stock
        const warehouseStock = await tx.warehouseStock.findFirst({
          where: {
            warehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
          }
        });

        if (!warehouseStock) {
          throw new BadRequestError(`No stock found for product in selected warehouse`);
        }

        if (warehouseStock.quantity < qty) {
          throw new BadRequestError(
            `Insufficient stock for product ID ${item.productId}. Available: ${warehouseStock.quantity}, Requested: ${qty}`
          );
        }

        await tx.warehouseStock.update({
          where: { id: warehouseStock.id },
          data: { quantity: { decrement: qty } }
        });

        // Decrement overall product stock
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: qty } }
        });

        // Log STOCK_OUT transaction
        await tx.stockTransaction.create({
          data: {
            type: 'STOCK_OUT',
            productId: item.productId,
            variantId: item.variantId || null,
            fromWarehouseId: warehouseId,
            quantity: qty,
            description: `Dispatched via ${dispatchNo} — ${courierName || 'Internal'} ${vehicleNo ? `| Vehicle: ${vehicleNo}` : ''}`,
            createdById: req.user.id,
            companyId: targetCompanyId,
          }
        });
      }

      return note;
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_DISPATCH',
      module: 'DISPATCH',
      details: { dispatchNo, itemCount: items.length, warehouseId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Dispatch note created & stock reduced', dispatch, 201);
  } catch (err) {
    next(err);
  }
};

// ── Get All Dispatch Notes ─────────────────────────────────────
export const getDispatches = async (req, res, next) => {
  try {
    const { companyId, status, warehouseId, customerId } = req.query;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;
    if (!targetCompanyId) throw new BadRequestError('Company ID is required');

    const where = { companyId: targetCompanyId };
    if (status) where.status = status;
    if (warehouseId) where.warehouseId = warehouseId;
    if (customerId) where.customerId = customerId;

    const dispatches = await prisma.dispatchNote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, barcode: true } }
          }
        },
        createdBy: { select: { id: true, name: true } }
      }
    });

    return successResponse(res, 'Dispatch notes fetched', dispatches);
  } catch (err) {
    next(err);
  }
};

// ── Get Single Dispatch Note ───────────────────────────────────
export const getDispatchById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    const dispatch = await prisma.dispatchNote.findUnique({
      where: { id },
      include: {
        warehouse: true,
        customer: { select: { id: true, name: true, phone: true, address: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, barcode: true, unit: true } }
          }
        },
        createdBy: { select: { id: true, name: true } }
      }
    });

    if (!dispatch) throw new NotFoundError('Dispatch note not found');
    if (dispatch.companyId !== targetCompanyId && req.user.role !== 'SUPER_ADMIN') {
      throw new NotFoundError('Dispatch note not found');
    }

    return successResponse(res, 'Dispatch note fetched', dispatch);
  } catch (err) {
    next(err);
  }
};

// ── Update Dispatch Status (e.g., DELIVERED, CANCELLED, RETURNED) ───────
export const updateDispatchStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, deliveredAt } = req.body;

    const allowedStatuses = ['DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'RETURNED'];
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestError(`Status must be one of: ${allowedStatuses.join(', ')}`);
    }

    const existing = await prisma.dispatchNote.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw new NotFoundError('Dispatch note not found');

    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? (req.body.companyId || existing.companyId) : req.user.companyId;

    const updated = await prisma.$transaction(async (tx) => {
      const note = await tx.dispatchNote.update({
        where: { id },
        data: {
          status,
          deliveredAt: status === 'DELIVERED' ? (deliveredAt ? new Date(deliveredAt) : new Date()) : undefined
        }
      });

      // If status changed to CANCELLED or RETURNED from an active state (DISPATCHED/IN_TRANSIT/DELIVERED), reverse stock reduction
      const wasActive = ['DISPATCHED', 'IN_TRANSIT', 'DELIVERED'].includes(existing.status);
      const isReversing = ['CANCELLED', 'RETURNED'].includes(status);

      if (wasActive && isReversing) {
        for (const item of existing.items) {
          const qty = parseFloat(item.quantity);
          if (isNaN(qty) || qty <= 0) continue;

          // 1. Increment Warehouse Stock
          const warehouseStock = await tx.warehouseStock.findFirst({
            where: {
              warehouseId: existing.warehouseId,
              productId: item.productId,
              variantId: item.variantId || null,
            }
          });

          if (warehouseStock) {
            await tx.warehouseStock.update({
              where: { id: warehouseStock.id },
              data: { quantity: { increment: qty } }
            });
          } else {
            await tx.warehouseStock.create({
              data: {
                warehouseId: existing.warehouseId,
                productId: item.productId,
                variantId: item.variantId || null,
                quantity: qty,
                companyId: existing.companyId,
              }
            });
          }

          // 2. Increment Product stock
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: qty } }
          });

          // 3. Log STOCK_IN transaction (Reversal)
          await tx.stockTransaction.create({
            data: {
              type: 'STOCK_IN',
              productId: item.productId,
              variantId: item.variantId || null,
              toWarehouseId: existing.warehouseId,
              quantity: qty,
              description: `Stock restored due to Dispatch ${existing.dispatchNo} set to ${status}`,
              createdById: req.user.id,
              companyId: existing.companyId,
            }
          });
        }
      }

      return note;
    });

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_DISPATCH_STATUS',
      module: 'DISPATCH',
      details: { id, from: existing.status, to: status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, `Dispatch status updated to ${status}`, updated);
  } catch (err) {
    next(err);
  }
};
