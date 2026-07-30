import prisma from '../config/db.js';
import { ForbiddenError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';

// ── Inventory Dashboard ──────────────────────────────────────
export const getDashboardStats = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const where = companyId ? { companyId } : {};
    const productWhere = { ...where, isDeleted: false };

    const now = new Date();
    const nearExpiryDate = new Date();
    nearExpiryDate.setDate(nearExpiryDate.getDate() + 30);

    // Run all aggregations in parallel
    const [
      totalProducts,
      activeProducts,
      totalCategories,
      totalBrands,
      totalWarehouses,
      allProducts,
      lowStockProducts,
      expiredBatches,
      nearExpiryBatches,
      recentTransactions,
      warehouseStockCount
    ] = await Promise.all([
      // Total products (not deleted)
      prisma.product.count({ where: productWhere }),

      // Active products
      prisma.product.count({ where: { ...productWhere, status: 'ACTIVE' } }),

      // Total categories
      prisma.category.count({ where }),

      // Total brands
      prisma.brand.count({ where }),

      // Total warehouses
      prisma.warehouse.count({ where: { ...where, status: 'ACTIVE' } }),

      // All products for inventory value calc & low stock
      prisma.product.findMany({
        where: productWhere,
        select: { currentStock: true, purchasePrice: true, lowStockThreshold: true, salesPrice: true }
      }),

      // Low stock count
      prisma.product.count({
        where: {
          ...productWhere,
          AND: [
            { lowStockThreshold: { gt: 0 } },
          ]
        }
      }),

      // Expired batches
      prisma.batch.count({
        where: {
          ...where,
          expiryDate: { lt: now }
        }
      }),

      // Near expiry batches (within 30 days)
      prisma.batch.count({
        where: {
          ...where,
          expiryDate: {
            gte: now,
            lte: nearExpiryDate
          }
        }
      }),

      // Recent stock transactions (last 10)
      prisma.stockTransaction.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
          createdBy: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),

      // Total warehouse-product stock records
      prisma.warehouseStock.count({ where })
    ]);

    // Calculate inventory valuation
    const inventoryValue = allProducts.reduce((sum, p) => sum + (p.currentStock * p.purchasePrice), 0);
    const inventoryRetailValue = allProducts.reduce((sum, p) => sum + (p.currentStock * p.salesPrice), 0);

    // Calculate true low stock (products where currentStock <= lowStockThreshold)
    const actualLowStockCount = allProducts.filter(p => p.lowStockThreshold > 0 && p.currentStock <= p.lowStockThreshold).length;

    return successResponse(res, 'Inventory dashboard stats retrieved', {
      totalProducts,
      activeProducts,
      totalCategories,
      totalBrands,
      totalWarehouses,
      lowStockCount: actualLowStockCount,
      expiredBatchCount: expiredBatches,
      nearExpiryBatchCount: nearExpiryBatches,
      inventoryValue: parseFloat(inventoryValue.toFixed(2)),
      inventoryRetailValue: parseFloat(inventoryRetailValue.toFixed(2)),
      warehouseStockRecords: warehouseStockCount,
      recentTransactions
    });
  } catch (err) {
    next(err);
  }
};

