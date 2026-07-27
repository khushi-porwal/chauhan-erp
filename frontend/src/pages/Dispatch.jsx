import { useState, useEffect, useRef } from 'react';
import { dispatchApi, productApi, warehouseApi, customerApi, companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Truck, Plus, X, Save, Eye, Package, MapPin,
  CheckCircle, AlertCircle, Clock, RefreshCw, Search,
  Hash, Navigation, FileText, Barcode
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_META = {
  DISPATCHED:  { label: 'Dispatched',  cls: 'alert-info',    icon: '🚚' },
  IN_TRANSIT:  { label: 'In Transit',  cls: 'alert-warning', icon: '📦' },
  DELIVERED:   { label: 'Delivered',   cls: 'alert-success', icon: '✅' },
  CANCELLED:   { label: 'Cancelled',   cls: 'alert-danger',  icon: '❌' },
  RETURNED:    { label: 'Returned',    cls: 'alert-warning', icon: '↩️' },
};

export default function Dispatch() {
  const { user, isSuperAdmin } = useAuth();
  const [dispatches, setDispatches] = useState([]);
  const [products, setProducts]     = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [companies, setCompanies]   = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading]       = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState(null);

  // Create Form
  const [fWarehouseId, setFWarehouseId] = useState('');
  const [fCustomerId, setFCustomerId]   = useState('');
  const [fCourier, setFCourier]         = useState('');
  const [fVehicle, setFVehicle]         = useState('');
  const [fLrNumber, setFLrNumber]       = useState('');
  const [fTrackingNo, setFTrackingNo]   = useState('');
  const [fDispatchDate, setFDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [fExpectedDate, setFExpectedDate] = useState('');
  const [fNotes, setFNotes]             = useState('');
  const [fItems, setFItems]             = useState([{ productId: '', quantity: 1, description: '' }]);

  // Barcode scanner ref
  const barcodeInputRef = useRef(null);
  const [barcodeScan, setBarcodeScan]   = useState('');

  const fetchMasterData = async (companyId) => {
    try {
      const [prodRes, whRes, custRes] = await Promise.all([
        productApi.getAll(companyId),
        warehouseApi.getAll(companyId),
        customerApi.getAll(companyId),
      ]);
      setProducts(prodRes.data.data || []);
      setWarehouses((whRes.data.data || []).filter(w => w.status === 'ACTIVE'));
      setCustomers(custRes.data.data || []);
    } catch { /* ignore */ }
  };

  const fetchDispatches = async (companyId) => {
    setLoading(true);
    try {
      const params = {};
      if (companyId) params.companyId = companyId;
      if (filterStatus) params.status = filterStatus;
      const res = await dispatchApi.getAll(params);
      setDispatches(res.data.data || []);
    } catch {
      toast.error('Failed to load dispatch notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      companyApi.getAll().then(res => {
        setCompanies(res.data.data);
        if (res.data.data.length > 0) setSelectedCompanyId(res.data.data[0].id);
      }).catch(() => {});
    } else {
      fetchDispatches();
      fetchMasterData();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && selectedCompanyId) {
      fetchDispatches(selectedCompanyId);
      fetchMasterData(selectedCompanyId);
    }
  }, [selectedCompanyId, isSuperAdmin]);

  useEffect(() => {
    const compId = isSuperAdmin ? selectedCompanyId : undefined;
    fetchDispatches(compId);
  }, [filterStatus]);

  // ── Barcode scan helper ─────────────────────────────────────
  const handleBarcodeScan = (code) => {
    if (!code.trim()) return;
    const match = products.find(p =>
      (p.barcode && p.barcode.toLowerCase() === code.trim().toLowerCase()) ||
      (p.sku && p.sku.toLowerCase() === code.trim().toLowerCase())
    );
    if (match) {
      setFItems(prev => {
        const idx = prev.findIndex(i => i.productId === match.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx].quantity += 1;
          return updated;
        }
        if (prev.length === 1 && !prev[0].productId) {
          return [{ productId: match.id, quantity: 1, description: '' }];
        }
        return [...prev, { productId: match.id, quantity: 1, description: '' }];
      });
      toast.success(`✓ Added ${match.name} via barcode`);
      setBarcodeScan('');
    } else {
      toast.error(`No product matched barcode: ${code}`);
    }
  };

  // ── Create Dispatch Submit ──────────────────────────────────
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!fWarehouseId) return toast.error('Select a warehouse');
    const validItems = fItems.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) return toast.error('Add at least one item');

    try {
      await dispatchApi.create({
        warehouseId: fWarehouseId,
        customerId: fCustomerId || undefined,
        courierName: fCourier || undefined,
        vehicleNo: fVehicle || undefined,
        lrNumber: fLrNumber || undefined,
        trackingNo: fTrackingNo || undefined,
        dispatchDate: fDispatchDate,
        expectedDeliveryDate: fExpectedDate || undefined,
        notes: fNotes || undefined,
        items: validItems,
        companyId: isSuperAdmin ? selectedCompanyId : undefined,
      });
      toast.success('Dispatch note created — stock reduced automatically');
      setIsCreateOpen(false);
      resetForm();
      fetchDispatches(isSuperAdmin ? selectedCompanyId : undefined);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create dispatch');
    }
  };

  const resetForm = () => {
    setFWarehouseId(warehouses[0]?.id || '');
    setFCustomerId('');
    setFCourier('');
    setFVehicle('');
    setFLrNumber('');
    setFTrackingNo('');
    setFDispatchDate(new Date().toISOString().split('T')[0]);
    setFExpectedDate('');
    setFNotes('');
    setFItems([{ productId: '', quantity: 1, description: '' }]);
    setBarcodeScan('');
  };

  const addItem = () => setFItems(prev => [...prev, { productId: '', quantity: 1, description: '' }]);
  const removeItem = (idx) => setFItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, value) => {
    setFItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  // ── Update Status ───────────────────────────────────────────
  const handleStatusUpdate = async (id, status) => {
    try {
      await dispatchApi.updateStatus(id, { status });
      toast.success(`Dispatch marked as ${STATUS_META[status]?.label || status}`);
      fetchDispatches(isSuperAdmin ? selectedCompanyId : undefined);
      if (selectedDispatch?.id === id) {
        setSelectedDispatch(prev => ({ ...prev, status }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  };

  // ── Filter ──────────────────────────────────────────────────
  const filteredDispatches = dispatches.filter(d => {
    const q = searchQuery.toLowerCase();
    return (
      d.dispatchNo?.toLowerCase().includes(q) ||
      d.customer?.name?.toLowerCase().includes(q) ||
      d.courierName?.toLowerCase().includes(q) ||
      d.trackingNo?.toLowerCase().includes(q) ||
      d.vehicleNo?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="text-primary font-bold">Dispatch & Delivery</h1>
          <p className="text-secondary text-sm">
            Create dispatch notes, track consignments & manage outbound deliveries with automatic stock reduction
          </p>
        </div>
        <button className="btn btn-primary flex-center" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
          <Plus size={16} /> New Dispatch Note
        </button>
      </div>

      {/* SuperAdmin Company Selector */}
      {isSuperAdmin && companies.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label className="form-label">Company Filter</label>
            <select className="form-select" value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)}>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid-3">
        {[
          { label: 'Total Dispatches', value: dispatches.length, icon: <Truck size={22} />, color: '#6366f1' },
          { label: 'In Transit', value: dispatches.filter(d => d.status === 'IN_TRANSIT').length, icon: <Navigation size={22} />, color: '#f59e0b' },
          { label: 'Delivered', value: dispatches.filter(d => d.status === 'DELIVERED').length, icon: <CheckCircle size={22} />, color: '#10b981' },
        ].map((card, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ background: `${card.color}22`, padding: '12px', borderRadius: 'var(--radius-lg)', color: card.color }}>
              {card.icon}
            </div>
            <div>
              <span className="text-muted text-xs block">{card.label}</span>
              <h2 className="text-primary font-bold">{card.value}</h2>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="flex-center gap-2" style={{ background: 'var(--bg-elevated)', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flex: 1, minWidth: '200px' }}>
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search dispatch no, customer, courier, tracking..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', color: 'var(--text-primary)', fontSize: '0.875rem' }}
          />
        </div>
        <select className="form-select" style={{ maxWidth: '200px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.keys(STATUS_META).map(s => (
            <option key={s} value={s}>{STATUS_META[s].icon} {STATUS_META[s].label}</option>
          ))}
        </select>
      </div>

      {/* Dispatch Table */}
      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 'var(--space-2)' }}>Loading dispatch notes...</p>
        </div>
      ) : filteredDispatches.length === 0 ? (
        <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Truck size={48} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-secondary">No Dispatch Notes Found</h3>
          <p className="text-muted text-sm">Create your first dispatch note to start tracking shipments</p>
          <button className="btn btn-primary" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus size={16} /> Create Dispatch
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Dispatch No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Warehouse</th>
                <th>Courier / Vehicle</th>
                <th>Tracking No</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDispatches.map(d => {
                const meta = STATUS_META[d.status] || {};
                return (
                  <tr key={d.id}>
                    <td className="font-semibold text-primary">{d.dispatchNo}</td>
                    <td className="text-xs">{new Date(d.dispatchDate).toLocaleDateString('en-IN')}</td>
                    <td className="font-medium">{d.customer?.name || <span className="text-muted">—</span>}</td>
                    <td className="text-xs text-secondary">{d.warehouse?.name} ({d.warehouse?.code})</td>
                    <td className="text-xs">
                      {d.courierName && <span className="font-medium">{d.courierName}</span>}
                      {d.vehicleNo && <span className="text-muted"> | {d.vehicleNo}</span>}
                      {!d.courierName && !d.vehicleNo && <span className="text-muted">—</span>}
                    </td>
                    <td className="text-xs text-secondary">{d.trackingNo || '—'}</td>
                    <td>
                      <span className={meta.cls} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap' }}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-secondary btn-icon btn-sm"
                          title="View Details"
                          onClick={() => { setSelectedDispatch(d); setIsDetailOpen(true); }}
                        >
                          <Eye size={14} />
                        </button>
                        {d.status === 'DISPATCHED' && (
                          <button className="btn btn-secondary btn-sm text-warning flex-center" style={{ fontSize: '11px' }} onClick={() => handleStatusUpdate(d.id, 'IN_TRANSIT')}>
                            🚚 Transit
                          </button>
                        )}
                        {(d.status === 'DISPATCHED' || d.status === 'IN_TRANSIT') && (
                          <button className="btn btn-secondary btn-sm text-success flex-center" style={{ fontSize: '11px' }} onClick={() => handleStatusUpdate(d.id, 'DELIVERED')}>
                            ✅ Deliver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL: CREATE DISPATCH ───────────────────────────── */}
      {isCreateOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'var(--space-4)', overflowY: 'auto' }}>
          <div className="card" style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1001, marginTop: '24px', marginBottom: '24px' }}>
            <div className="flex-between">
              <div>
                <h3 className="text-primary font-bold">Create Dispatch Note</h3>
                <p className="text-secondary text-sm">Stock will be reduced automatically on dispatch</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsCreateOpen(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Row 1: Warehouse + Customer */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Dispatch Warehouse *</label>
                  <select className="form-select" value={fWarehouseId} onChange={e => setFWarehouseId(e.target.value)} required>
                    <option value="">Select warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Customer (optional)</label>
                  <select className="form-select" value={fCustomerId} onChange={e => setFCustomerId(e.target.value)}>
                    <option value="">No customer linked</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: Courier + Vehicle */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Courier / Transport Name</label>
                  <input className="form-input" type="text" placeholder="e.g. Blue Dart, DTDC" value={fCourier} onChange={e => setFCourier(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Vehicle No</label>
                  <input className="form-input" type="text" placeholder="e.g. GJ01AB1234" value={fVehicle} onChange={e => setFVehicle(e.target.value)} />
                </div>
              </div>

              {/* Row 3: LR + Tracking + Dates */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">LR Number (Lorry Receipt)</label>
                  <input className="form-input" type="text" placeholder="LR-XXXX" value={fLrNumber} onChange={e => setFLrNumber(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tracking Number</label>
                  <input className="form-input" type="text" placeholder="Courier tracking ID" value={fTrackingNo} onChange={e => setFTrackingNo(e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Dispatch Date</label>
                  <input className="form-input" type="date" value={fDispatchDate} onChange={e => setFDispatchDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Delivery Date</label>
                  <input className="form-input" type="date" value={fExpectedDate} onChange={e => setFExpectedDate(e.target.value)} />
                </div>
              </div>

              {/* Barcode Scanner Input */}
              <div className="form-group">
                <label className="form-label flex gap-2" style={{ alignItems: 'center' }}>
                  <Barcode size={16} /> Barcode Scanner (scan or type barcode, press Enter)
                </label>
                <div className="flex gap-2">
                  <input
                    ref={barcodeInputRef}
                    className="form-input"
                    type="text"
                    placeholder="Scan product barcode / SKU to auto-add..."
                    value={barcodeScan}
                    onChange={e => setBarcodeScan(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleBarcodeScan(barcodeScan); } }}
                  />
                  <button type="button" className="btn btn-secondary flex-center" onClick={() => handleBarcodeScan(barcodeScan)}>Add</button>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex-between" style={{ marginBottom: 'var(--space-2)' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Dispatch Items *</h4>
                  <button type="button" className="btn btn-secondary btn-sm flex-center" onClick={addItem}>
                    <Plus size={13} /> Add Row
                  </button>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th style={{ width: '110px' }}>Quantity</th>
                        <th>Description</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fItems.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <select
                              className="form-select"
                              value={item.productId}
                              onChange={e => updateItem(idx, 'productId', e.target.value)}
                            >
                              <option value="">Select product</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.sku ? `[${p.sku}]` : ''} — Stock: {p.currentStock}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input"
                              min="0.01"
                              step="0.01"
                              value={item.quantity}
                              onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Optional note"
                              value={item.description}
                              onChange={e => updateItem(idx, 'description', e.target.value)}
                            />
                          </td>
                          <td>
                            {fItems.length > 1 && (
                              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => removeItem(idx)}>
                                <X size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Notes / Remarks</label>
                <textarea className="form-textarea" placeholder="Delivery instructions, remarks..." value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2} />
              </div>

              <div className="alert-warning flex gap-2" style={{ alignItems: 'center', fontSize: '11px', borderRadius: '8px' }}>
                <AlertCircle size={16} /> Warehouse stock will be automatically reduced upon dispatch. This action cannot be undone.
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Create & Dispatch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW DISPATCH DETAIL ──────────────────────── */}
      {isDetailOpen && selectedDispatch && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '750px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1001, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between">
              <div>
                <h3 className="text-primary font-bold">Dispatch Note — {selectedDispatch.dispatchNo}</h3>
                <span className={`${STATUS_META[selectedDispatch.status]?.cls}`} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                  {STATUS_META[selectedDispatch.status]?.icon} {STATUS_META[selectedDispatch.status]?.label}
                </span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsDetailOpen(false)}><X size={16} /></button>
            </div>

            {/* Meta Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', background: 'var(--bg-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
              {[
                ['Customer', selectedDispatch.customer?.name || '—'],
                ['Warehouse', `${selectedDispatch.warehouse?.name} (${selectedDispatch.warehouse?.code})`],
                ['Dispatch Date', new Date(selectedDispatch.dispatchDate).toLocaleDateString('en-IN')],
                ['Courier', selectedDispatch.courierName || '—'],
                ['Vehicle No', selectedDispatch.vehicleNo || '—'],
                ['LR Number', selectedDispatch.lrNumber || '—'],
                ['Tracking No', selectedDispatch.trackingNo || '—'],
                ['Expected Delivery', selectedDispatch.expectedDeliveryDate ? new Date(selectedDispatch.expectedDeliveryDate).toLocaleDateString('en-IN') : '—'],
                ['Delivered At', selectedDispatch.deliveredAt ? new Date(selectedDispatch.deliveredAt).toLocaleDateString('en-IN') : '—'],
              ].map(([key, val]) => (
                <div key={key}>
                  <span className="text-muted block">{key}:</span>
                  <strong className="text-primary">{val}</strong>
                </div>
              ))}
            </div>

            {/* Items */}
            {selectedDispatch.items && selectedDispatch.items.length > 0 && (
              <div>
                <h4 style={{ marginBottom: 'var(--space-2)', fontSize: '0.85rem' }}>Dispatched Items</h4>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Product</th><th>SKU / Barcode</th><th>Quantity</th><th>Description</th></tr></thead>
                    <tbody>
                      {selectedDispatch.items.map(item => (
                        <tr key={item.id}>
                          <td className="font-semibold text-primary">{item.product?.name}</td>
                          <td className="text-xs text-muted">{item.product?.sku || '—'}</td>
                          <td className="font-bold">{item.quantity}</td>
                          <td className="text-sm text-secondary">{item.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedDispatch.notes && (
              <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
                <span className="text-muted block">Notes:</span>
                <p className="text-secondary">{selectedDispatch.notes}</p>
              </div>
            )}

            {/* Status Actions */}
            <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
              {selectedDispatch.status === 'DISPATCHED' && (
                <button className="btn btn-secondary flex-center text-warning" onClick={() => handleStatusUpdate(selectedDispatch.id, 'IN_TRANSIT')}>
                  🚚 Mark In Transit
                </button>
              )}
              {(selectedDispatch.status === 'DISPATCHED' || selectedDispatch.status === 'IN_TRANSIT') && (
                <button className="btn btn-secondary flex-center text-success" onClick={() => handleStatusUpdate(selectedDispatch.id, 'DELIVERED')}>
                  ✅ Mark Delivered
                </button>
              )}
              {(selectedDispatch.status === 'DISPATCHED') && (
                <button className="btn btn-secondary flex-center text-danger" onClick={() => handleStatusUpdate(selectedDispatch.id, 'CANCELLED')}>
                  ❌ Cancel
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setIsDetailOpen(false)} style={{ marginLeft: 'auto' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
