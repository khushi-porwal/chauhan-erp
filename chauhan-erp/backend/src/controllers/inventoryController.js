import prisma from '../config/db.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

// ── Stock In ─────────────────────────────────────────────────
export const stockIn = async (req, res, next) => {
  try {
    const { productId, variantId, warehouseId, quantity, description, batchNumber, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new BadRequestError('Quantity must be a positive number');
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    // Atomic transaction for Product update, WarehouseStock update, and StockTransaction log
    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Update general currentStock on product
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: { increment: qty } }
      });

      // 2. If variant exists, update variant stock
      if (variantId) {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { stock: { increment: qty } }
        });
      }

      // 3. Upsert WarehouseStock using findFirst to safely handle nullable variantId
      const existingStock = await tx.warehouseStock.findFirst({
        where: {
          warehouseId,
          productId,
          variantId: variantId || null
        }
      });

      let updatedStock;
      if (existingStock) {
        updatedStock = await tx.warehouseStock.update({
          where: { id: existingStock.id },
          data: { quantity: { increment: qty } }
        });
      } else {
        updatedStock = await tx.warehouseStock.create({
          data: {
            warehouseId,
            productId,
            variantId: variantId || null,
            quantity: qty,
            companyId: targetCompanyId
          }
        });
      }

      // 4. Update or Create Batch if batch number is supplied
      if (batchNumber) {
        const existingBatch = await tx.batch.findFirst({
          where: {
            companyId: targetCompanyId,
            productId,
            batchNumber
          }
        });

        if (existingBatch) {
          await tx.batch.update({
            where: { id: existingBatch.id },
            data: {
              quantity: { increment: qty },
              expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : existingBatch.expiryDate,
              mfgDate: req.body.mfgDate ? new Date(req.body.mfgDate) : existingBatch.mfgDate,
              warehouseId: warehouseId || existingBatch.warehouseId
            }
          });
        } else {
          await tx.batch.create({
            data: {
              batchNumber,
              productId,
              quantity: qty,
              expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
              mfgDate: req.body.mfgDate ? new Date(req.body.mfgDate) : null,
              warehouseId,
              companyId: targetCompanyId
            }
          });
        }
      }

      // 5. Log StockTransaction
      const stockTx = await tx.stockTransaction.create({
        data: {
          type: 'STOCK_IN',
          productId,
          variantId: variantId || null,
          toWarehouseId: warehouseId,
          quantity: qty,
          quantityBefore: existingStock ? existingStock.quantity : 0,
          quantityAfter: (existingStock ? existingStock.quantity : 0) + qty,
          description: description || 'Manual Stock In',
          batchNumber,
          createdById: req.user.id,
          companyId: targetCompanyId
        }
      });

      return { stockTx, updatedStock };
    });

    await logAudit({
      userId: req.user.id,
      action: 'STOCK_IN',
      module: 'INVENTORY',
      details: { productId, warehouseId, quantity: qty },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Stock added successfully', transaction);
  } catch (err) {
    next(err);
  }
};

