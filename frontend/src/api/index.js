import api from './axios.js';

// ── Auth ────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh-token'),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

// ── Companies ────────────────────────────────────────────────
export const companyApi = {
  getAll: () => api.get('/companies'),
  getById: (id) => api.get(`/companies/${id}`),
  create: (data) => api.post('/companies', data),
  update: (id, data) => api.put(`/companies/${id}`, data),
  // Branches
  getBranches: (companyId) => api.get('/companies/branches/list', { params: companyId ? { companyId } : {} }),
  createBranch: (data) => api.post('/companies/branches', data),
  // Financial Years
  getFinancialYears: (companyId) => api.get('/companies/financial-years/list', { params: companyId ? { companyId } : {} }),
  createFinancialYear: (data) => api.post('/companies/financial-years', data),
};

// ── Users ────────────────────────────────────────────────────
export const userApi = {
  getAll: (companyId) => api.get('/users', { params: companyId ? { companyId } : {} }),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  getAuditLogs: (companyId) => api.get('/users/audit-logs/list', { params: companyId ? { companyId } : {} }),
};

// ── Customers ────────────────────────────────────────────────
export const customerApi = {
  getAll: (companyId) => api.get('/customers', { params: companyId ? { companyId } : {} }),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  getLedger: (id) => api.get(`/customers/${id}/ledger`),
  getGroups: (companyId) => api.get('/customers/groups', { params: companyId ? { companyId } : {} }),
  createGroup: (data) => api.post('/customers/groups', data),
};

