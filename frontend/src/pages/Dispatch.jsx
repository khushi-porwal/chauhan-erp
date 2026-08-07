import { useState, useEffect, useCallback, useRef } from 'react';
import { dispatchApi, productApi, warehouseApi, customerApi, companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Truck, Plus, X, Save, Eye, Package, MapPin,
  CheckCircle, AlertCircle, Clock, RefreshCw, Search,
  Hash, Navigation, FileText, Barcode, ArrowRight,
  Calendar, User, PhoneCall, Info, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Status Config ──────────────────────────────────────────────
const STATUS_CFG = {
  DISPATCHED:  { label: 'Dispatched',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: '🚛', nextStatuses: ['IN_TRANSIT', 'DELIVERED', 'CANCELLED'] },
  IN_TRANSIT:  { label: 'In Transit',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '📦', nextStatuses: ['DELIVERED', 'RETURNED'] },
  DELIVERED:   { label: 'Delivered',   color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: '✅', nextStatuses: [] },
  CANCELLED:   { label: 'Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '❌', nextStatuses: [] },
  RETURNED:    { label: 'Returned',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '↩️', nextStatuses: [] },
};

function DispatchBadge({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: '❓' };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}33`,
      padding: '3px 10px', borderRadius: 999, fontSize: '0.7rem',
      fontWeight: 700, letterSpacing: '0.03em', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
    }}>
      <span>{cfg.icon}</span> {cfg.label}
    </span>
  );
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function Dispatch() {
  const { user, isSuperAdmin } = useAuth();
  const [dispatches, setDispatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState(null);

  // Create Form
  const [fWarehouseId, setFWarehouseId] = useState('');
  const [fCustomerId, setFCustomerId] = useState('');
  const [fCourier, setFCourier] = useState('');
  const [fVehicle, setFVehicle] = useState('');
  const [fLrNumber, setFLrNumber] = useState('');
  const [fTrackingNo, setFTrackingNo] = useState('');
  const [fDispatchDate, setFDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [fExpectedDate, setFExpectedDate] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [fItems, setFItems] = useState([{ productId: '', quantity: 1, description: '' }]);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const barcodeRef = useRef(null);
  const [barcodeScan, setBarcodeScan] = useState('');

  // ── Fetch helpers
  const fetchMasterData = useCallback(async (companyId) => {
    try {
      const [prodRes, whRes, custRes] = await Promise.all([
        productApi.getAll(companyId),
        warehouseApi.getAll(companyId),
        customerApi.getAll(companyId),
      ]);
      const pData = prodRes.data?.data;
      setProducts(Array.isArray(pData) ? pData : (pData?.products || []));
      const wh = (whRes.data.data || []).filter(w => w.status === 'ACTIVE');
      setWarehouses(wh);
      if (wh.length) setFWarehouseId(wh[0].id);
      setCustomers(custRes.data.data || []);
    } catch { /* ignore */ }
  }, []);

  const fetchDispatches = useCallback(async (companyId) => {
    setLoading(true);
    try {
      const params = {};
      if (companyId) params.companyId = companyId;
      if (filterStatus) params.status = filterStatus;
      const res = await dispatchApi.getAll(params);
      setDispatches(res.data.data || []);
    } catch {
      toast.error('Failed to load dispatches');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (isSuperAdmin) {
      companyApi.getAll().then(res => {
        const list = res.data.data || [];
        setCompanies(list);
        if (list.length) setSelectedCompanyId(list[0].id);
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

  // ── Barcode scan
  const handleBarcodeScan = useCallback(() => {
    if (!barcodeScan.trim()) return;
    const match = products.find(p =>
      (p.barcode && p.barcode === barcodeScan.trim()) ||
      (p.sku && p.sku === barcodeScan.trim())
    );
    if (match) {
      setFItems(prev => {
        const idx = prev.findIndex(i => i.productId === match.id);
        if (idx >= 0) {
          const u = [...prev]; u[idx].quantity += 1; return u;
        }
        if (prev.length === 1 && !prev[0].productId) return [{ productId: match.id, quantity: 1, description: '' }];
        return [...prev, { productId: match.id, quantity: 1, description: '' }];
      });
      toast.success(`✓ Added ${match.name} — Stock: ${match.currentStock}`);
    } else {
      toast.error(`No product found for: ${barcodeScan}`);
    }
    setBarcodeScan('');
  }, [barcodeScan, products]);

  // ── Submit dispatch
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!fWarehouseId) return toast.error('Select a warehouse');
    const validItems = fItems.filter(i => i.productId && i.quantity > 0);
    if (!validItems.length) return toast.error('Add at least one item');

    // Check stock
    for (const item of validItems) {
      const prod = products.find(p => p.id === item.productId);
      if (prod && item.quantity > prod.currentStock) {
        return toast.error(`Insufficient stock for ${prod.name}. Available: ${prod.currentStock}`);
      }
    }

    setFormSubmitting(true);
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
      toast.success('🚛 Dispatch note created — stock reduced automatically!');
      setIsCreateOpen(false);
      resetForm();
      fetchDispatches(isSuperAdmin ? selectedCompanyId : undefined);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create dispatch');
    } finally {
      setFormSubmitting(false);
    }
  };

  const resetForm = () => {
    setFWarehouseId(warehouses[0]?.id || '');
    setFCustomerId(''); setFCourier(''); setFVehicle('');
    setFLrNumber(''); setFTrackingNo('');
    setFDispatchDate(new Date().toISOString().split('T')[0]);
    setFExpectedDate(''); setFNotes('');
    setFItems([{ productId: '', quantity: 1, description: '' }]);
    setBarcodeScan('');
  };

  const addItem = () => setFItems(prev => [...prev, { productId: '', quantity: 1, description: '' }]);
  const removeItem = (idx) => setFItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, value) => setFItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  // ── Status update
  const handleStatusUpdate = async (id, status) => {
    try {
      await dispatchApi.updateStatus(id, { status });
      toast.success(`Dispatch marked as ${STATUS_CFG[status]?.label || status}`);
      const compId = isSuperAdmin ? selectedCompanyId : undefined;
      fetchDispatches(compId);
      if (selectedDispatch?.id === id) setSelectedDispatch(prev => ({ ...prev, status }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  };

  // ── Filter + search
  const filteredDispatches = dispatches.filter(d => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      d.dispatchNo?.toLowerCase().includes(q) ||
      d.customer?.name?.toLowerCase().includes(q) ||
      d.courierName?.toLowerCase().includes(q) ||
      d.trackingNo?.toLowerCase().includes(q) ||
      d.vehicleNo?.toLowerCase().includes(q)
    );
  });

  // ── KPI counts
  const total = dispatches.length;
  const inTransit = dispatches.filter(d => d.status === 'IN_TRANSIT').length;
  const delivered = dispatches.filter(d => d.status === 'DELIVERED').length;
  const pending = dispatches.filter(d => d.status === 'DISPATCHED').length;

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(79,110,247,0.15)', borderRadius: 12, padding: 12 }}>
            <Truck size={24} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Dispatch & Delivery</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Create dispatch notes · Track consignments · Stock auto-reduced on dispatch</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchDispatches(isSuperAdmin ? selectedCompanyId : undefined)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setIsCreateOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> New Dispatch Note
          </button>
        </div>
      </div>

      {/* ── SuperAdmin Company Filter ────────────────────────────── */}
      {isSuperAdmin && companies.length > 0 && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Company Filter:</span>
          <select value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)} className="form-input" style={{ maxWidth: 280, fontSize: '0.85rem' }}>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Dispatches', val: total, color: 'var(--primary)', icon: Truck, sub: 'All time' },
          { label: 'Dispatched', val: pending, color: '#3b82f6', icon: Package, sub: 'Awaiting transit' },
          { label: 'In Transit', val: inTransit, color: '#f59e0b', icon: Navigation, sub: 'On the road' },
          { label: 'Delivered', val: delivered, color: '#10b981', icon: CheckCircle, sub: 'Successfully completed' },
        ].map(({ label, val, color, icon: Icon, sub }) => (
          <div key={label} className="card" style={{ padding: 18, cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: `${color}1A`, borderRadius: 10, padding: 10 }}>
                <Icon size={20} style={{ color }} />
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>{label}</div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color, lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Search dispatch no, customer, courier, tracking..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="form-input" style={{ paddingLeft: 36, fontSize: '0.85rem' }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="form-input" style={{ width: 160, fontSize: '0.83rem' }}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        {(searchQuery || filterStatus) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearchQuery(''); setFilterStatus(''); }}>
            <X size={13} /> Clear
          </button>
        )}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{filteredDispatches.length} records</span>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-secondary)', gap: 10 }}>
            <RefreshCw size={18} className="animate-spin" /> Loading dispatches...
          </div>
        ) : filteredDispatches.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, color: 'var(--text-muted)', gap: 12 }}>
            <Truck size={48} style={{ opacity: 0.25 }} />
            <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>No dispatch notes found</p>
            <p style={{ fontSize: '0.8rem' }}>Create your first dispatch note to start tracking</p>
            <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
              <Plus size={13} /> Create Dispatch
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                  {['Dispatch No', 'Date', 'Customer', 'Warehouse', 'Courier / Vehicle', 'Tracking No', 'Items', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDispatches.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary)', fontSize: '0.82rem' }}>{d.dispatchNo}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{fmtDate(d.dispatchDate)}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, fontSize: '0.85rem' }}>
                      {d.customer?.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {d.warehouse?.name}<br/>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{d.warehouse?.code}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '0.8rem' }}>
                      {d.courierName && <div style={{ fontWeight: 600 }}>{d.courierName}</div>}
                      {d.vehicleNo && <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>🚗 {d.vehicleNo}</div>}
                      {!d.courierName && !d.vehicleNo && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {d.trackingNo || '—'}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {d.items?.length || 0} items
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <DispatchBadge status={d.status} />
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-icon btn-sm" title="View Details"
                          onClick={async () => {
                            try {
                              const res = await dispatchApi.getById(d.id);
                              setSelectedDispatch(res.data.data);
                            } catch {
                              setSelectedDispatch(d);
                            }
                            setIsDetailOpen(true);
                          }}>
                          <Eye size={13} />
                        </button>
                        {d.status === 'DISPATCHED' && (
                          <button onClick={() => handleStatusUpdate(d.id, 'IN_TRANSIT')}
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '4px 9px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}>
                            🚚 Transit
                          </button>
                        )}
                        {(d.status === 'DISPATCHED' || d.status === 'IN_TRANSIT') && (
                          <button onClick={() => handleStatusUpdate(d.id, 'DELIVERED')}
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '4px 9px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}>
                            ✅ Deliver
                          </button>
                        )}
                        {d.status === 'DISPATCHED' && (
                          <button onClick={() => handleStatusUpdate(d.id, 'CANCELLED')}
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '4px 9px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}>
                            ❌
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CREATE DISPATCH MODAL ─────────────────────────────── */}
      {isCreateOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', padding: '24px 16px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 880, boxShadow: 'var(--shadow-lg)', marginBottom: 24 }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(79,110,247,0.1), rgba(124,58,237,0.04))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(79,110,247,0.15)', borderRadius: 8, padding: 8 }}>
                  <Truck size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>Create Dispatch Note</h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Stock will be auto-reduced on confirmation</p>
                </div>
              </div>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ padding: '20px 24px' }}>
              {/* Row 1: Warehouse + Customer */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="form-label">Dispatch Warehouse *</label>
                  <select value={fWarehouseId} onChange={e => setFWarehouseId(e.target.value)} className="form-input" required>
                    <option value="">— Select Warehouse —</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Customer (Optional)</label>
                  <select value={fCustomerId} onChange={e => setFCustomerId(e.target.value)} className="form-input">
                    <option value="">— No Customer Linked —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` | ${c.phone}` : ''}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: Courier + Vehicle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="form-label">Courier / Transport</label>
                  <input type="text" value={fCourier} onChange={e => setFCourier(e.target.value)} className="form-input" placeholder="e.g. Blue Dart, DTDC, Own Vehicle" />
                </div>
                <div>
                  <label className="form-label">Vehicle No.</label>
                  <input type="text" value={fVehicle} onChange={e => setFVehicle(e.target.value)} className="form-input" placeholder="e.g. GJ01AB1234" />
                </div>
              </div>

              {/* Row 3: LR + Tracking */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="form-label">LR No. (Lorry Receipt)</label>
                  <input type="text" value={fLrNumber} onChange={e => setFLrNumber(e.target.value)} className="form-input" placeholder="LR-XXXX" />
                </div>
                <div>
                  <label className="form-label">Tracking No.</label>
                  <input type="text" value={fTrackingNo} onChange={e => setFTrackingNo(e.target.value)} className="form-input" placeholder="Courier tracking ID" />
                </div>
              </div>

              {/* Row 4: Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label className="form-label">Dispatch Date</label>
                  <input type="date" value={fDispatchDate} onChange={e => setFDispatchDate(e.target.value)} className="form-input" required />
                </div>
                <div>
                  <label className="form-label">Expected Delivery Date</label>
                  <input type="date" value={fExpectedDate} onChange={e => setFExpectedDate(e.target.value)} className="form-input" />
                </div>
              </div>

              {/* Barcode quick add */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Barcode size={14} /> Barcode Scanner (press Enter to add)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Hash size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input ref={barcodeRef} type="text" placeholder="Scan barcode / SKU..."
                      value={barcodeScan} onChange={e => setBarcodeScan(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleBarcodeScan())}
                      className="form-input" style={{ paddingLeft: 32, fontSize: '0.82rem' }} />
                  </div>
                  <button type="button" onClick={handleBarcodeScan} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Zap size={13} /> Scan
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Dispatch Items *</h4>
                  <button type="button" onClick={addItem} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Plus size={12} /> Add Row
                  </button>
                </div>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)' }}>
                        {['Product', 'Qty', 'Note (Optional)', ''].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fItems.map((item, idx) => {
                        const selectedProd = products.find(p => p.id === item.productId);
                        return (
                          <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px' }}>
                              <select value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)} className="form-input" style={{ fontSize: '0.82rem', minWidth: 200 }}>
                                <option value="">— Select Product —</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}{p.sku ? ` [${p.sku}]` : ''} — Stock: {p.currentStock}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input type="number" min="0.01" step="0.01" value={item.quantity}
                                onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                className="form-input" style={{ width: 80, fontSize: '0.82rem' }} />
                              {selectedProd && item.quantity > selectedProd.currentStock && (
                                <div style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: 2 }}>⚠ Low stock!</div>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input type="text" value={item.description}
                                onChange={e => updateItem(idx, 'description', e.target.value)}
                                placeholder="Optional..." className="form-input" style={{ fontSize: '0.82rem', minWidth: 150 }} />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {fItems.length > 1 && (
                                <button type="button" onClick={() => removeItem(idx)}
                                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}>
                                  <X size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 18 }}>
                <label className="form-label">Delivery Notes / Remarks</label>
                <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} className="form-input" placeholder="Delivery instructions, packing notes..." rows={2} style={{ resize: 'vertical' }} />
              </div>

              {/* Alert */}
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: '0.82rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={15} />
                <span>Warehouse stock will be <strong>permanently reduced</strong> upon dispatch. This action cannot be undone.</span>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={formSubmitting} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: formSubmitting ? 0.7 : 1 }}>
                  {formSubmitting ? <RefreshCw size={13} className="animate-spin" /> : <Save size={14} />}
                  {formSubmitting ? 'Dispatching...' : 'Dispatch & Reduce Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ──────────────────────────────────────── */}
      {isDetailOpen && selectedDispatch && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '95vw', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(79,110,247,0.08), transparent)', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', fontFamily: 'monospace', color: 'var(--primary)' }}>{selectedDispatch.dispatchNo}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <DispatchBadge status={selectedDispatch.status} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(selectedDispatch.dispatchDate)}</span>
                </div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Meta Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { icon: User, label: 'Customer', val: selectedDispatch.customer?.name || '—' },
                  { icon: Package, label: 'Warehouse', val: `${selectedDispatch.warehouse?.name || '—'} (${selectedDispatch.warehouse?.code || ''})` },
                  { icon: Truck, label: 'Courier', val: selectedDispatch.courierName || '—' },
                  { icon: Navigation, label: 'Vehicle No.', val: selectedDispatch.vehicleNo || '—' },
                  { icon: Hash, label: 'LR No.', val: selectedDispatch.lrNumber || '—' },
                  { icon: FileText, label: 'Tracking No.', val: selectedDispatch.trackingNo || '—' },
                  { icon: Calendar, label: 'Expected Delivery', val: fmtDate(selectedDispatch.expectedDeliveryDate) },
                  { icon: CheckCircle, label: 'Delivered At', val: fmtDate(selectedDispatch.deliveredAt) },
                ].map(({ icon: Icon, label, val }) => (
                  <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Icon size={12} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{label}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Items */}
              {selectedDispatch.items?.length > 0 && (
                <>
                  <h4 style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Dispatched Items</h4>
                  <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 18 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-elevated)' }}>
                          {['Product', 'SKU', 'Qty', 'Note'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDispatch.items.map((item, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '9px 12px', fontWeight: 700, fontSize: '0.85rem' }}>{item.product?.name || '—'}</td>
                            <td style={{ padding: '9px 12px', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.product?.sku || '—'}</td>
                            <td style={{ padding: '9px 12px', fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)' }}>{item.quantity}</td>
                            <td style={{ padding: '9px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.description || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {selectedDispatch.notes && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <strong>Notes: </strong>{selectedDispatch.notes}
                </div>
              )}

              {/* Status Action Buttons */}
              {STATUS_CFG[selectedDispatch.status]?.nextStatuses?.length > 0 && (
                <>
                  <h4 style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Update Status</h4>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                    {STATUS_CFG[selectedDispatch.status]?.nextStatuses.map(nextStatus => {
                      const cfg = STATUS_CFG[nextStatus];
                      return (
                        <button key={nextStatus} onClick={() => handleStatusUpdate(selectedDispatch.id, nextStatus)}
                          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44`, borderRadius: 8, padding: '8px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cfg.icon} Mark as {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setIsDetailOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