// ── Stock Out ────────────────────────────────────────────────
export const stockOut = async (req, res, next) => {
  try {
    const { productId, variantId, warehouseId, quantity, description, batchNumber, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new BadRequestError('Quantity must be a positive number');
    }

    // Check WarehouseStock availability safely using findFirst
    const warehouseStock = await prisma.warehouseStock.findFirst({
      where: {
        warehouseId,
        productId,
        variantId: variantId || null
      }
    });

    if (!warehouseStock || warehouseStock.quantity < qty) {
      throw new BadRequestError(`Insufficient stock in selected warehouse. Available: ${warehouseStock?.quantity || 0}`);
    }

    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Decrement product current stock
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: { decrement: qty } }
      });

      // 2. If variant, decrement variant stock
      if (variantId) {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { stock: { decrement: qty } }
        });
      }

      // 3. Decrement warehouse stock
      const updatedStock = await tx.warehouseStock.update({
        where: { id: warehouseStock.id },
        data: { quantity: { decrement: qty } }
      });

      // 4. Update batch count if tracking is enabled
      if (batchNumber) {
        const batch = await tx.batch.findFirst({
          where: {
            companyId: targetCompanyId,
            productId,
            batchNumber
          }
        });
        if (batch) {
          await tx.batch.update({
            where: { id: batch.id },
            data: { quantity: { decrement: Math.min(qty, batch.quantity) } }
          });
        }
      }

      // 5. Log StockTransaction
      const stockTx = await tx.stockTransaction.create({
        data: {
          type: 'STOCK_OUT',
          productId,
          variantId: variantId || null,
          fromWarehouseId: warehouseId,
          quantity: qty,
          quantityBefore: warehouseStock.quantity,
          quantityAfter: updatedStock.quantity,
          description: description || 'Manual Stock Out',
          batchNumber,
          createdById: req.user.id,
          companyId: targetCompanyId
        }
      });

      return { stockTx, updatedStock };
    });

    await logAudit({
      userId: req.user.id,
      action: 'STOCK_OUT',
      module: 'INVENTORY',
      details: { productId, warehouseId, quantity: qty },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Stock deducted successfully', transaction);
  } catch (err) {
    next(err);
  }
};

// ── Stock Transfer ───────────────────────────────────────────
export const stockTransfer = async (req, res, next) => {
  try {
    const { productId, variantId, fromWarehouseId, toWarehouseId, quantity, description, batchNumber, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    if (fromWarehouseId === toWarehouseId) {
      throw new BadRequestError('Source and destination warehouses must be different');
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new BadRequestError('Quantity must be a positive number');
    }

    // Check source warehouse stock safely using findFirst
    const sourceStock = await prisma.warehouseStock.findFirst({
      where: {
        warehouseId: fromWarehouseId,
        productId,
        variantId: variantId || null
      }
    });

    if (!sourceStock || sourceStock.quantity < qty) {
      throw new BadRequestError(`Insufficient stock in source warehouse. Available: ${sourceStock?.quantity || 0}`);
    }

    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Decrement source warehouse stock
      await tx.warehouseStock.update({
        where: { id: sourceStock.id },
        data: { quantity: { decrement: qty } }
      });

      // 2. Increment destination warehouse stock (upsert safely)
      const destStock = await tx.warehouseStock.findFirst({
        where: {
          warehouseId: toWarehouseId,
          productId,
          variantId: variantId || null
        }
      });

      if (destStock) {
        await tx.warehouseStock.update({
          where: { id: destStock.id },
          data: { quantity: { increment: qty } }
        });
      } else {
        await tx.warehouseStock.create({
          data: {
            warehouseId: toWarehouseId,
            productId,
            variantId: variantId || null,
            quantity: qty,
            companyId: targetCompanyId
          }
        });
      }

      // 3. Log StockTransaction
      const stockTx = await tx.stockTransaction.create({
        data: {
          type: 'STOCK_TRANSFER',
          productId,
          variantId: variantId || null,
          fromWarehouseId,
          toWarehouseId,
          quantity: qty,
          quantityBefore: sourceStock.quantity,
          quantityAfter: sourceStock.quantity - qty,
          description: description || 'Warehouse Transfer',
          batchNumber,
          createdById: req.user.id,
          companyId: targetCompanyId
        }
      });

      return stockTx;
    });

    await logAudit({
      userId: req.user.id,
      action: 'STOCK_TRANSFER',
      module: 'INVENTORY',
      details: { productId, fromWarehouseId, toWarehouseId, quantity: qty },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Stock transferred successfully', transaction);
  } catch (err) {
    next(err);
  }
};

// ── Stock Adjustment ─────────────────────────────────────────
export const stockAdjustment = async (req, res, next) => {
  try {
    const { productId, variantId, warehouseId, quantity, description, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    const newQty = parseFloat(quantity);
    if (isNaN(newQty) || newQty < 0) {
      throw new BadRequestError('Adjusted quantity must be a non-negative number');
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const existingStock = await tx.warehouseStock.findFirst({
        where: {
          warehouseId,
          productId,
          variantId: variantId || null
        }
      });

      const currentQty = existingStock ? existingStock.quantity : 0;
      const diff = newQty - currentQty;

      // 1. Update product overall count
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: { increment: diff } }
      });

      // 2. If variant, update variant overall count
      if (variantId) {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { stock: { increment: diff } }
        });
      }

      // 3. Update warehouse stock count
      let updatedStock;
      if (existingStock) {
        updatedStock = await tx.warehouseStock.update({
          where: { id: existingStock.id },
          data: { quantity: newQty }
        });
      } else {
        updatedStock = await tx.warehouseStock.create({
          data: {
            warehouseId,
            productId,
            variantId: variantId || null,
            quantity: newQty,
            companyId: targetCompanyId
          }
        });
      }

      // 4. Log Transaction (using absolute value of difference for transaction logging)
      const stockTx = await tx.stockTransaction.create({
        data: {
          type: 'STOCK_ADJUSTMENT',
          productId,
          variantId: variantId || null,
          toWarehouseId: diff >= 0 ? warehouseId : null,
          fromWarehouseId: diff < 0 ? warehouseId : null,
          quantity: Math.abs(diff),
          quantityBefore: currentQty,
          quantityAfter: newQty,
          description: description || `Stock Adjustment (From ${currentQty} to ${newQty})`,
          createdById: req.user.id,
          companyId: targetCompanyId
        }
      });

      return { stockTx, updatedStock };
    });

    await logAudit({
      userId: req.user.id,
      action: 'STOCK_ADJUSTMENT',
      module: 'INVENTORY',
      details: { productId, warehouseId, adjustmentQty: newQty },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Stock adjusted successfully', transaction);
  } catch (err) {
    next(err);
  }
};