// ── Vendors ──────────────────────────────────────────────────
export const vendorApi = {
  getAll: (companyId) => api.get('/vendors', { params: companyId ? { companyId } : {} }),
  create: (data) => api.post('/vendors', data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  getLedger: (id) => api.get(`/vendors/${id}/ledger`),
  getDetails: (id) => api.get(`/vendors/${id}/details`),
  getPricingHistory: (id) => api.get(`/vendors/${id}/pricing-history`),
};

// ── Products ─────────────────────────────────────────────────
export const productApi = {
  getAll: (companyId) => api.get('/products', { params: companyId ? { companyId } : {} }),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  // Categories
  getCategories: (companyId) => api.get('/products/categories', { params: companyId ? { companyId } : {} }),
  createCategory: (data) => api.post('/products/categories', data),
  updateCategory: (id, data) => api.put(`/products/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/products/categories/${id}`),
  // Brands
  getBrands: (companyId) => api.get('/products/brands', { params: companyId ? { companyId } : {} }),
  createBrand: (data) => api.post('/products/brands', data),
  updateBrand: (id, data) => api.put(`/products/brands/${id}`, data),
  deleteBrand: (id) => api.delete(`/products/brands/${id}`),
  // Units
  getUnits: (companyId) => api.get('/products/units', { params: companyId ? { companyId } : {} }),
  createUnit: (data) => api.post('/products/units', data),
  updateUnit: (id, data) => api.put(`/products/units/${id}`, data),
  deleteUnit: (id) => api.delete(`/products/units/${id}`),
  // Variants
  getVariants: (productId) => api.get(`/products/${productId}/variants`),
  createVariant: (productId, data) => api.post(`/products/${productId}/variants`, data),
  updateVariant: (productId, variantId, data) => api.put(`/products/${productId}/variants/${variantId}`, data),
  deleteVariant: (productId, variantId) => api.delete(`/products/${productId}/variants/${variantId}`),
  // Barcode
  generateBarcode: (companyId) => api.get('/products/generate-barcode', { params: companyId ? { companyId } : {} }),
  lookupByBarcode: (code, companyId) => api.get(`/products/barcode-lookup/${code}`, { params: companyId ? { companyId } : {} }),
};


// ── Warehouses ───────────────────────────────────────────────
export const warehouseApi = {
  getAll: (companyId) => api.get('/warehouses', { params: companyId ? { companyId } : {} }),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
  delete: (id) => api.delete(`/warehouses/${id}`),
};

// ── Inventory ────────────────────────────────────────────────
export const inventoryApi = {
  stockIn: (data) => api.post('/inventory/stock-in', data),
  stockOut: (data) => api.post('/inventory/stock-out', data),
  stockTransfer: (data) => api.post('/inventory/stock-transfer', data),
  stockAdjustment: (data) => api.post('/inventory/stock-adjustment', data),
  getStocks: (params) => api.get('/inventory/stocks', { params }),
  getLowStock: (companyId) => api.get('/inventory/low-stock', { params: companyId ? { companyId } : {} }),
  getHistory: (params) => api.get('/inventory/history', { params }),
  getBatches: (params) => api.get('/inventory/batches', { params }),
  createBatch: (data) => api.post('/inventory/batches', data),
  deleteBatch: (id) => api.delete(`/inventory/batches/${id}`),
  reconcile: (data) => api.post('/inventory/reconcile', data),
};

// ── Sales ────────────────────────────────────────────────────
export const salesApi = {
  getQuotations: (companyId) => api.get('/sales/quotations', { params: companyId ? { companyId } : {} }),
  createQuotation: (data) => api.post('/sales/quotations', data),
  getSalesOrders: (companyId) => api.get('/sales/orders', { params: companyId ? { companyId } : {} }),
  createSalesOrder: (data) => api.post('/sales/orders', data),
  getDeliveryChallans: (companyId) => api.get('/sales/challans', { params: companyId ? { companyId } : {} }),
  createDeliveryChallan: (data) => api.post('/sales/challans', data),
  getInvoices: (companyId) => api.get('/sales/invoices', { params: companyId ? { companyId } : {} }),
  createInvoice: (data) => api.post('/sales/invoices', data),
  getReturns: (companyId) => api.get('/sales/returns', { params: companyId ? { companyId } : {} }),
  createReturn: (data) => api.post('/sales/returns', data),
};

// ── Purchases ────────────────────────────────────────────────
export const purchaseApi = {
  getOrders: (companyId) => api.get('/purchases/orders', { params: companyId ? { companyId } : {} }),
  createOrder: (data) => api.post('/purchases/orders', data),
  updateOrderStatus: (id, data) => api.put(`/purchases/orders/${id}/status`, data),
  convertOrderToInvoice: (id, data) => api.post(`/purchases/orders/${id}/convert`, data),
  receiveOrder: (id, data) => api.post(`/purchases/orders/${id}/receive`, data),
  getVendorHistory: (vendorId, companyId) => api.get(`/purchases/vendors/${vendorId}/history`, { params: companyId ? { companyId } : {} }),
  getInvoices: (companyId) => api.get('/purchases/invoices', { params: companyId ? { companyId } : {} }),
  createInvoice: (data) => api.post('/purchases/invoices', data),
  getReturns: (companyId) => api.get('/purchases/returns', { params: companyId ? { companyId } : {} }),
  createReturn: (data) => api.post('/purchases/returns', data),
};

// ── Finance ──────────────────────────────────────────────────
export const financeApi = {
  getPayments: (companyId) => api.get('/finance/payments', { params: companyId ? { companyId } : {} }),
  createPayment: (data) => api.post('/finance/payments', data),
  getExpenses: (companyId) => api.get('/finance/expenses', { params: companyId ? { companyId } : {} }),
  createExpense: (data) => api.post('/finance/expenses', data),
  getCashBook: (companyId) => api.get('/finance/cash-book', { params: companyId ? { companyId } : {} }),
  getBankBook: (companyId) => api.get('/finance/bank-book', { params: companyId ? { companyId } : {} }),
};

// ── Reports ──────────────────────────────────────────────────
export const reportApi = {
  getSales: (companyId) => api.get('/reports/sales', { params: companyId ? { companyId } : {} }),
  getPurchases: (companyId) => api.get('/reports/purchases', { params: companyId ? { companyId } : {} }),
  getStock: (companyId) => api.get('/reports/stock', { params: companyId ? { companyId } : {} }),
  getGst: (companyId) => api.get('/reports/gst', { params: companyId ? { companyId } : {} }),
  getProfitLoss: (companyId) => api.get('/reports/profit-loss', { params: companyId ? { companyId } : {} }),
};

// ── Dispatch ──────────────────────────────────────────────────
export const dispatchApi = {
  getAll: (params) => api.get('/dispatch', { params }),
  getById: (id) => api.get(`/dispatch/${id}`),
  create: (data) => api.post('/dispatch', data),
  updateStatus: (id, data) => api.put(`/dispatch/${id}/status`, data),
};

