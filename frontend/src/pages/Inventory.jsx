import { useState, useEffect, useCallback } from 'react';
import { inventoryApi, productApi, warehouseApi, companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import BarcodeScannerModal from '../components/BarcodeScannerModal.jsx';
import {
  Boxes, Plus, AlertTriangle, History,
  ArrowRightLeft, ArrowDown, ArrowUp, RefreshCw, X, Save,
  Layers, Tag, Trash2, Search, CheckCircle2, ClipboardCheck, Barcode
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Inventory() {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('levels');
  const [loading, setLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Master Data Lists
  const [stocks, setStocks] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [history, setHistory] = useState([]);
  const [batches, setBatches] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  // Filters & Search
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [batchSearch, setBatchSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  // Transaction Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txType, setTxType] = useState('STOCK_IN'); // STOCK_IN, STOCK_OUT, STOCK_TRANSFER, STOCK_ADJUSTMENT

  // Form Fields for Stock Movement
  const [formProductId, setFormProductId] = useState('');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formFromWarehouseId, setFormFromWarehouseId] = useState('');
  const [formToWarehouseId, setFormToWarehouseId] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formBatchNumber, setFormBatchNumber] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formMfgDate, setFormMfgDate] = useState('');

  // Batch Creation Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchFormProductId, setBatchFormProductId] = useState('');
  const [batchFormNumber, setBatchFormNumber] = useState('');
  const [batchFormWarehouseId, setBatchFormWarehouseId] = useState('');
  const [batchFormQty, setBatchFormQty] = useState('');
  const [batchFormMfgDate, setBatchFormMfgDate] = useState('');
  const [batchFormExpiryDate, setBatchFormExpiryDate] = useState('');

  // Reconciliation State
  const [reconcileWarehouseId, setReconcileWarehouseId] = useState('');
  const [reconcileItems, setReconcileItems] = useState([]);
  const [reconcileLoading, setReconcileLoading] = useState(false);

  // Fetch Companies if SuperAdmin
  const fetchCompanies = async () => {
    try {
      const res = await companyApi.getAll();
      const companyData = res.data.data;
      setCompanies(companyData);
      if (companyData.length > 0) {
        setSelectedCompanyId(companyData[0].id);
      }
    } catch { /* ignore */ }
  };

  const fetchWarehouses = async (companyId) => {
    try {
      const res = await warehouseApi.getAll(companyId);
      setWarehouses(res.data.data.filter(wh => wh.status === 'ACTIVE'));
    } catch { /* ignore */ }
  };

  const fetchProducts = async (companyId) => {
    try {
      const res = await productApi.getAll(companyId);
      const data = res.data?.data;
      const productList = Array.isArray(data) ? data : (data?.products || []);
      setProducts(productList);
    } catch { /* ignore */ }
  };

  const fetchStockLevels = async (companyId) => {
    setLoading(true);
    try {
      const params = {};
      if (companyId) params.companyId = companyId;
      if (filterWarehouse) params.warehouseId = filterWarehouse;
      const res = await inventoryApi.getStocks(params);
      setStocks(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load stock levels');
    } finally {
      setLoading(false);
    }
  };

  const fetchLowStock = async (companyId) => {
    try {
      const res = await inventoryApi.getLowStock(companyId);
      setLowStock(res.data.data);
    } catch { /* ignore */ }
  };

  const fetchHistory = async (companyId) => {
    try {
      const params = {};
      if (companyId) params.companyId = companyId;
      const res = await inventoryApi.getHistory(params);
      setHistory(res.data.data);
    } catch { /* ignore */ }
  };

  const fetchBatches = async (companyId) => {
    try {
      const params = {};
      if (companyId) params.companyId = companyId;
      const res = await inventoryApi.getBatches(params);
      setBatches(res.data.data);
    } catch { /* ignore */ }
  };

  const loadAll = useCallback((companyId) => {
    fetchStockLevels(companyId);
    fetchWarehouses(companyId);
    fetchProducts(companyId);
    fetchLowStock(companyId);
    fetchHistory(companyId);
    fetchBatches(companyId);
  }, [filterWarehouse]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    } else {
      loadAll();
    }
  }, [isSuperAdmin, loadAll]);

  useEffect(() => {
    if (isSuperAdmin && selectedCompanyId) {
      loadAll(selectedCompanyId);
    }
  }, [selectedCompanyId, isSuperAdmin, loadAll]);

  // Refetch when filters change
  useEffect(() => {
    const compId = isSuperAdmin ? selectedCompanyId : undefined;
    fetchStockLevels(compId);
  }, [filterWarehouse, filterProduct]);

  const openTxModal = (type, prefill = {}) => {
    setTxType(type);
    const firstProd = prefill.productId || products[0]?.id || '';
    setFormProductId(firstProd);
    setFormWarehouseId(prefill.warehouseId || warehouses[0]?.id || '');
    setFormFromWarehouseId(prefill.warehouseId || warehouses[0]?.id || '');
    setFormToWarehouseId(warehouses[1]?.id || warehouses[0]?.id || '');
    setFormQuantity(prefill.quantity !== undefined ? prefill.quantity.toString() : '');
    setFormDescription('');
    setFormBatchNumber(prefill.batchNumber || '');
    setFormExpiryDate('');
    setFormMfgDate('');
    setIsModalOpen(true);
  };

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    if (!formProductId || !formQuantity) {
      return toast.error('Required fields are missing');
    }

    const qty = parseFloat(formQuantity);
    if (isNaN(qty) || qty <= 0) {
      if (txType !== 'STOCK_ADJUSTMENT' || qty < 0) {
        return toast.error('Quantity must be a valid positive number');
      }
    }

    const companyIdParam = isSuperAdmin ? selectedCompanyId : undefined;

    try {
      if (txType === 'STOCK_IN') {
        await inventoryApi.stockIn({
          productId: formProductId,
          warehouseId: formWarehouseId,
          quantity: qty,
          description: formDescription,
          batchNumber: formBatchNumber,
          expiryDate: formExpiryDate || undefined,
          mfgDate: formMfgDate || undefined,
          companyId: companyIdParam
        });
        toast.success('Stock-In logged successfully');
      } else if (txType === 'STOCK_OUT') {
        await inventoryApi.stockOut({
          productId: formProductId,
          warehouseId: formWarehouseId,
          quantity: qty,
          description: formDescription,
          batchNumber: formBatchNumber,
          companyId: companyIdParam
        });
        toast.success('Stock-Out logged successfully');
      } else if (txType === 'STOCK_TRANSFER') {
        await inventoryApi.stockTransfer({
          productId: formProductId,
          fromWarehouseId: formFromWarehouseId,
          toWarehouseId: formToWarehouseId,
          quantity: qty,
          description: formDescription,
          batchNumber: formBatchNumber,
          companyId: companyIdParam
        });
        toast.success('Stock Transfer completed successfully');
      } else if (txType === 'STOCK_ADJUSTMENT') {
        await inventoryApi.stockAdjustment({
          productId: formProductId,
          warehouseId: formWarehouseId,
          quantity: qty,
          description: formDescription,
          companyId: companyIdParam
        });
        toast.success('Stock Adjust completed successfully');
      }

      setIsModalOpen(false);
      loadAll(isSuperAdmin ? selectedCompanyId : undefined);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Transaction failed';
      toast.error(errMsg);
    }
  };

  // Create Batch Form Handler
  const handleCreateBatchSubmit = async (e) => {
    e.preventDefault();
    if (!batchFormProductId || !batchFormNumber) {
      return toast.error('Product and Batch Number are required');
    }
    const companyIdParam = isSuperAdmin ? selectedCompanyId : undefined;
    try {
      await inventoryApi.createBatch({
        productId: batchFormProductId,
        batchNumber: batchFormNumber.trim(),
        quantity: batchFormQty ? parseFloat(batchFormQty) : 0,
        warehouseId: batchFormWarehouseId || undefined,
        mfgDate: batchFormMfgDate || undefined,
        expiryDate: batchFormExpiryDate || undefined,
        companyId: companyIdParam
      });
      toast.success(`Batch '${batchFormNumber}' registered successfully`);
      setIsBatchModalOpen(false);
      fetchBatches(companyIdParam);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to create batch';
      toast.error(errMsg);
    }
  };

  const handleDeleteBatch = async (batchId, batchNo) => {
    if (!window.confirm(`Are you sure you want to delete batch "${batchNo}"?`)) return;
    try {
      await inventoryApi.deleteBatch(batchId);
      toast.success('Batch deleted successfully');
      fetchBatches(isSuperAdmin ? selectedCompanyId : undefined);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to delete batch';
      toast.error(errMsg);
    }
  };

  const getTxTypeBadgeClass = (type) => {
    if (type === 'STOCK_IN') return 'alert-success';
    if (type === 'STOCK_OUT') return 'alert-danger';
    if (type === 'STOCK_TRANSFER') return 'alert-info';
    return 'alert-warning';
  };

  // Helper for Batch Expiry Status
  const getBatchExpiryStatus = (expiryDate) => {
    if (!expiryDate) return { text: 'No Expiry Set', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' };
    const exp = new Date(expiryDate);
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (exp < now) {
      return { text: 'Expired', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
    } else if (exp.getTime() - now.getTime() < thirtyDays) {
      return { text: 'Expiring Soon', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
    }
    return { text: 'Active', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
  };

  // Helper to find stock available in chosen warehouse & product
  const getAvailableStockHelper = (whId, prodId) => {
    const found = stocks.find(s => s.warehouseId === whId && s.productId === prodId);
    return found ? found.quantity : 0;
  };

  const filteredBatches = batches.filter(b => {
    const query = batchSearch.toLowerCase();
    return (
      b.batchNumber?.toLowerCase().includes(query) ||
      b.product?.name?.toLowerCase().includes(query) ||
      b.product?.sku?.toLowerCase().includes(query) ||
      b.warehouse?.name?.toLowerCase().includes(query)
    );
  });

  const filteredHistory = history.filter(h => {
    const query = historySearch.toLowerCase();
    return (
      h.product?.name?.toLowerCase().includes(query) ||
      h.type?.toLowerCase().includes(query) ||
      h.batchNumber?.toLowerCase().includes(query) ||
      h.description?.toLowerCase().includes(query) ||
      h.fromWarehouse?.name?.toLowerCase().includes(query) ||
      h.toWarehouse?.name?.toLowerCase().includes(query)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header Section */}
      <div className="flex-between">
        <div>
          <h1 className="text-primary font-bold">Inventory Control</h1>
          <p className="text-secondary text-sm">Track physical inventory counts, record movements, manage batches & warehouses</p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary flex-center" onClick={() => openTxModal('STOCK_IN')}>
            <ArrowDown size={14} className="text-success" /> Stock In
          </button>
          <button className="btn btn-secondary flex-center" onClick={() => openTxModal('STOCK_OUT')}>
            <ArrowUp size={14} className="text-danger" /> Stock Out
          </button>
          <button className="btn btn-secondary flex-center" onClick={() => openTxModal('STOCK_TRANSFER')}>
            <ArrowRightLeft size={14} className="text-info" /> Transfer
          </button>
          <button className="btn btn-primary flex-center" onClick={() => openTxModal('STOCK_ADJUSTMENT')}>
            <Boxes size={14} /> Adjust Count
          </button>
        </div>
      </div>

      {/* Super Admin Company Selector */}
      {isSuperAdmin && companies.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label className="form-label">Active Company Filter</label>
            <select
              className="form-select"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Nav Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn${activeTab === 'levels' ? ' active' : ''}`}
          onClick={() => setActiveTab('levels')}
        >
          <span className="flex gap-2" style={{ alignItems: 'center' }}>
            <Boxes size={14} /> Stock Levels ({stocks.length})
          </span>
        </button>
        <button
          className={`tab-btn${activeTab === 'batches' ? ' active' : ''}`}
          onClick={() => setActiveTab('batches')}
        >
          <span className="flex gap-2" style={{ alignItems: 'center' }}>
            <Layers size={14} /> Batches & Lots ({batches.length})
          </span>
        </button>
        <button
          className={`tab-btn${activeTab === 'alerts' ? ' active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          <span className="flex gap-2" style={{ alignItems: 'center' }}>
            <AlertTriangle size={14} className="text-warning" /> Low Stock Alerts ({lowStock.length})
          </span>
        </button>
        <button
          className={`tab-btn${activeTab === 'history' ? ' active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="flex gap-2" style={{ alignItems: 'center' }}>
            <History size={14} /> Transaction History
          </span>
        </button>
        <button
          className={`tab-btn${activeTab === 'reconcile' ? ' active' : ''}`}
          onClick={() => {
            setActiveTab('reconcile');
            if (warehouses.length > 0 && !reconcileWarehouseId) {
              setReconcileWarehouseId(warehouses[0].id);
              const compId = isSuperAdmin ? selectedCompanyId : undefined;
              inventoryApi.getStocks({ warehouseId: warehouses[0].id, ...(compId ? { companyId: compId } : {}) }).then(res => {
                setReconcileItems((res.data.data || []).map(s => ({
                  productId: s.productId,
                  variantId: s.variantId || null,
                  productName: s.product?.name || 'Product',
                  systemQty: s.quantity,
                  physicalQty: s.quantity.toString(),
                  reason: ''
                })));
              }).catch(() => {});
            }
          }}
        >
          <span className="flex gap-2" style={{ alignItems: 'center' }}>
            <ClipboardCheck size={14} /> Stock Reconciliation
          </span>
        </button>
      </div>

      {/* Tab: Stock Levels */}
      {activeTab === 'levels' && (
        <>
          <div className="card grid-3" style={{ padding: 'var(--space-4)', gridTemplateColumns: '1fr 1fr auto' }}>
            <div className="form-group">
              <label className="form-label">Filter Warehouse</label>
              <select
                className="form-select"
                value={filterWarehouse}
                onChange={(e) => setFilterWarehouse(e.target.value)}
              >
                <option value="">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Search Product Catalog</label>
              <select
                className="form-select"
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
              >
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-secondary flex-center"
              style={{ alignSelf: 'flex-end', height: '38px' }}
              onClick={() => { setFilterWarehouse(''); setFilterProduct(''); }}
            >
              <RefreshCw size={14} /> Reset Filters
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading stock quantities...</div>
          ) : stocks.length === 0 ? (
            <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Boxes size={48} style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-secondary">No Stocks Recorded</h3>
              <p className="text-muted text-sm">Perform a stock-in transaction to populate warehouse counts</p>
              <button className="btn btn-primary" onClick={() => openTxModal('STOCK_IN')}>
                Stock In
              </button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Product Details</th>
                    <th>Warehouse Location</th>
                    <th>Stock Count (Qty)</th>
                    <th>SKU / Barcode</th>
                    <th>Overall Total Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks
                    .filter((s) => !filterProduct || s.productId === filterProduct)
                    .map((stock) => (
                      <tr key={stock.id}>
                        <td>
                          <span className="font-semibold text-primary">{stock.product.name}</span>
                          {stock.variant && <span className="text-xs text-muted"> ({stock.variant.name})</span>}
                        </td>
                        <td>
                          <span className="alert-info" style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '10px', fontWeight: '500' }}>
                            {stock.warehouse.name} ({stock.warehouse.code})
                          </span>
                        </td>
                        <td className="font-semibold text-primary">{stock.quantity}</td>
                        <td className="text-xs text-secondary">
                          {stock.product.sku || '-'} {stock.product.barcode ? `/ ${stock.product.barcode}` : ''}
                        </td>
                        <td className="text-secondary">{stock.product.currentStock}</td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm flex-center"
                            onClick={() => openTxModal('STOCK_ADJUSTMENT', { productId: stock.productId, warehouseId: stock.warehouseId, quantity: stock.quantity })}
                            title="Update / Adjust Stock Count"
                          >
                            <RefreshCw size={12} style={{ marginRight: 4 }} /> Adjust Count
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab: Batches & Lots */}
      {activeTab === 'batches' && (
        <>
          <div className="flex-between">
            <div className="form-group" style={{ maxWidth: '360px', flex: 1 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '34px' }}
                  placeholder="Search batch number, product or warehouse..."
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                />
              </div>
            </div>
            <button
              className="btn btn-primary flex-center"
              onClick={() => {
                setBatchFormProductId(products[0]?.id || '');
                setBatchFormNumber('');
                setBatchFormWarehouseId(warehouses[0]?.id || '');
                setBatchFormQty('');
                setBatchFormMfgDate('');
                setBatchFormExpiryDate('');
                setIsBatchModalOpen(true);
              }}
            >
              <Plus size={14} /> Register Batch / Lot
            </button>
          </div>

          {filteredBatches.length === 0 ? (
            <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Layers size={48} style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-secondary">No Batches Found</h3>
              <p className="text-muted text-sm">{batchSearch ? 'Try a different search query' : 'Register batch/lot numbers during stock in or via manual entry'}</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Batch / Lot No</th>
                    <th>Product Name</th>
                    <th>Warehouse Depot</th>
                    <th>Quantity</th>
                    <th>Mfg Date</th>
                    <th>Expiry Date</th>
                    <th>Expiry Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((b) => {
                    const status = getBatchExpiryStatus(b.expiryDate);
                    return (
                      <tr key={b.id}>
                        <td>
                          <span className="font-semibold text-primary flex gap-2" style={{ alignItems: 'center' }}>
                            <Tag size={13} style={{ color: 'var(--primary)' }} />
                            {b.batchNumber}
                          </span>
                        </td>
                        <td>
                          <span className="font-medium text-primary">{b.product?.name || '-'}</span>
                          {b.product?.sku && <span className="text-xs text-muted"> ({b.product.sku})</span>}
                        </td>
                        <td>
                          {b.warehouse ? (
                            <span className="alert-info" style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '10px' }}>
                              {b.warehouse.name}
                            </span>
                          ) : (
                            <span className="text-muted text-xs">All Warehouses</span>
                          )}
                        </td>
                        <td className="font-semibold text-primary">{b.quantity}</td>
                        <td className="text-xs text-secondary">
                          {b.mfgDate ? new Date(b.mfgDate).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="text-xs font-medium" style={{ color: status.color }}>
                          {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '10px',
                              fontWeight: '600',
                              color: status.color,
                              backgroundColor: status.bg
                            }}
                          >
                            {status.text}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-icon btn-sm text-danger"
                            onClick={() => handleDeleteBatch(b.id, b.batchNumber)}
                            title="Delete Batch"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab: Low Stock Alerts */}
      {activeTab === 'alerts' && (
        <>
          {lowStock.length === 0 ? (
            <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <CheckCircle2 size={48} style={{ color: 'var(--success)' }} />
              <h3 className="text-secondary">Inventory Healthy</h3>
              <p className="text-muted text-sm">No items currently below low-stock alert thresholds</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Product Details</th>
                    <th>SKU</th>
                    <th>Current Total Stock</th>
                    <th>Min Alert Threshold</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className="font-semibold text-danger">{p.name}</span>
                      </td>
                      <td className="text-xs text-secondary">{p.sku || '-'}</td>
                      <td className="font-semibold text-danger">{p.currentStock}</td>
                      <td className="text-secondary">{p.lowStockThreshold}</td>
                      <td>{p.category?.name || '-'}</td>
                      <td>{p.brand?.name || '-'}</td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm flex-center"
                          onClick={() => openTxModal('STOCK_IN', { productId: p.id })}
                          title="Refill Stock"
                        >
                          <ArrowDown size={12} style={{ marginRight: 4 }} /> Refill Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab: Transaction History */}
      {activeTab === 'history' && (
        <>
          <div className="form-group" style={{ maxWidth: '360px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '34px' }}
                placeholder="Search transaction history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <History size={48} style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-secondary">No Activity Found</h3>
              <p className="text-muted text-sm">Stock movement logs will record transactions automatically</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Movement Type</th>
                    <th>Product</th>
                    <th>From Warehouse</th>
                    <th>To Warehouse</th>
                    <th>Quantity</th>
                    <th>Batch / Lot</th>
                    <th>Description</th>
                    <th>Handled By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((tx) => (
                    <tr key={tx.id}>
                      <td className="text-xs">{new Date(tx.date).toLocaleString('en-IN')}</td>
                      <td>
                        <span className={`alert ${getTxTypeBadgeClass(tx.type)}`} style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 'bold' }}>
                          {tx.type}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold text-primary">{tx.product.name}</span>
                      </td>
                      <td className="text-sm">{tx.fromWarehouse?.name || '-'}</td>
                      <td className="text-sm">{tx.toWarehouse?.name || '-'}</td>
                      <td className="font-semibold text-primary">{tx.quantity}</td>
                      <td className="text-xs text-secondary">{tx.batchNumber || '-'}</td>
                      <td className="text-sm text-secondary">{tx.description || '-'}</td>
                      <td className="text-xs text-muted">{tx.createdBy?.name || 'System User'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab: Stock Reconciliation Engine */}
      {activeTab === 'reconcile' && (
        <>
          <div className="card flex-between" style={{ padding: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div className="form-group" style={{ minWidth: '240px' }}>
              <label className="form-label">Select Warehouse for Physical Audit *</label>
              <select
                className="form-select"
                value={reconcileWarehouseId}
                onChange={(e) => {
                  const whId = e.target.value;
                  setReconcileWarehouseId(whId);
                  const compId = isSuperAdmin ? selectedCompanyId : undefined;
                  inventoryApi.getStocks({ warehouseId: whId, ...(compId ? { companyId: compId } : {}) }).then(res => {
                    setReconcileItems((res.data.data || []).map(s => ({
                      productId: s.productId,
                      variantId: s.variantId || null,
                      productName: s.product?.name || 'Product',
                      sku: s.product?.sku || '',
                      barcode: s.product?.barcode || '',
                      systemQty: s.quantity,
                      physicalQty: s.quantity.toString(),
                      reason: ''
                    })));
                  }).catch(() => {});
                }}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2" style={{ alignItems: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary flex-center"
                onClick={() => setIsScannerOpen(true)}
              >
                <Barcode size={14} /> Scan Barcode
              </button>
              <button
                type="button"
                className="btn btn-primary flex-center"
                disabled={reconcileLoading || reconcileItems.length === 0}
                onClick={async () => {
                  if (!reconcileWarehouseId) return toast.error('Please select a warehouse');
                  setReconcileLoading(true);
                  try {
                    await inventoryApi.reconcile({
                      warehouseId: reconcileWarehouseId,
                      items: reconcileItems.map(i => ({
                        productId: i.productId,
                        variantId: i.variantId || null,
                        physicalQty: parseFloat(i.physicalQty || 0),
                        reason: i.reason || undefined
                      })),
                      companyId: isSuperAdmin ? selectedCompanyId : undefined
                    });
                    toast.success('Stock reconciliation completed successfully');
                    loadAll(isSuperAdmin ? selectedCompanyId : undefined);
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Reconciliation failed');
                  } finally {
                    setReconcileLoading(false);
                  }
                }}
              >
                {reconcileLoading ? 'Saving...' : 'Apply Batch Reconciliation'}
              </button>
            </div>
          </div>

          {reconcileItems.length === 0 ? (
            <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <ClipboardCheck size={48} style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-secondary">No Stock Items to Reconcile</h3>
              <p className="text-muted text-sm">Select a warehouse with stock items to perform a physical inventory audit</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU / Barcode</th>
                    <th>System Count</th>
                    <th>Physical Count (Input / Scan)</th>
                    <th>Discrepancy (Diff)</th>
                    <th>Adjustment Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {reconcileItems.map((item, idx) => {
                    const physical = parseFloat(item.physicalQty) || 0;
                    const diff = physical - item.systemQty;
                    return (
                      <tr key={idx}>
                        <td className="font-semibold text-primary">{item.productName}</td>
                        <td className="text-xs text-muted">{item.sku || '-'} {item.barcode ? `/ ${item.barcode}` : ''}</td>
                        <td className="font-semibold">{item.systemQty}</td>
                        <td style={{ width: '140px' }}>
                          <input
                            type="number"
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '13px' }}
                            value={item.physicalQty}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReconcileItems(prev => {
                                const next = [...prev];
                                next[idx].physicalQty = val;
                                return next;
                              });
                            }}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td>
                          {diff === 0 ? (
                            <span className="text-muted text-xs font-semibold">Matched (0)</span>
                          ) : diff > 0 ? (
                            <span className="text-success font-bold text-xs">+{diff} (Surplus)</span>
                          ) : (
                            <span className="text-danger font-bold text-xs">{diff} (Shortage)</span>
                          )}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            placeholder="e.g. Audit variance"
                            value={item.reason}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReconcileItems(prev => {
                                const next = [...prev];
                                next[idx].reason = val;
                                return next;
                              });
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Barcode Scanner Modal Integration */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        title="Inventory Reconciliation Barcode Scanner"
        onScanSuccess={(product) => {
          setReconcileItems(prev => {
            const idx = prev.findIndex(i => i.productId === product.id);
            if (idx >= 0) {
              const updated = [...prev];
              const current = parseFloat(updated[idx].physicalQty || 0);
              updated[idx].physicalQty = (current + 1).toString();
              return updated;
            }
            return prev;
          });
        }}
      />

      {/* Modal: Transaction Wizard (Stock In / Stock Out / Transfer / Adjustment) */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '540px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1001 }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">
                {txType === 'STOCK_IN' && 'Record Stock In'}
                {txType === 'STOCK_OUT' && 'Record Stock Out'}
                {txType === 'STOCK_TRANSFER' && 'Warehouse Stock Transfer'}
                {txType === 'STOCK_ADJUSTMENT' && 'Override Stock Count'}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleTxSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Select Product *</label>
                <select
                  className="form-select"
                  value={formProductId}
                  onChange={(e) => setFormProductId(e.target.value)}
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
                  ))}
                </select>
              </div>

              {txType !== 'STOCK_TRANSFER' ? (
                <div className="form-group">
                  <div className="flex-between">
                    <label className="form-label">Warehouse Location *</label>
                    {txType === 'STOCK_OUT' && formProductId && formWarehouseId && (
                      <span className="text-xs text-muted">
                        Available: <strong className="text-primary">{getAvailableStockHelper(formWarehouseId, formProductId)}</strong>
                      </span>
                    )}
                  </div>
                  <select
                    className="form-select"
                    value={formWarehouseId}
                    onChange={(e) => setFormWarehouseId(e.target.value)}
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-row">
                  <div className="form-group">
                    <div className="flex-between">
                      <label className="form-label">Source Warehouse *</label>
                      {formProductId && formFromWarehouseId && (
                        <span className="text-xs text-muted">
                          Avail: <strong className="text-primary">{getAvailableStockHelper(formFromWarehouseId, formProductId)}</strong>
                        </span>
                      )}
                    </div>
                    <select
                      className="form-select"
                      value={formFromWarehouseId}
                      onChange={(e) => setFormFromWarehouseId(e.target.value)}
                      required
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Destination Warehouse *</label>
                    <select
                      className="form-select"
                      value={formToWarehouseId}
                      onChange={(e) => setFormToWarehouseId(e.target.value)}
                      required
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    {txType === 'STOCK_ADJUSTMENT' ? 'New Target Quantity *' : 'Quantity *'}
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    placeholder="e.g. 50"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Batch Number / Lot</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formBatchNumber}
                    onChange={(e) => setFormBatchNumber(e.target.value)}
                    placeholder="e.g. BATCH-2026-01"
                  />
                </div>
              </div>

              {/* Manufacturing & Expiry Dates for Stock In */}
              {txType === 'STOCK_IN' && formBatchNumber && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Mfg Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formMfgDate}
                      onChange={(e) => setFormMfgDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiry Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formExpiryDate}
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Movement Notes / Description</label>
                <textarea
                  className="form-textarea"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Reason for adjustment, PO reference or invoice ID"
                  style={{ minHeight: '60px' }}
                />
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Log Movement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Batch Directly */}
      {isBatchModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1001 }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">Register Batch / Lot</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsBatchModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select
                  className="form-select"
                  value={batchFormProductId}
                  onChange={(e) => setBatchFormProductId(e.target.value)}
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Batch / Lot Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={batchFormNumber}
                    onChange={(e) => setBatchFormNumber(e.target.value)}
                    placeholder="e.g. BATCH-2026-A"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Batch Qty</label>
                  <input
                    type="number"
                    className="form-input"
                    value={batchFormQty}
                    onChange={(e) => setBatchFormQty(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Warehouse Depot</label>
                <select
                  className="form-select"
                  value={batchFormWarehouseId}
                  onChange={(e) => setBatchFormWarehouseId(e.target.value)}
                >
                  <option value="">All / Unassigned</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Manufacturing Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={batchFormMfgDate}
                    onChange={(e) => setBatchFormMfgDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={batchFormExpiryDate}
                    onChange={(e) => setBatchFormExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsBatchModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Save Batch</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
