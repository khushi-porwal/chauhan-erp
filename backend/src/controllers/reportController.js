import prisma from '../config/db.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { successResponse } from '../utils/apiResponse.js';

// ── Sales Report ──────────────────────────────────────────────
export const getSalesReport = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const invoices = await prisma.salesInvoice.findMany({
      where: {
        companyId: companyId || undefined,
        status: { not: 'CANCELLED' }
      },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } }
      },
      orderBy: { date: 'desc' }
    });

    // Compute aggregations
    let totalSalesVal = 0;
    let totalTaxVal = 0;
    let totalDiscVal = 0;
    const customerSales = {};

    invoices.forEach(inv => {
      totalSalesVal += inv.netAmount;
      totalTaxVal += inv.gstAmount;
      totalDiscVal += inv.discount;

      const custName = inv.customer?.name || 'Walk-in Customer';
      customerSales[custName] = (customerSales[custName] || 0) + inv.netAmount;
    });

    return successResponse(res, 'Sales report retrieved successfully', {
      summary: {
        totalSalesValue: totalSalesVal,
        totalTaxCollected: totalTaxVal,
        totalDiscountGiven: totalDiscVal,
        totalInvoiceCount: invoices.length
      },
      customerSales,
      invoices
    });
  } catch (err) {
    next(err);
  }
};

// ── Purchase Report ───────────────────────────────────────────
export const getPurchaseReport = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    const invoices = await prisma.purchaseInvoice.findMany({
      where: {
        companyId: companyId || undefined,
        status: { not: 'CANCELLED' }
      },
      include: {
        vendor: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } }
      },
      orderBy: { date: 'desc' }
    });

    let totalPurchaseVal = 0;
    let totalTaxVal = 0;
    let totalDiscVal = 0;
    const vendorPurchases = {};

    invoices.forEach(inv => {
      totalPurchaseVal += inv.netAmount;
      totalTaxVal += inv.gstAmount;
      totalDiscVal += inv.discount;

      const vendName = inv.vendor?.name || 'Unknown Supplier';
      vendorPurchases[vendName] = (vendorPurchases[vendName] || 0) + inv.netAmount;
    });

    return successResponse(res, 'Purchase report retrieved successfully', {
      summary: {
        totalPurchaseValue: totalPurchaseVal,
        totalTaxPaid: totalTaxVal,
        totalDiscountReceived: totalDiscVal,
        totalInvoiceCount: invoices.length
      },
      vendorPurchases,
      invoices
    });
  } catch (err) {
    next(err);
  }
};

// ── Stock Report ──────────────────────────────────────────────
export const getStockReport = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    // Fetch warehouse stocks
    const stocks = await prisma.warehouseStock.findMany({
      where: companyId ? { companyId } : {},
      include: {
        warehouse: { select: { name: true, code: true } },
        product: true,
        variant: true
      }
    });

    let totalValuationPurchase = 0;
    let totalValuationSales = 0;
    let totalQty = 0;

    stocks.forEach(st => {
      const qty = st.quantity;
      const buyPrice = st.product?.purchasePrice || 0;
      const sellPrice = st.variant?.price || st.product?.salesPrice || 0;

      totalValuationPurchase += qty * buyPrice;
      totalValuationSales += qty * sellPrice;
      totalQty += qty;
    });

    return successResponse(res, 'Stock report retrieved successfully', {
      summary: {
        totalQuantity: totalQty,
        totalValuationAtPurchasePrice: totalValuationPurchase,
        totalValuationAtSalesPrice: totalValuationSales
      },
      stocks
    });
  } catch (err) {
    next(err);
  }
};

// ── GST Report ────────────────────────────────────────────────
export const getGstReport = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    // Fetch tax collected (Sales)
    const salesInvoices = await prisma.salesInvoice.findMany({
      where: {
        companyId: companyId || undefined,
        status: { not: 'CANCELLED' }
      },
      select: { gstAmount: true, netAmount: true, invoiceNo: true, date: true }
    });

    // Fetch tax paid (Purchase)
    const purchaseInvoices = await prisma.purchaseInvoice.findMany({
      where: {
        companyId: companyId || undefined,
        status: { not: 'CANCELLED' }
      },
      select: { gstAmount: true, netAmount: true, billNo: true, date: true }
    });

    let totalGstCollected = 0;
    let totalSalesEligible = 0;
    salesInvoices.forEach(s => {
      totalGstCollected += s.gstAmount;
      totalSalesEligible += s.netAmount;
    });

    let totalGstPaid = 0;
    let totalPurchasesEligible = 0;
    purchaseInvoices.forEach(p => {
      totalGstPaid += p.gstAmount;
      totalPurchasesEligible += p.netAmount;
    });

    const netGstLiability = totalGstCollected - totalGstPaid;

    return successResponse(res, 'GST report retrieved successfully', {
      summary: {
        totalSalesEligible,
        totalPurchasesEligible,
        totalGstCollected,
        totalGstPaid,
        netGstLiability
      },
      salesInvoices,
      purchaseInvoices
    });
  } catch (err) {
    next(err);
  }
};

// ── Profit & Loss Summary ──────────────────────────────────────
export const getProfitLossReport = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'SUPER_ADMIN' ? req.query.companyId : req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') throw new ForbiddenError('No associated company');

    // Revenue
    const sales = await prisma.salesInvoice.aggregate({
      where: { companyId: companyId || undefined, status: { not: 'CANCELLED' } },
      _sum: { netAmount: true }
    });
    const returns = await prisma.salesReturn.aggregate({
      where: { companyId: companyId || undefined },
      _sum: { netAmount: true }
    });

    const totalRevenue = (sales._sum.netAmount || 0) - (returns._sum.netAmount || 0);

    // Cost of Purchases
    const purchases = await prisma.purchaseInvoice.aggregate({
      where: { companyId: companyId || undefined, status: { not: 'CANCELLED' } },
      _sum: { netAmount: true }
    });
    const pReturns = await prisma.purchaseReturn.aggregate({
      where: { companyId: companyId || undefined },
      _sum: { netAmount: true }
    });

    const totalPurchaseCost = (purchases._sum.netAmount || 0) - (pReturns._sum.netAmount || 0);

    // Expenses
    const expenses = await prisma.expense.aggregate({
      where: { companyId: companyId || undefined },
      _sum: { amount: true }
    });

    const totalExpenses = expenses._sum.amount || 0;

    const grossProfit = totalRevenue - totalPurchaseCost;
    const netProfit = grossProfit - totalExpenses;

    return successResponse(res, 'Profit and loss summary retrieved successfully', {
      revenue: totalRevenue,
      purchaseCost: totalPurchaseCost,
      grossProfit,
      expenses: totalExpenses,
      netProfit
    });
  } catch (err) {
    next(err);
  }
};
