import prisma from '../config/db.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

// ── HSN Codes ────────────────────────────────────────────────
export const getHsnCodes = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Company access required');
    }

    const hsnCodes = await prisma.hsnCode.findMany({
      where: companyId ? { companyId } : {},
      include: { _count: { select: { products: true } } },
      orderBy: { code: 'asc' }
    });

    return successResponse(res, 'HSN Codes retrieved successfully', hsnCodes);
  } catch (err) {
    next(err);
  }
};

export const createHsnCode = async (req, res, next) => {
  try {
    const { code, description, gstRate, companyId } = req.body;
    let targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      const firstCompany = await prisma.company.findFirst();
      if (firstCompany) targetCompanyId = firstCompany.id;
    }

    if (!code) throw new BadRequestError('HSN Code is required');
    if (!targetCompanyId) throw new BadRequestError('Company ID is required');

    const hsn = await prisma.hsnCode.create({
      data: {
        code,
        description,
        gstRate: gstRate ? parseFloat(gstRate) : 0,
        companyId: targetCompanyId
      }
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_HSN_CODE',
      module: 'TAXES',
      details: { hsnId: hsn.id, code: hsn.code },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId
    });

    return successResponse(res, 'HSN Code created successfully', hsn, 201);
  } catch (err) {
    next(err);
  }
};

export const updateHsnCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, description, gstRate } = req.body;

    const hsn = await prisma.hsnCode.findUnique({ where: { id } });
    if (!hsn) throw new NotFoundError('HSN Code not found');

    if (req.user.role !== 'SUPER_ADMIN' && hsn.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    const updated = await prisma.hsnCode.update({
      where: { id },
      data: {
        code: code || hsn.code,
        description: description !== undefined ? description : hsn.description,
        gstRate: gstRate !== undefined ? parseFloat(gstRate) : hsn.gstRate
      }
    });

    return successResponse(res, 'HSN Code updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const deleteHsnCode = async (req, res, next) => {
  try {
    const { id } = req.params;

    const hsn = await prisma.hsnCode.findUnique({ where: { id } });
    if (!hsn) throw new NotFoundError('HSN Code not found');

    if (req.user.role !== 'SUPER_ADMIN' && hsn.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    await prisma.hsnCode.delete({ where: { id } });

    return successResponse(res, 'HSN Code deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ── GST Slabs ────────────────────────────────────────────────
export const getGstSlabs = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    const gstSlabs = await prisma.gstSlab.findMany({
      where: companyId ? { companyId } : {},
      include: { _count: { select: { products: true } } },
      orderBy: { rate: 'asc' }
    });

    return successResponse(res, 'GST Slabs retrieved successfully', gstSlabs);
  } catch (err) {
    next(err);
  }
};

export const createGstSlab = async (req, res, next) => {
  try {
    const { name, rate, description, companyId } = req.body;
    let targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;

    if (!targetCompanyId) {
      const firstCompany = await prisma.company.findFirst();
      if (firstCompany) targetCompanyId = firstCompany.id;
    }

    if (!name || rate === undefined) throw new BadRequestError('Name and GST Rate are required');
    if (!targetCompanyId) throw new BadRequestError('Company ID is required');

    const slab = await prisma.gstSlab.create({
      data: {
        name,
        rate: parseFloat(rate),
        description,
        companyId: targetCompanyId
      }
    });

    return successResponse(res, 'GST Slab created successfully', slab, 201);
  } catch (err) {
    next(err);
  }
};

export const updateGstSlab = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, rate, description } = req.body;

    const slab = await prisma.gstSlab.findUnique({ where: { id } });
    if (!slab) throw new NotFoundError('GST Slab not found');

    if (req.user.role !== 'SUPER_ADMIN' && slab.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    const updated = await prisma.gstSlab.update({
      where: { id },
      data: {
        name: name || slab.name,
        rate: rate !== undefined ? parseFloat(rate) : slab.rate,
        description: description !== undefined ? description : slab.description
      }
    });

    return successResponse(res, 'GST Slab updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const deleteGstSlab = async (req, res, next) => {
  try {
    const { id } = req.params;

    const slab = await prisma.gstSlab.findUnique({ where: { id } });
    if (!slab) throw new NotFoundError('GST Slab not found');

    if (req.user.role !== 'SUPER_ADMIN' && slab.companyId !== req.user.companyId) {
      throw new ForbiddenError('Access denied');
    }

    await prisma.gstSlab.delete({ where: { id } });

    return successResponse(res, 'GST Slab deleted successfully');
  } catch (err) {
    next(err);
  }
};