// ── Lookups and Lists ────────────────────────────────────────
export const getWarehouseStock = async (req, res, next) => {
  try {
    const { warehouseId } = req.query;
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const where = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (companyId) where.companyId = companyId;

    const stocks = await prisma.warehouseStock.findMany({
      where,
      include: {
        warehouse: { select: { name: true, code: true } },
        product: { select: { name: true, sku: true, barcode: true, currentStock: true, purchasePrice: true, salesPrice: true } },
        variant: { select: { name: true, sku: true } }
      },
      orderBy: { product: { name: 'asc' } }
    });

    return successResponse(res, 'Warehouse stocks retrieved successfully', stocks);
  } catch (err) {
    next(err);
  }
};

export const getLowStockAlerts = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const allProducts = await prisma.product.findMany({
      where: {
        companyId: companyId || undefined,
      },
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        unit: { select: { name: true } }
      },
      orderBy: { name: 'asc' }
    });

    const products = allProducts.filter(p => p.currentStock <= p.lowStockThreshold);

    return successResponse(res, 'Low stock alerts retrieved successfully', products);
  } catch (err) {
    next(err);
  }
};

export const getStockHistory = async (req, res, next) => {
  try {
    const { productId, warehouseId } = req.query;
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const where = { companyId: companyId || undefined };
    if (productId) where.productId = productId;
    if (warehouseId) {
      where.OR = [
        { fromWarehouseId: warehouseId },
        { toWarehouseId: warehouseId }
      ];
    }

    const transactions = await prisma.stockTransaction.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true } },
        variant: { select: { name: true } },
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        createdBy: { select: { name: true } }
      },
      orderBy: { date: 'desc' },
      take: 100
    });

    return successResponse(res, 'Stock history retrieved successfully', transactions);
  } catch (err) {
    next(err);
  }
};

