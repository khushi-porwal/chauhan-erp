import { useState, useEffect, useCallback } from 'react';
import { Package, AlertTriangle, RefreshCw, TrendingDown, ArrowDown, Search, Filter, Plus } from 'lucide-react';
import { m1Api, inventoryApi, warehouseApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LowStock() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Restock modal state
  const [restockModal, setRestockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [restockForm, setRestockForm] = useState({ warehouseId: '', quantity: '', description: '' });
  const [restockLoading, setRestockLoading] = useState(false);

  const fetchLowStock = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const companyId = user?.role !== 'SUPER_ADMIN' ? undefined : undefined;
      const res = await m1Api.getLowStock({ page, limit: 20 });
      const data = res.data?.data;
      let prods = data?.products || [];
      if (search) {
        prods = prods.filter(p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
        );
      }
      setProducts(prods);
      setPagination(data?.pagination || { total: 0, page: 1, totalPages: 1 });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load low stock data');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await warehouseApi.getAll();
      setWarehouses(res.data?.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchLowStock(); fetchWarehouses(); }, [fetchLowStock, fetchWarehouses]);

  const openRestockModal = (product) => {
    setSelectedProduct(product);
    setRestockForm({ warehouseId: '', quantity: '', description: `Restock for low stock item: ${product.name}` });
    setRestockModal(true);
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    if (!restockForm.warehouseId || !restockForm.quantity) return;
    setRestockLoading(true);
    try {
      await inventoryApi.stockIn({
        productId: selectedProduct.id,
        warehouseId: restockForm.warehouseId,
        quantity: parseFloat(restockForm.quantity),
        description: restockForm.description,
      });
      setRestockModal(false);
      fetchLowStock();
    } catch (err) {
      alert(err?.response?.data?.message || 'Restock failed');
    } finally {
      setRestockLoading(false);
    }
  };

  const getStockPercentage = (current, threshold) => {
    if (!threshold || threshold === 0) return 100;
    return Math.min(100, (current / threshold) * 100);
  };

  const getStockColor = (current, threshold) => {
    const pct = getStockPercentage(current, threshold);
    if (pct === 0) return 'bg-red-500';
    if (pct <= 30) return 'bg-red-400';
    if (pct <= 70) return 'bg-yellow-400';
    return 'bg-green-400';
  };

  const getStockBadge = (current, threshold) => {
    if (current === 0) return { label: 'OUT OF STOCK', cls: 'bg-red-100 text-red-700 border border-red-200' };
    if (current <= threshold * 0.3) return { label: 'CRITICAL', cls: 'bg-red-50 text-red-600 border border-red-200' };
    return { label: 'LOW STOCK', cls: 'bg-yellow-50 text-yellow-600 border border-yellow-200' };
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 rounded-xl">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Low Stock Alerts</h1>
            <p className="text-sm text-gray-500">Products at or below minimum threshold</p>
          </div>
        </div>
        <button
          onClick={fetchLowStock}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-red-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg"><TrendingDown className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Low Stock</p>
              <p className="text-2xl font-bold text-red-600">{pagination.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-orange-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-orange-600" /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Out of Stock</p>
              <p className="text-2xl font-bold text-orange-600">
                {products.filter(p => p.currentStock === 0).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-yellow-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg"><Package className="w-5 h-5 text-yellow-600" /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Critical Level</p>
              <p className="text-2xl font-bold text-yellow-600">
                {products.filter(p => p.currentStock > 0 && p.currentStock <= p.lowStockThreshold * 0.3).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading low stock data...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <div className="p-4 bg-green-50 rounded-full">
              <Package className="w-10 h-10 text-green-400" />
            </div>
            <p className="text-lg font-medium text-gray-500">All stock levels are healthy!</p>
            <p className="text-sm">No products are below their minimum threshold.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Stock</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Threshold</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock Level</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map(product => {
                  const badge = getStockBadge(product.currentStock, product.lowStockThreshold);
                  const pct = getStockPercentage(product.currentStock, product.lowStockThreshold);
                  const barColor = getStockColor(product.currentStock, product.lowStockThreshold);
                  const primaryImg = product.images?.[0]?.url;

                  return (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {primaryImg ? (
                            <img src={primaryImg} alt={product.name} className="w-10 h-10 rounded-lg object-cover border" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-800">{product.name}</p>
                            <p className="text-xs text-gray-400">{product.sku || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{product.category?.name || '—'}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`font-bold text-lg ${product.currentStock === 0 ? 'text-red-600' : 'text-orange-500'}`}>
                          {product.currentStock}
                        </span>
                        <span className="text-gray-400 text-xs ml-1">{product.unit?.name || ''}</span>
                      </td>
                      <td className="px-5 py-4 text-center text-gray-600 font-medium">{product.lowStockThreshold}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-24">
                            <div
                              className={`h-2 rounded-full transition-all ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 font-medium">{Math.round(pct)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => openRestockModal(product)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 ml-auto"
                        >
                          <Plus className="w-3 h-3" />
                          Restock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                p === page ? 'bg-red-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Restock Modal */}
      {restockModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Quick Restock</h2>
              <p className="text-sm text-gray-500 mt-1">{selectedProduct.name}</p>
            </div>
            <form onSubmit={handleRestock} className="p-6 space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-orange-700">Current Stock: {selectedProduct.currentStock}</p>
                  <p className="text-orange-600">Threshold: {selectedProduct.lowStockThreshold}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse *</label>
                <select
                  value={restockForm.warehouseId}
                  onChange={e => setRestockForm(f => ({ ...f, warehouseId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  required
                >
                  <option value="">Select warehouse...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Add *</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={restockForm.quantity}
                  onChange={e => setRestockForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="Enter quantity"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input
                  type="text"
                  value={restockForm.description}
                  onChange={e => setRestockForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restockLoading}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {restockLoading ? 'Processing...' : 'Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
