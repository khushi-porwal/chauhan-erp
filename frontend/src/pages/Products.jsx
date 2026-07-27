import { useState, useEffect } from 'react';
import { productApi, companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Package, Plus, Edit3, Trash2, X, Save, Tag, Layers, Ruler, Barcode,
  Search, Filter, ChevronDown, ChevronRight, GitBranch, AlertTriangle, Printer, Wand2, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Products() {
  const { user, isSuperAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [units, setUnits] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('products');

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  // Product modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Inline modals for categories/brands/units
  const [inlineModal, setInlineModal] = useState({ open: false, type: '', id: null, name: '', desc: '', parentId: '' });

  // Print Barcode Label modal
  const [printModal, setPrintModal] = useState({ open: false, product: null, count: 12, labelSize: '50x25' });

  // Variants modal
  const [variantModal, setVariantModal] = useState({ open: false, product: null });
  const [variants, setVariants] = useState([]);
  const [editingVariant, setEditingVariant] = useState(null);
  const [vName, setVName] = useState('');
  const [vSku, setVSku] = useState('');
  const [vPrice, setVPrice] = useState('');
  const [vStock, setVStock] = useState('');

  // Product form fields
  const [pName, setPName] = useState('');
  const [pSku, setPSku] = useState('');
  const [pBarcode, setPBarcode] = useState('');
  const [pDescription, setPDescription] = useState('');
  const [pCategoryId, setPCategoryId] = useState('');
  const [pBrandId, setPBrandId] = useState('');
  const [pUnitId, setPUnitId] = useState('');
  const [pHsnCode, setPHsnCode] = useState('');
  const [pGstRate, setPGstRate] = useState('0');
  const [pPurchasePrice, setPPurchasePrice] = useState('');
  const [pSalesPrice, setPSalesPrice] = useState('');
  const [pOpeningStock, setPOpeningStock] = useState('');
  const [pLowStockThreshold, setPLowStockThreshold] = useState('');

  const cid = () => isSuperAdmin ? selectedCompanyId : undefined;

  const fetchCompanies = async () => {
    try {
      const res = await companyApi.getAll();
      setCompanies(res.data.data);
      if (res.data.data.length > 0) setSelectedCompanyId(res.data.data[0].id);
    } catch { /* ignore */ }
  };

  const fetchAll = async (companyId) => {
    setLoading(true);
    try {
      const [pRes, cRes, bRes, uRes] = await Promise.all([
        productApi.getAll(companyId),
        productApi.getCategories(companyId),
        productApi.getBrands(companyId),
        productApi.getUnits(companyId),
      ]);
      setProducts(pRes.data.data);
      setCategories(cRes.data.data);
      setBrands(bRes.data.data);
      setUnits(uRes.data.data);
    } catch {
      toast.error('Failed to load product data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchCompanies();
    else fetchAll();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && selectedCompanyId) fetchAll(selectedCompanyId);
  }, [selectedCompanyId, isSuperAdmin]);

  // ── Product CRUD ──────────────────────────────────────────
  const openAdd = () => {
    setEditingProduct(null);
    setPName(''); setPSku(''); setPBarcode(''); setPDescription('');
    setPCategoryId(''); setPBrandId(''); setPUnitId('');
    setPHsnCode(''); setPGstRate('0'); setPPurchasePrice(''); setPSalesPrice('');
    setPOpeningStock(''); setPLowStockThreshold('');
    setIsModalOpen(true);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setPName(p.name || ''); setPSku(p.sku || ''); setPBarcode(p.barcode || '');
    setPDescription(p.description || ''); setPCategoryId(p.categoryId || '');
    setPBrandId(p.brandId || ''); setPUnitId(p.unitId || '');
    setPHsnCode(p.hsnCode || ''); setPGstRate(p.gstRate?.toString() || '0');
    setPPurchasePrice(p.purchasePrice?.toString() || '');
    setPSalesPrice(p.salesPrice?.toString() || '');
    setPLowStockThreshold(p.lowStockThreshold?.toString() || '');
    setIsModalOpen(true);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!pName) return toast.error('Product name is required');
    const payload = {
      name: pName, sku: pSku, barcode: pBarcode, description: pDescription,
      categoryId: pCategoryId || undefined, brandId: pBrandId || undefined,
      unitId: pUnitId || undefined, hsnCode: pHsnCode,
      gstRate: pGstRate, purchasePrice: pPurchasePrice, salesPrice: pSalesPrice,
      openingStock: pOpeningStock || 0,
      lowStockThreshold: pLowStockThreshold || 0,
      companyId: isSuperAdmin ? selectedCompanyId : undefined
    };
    try {
      if (editingProduct) {
        await productApi.update(editingProduct.id, payload);
        toast.success('Product updated');
      } else {
        await productApi.create(payload);
        toast.success('Product created');
      }
      setIsModalOpen(false);
      fetchAll(cid());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    }
  };

  const handleDeleteProduct = async (p) => {
    if (!window.confirm(`Delete product "${p.name}"? This cannot be undone.`)) return;
    try {
      await productApi.delete(p.id);
      toast.success('Product deleted');
      fetchAll(cid());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  // ── Auto Barcode Generator ───────────────────────────────
  const handleGenerateBarcode = async () => {
    try {
      const res = await productApi.generateBarcode(cid());
      if (res.data.data?.barcode) {
        setPBarcode(res.data.data.barcode);
        toast.success('Barcode generated');
      }
    } catch {
      toast.error('Failed to generate barcode');
    }
  };

  // ── Print Barcode Modal ──────────────────────────────────
  const openPrintBarcodeModal = (product) => {
    setPrintModal({ open: true, product, count: 12, labelSize: '50x25' });
  };

  // ── Inline modal for Category / Brand / Unit ──────────────
  const openInline = (type, item = null) => {
    setInlineModal({
      open: true,
      type,
      id: item?.id || null,
      name: item?.name || '',
      desc: item?.description || '',
      parentId: item?.parentId || ''
    });
  };

  const handleInlineSave = async () => {
    const { type, id, name, desc, parentId } = inlineModal;
    if (!name) return toast.error('Name is required');
    const payload = {
      name,
      description: desc || undefined,
      parentId: parentId || undefined,
      companyId: isSuperAdmin ? selectedCompanyId : undefined
    };
    try {
      if (type === 'category') {
        if (id) { await productApi.updateCategory(id, payload); toast.success('Category updated'); }
        else { await productApi.createCategory(payload); toast.success('Category created'); }
      } else if (type === 'brand') {
        if (id) { await productApi.updateBrand(id, payload); toast.success('Brand updated'); }
        else { await productApi.createBrand(payload); toast.success('Brand created'); }
      } else {
        if (id) { await productApi.updateUnit(id, payload); toast.success('Unit updated'); }
        else { await productApi.createUnit(payload); toast.success('Unit created'); }
      }
      setInlineModal({ open: false, type: '', id: null, name: '', desc: '', parentId: '' });
      fetchAll(cid());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const handleInlineDelete = async (type, id, name) => {
    if (!window.confirm(`Delete "${name}"? Products using it will lose this ${type}.`)) return;
    try {
      if (type === 'category') await productApi.deleteCategory(id);
      else if (type === 'brand') await productApi.deleteBrand(id);
      else await productApi.deleteUnit(id);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`);
      fetchAll(cid());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  // ── Product Variants ─────────────────────────────────────
  const openVariantModal = async (product) => {
    setVariantModal({ open: true, product });
    setEditingVariant(null);
    setVName(''); setVSku(''); setVPrice(''); setVStock('');
    try {
      const res = await productApi.getVariants(product.id);
      setVariants(res.data.data);
    } catch {
      setVariants([]);
    }
  };

  const openEditVariant = (v) => {
    setEditingVariant(v);
    setVName(v.name || ''); setVSku(v.sku || '');
    setVPrice(v.price?.toString() || ''); setVStock(v.stock?.toString() || '');
  };

  const resetVariantForm = () => {
    setEditingVariant(null);
    setVName(''); setVSku(''); setVPrice(''); setVStock('');
  };

  const handleVariantSubmit = async (e) => {
    e.preventDefault();
    if (!vName) return toast.error('Variant name is required');
    const productId = variantModal.product.id;
    const payload = { name: vName, sku: vSku || undefined, price: vPrice || 0, stock: vStock || 0 };
    try {
      if (editingVariant) {
        await productApi.updateVariant(productId, editingVariant.id, payload);
        toast.success('Variant updated');
      } else {
        await productApi.createVariant(productId, payload);
        toast.success('Variant created');
      }
      const res = await productApi.getVariants(productId);
      setVariants(res.data.data);
      resetVariantForm();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save variant');
    }
  };

  const handleDeleteVariant = async (v) => {
    if (!window.confirm(`Delete variant "${v.name}"?`)) return;
    try {
      await productApi.deleteVariant(variantModal.product.id, v.id);
      toast.success('Variant deleted');
      const res = await productApi.getVariants(variantModal.product.id);
      setVariants(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete variant');
    }
  };

  // ── Helpers ───────────────────────────────────────────────
  const formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const renderBarcodeSvg = (code) => {
    if (!code) return null;
    const codeStr = String(code);
    const bars = [];
    let x = 10;
    for (let i = 0; i < codeStr.length; i++) {
      const num = parseInt(codeStr[i]) || 3;
      const w1 = (num % 3) + 1;
      const w2 = (num % 2) + 1;
      bars.push(<rect key={`b1-${i}`} x={x} y={4} width={w1 * 2} height={32} fill="#000" />);
      x += w1 * 2 + w2 * 2;
      bars.push(<rect key={`b2-${i}`} x={x} y={4} width={w2} height={32} fill="#000" />);
      x += w2 * 2 + 2;
    }
    return (
      <svg width={x + 10} height={46} style={{ background: '#fff', padding: '2px 4px' }}>
        {bars}
        <text x={(x + 10) / 2} y={44} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#000">{codeStr}</text>
      </svg>
    );
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = !filterCategoryId || p.categoryId === filterCategoryId;
    return matchSearch && matchCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Header */}
      <div className="flex-between">
        <div>
          <h1 className="text-primary font-bold">Product Master</h1>
          <p className="text-secondary text-sm">Manage products, categories, brands, units, GST, and barcodes</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => openInline('category')}><Tag size={14} /> Category</button>
          <button className="btn btn-secondary" onClick={() => openInline('brand')}><Layers size={14} /> Brand</button>
          <button className="btn btn-secondary" onClick={() => openInline('unit')}><Ruler size={14} /> Unit</button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Product</button>
        </div>
      </div>

      {/* Super Admin Company Selector */}
      {isSuperAdmin && companies.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label className="form-label">Company Filter</label>
            <select className="form-select" value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)}>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn${activeTab === 'products' ? ' active' : ''}`} onClick={() => setActiveTab('products')}>
          <Package size={14} style={{ marginRight: 6 }} />Products ({filteredProducts.length})
        </button>
        <button className={`tab-btn${activeTab === 'categories' ? ' active' : ''}`} onClick={() => setActiveTab('categories')}>
          <Tag size={14} style={{ marginRight: 6 }} />Categories ({categories.length})
        </button>
        <button className={`tab-btn${activeTab === 'brands' ? ' active' : ''}`} onClick={() => setActiveTab('brands')}>
          <Layers size={14} style={{ marginRight: 6 }} />Brands ({brands.length})
        </button>
        <button className={`tab-btn${activeTab === 'units' ? ' active' : ''}`} onClick={() => setActiveTab('units')}>
          <Ruler size={14} style={{ marginRight: 6 }} />Units ({units.length})
        </button>
      </div>

      {/* ── Products Tab ───────────────────────────────────── */}
      {activeTab === 'products' && (
        <>
          {/* Search + Filter Bar */}
          <div className="card" style={{ padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Search Products</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text" className="form-input" style={{ paddingLeft: 32 }}
                  placeholder="Search by name, SKU, or barcode..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Filter by Category</label>
              <select className="form-select" value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="btn btn-secondary" style={{ height: 38 }} onClick={() => { setSearchQuery(''); setFilterCategoryId(''); }}>
              <Filter size={14} /> Reset
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Package size={48} style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-secondary">{searchQuery || filterCategoryId ? 'No products match your filter' : 'No Products Yet'}</h3>
              <p className="text-muted text-sm">Add your first product to the catalog</p>
              {!searchQuery && !filterCategoryId && (
                <button className="btn btn-primary" onClick={openAdd}>Add Product</button>
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU / Barcode</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th>Unit</th>
                    <th>GST %</th>
                    <th>Purchase ₹</th>
                    <th>Sale ₹</th>
                    <th>Stock</th>
                    <th>Variants</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="font-semibold text-primary">{p.name}</div>
                        {p.hsnCode && <div className="text-xs text-muted">HSN: {p.hsnCode}</div>}
                        {p.lowStockThreshold > 0 && (
                          <div className="text-xs" style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <AlertTriangle size={10} /> Alert at {p.lowStockThreshold}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="text-sm">{p.sku || '-'}</div>
                        {p.barcode && <div className="text-xs text-muted flex gap-1" style={{ alignItems: 'center' }}><Barcode size={10} />{p.barcode}</div>}
                      </td>
                      <td>
                        {p.category?.parent ? (
                          <div>
                            <span className="text-xs text-muted">{p.category.parent.name} &gt; </span>
                            <span className="font-medium">{p.category.name}</span>
                          </div>
                        ) : (
                          p.category?.name || '-'
                        )}
                      </td>
                      <td>{p.brand?.name || '-'}</td>
                      <td>{p.unit?.name || '-'}</td>
                      <td>{p.gstRate}%</td>
                      <td>{formatCurrency(p.purchasePrice)}</td>
                      <td className="font-semibold">{formatCurrency(p.salesPrice)}</td>
                      <td>
                        <span style={{ color: p.currentStock <= 0 ? 'var(--danger)' : p.currentStock < (p.lowStockThreshold || 10) ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                          {p.currentStock}
                        </span>
                      </td>
                      <td>
                        {p.variants?.length > 0 ? (
                          <span className="alert-info" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', cursor: 'pointer' }} onClick={() => openVariantModal(p)}>
                            {p.variants.length} variants
                          </span>
                        ) : (
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openVariantModal(p)}>
                            <GitBranch size={11} /> Add
                          </button>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openPrintBarcodeModal(p)} title="Print Barcode Label" style={{ color: 'var(--primary)' }}><Printer size={14} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(p)} title="Edit"><Edit3 size={14} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDeleteProduct(p)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Categories Tab ────────────────────────────────── */}
      {activeTab === 'categories' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => openInline('category')}><Plus size={14} /> Add Category</button>
          </div>
          <div className="grid-3">
            {categories.length === 0 ? (
              <div className="card flex-center" style={{ padding: 'var(--space-8)', flexDirection: 'column', gap: 'var(--space-2)', gridColumn: 'span 3' }}>
                <Tag size={36} style={{ color: 'var(--text-muted)' }} />
                <p className="text-muted">No categories yet.</p>
              </div>
            ) : categories.map((c) => (
              <div key={c.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 className="text-primary font-semibold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Tag size={14} /> {c.name}</h4>
                  {c.description && <p className="text-muted text-sm" style={{ marginTop: 4 }}>{c.description}</p>}
                  <p className="text-xs text-muted" style={{ marginTop: 6 }}>{c._count?.products || 0} product(s)</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openInline('category', c)} title="Edit"><Edit3 size={13} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleInlineDelete('category', c.id, c.name)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Brands Tab ───────────────────────────────────── */}
      {activeTab === 'brands' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => openInline('brand')}><Plus size={14} /> Add Brand</button>
          </div>
          <div className="grid-4">
            {brands.length === 0 ? (
              <div className="card flex-center" style={{ padding: 'var(--space-8)', flexDirection: 'column', gap: 'var(--space-2)', gridColumn: 'span 4' }}>
                <Layers size={36} style={{ color: 'var(--text-muted)' }} />
                <p className="text-muted">No brands yet.</p>
              </div>
            ) : brands.map((b) => (
              <div key={b.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={16} style={{ color: 'var(--primary)' }} />
                  <div>
                    <span className="font-semibold text-primary">{b.name}</span>
                    <div className="text-xs text-muted">{b._count?.products || 0} product(s)</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openInline('brand', b)}><Edit3 size={13} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleInlineDelete('brand', b.id, b.name)} style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Units Tab ────────────────────────────────────── */}
      {activeTab === 'units' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => openInline('unit')}><Plus size={14} /> Add Unit</button>
          </div>
          <div className="grid-4">
            {units.length === 0 ? (
              <div className="card flex-center" style={{ padding: 'var(--space-8)', flexDirection: 'column', gap: 'var(--space-2)', gridColumn: 'span 4' }}>
                <Ruler size={36} style={{ color: 'var(--text-muted)' }} />
                <p className="text-muted">No units yet.</p>
              </div>
            ) : units.map((u) => (
              <div key={u.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Ruler size={16} style={{ color: 'var(--success)' }} />
                  <div>
                    <span className="font-semibold text-primary">{u.name}</span>
                    <div className="text-xs text-muted">{u._count?.products || 0} product(s)</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openInline('unit', u)}><Edit3 size={13} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleInlineDelete('unit', u.id, u.name)} style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Product Add / Edit Modal ─────────────────────── */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input type="text" className="form-input" value={pName} onChange={(e) => setPName(e.target.value)} required placeholder="e.g. Samsung Galaxy A15" />
                </div>
                <div className="form-group">
                  <label className="form-label">SKU</label>
                  <input type="text" className="form-input" value={pSku} onChange={(e) => setPSku(e.target.value)} placeholder="SKU-001" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Barcode</label>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} onClick={handleGenerateBarcode}>
                      <Wand2 size={11} /> Auto Generate
                    </button>
                  </div>
                  <input type="text" className="form-input" value={pBarcode} onChange={(e) => setPBarcode(e.target.value)} placeholder="EAN-13 / UPC code" />
                </div>
                <div className="form-group">
                  <label className="form-label">HSN Code</label>
                  <input type="text" className="form-input" value={pHsnCode} onChange={(e) => setPHsnCode(e.target.value)} placeholder="e.g. 8517" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={pDescription} onChange={(e) => setPDescription(e.target.value)} placeholder="Product description" style={{ minHeight: 60 }} />
              </div>
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={pCategoryId} onChange={(e) => setPCategoryId(e.target.value)}>
                    <option value="">None</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Brand</label>
                  <select className="form-select" value={pBrandId} onChange={(e) => setPBrandId(e.target.value)}>
                    <option value="">None</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-select" value={pUnitId} onChange={(e) => setPUnitId(e.target.value)}>
                    <option value="">None</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="form-group">
                  <label className="form-label">GST Rate (%)</label>
                  <select className="form-select" value={pGstRate} onChange={(e) => setPGstRate(e.target.value)}>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Price (₹)</label>
                  <input type="number" className="form-input" value={pPurchasePrice} onChange={(e) => setPPurchasePrice(e.target.value)} min="0" step="0.01" placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Sales Price (₹)</label>
                  <input type="number" className="form-input" value={pSalesPrice} onChange={(e) => setPSalesPrice(e.target.value)} min="0" step="0.01" placeholder="0.00" />
                </div>
              </div>
              <div className="form-row">
                {!editingProduct && (
                  <div className="form-group">
                    <label className="form-label">Opening Stock</label>
                    <input type="number" className="form-input" value={pOpeningStock} onChange={(e) => setPOpeningStock(e.target.value)} min="0" step="1" placeholder="0" />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <AlertTriangle size={12} style={{ color: 'var(--warning)' }} /> Low Stock Alert Threshold
                  </label>
                  <input type="number" className="form-input" value={pLowStockThreshold} onChange={(e) => setPLowStockThreshold(e.target.value)} min="0" step="1" placeholder="e.g. 10" />
                </div>
              </div>
              <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Inline Category / Brand / Unit Modal ─────────── */}
      {inlineModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">
                {inlineModal.id ? 'Edit' : 'Add'} {inlineModal.type.charAt(0).toUpperCase() + inlineModal.type.slice(1)}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setInlineModal({ open: false, type: '', id: null, name: '', desc: '' })}><X size={16} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input type="text" className="form-input" value={inlineModal.name}
                onChange={(e) => setInlineModal(m => ({ ...m, name: e.target.value }))}
                placeholder={`${inlineModal.type} name`} autoFocus />
            </div>
            {inlineModal.type === 'category' && (
              <>
                <div className="form-group">
                  <label className="form-label">Parent Category (Optional)</label>
                  <select
                    className="form-select"
                    value={inlineModal.parentId || ''}
                    onChange={(e) => setInlineModal(m => ({ ...m, parentId: e.target.value }))}
                  >
                    <option value="">None (Top-Level Category)</option>
                    {categories.filter(c => c.id !== inlineModal.id && !c.parentId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" value={inlineModal.desc}
                    onChange={(e) => setInlineModal(m => ({ ...m, desc: e.target.value }))}
                    placeholder="Optional description" style={{ minHeight: 60 }} />
                </div>
              </>
            )}
            <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setInlineModal({ open: false, type: '', id: null, name: '', desc: '' })}>Cancel</button>
              <button className="btn btn-primary flex-center" onClick={handleInlineSave}><Save size={16} /> Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Product Variants Modal ───────────────────────── */}
      {variantModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="flex-between">
              <div>
                <h3 className="text-primary font-bold">Product Variants</h3>
                <p className="text-secondary text-sm">{variantModal.product?.name}</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setVariantModal({ open: false, product: null })}><X size={16} /></button>
            </div>

            {/* Add / Edit variant form */}
            <div className="card" style={{ background: 'var(--surface-2)', padding: 'var(--space-4)' }}>
              <h4 className="text-primary font-semibold" style={{ marginBottom: 'var(--space-3)' }}>
                {editingVariant ? 'Edit Variant' : 'Add New Variant'}
              </h4>
              <form onSubmit={handleVariantSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="form-row" style={{ gridTemplateColumns: '2fr 1fr' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Variant Name * <span className="text-xs text-muted">(e.g. Red, Large, 128GB)</span></label>
                    <input type="text" className="form-input" value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Variant name" required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Variant SKU</label>
                    <input type="text" className="form-input" value={vSku} onChange={(e) => setVSku(e.target.value)} placeholder="SKU-V1" />
                  </div>
                </div>
                <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Price (₹)</label>
                    <input type="number" className="form-input" value={vPrice} onChange={(e) => setVPrice(e.target.value)} min="0" step="0.01" placeholder="0.00" />
                  </div>
                  {!editingVariant && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Opening Stock</label>
                      <input type="number" className="form-input" value={vStock} onChange={(e) => setVStock(e.target.value)} min="0" step="1" placeholder="0" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                  {editingVariant && (
                    <button type="button" className="btn btn-secondary" onClick={resetVariantForm}>Cancel Edit</button>
                  )}
                  <button type="submit" className="btn btn-primary flex-center"><Save size={14} /> {editingVariant ? 'Update Variant' : 'Add Variant'}</button>
                </div>
              </form>
            </div>

            {/* Variants list */}
            {variants.length === 0 ? (
              <div className="flex-center" style={{ padding: 'var(--space-6)', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <GitBranch size={36} style={{ color: 'var(--text-muted)' }} />
                <p className="text-muted text-sm">No variants yet. Add the first one above.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>SKU</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map(v => (
                      <tr key={v.id}>
                        <td className="font-semibold text-primary">{v.name}</td>
                        <td className="text-sm text-secondary">{v.sku || '-'}</td>
                        <td>{formatCurrency(v.price)}</td>
                        <td>
                          <span style={{ color: v.stock <= 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{v.stock}</span>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEditVariant(v)} title="Edit"><Edit3 size={13} /></button>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDeleteVariant(v)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Print Barcode Labels Modal ──────────────────── */}
      {printModal.open && printModal.product && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #printable-barcode-sheet, #printable-barcode-sheet * { visibility: visible; }
              #printable-barcode-sheet {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: #fff !important;
                color: #000 !important;
              }
              .no-print { display: none !important; }
            }
          `}</style>
          <div className="card" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="flex-between no-print">
              <div>
                <h3 className="text-primary font-bold">Print Barcode Labels</h3>
                <p className="text-secondary text-sm">{printModal.product.name} ({printModal.product.barcode || 'No barcode code'})</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setPrintModal({ open: false, product: null, count: 12, labelSize: '50x25' })}><X size={16} /></button>
            </div>

            {/* Print Controls */}
            <div className="card no-print" style={{ background: 'var(--surface-2)', padding: 'var(--space-3)', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Number of Labels</label>
                <input type="number" className="form-input" min="1" max="100" value={printModal.count} onChange={(e) => setPrintModal(m => ({ ...m, count: Math.max(1, parseInt(e.target.value) || 1) }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Label Size Format</label>
                <select className="form-select" value={printModal.labelSize} onChange={(e) => setPrintModal(m => ({ ...m, labelSize: e.target.value }))}>
                  <option value="50x25">50mm x 25mm (Standard Label)</option>
                  <option value="38x25">38mm x 25mm (Compact Label)</option>
                  <option value="single">Single Wide Label</option>
                </select>
              </div>
              <button className="btn btn-primary flex-center" style={{ height: 38 }} onClick={() => window.print()}>
                <Printer size={16} /> Print Labels
              </button>
            </div>

            {/* Printable Labels Sheet Container */}
            <div id="printable-barcode-sheet" style={{ background: '#ffffff', padding: '16px', borderRadius: 'var(--radius-md)', color: '#000' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: printModal.labelSize === 'single' ? '1fr' : 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '12px',
                justifyItems: 'center'
              }}>
                {Array.from({ length: printModal.count }).map((_, idx) => (
                  <div key={idx} style={{
                    border: '1px dashed #ccc',
                    borderRadius: '4px',
                    padding: '8px',
                    textAlign: 'center',
                    width: '100%',
                    maxWidth: '180px',
                    background: '#fff',
                    color: '#000',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                      {printModal.product.name}
                    </div>
                    <div style={{ fontSize: '9px', color: '#444' }}>
                      SKU: {printModal.product.sku || 'N/A'} {printModal.product.gstRate > 0 && `| GST: ${printModal.product.gstRate}%`}
                    </div>

                    {/* Barcode Graphic SVG */}
                    <div style={{ margin: '4px 0' }}>
                      {renderBarcodeSvg(printModal.product.barcode || printModal.product.sku || '8901234567890')}
                    </div>

                    <div style={{ fontWeight: 800, fontSize: '12px', color: '#000' }}>
                      MRP: ₹{Number(printModal.product.salesPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