// ── Batch Tracking ───────────────────────────────────────────
export const createBatch = async (req, res, next) => {
  try {
    const { batchNumber, productId, expiryDate, mfgDate, quantity, warehouseId, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    const existing = await prisma.batch.findUnique({
      where: {
        companyId_productId_batchNumber: {
          companyId: targetCompanyId,
          productId,
          batchNumber
        }
      }
    });

    if (existing) {
      throw new BadRequestError(`Batch number '${batchNumber}' already exists for this product`);
    }

    const batch = await prisma.batch.create({
      data: {
        batchNumber,
        productId,
        quantity: quantity ? parseFloat(quantity) : 0,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        mfgDate: mfgDate ? new Date(mfgDate) : null,
        warehouseId: warehouseId || null,
        companyId: targetCompanyId
      }
    });

    return successResponse(res, 'Batch created successfully', batch, 201);
  } catch (err) {
    next(err);
  }
};

export const getBatches = async (req, res, next) => {
  try {
    const { productId } = req.query;
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const where = { companyId: companyId || undefined };
    if (productId) where.productId = productId;

    const batches = await prisma.batch.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true } },
        warehouse: { select: { name: true } }
      },
      orderBy: { expiryDate: 'asc' }
    });

    return successResponse(res, 'Batches retrieved successfully', batches);
  } catch (err) {
    next(err);
  }
};

