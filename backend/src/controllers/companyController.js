import prisma from '../config/db.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../utils/auditLogger.js';

// --- Company ---
export const createCompany = async (req, res, next) => {
  try {
    const { name, legalName, email, phone, website, gstNumber, address, currency } = req.body;

    const company = await prisma.company.create({
      data: { name, legalName, email, phone, website, gstNumber, address, currency },
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_COMPANY',
      module: 'COMPANY',
      details: { companyId: company.id, name: company.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: company.id,
    });

    return successResponse(res, 'Company created successfully', company, 201);
  } catch (err) {
    next(err);
  }
};

export const getCompanies = async (req, res, next) => {
  try {
    let companies;
    if (req.user.role === 'SUPER_ADMIN') {
      companies = await prisma.company.findMany({
        include: { branches: true, financialYears: true },
      });
    } else {
      if (!req.user.companyId) {
        throw new ForbiddenError('You are not associated with any company');
      }
      companies = await prisma.company.findMany({
        where: { id: req.user.companyId },
        include: { branches: true, financialYears: true },
      });
    }
    return successResponse(res, 'Companies retrieved successfully', companies);
  } catch (err) {
    next(err);
  }
};

export const getCompanyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'SUPER_ADMIN' && req.user.companyId !== id) {
      throw new ForbiddenError('You do not have access to this company');
    }

    const company = await prisma.company.findUnique({
      where: { id },
      include: { branches: true, financialYears: true },
    });

    if (!company) {
      throw new NotFoundError('Company not found');
    }

    return successResponse(res, 'Company retrieved successfully', company);
  } catch (err) {
    next(err);
  }
};

export const updateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, legalName, email, phone, website, gstNumber, address, currency, status } = req.body;

    if (req.user.role !== 'SUPER_ADMIN' && req.user.companyId !== id) {
      throw new ForbiddenError('You do not have permission to update this company');
    }

    const company = await prisma.company.update({
      where: { id },
      data: { name, legalName, email, phone, website, gstNumber, address, currency, status },
    });

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_COMPANY',
      module: 'COMPANY',
      details: { companyId: company.id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: company.id,
    });

    return successResponse(res, 'Company updated successfully', company);
  } catch (err) {
    next(err);
  }
};

// --- Branch ---
export const createBranch = async (req, res, next) => {
  try {
    const { name, code, address, phone, companyId } = req.body;

    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;
    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    const existing = await prisma.branch.findUnique({
      where: { companyId_code: { companyId: targetCompanyId, code } },
    });

    if (existing) {
      throw new BadRequestError(`Branch with code '${code}' already exists in this company`);
    }

    const branch = await prisma.branch.create({
      data: { name, code, address, phone, companyId: targetCompanyId },
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_BRANCH',
      module: 'BRANCH',
      details: { branchId: branch.id, name: branch.name, code: branch.code },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Branch created successfully', branch, 201);
  } catch (err) {
    next(err);
  }
};

export const getBranches = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const branches = await prisma.branch.findMany({
      where: companyId ? { companyId } : {},
    });

    return successResponse(res, 'Branches retrieved successfully', branches);
  } catch (err) {
    next(err);
  }
};

// --- Financial Year ---
export const createFinancialYear = async (req, res, next) => {
  try {
    const { name, startDate, endDate, isActive, companyId } = req.body;

    const targetCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : req.user.companyId;
    if (!targetCompanyId) {
      throw new BadRequestError('Company ID is required');
    }

    if (isActive) {
      await prisma.financialYear.updateMany({
        where: { companyId: targetCompanyId },
        data: { isActive: false },
      });
    }

    const fy = await prisma.financialYear.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: !!isActive,
        companyId: targetCompanyId,
      },
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_FINANCIAL_YEAR',
      module: 'FINANCIAL_YEAR',
      details: { fyId: fy.id, name: fy.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      companyId: targetCompanyId,
    });

    return successResponse(res, 'Financial Year created successfully', fy, 201);
  } catch (err) {
    next(err);
  }
};

export const getFinancialYears = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;

    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You are not associated with any company');
    }

    const fys = await prisma.financialYear.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { startDate: 'desc' },
    });

    return successResponse(res, 'Financial Years retrieved successfully', fys);
  } catch (err) {
    next(err);
  }
};