// ── Low Stock Engine ─────────────────────────────────────────
export const getLowStockProducts = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const { page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      isDeleted: false,
      ...(companyId ? { companyId } : {}),
      lowStockThreshold: { gt: 0 }
    };

    const allLowStockProducts = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        images: { where: { isPrimary: true }, take: 1 },
        stocks: {
          include: { warehouse: { select: { id: true, name: true, code: true } } }
        }
      },
      orderBy: { currentStock: 'asc' }
    });

    // Filter only those at or below threshold
    const filteredProducts = allLowStockProducts.filter(p => p.currentStock <= p.lowStockThreshold);
    const total = filteredProducts.length;
    const paginated = filteredProducts.slice(skip, skip + limitNum);

    // Also trigger notifications for low stock (auto-detection)
    if (companyId && filteredProducts.length > 0) {
      // Create notification if not already done today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingNotif = await prisma.notification.findFirst({
        where: {
          companyId,
          type: 'LOW_STOCK',
          createdAt: { gte: today }
        }
      });

      if (!existingNotif && filteredProducts.length > 0) {
        await prisma.notification.create({
          data: {
            title: 'Low Stock Alert',
            message: `${filteredProducts.length} product(s) are at or below their low stock threshold.`,
            type: 'LOW_STOCK',
            companyId,
            userId: req.user.id
          }
        });
      }
    }

    return successResponse(res, 'Low stock products retrieved', {
      products: paginated,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
};

// ── Batch Expiry Engine ──────────────────────────────────────
export const getBatchesWithExpiryStatus = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const { status, productId, warehouseId, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const now = new Date();
    const nearExpiryDate = new Date();
    nearExpiryDate.setDate(nearExpiryDate.getDate() + 30);

    const where = {
      ...(companyId ? { companyId } : {}),
      ...(productId ? { productId } : {}),
      ...(warehouseId ? { warehouseId } : {})
    };

    const batches = await prisma.batch.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, barcode: true } },
        warehouse: { select: { id: true, name: true, code: true } }
      },
      orderBy: { expiryDate: 'asc' }
    });

    // Classify each batch with expiry status
    const enrichedBatches = batches.map(batch => {
      let expiryStatus = 'ACTIVE';
      if (batch.expiryDate) {
        if (batch.expiryDate < now) {
          expiryStatus = 'EXPIRED';
        } else if (batch.expiryDate <= nearExpiryDate) {
          expiryStatus = 'NEAR_EXPIRY';
        }
      }
      return { ...batch, expiryStatus };
    });

    // Filter by status if provided
    const filtered = status
      ? enrichedBatches.filter(b => b.expiryStatus === status.toUpperCase())
      : enrichedBatches;

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);

    // Auto-create expiry notification
    if (companyId) {
      const expiredCount = enrichedBatches.filter(b => b.expiryStatus === 'EXPIRED').length;
      const nearExpiryCount = enrichedBatches.filter(b => b.expiryStatus === 'NEAR_EXPIRY').length;

      if (expiredCount > 0 || nearExpiryCount > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existingNotif = await prisma.notification.findFirst({
          where: { companyId, type: 'EXPIRY_WARNING', createdAt: { gte: today } }
        });

        if (!existingNotif) {
          await prisma.notification.create({
            data: {
              title: 'Batch Expiry Alert',
              message: `${expiredCount} batch(es) expired and ${nearExpiryCount} batch(es) expiring within 30 days.`,
              type: 'EXPIRY_WARNING',
              companyId,
              userId: req.user.id
            }
          });
        }
      }
    }

    return successResponse(res, 'Batch expiry data retrieved', {
      batches: paginated,
      summary: {
        total: enrichedBatches.length,
        active: enrichedBatches.filter(b => b.expiryStatus === 'ACTIVE').length,
        nearExpiry: enrichedBatches.filter(b => b.expiryStatus === 'NEAR_EXPIRY').length,
        expired: enrichedBatches.filter(b => b.expiryStatus === 'EXPIRED').length
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
};

// ── Notifications ────────────────────────────────────────────
export const getNotifications = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    const notifications = await prisma.notification.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        OR: [{ userId: req.user.id }, { userId: null }]
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return successResponse(res, 'Notifications retrieved', { notifications, unreadCount });
  } catch (err) {
    next(err);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    return successResponse(res, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
};

export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    await prisma.notification.updateMany({
      where: {
        companyId,
        OR: [{ userId: req.user.id }, { userId: null }],
        isRead: false
      },
      data: { isRead: true }
    });

    return successResponse(res, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
};

// ── Barcode Engine ───────────────────────────────────────────
export const generateBulkBarcodes = async (req, res, next) => {
  try {
    const { productIds, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error('productIds array is required');
    }

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isDeleted: false,
        ...(targetCompanyId ? { companyId: targetCompanyId } : {})
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        salesPrice: true,
        mrp: true,
        images: { where: { isPrimary: true }, take: 1 }
      }
    });

    return successResponse(res, 'Products for barcode printing retrieved', products);
  } catch (err) {
    next(err);
  }
};