export const deleteBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const batch = await prisma.batch.findUnique({ where: { id } });
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    if (req.user.role !== 'SUPER_ADMIN' && batch.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this batch');
    }

    await prisma.batch.delete({ where: { id } });

    await logAudit({
      userId: req.user.id,
      action: 'DELETE_BATCH',
      module: 'INVENTORY',
      details: { batchId: id, batchNumber: batch.batchNumber },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: batch.companyId
    });

    return successResponse(res, 'Batch deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ── Stock Reconciliation ─────────────────────────────────────
export const reconcileStock = async (req, res, next) => {
  try {
    const { warehouseId, items, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) throw new BadRequestError('Company ID is required');
    if (!warehouseId || !items || items.length === 0) {
      throw new BadRequestError('Warehouse ID and items list are required');
    }

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new NotFoundError('Warehouse not found');

    const reconciliations = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of items) {
        const physical = parseFloat(item.physicalQty);
        if (isNaN(physical) || physical < 0) continue;

        const stock = await tx.warehouseStock.findFirst({
          where: {
            warehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
          },
        });

        const currentQty = stock ? stock.quantity : 0;
        const diff = physical - currentQty;

        if (diff !== 0) {
          // 1. Update or Create WarehouseStock
          if (stock) {
            await tx.warehouseStock.update({
              where: { id: stock.id },
              data: { quantity: physical },
            });
          } else {
            await tx.warehouseStock.create({
              data: {
                warehouseId,
                productId: item.productId,
                variantId: item.variantId || null,
                quantity: physical,
                companyId: targetCompanyId,
              },
            });
          }

          // 2. Adjust general Product stock
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: diff } },
          });

          // 3. Log StockTransaction
          const stockTx = await tx.stockTransaction.create({
            data: {
              type: 'STOCK_ADJUSTMENT',
              productId: item.productId,
              variantId: item.variantId || null,
              fromWarehouseId: diff < 0 ? warehouseId : null,
              toWarehouseId: diff > 0 ? warehouseId : null,
              quantity: Math.abs(diff),
              description: item.reason || `Stock Reconciliation: Physical ${physical} vs System ${currentQty}`,
              createdById: req.user.id,
              companyId: targetCompanyId,
            },
          });

          results.push({ productId: item.productId, systemQty: currentQty, physicalQty: physical, diff, stockTxId: stockTx.id });
        }
      }

      return results;
    });

    await logAudit({
      userId: req.user.id,
      action: 'RECONCILE_STOCK',
      module: 'INVENTORY',
      details: { warehouseId, adjustedItemsCount: reconciliations.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Stock reconciliation completed successfully', reconciliations);
  } catch (err) {
    next(err);
  }
};

// ── CSV Export ───────────────────────────────────────────────
export const exportStockCSV = async (req, res, next) => {
  try {
    const { warehouseId } = req.query;
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    const where = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (companyId) where.companyId = companyId;

    const stocks = await prisma.warehouseStock.findMany({
      where,
      include: {
        warehouse: { select: { name: true, code: true } },
        product: { select: { name: true, sku: true, barcode: true, purchasePrice: true, salesPrice: true } },
        variant: { select: { name: true, sku: true } }
      },
      orderBy: { product: { name: 'asc' } }
    });

    const headers = ['Warehouse Code', 'Warehouse Name', 'Product Name', 'SKU', 'Barcode', 'Quantity', 'Valuation (Est. Cost)'];
    const rows = stocks.map(s => {
      const productName = s.variant ? `${s.product?.name} (${s.variant.name})` : (s.product?.name || 'N/A');
      const sku = s.variant?.sku || s.product?.sku || 'N/A';
      const barcode = s.product?.barcode || 'N/A';
      const qty = s.quantity || 0;
      const estCost = ((s.product?.purchasePrice || 0) * qty).toFixed(2);
      return [
        `"${s.warehouse?.code || ''}"`,
        `"${s.warehouse?.name || ''}"`,
        `"${productName.replace(/"/g, '""')}"`,
        `"${sku}"`,
        `"${barcode}"`,
        qty,
        estCost
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    await logAudit({
      userId: req.user.id,
      action: 'EXPORT_STOCK_CSV',
      module: 'INVENTORY',
      details: { warehouseId, count: stocks.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_stock_levels.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};

// ── PDF Export ───────────────────────────────────────────────
export const exportStockPDF = async (req, res, next) => {
  try {
    const { warehouseId } = req.query;
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    const where = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (companyId) where.companyId = companyId;

    const stocks = await prisma.warehouseStock.findMany({
      where,
      include: {
        warehouse: { select: { name: true, code: true } },
        product: { select: { name: true, sku: true, barcode: true } },
        variant: { select: { name: true, sku: true } }
      },
      orderBy: { product: { name: 'asc' } }
    });

    const htmlReport = `<!DOCTYPE html>
<html>
<head>
  <title>Stock Inventory Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #1e293b; }
    h1 { font-size: 22px; color: #0f172a; margin-bottom: 4px; }
    p { font-size: 13px; color: #64748b; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 14px; font-size: 13px; text-align: left; }
    th { background-color: #f1f5f9; font-weight: 600; color: #334155; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .text-right { text-align: right; }
    .badge { background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 11px; }
  </style>
</head>
<body>
  <h1>Chauhan ERP — Inventory Stock Report</h1>
  <p>Generated on: ${new Date().toLocaleString()}</p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Warehouse</th>
        <th>Product Name</th>
        <th>SKU</th>
        <th>Barcode</th>
        <th class="text-right">Quantity</th>
      </tr>
    </thead>
    <tbody>
      ${stocks.map((s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${s.warehouse?.name} (<span class="badge">${s.warehouse?.code}</span>)</td>
          <td>${s.variant ? `${s.product?.name} (${s.variant.name})` : s.product?.name}</td>
          <td>${s.variant?.sku || s.product?.sku || '-'}</td>
          <td>${s.product?.barcode || '-'}</td>
          <td class="text-right"><strong>${s.quantity}</strong></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

    await logAudit({
      userId: req.user.id,
      action: 'EXPORT_STOCK_PDF',
      module: 'INVENTORY',
      details: { warehouseId, count: stocks.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId
    });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'inline; filename="inventory_stock_levels.html"');
    return res.status(200).send(htmlReport);
  } catch (err) {
    next(err);
  }
};

