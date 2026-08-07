import prisma from '../config/db.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

// ── Categories ───────────────────────────────────────────────
export const createCategory = async (req, res, next) => {
  try {
    const { name, description, parentId, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    if (parentId) {
      const parentCat = await prisma.category.findUnique({ where: { id: parentId } });
      if (!parentCat) throw new NotFoundError('Parent category not found');
    }

    const category = await prisma.category.create({
      data: { name, description, parentId: parentId || null, companyId: targetCompanyId },
      include: { parent: true }
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_CATEGORY',
      module: 'PRODUCT',
      details: { categoryId: category.id, name: category.name, parentId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Category created successfully', category, 201);
  } catch (err) {
    next(err);
  }
};

export const getCategories = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const categories = await prisma.category.findMany({
      where: companyId ? { companyId } : {},
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, _count: { select: { products: true } } } },
        _count: { select: { products: true } }
      },
      orderBy: { name: 'asc' }
    });

    return successResponse(res, 'Categories retrieved successfully', categories);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, parentId } = req.body;

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundError('Category not found');

    if (req.user.role !== 'SUPER_ADMIN' && category.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    if (parentId === id) {
      throw new BadRequestError('Category cannot be its own parent');
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { name, description, parentId: parentId || null },
      include: { parent: true }
    });

    return successResponse(res, 'Category updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

// ── Unique Barcode Generator ──────────────────────────────
export const generateBarcode = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    let isUnique = false;
    let newBarcode = '';

    while (!isUnique) {
      // EAN-13 style code: 890 + 9 random digits
      const randomDigits = Math.floor(100000000 + Math.random() * 900000000).toString();
      const code12 = `890${randomDigits}`;
      // Calculate EAN-13 checksum
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(code12[i]) * (i % 2 === 0 ? 1 : 3);
      }
      const checksum = (10 - (sum % 10)) % 10;
      newBarcode = `${code12}${checksum}`;

      const existing = await prisma.product.findFirst({
        where: { barcode: newBarcode, ...(companyId ? { companyId } : {}) }
      });
      if (!existing) isUnique = true;
    }

    return successResponse(res, 'Unique barcode generated', { barcode: newBarcode });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundError('Category not found');

    if (req.user.role !== 'SUPER_ADMIN' && category.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    await prisma.category.delete({ where: { id } });

    await logAudit({
      userId: req.user.id,
      action: 'DELETE_CATEGORY',
      module: 'PRODUCT',
      details: { categoryId: id, name: category.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: category.companyId
    });

    return successResponse(res, 'Category deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ── Brands ───────────────────────────────────────────────────
export const createBrand = async (req, res, next) => {
  try {
    const { name, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    const brand = await prisma.brand.create({
      data: { name, companyId: targetCompanyId }
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_BRAND',
      module: 'PRODUCT',
      details: { brandId: brand.id, name: brand.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Brand created successfully', brand, 201);
  } catch (err) {
    next(err);
  }
};

export const getBrands = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const brands = await prisma.brand.findMany({
      where: companyId ? { companyId } : {},
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });

    return successResponse(res, 'Brands retrieved successfully', brands);
  } catch (err) {
    next(err);
  }
};

export const updateBrand = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundError('Brand not found');

    if (req.user.role !== 'SUPER_ADMIN' && brand.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    const updated = await prisma.brand.update({ where: { id }, data: { name } });

    return successResponse(res, 'Brand updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const deleteBrand = async (req, res, next) => {
  try {
    const { id } = req.params;

    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundError('Brand not found');

    if (req.user.role !== 'SUPER_ADMIN' && brand.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    await prisma.brand.delete({ where: { id } });

    await logAudit({
      userId: req.user.id,
      action: 'DELETE_BRAND',
      module: 'PRODUCT',
      details: { brandId: id, name: brand.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: brand.companyId
    });

    return successResponse(res, 'Brand deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ── Units ────────────────────────────────────────────────────
export const createUnit = async (req, res, next) => {
  try {
    const { name, companyId } = req.body;
    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    const unit = await prisma.unit.create({
      data: { name, companyId: targetCompanyId }
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_UNIT',
      module: 'PRODUCT',
      details: { unitId: unit.id, name: unit.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Unit created successfully', unit, 201);
  } catch (err) {
    next(err);
  }
};

export const getUnits = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const units = await prisma.unit.findMany({
      where: companyId ? { companyId } : {},
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });

    return successResponse(res, 'Units retrieved successfully', units);
  } catch (err) {
    next(err);
  }
};

export const updateUnit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const unit = await prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundError('Unit not found');

    if (req.user.role !== 'SUPER_ADMIN' && unit.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    const updated = await prisma.unit.update({ where: { id }, data: { name } });

    return successResponse(res, 'Unit updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const deleteUnit = async (req, res, next) => {
  try {
    const { id } = req.params;

    const unit = await prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundError('Unit not found');

    if (req.user.role !== 'SUPER_ADMIN' && unit.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    await prisma.unit.delete({ where: { id } });

    await logAudit({
      userId: req.user.id,
      action: 'DELETE_UNIT',
      module: 'PRODUCT',
      details: { unitId: id, name: unit.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: unit.companyId
    });

    return successResponse(res, 'Unit deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ── Products ─────────────────────────────────────────────────
export const createProduct = async (req, res, next) => {
  try {
    const {
      name, sku, barcode, description, categoryId, brandId, unitId,
      hsnCode, hsnCodeId, gstRate, gstSlabId, purchasePrice, salesPrice,
      mrp, minPrice, openingStock, openingValue, lowStockThreshold,
      status, images, companyId
    } = req.body;

    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;
    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    if (!name) throw new BadRequestError('Product name is required');

    // Check SKU Uniqueness per company
    if (sku) {
      const existingSku = await prisma.product.findFirst({
        where: { sku, companyId: targetCompanyId, isDeleted: false }
      });
      if (existingSku) {
        throw new BadRequestError(`Product with SKU '${sku}' already exists.`);
      }
    }

    // Check Barcode Uniqueness per company
    if (barcode) {
      const existingBarcode = await prisma.product.findFirst({
        where: { barcode, companyId: targetCompanyId, isDeleted: false }
      });
      if (existingBarcode) {
        throw new BadRequestError(`Product with Barcode '${barcode}' already exists.`);
      }
    }

    const pPrice = purchasePrice ? parseFloat(purchasePrice) : 0;
    const sPrice = salesPrice ? parseFloat(salesPrice) : 0;
    const mrpVal = mrp ? parseFloat(mrp) : sPrice;
    const minP = minPrice ? parseFloat(minPrice) : 0;
    const stock = openingStock ? parseFloat(openingStock) : 0;
    const openVal = openingValue ? parseFloat(openingValue) : (stock * pPrice);
    const gst = gstRate ? parseFloat(gstRate) : 0;
    const threshold = lowStockThreshold ? parseFloat(lowStockThreshold) : 0;

    const product = await prisma.product.create({
      data: {
        name,
        sku: sku || null,
        barcode: barcode || null,
        description,
        categoryId: categoryId || null,
        brandId: brandId || null,
        unitId: unitId || null,
        hsnCode,
        hsnCodeId: hsnCodeId || null,
        gstRate: gst,
        gstSlabId: gstSlabId || null,
        purchasePrice: pPrice,
        salesPrice: sPrice,
        mrp: mrpVal,
        minPrice: minP,
        openingStock: stock,
        openingValue: openVal,
        currentStock: stock,
        lowStockThreshold: threshold,
        status: status || 'ACTIVE',
        isDeleted: false,
        companyId: targetCompanyId,
        images: Array.isArray(images) && images.length > 0 ? {
          create: images.map((img, idx) => ({
            url: typeof img === 'string' ? img : img.url,
            isPrimary: idx === 0
          }))
        } : undefined
      },
      include: {
        category: true,
        brand: true,
        unit: true,
        images: true,
        hsnCodeRef: true,
        gstSlab: true
      }
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_PRODUCT',
      module: 'PRODUCT',
      details: { productId: product.id, name: product.name, sku: product.sku },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'Product created successfully', product, 201);
  } catch (err) {
    next(err);
  }
};

export const getProducts = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const {
      search, categoryId, brandId, status, lowStock,
      page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      isDeleted: false,
      ...(companyId ? { companyId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(brandId ? { brandId } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      } : {}),
    };

    const total = await prisma.product.count({ where });

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        images: true,
        variants: { select: { id: true, name: true, sku: true, price: true, stock: true } },
        hsnCodeRef: { select: { id: true, code: true, gstRate: true } },
        gstSlab: { select: { id: true, name: true, rate: true } },
        _count: { select: { stocks: true } }
      },
      orderBy: { [sortBy]: sortOrder.toLowerCase() },
      skip,
      take: limitNum
    });

    return successResponse(res, 'Products retrieved successfully', {
      products,
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

export const lookupByBarcode = async (req, res, next) => {
  try {
    const { code } = req.params;
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    if (!code) throw new BadRequestError('Barcode is required');

    const product = await prisma.product.findFirst({
      where: {
        isDeleted: false,
        ...(companyId ? { companyId } : {}),
        OR: [
          { barcode: code },
          { sku: code },
        ],
      },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        images: true,
        variants: true,
        stocks: { include: { warehouse: { select: { id: true, name: true } } } },
      },
    });

    if (!product) {
      throw new NotFoundError(`No product found with barcode/SKU '${code}'`);
    }

    return successResponse(res, 'Product found', product);
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name, sku, barcode, description, categoryId, brandId, unitId,
      hsnCode, hsnCodeId, gstRate, gstSlabId, purchasePrice, salesPrice,
      mrp, minPrice, lowStockThreshold, status, images
    } = req.body;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product || product.isDeleted) throw new NotFoundError('Product not found');

    if (req.user.role !== 'SUPER_ADMIN' && product.companyId !== req.user.companyId) {
      throw new ForbiddenError('You do not have access to this product');
    }

    // Check SKU uniqueness
    if (sku && sku !== product.sku) {
      const existingSku = await prisma.product.findFirst({
        where: { sku, companyId: product.companyId, isDeleted: false, NOT: { id } }
      });
      if (existingSku) {
        throw new BadRequestError(`Product with SKU '${sku}' already exists.`);
      }
    }

    // Check Barcode uniqueness
    if (barcode && barcode !== product.barcode) {
      const existingBarcode = await prisma.product.findFirst({
        where: { barcode, companyId: product.companyId, isDeleted: false, NOT: { id } }
      });
      if (existingBarcode) {
        throw new BadRequestError(`Product with Barcode '${barcode}' already exists.`);
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: name || product.name,
        sku: sku !== undefined ? sku : product.sku,
        barcode: barcode !== undefined ? barcode : product.barcode,
        description: description !== undefined ? description : product.description,
        categoryId: categoryId || null,
        brandId: brandId || null,
        unitId: unitId || null,
        hsnCode: hsnCode !== undefined ? hsnCode : product.hsnCode,
        hsnCodeId: hsnCodeId || null,
        gstRate: gstRate !== undefined ? parseFloat(gstRate) : product.gstRate,
        gstSlabId: gstSlabId || null,
        purchasePrice: purchasePrice !== undefined ? parseFloat(purchasePrice) : product.purchasePrice,
        salesPrice: salesPrice !== undefined ? parseFloat(salesPrice) : product.salesPrice,
        mrp: mrp !== undefined ? parseFloat(mrp) : product.mrp,
        minPrice: minPrice !== undefined ? parseFloat(minPrice) : product.minPrice,
        lowStockThreshold: lowStockThreshold !== undefined ? parseFloat(lowStockThreshold) : product.lowStockThreshold,
        status: status || product.status,
      },
      include: {
        category: true,
        brand: true,
        unit: true,
        images: true,
        hsnCodeRef: true,
        gstSlab: true
      }
    });

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_PRODUCT',
      module: 'PRODUCT',
      details: { productId: updated.id, name: updated.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: product.companyId
    });

    return successResponse(res, 'Product updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product || product.isDeleted) throw new NotFoundError('Product not found');

    if (req.user.role !== 'SUPER_ADMIN' && product.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    // Soft delete only - keeps transaction logs intact!
    await prisma.product.update({
      where: { id },
      data: { isDeleted: true, status: 'INACTIVE' }
    });

    await logAudit({
      userId: req.user.id,
      action: 'DELETE_PRODUCT',
      module: 'PRODUCT',
      details: { productId: id, name: product.name, type: 'SOFT_DELETE' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: product.companyId
    });

    return successResponse(res, 'Product soft-deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ── Product Variants ─────────────────────────────────────────
export const getVariants = async (req, res, next) => {
  try {
    const { id: productId } = req.params;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    if (req.user.role !== 'SUPER_ADMIN' && product.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    const variants = await prisma.productVariant.findMany({
      where: { productId },
      orderBy: { name: 'asc' }
    });

    return successResponse(res, 'Variants retrieved successfully', variants);
  } catch (err) {
    next(err);
  }
};

export const createVariant = async (req, res, next) => {
  try {
    const { id: productId } = req.params;
    const { name, sku, price, stock } = req.body;

    if (!name) throw new BadRequestError('Variant name is required');

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    if (req.user.role !== 'SUPER_ADMIN' && product.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        name,
        sku: sku || null,
        price: price ? parseFloat(price) : 0,
        stock: stock ? parseFloat(stock) : 0
      }
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_VARIANT',
      module: 'PRODUCT',
      details: { variantId: variant.id, productId, name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: product.companyId
    });

    return successResponse(res, 'Variant created successfully', variant, 201);
  } catch (err) {
    next(err);
  }
};

export const updateVariant = async (req, res, next) => {
  try {
    const { id: productId, variantId } = req.params;
    const { name, sku, price } = req.body;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    if (req.user.role !== 'SUPER_ADMIN' && product.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== productId) throw new NotFoundError('Variant not found');

    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        name,
        sku: sku || null,
        price: price !== undefined ? parseFloat(price) : undefined
      }
    });

    return successResponse(res, 'Variant updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const deleteVariant = async (req, res, next) => {
  try {
    const { id: productId, variantId } = req.params;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    if (req.user.role !== 'SUPER_ADMIN' && product.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== productId) throw new NotFoundError('Variant not found');

    await prisma.productVariant.delete({ where: { id: variantId } });

    await logAudit({
      userId: req.user.id,
      action: 'DELETE_VARIANT',
      module: 'PRODUCT',
      details: { variantId, productId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: product.companyId
    });

    return successResponse(res, 'Variant deleted successfully');
  } catch (err) {
    next(err);
  }
};