// ── Enhanced Stock History with pagination & filters ─────────
export const getStockHistory = async (req, res, next) => {
  try {
    const {
      productId, warehouseId, type, page = 1, limit = 50,
      dateFrom, dateTo
    } = req.query;
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      ...(companyId ? { companyId } : {}),
      ...(productId ? { productId } : {}),
      ...(type ? { type } : {}),
      ...(warehouseId ? {
        OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }]
      } : {}),
      ...(dateFrom || dateTo ? {
        date: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {})
        }
      } : {})
    };

    const [total, transactions] = await Promise.all([
      prisma.stockTransaction.count({ where }),
      prisma.stockTransaction.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true, barcode: true } },
          variant: { select: { name: true } },
          fromWarehouse: { select: { name: true, code: true } },
          toWarehouse: { select: { name: true, code: true } },
          createdBy: { select: { name: true, email: true } }
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum
      })
    ]);

    return successResponse(res, 'Stock history retrieved', {
      transactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
};

// ── Stock Adjustment with dedicated table ────────────────────
export const createStockAdjustment = async (req, res, next) => {
  try {
    const {
      productId, variantId, warehouseId, type, quantity, reason, batchNumber, companyId
    } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!productId || !warehouseId || !type || !quantity || !reason) {
      throw new Error('productId, warehouseId, type, quantity, and reason are required');
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) throw new Error('Quantity must be a positive number');
    if (!['INCREASE', 'DECREASE'].includes(type)) throw new Error('Type must be INCREASE or DECREASE');

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('Product not found');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new Error('Warehouse not found');

    // Check existing warehouse stock
    const existingStock = await prisma.warehouseStock.findFirst({
      where: { warehouseId, productId, variantId: variantId || null }
    });

    const currentQty = existingStock ? existingStock.quantity : 0;

    if (type === 'DECREASE' && qty > currentQty) {
      throw new Error(`Cannot decrease by ${qty}. Current warehouse stock is ${currentQty}`);
    }

    const adjustmentNo = `ADJ-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const finalQty = type === 'INCREASE' ? currentQty + qty : currentQty - qty;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Record stock adjustment
      const adjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNo,
          warehouseId,
          productId,
          variantId: variantId || null,
          batchNumber: batchNumber || null,
          type,
          quantity: qty,
          reason,
          createdById: req.user.id,
          companyId: targetCompanyId
        }
      });

      // 2. Update or create warehouse stock
      if (existingStock) {
        await tx.warehouseStock.update({
          where: { id: existingStock.id },
          data: { quantity: finalQty }
        });
      } else {
        await tx.warehouseStock.create({
          data: {
            warehouseId, productId,
            variantId: variantId || null,
            quantity: finalQty,
            companyId: targetCompanyId
          }
        });
      }

      // 3. Update product total stock
      const diff = type === 'INCREASE' ? qty : -qty;
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: { increment: diff } }
      });

      // 4. Log stock transaction with before/after
      const stockTx = await tx.stockTransaction.create({
        data: {
          type: 'STOCK_ADJUSTMENT',
          productId,
          variantId: variantId || null,
          toWarehouseId: type === 'INCREASE' ? warehouseId : null,
          fromWarehouseId: type === 'DECREASE' ? warehouseId : null,
          quantity: qty,
          quantityBefore: currentQty,
          quantityAfter: finalQty,
          reason,
          description: `Stock Adjustment: ${type} by ${qty}. Reason: ${reason}`,
          batchNumber: batchNumber || null,
          createdById: req.user.id,
          companyId: targetCompanyId
        }
      });

      return { adjustment, stockTx, quantityBefore: currentQty, quantityAfter: finalQty };
    });

    return successResponse(res, 'Stock adjustment created successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

export const getStockAdjustments = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    const { page = 1, limit = 50, productId, warehouseId } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      ...(companyId ? { companyId } : {}),
      ...(productId ? { productId } : {}),
      ...(warehouseId ? { warehouseId } : {})
    };

    const [total, adjustments] = await Promise.all([
      prisma.stockAdjustment.count({ where }),
      prisma.stockAdjustment.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          warehouse: { select: { name: true, code: true } },
          createdBy: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      })
    ]);

    return successResponse(res, 'Stock adjustments retrieved', {
      adjustments,
      pagination: {
        total, page: pageNum, limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
};
