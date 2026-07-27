import { useState, useEffect } from 'react';
import { vendorApi, companyApi, purchaseApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Truck, Plus, Edit3, X, Save, Phone, Mail, MapPin, BookOpen, History, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Vendors() {
  const { user, isSuperAdmin } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [ledgerVendorId, setLedgerVendorId] = useState(null);
  const [ledgerData, setLedgerData] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Supplier History Drawer
  const [historyVendor, setHistoryVendor] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');

  const fetchCompanies = async () => {
    try {
      const res = await companyApi.getAll();
      setCompanies(res.data.data);
      if (res.data.data.length > 0) setSelectedCompanyId(res.data.data[0].id);
    } catch { /* ignore */ }
  };

  const fetchVendors = async (companyId) => {
    setLoading(true);
    try {
      const res = await vendorApi.getAll(companyId);
      setVendors(res.data.data);
    } catch {
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    } else {
      fetchVendors();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && selectedCompanyId) fetchVendors(selectedCompanyId);
  }, [selectedCompanyId, isSuperAdmin]);

  const openAddModal = () => {
    setEditingVendor(null);
    setName(''); setEmail(''); setPhone(''); setAddress(''); setOpeningBalance('');
    setIsModalOpen(true);
  };

  const openEditModal = (v) => {
    setEditingVendor(v);
    setName(v.name || ''); setEmail(v.email || ''); setPhone(v.phone || '');
    setAddress(v.address || ''); setOpeningBalance('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return toast.error('Vendor name is required');
    const payload = {
      name, email, phone, address,
      openingBalance: openingBalance || 0,
      companyId: isSuperAdmin ? selectedCompanyId : undefined
    };
    try {
      if (editingVendor) {
        await vendorApi.update(editingVendor.id, payload);
        toast.success('Vendor updated');
      } else {
        await vendorApi.create(payload);
        toast.success('Vendor created');
      }
      setIsModalOpen(false);
      fetchVendors(isSuperAdmin ? selectedCompanyId : undefined);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save vendor');
    }
  };

  const openLedger = async (vendorId) => {
    setLedgerVendorId(vendorId);
    setLedgerLoading(true);
    try {
      const res = await vendorApi.getLedger(vendorId);
      setLedgerData(res.data.data);
    } catch {
      toast.error('Failed to load ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const openHistory = async (vendor) => {
    setHistoryVendor(vendor);
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      const [historyRes, pricingRes] = await Promise.all([
        purchaseApi.getVendorHistory(vendor.id, isSuperAdmin ? selectedCompanyId : undefined),
        vendorApi.getPricingHistory(vendor.id),
      ]);
      setHistoryData({
        ...historyRes.data.data,
        priceHistory: pricingRes.data.data || [],
      });
    } catch {
      toast.error('Failed to load supplier history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="flex-between">
        <div>
          <h1 className="text-primary font-bold">Vendor Management</h1>
          <p className="text-secondary text-sm">Manage suppliers, payments, and purchase ledgers</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Add Vendor
        </button>
      </div>

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

      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading vendors...</div>
      ) : vendors.length === 0 ? (
        <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Truck size={48} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-secondary">No Vendors Yet</h3>
          <p className="text-muted text-sm">Register your first supplier</p>
          <button className="btn btn-primary" onClick={openAddModal}>Add Vendor</button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="font-semibold text-primary">{v.name}</div>
                    {v.email && <div className="text-xs text-muted">{v.email}</div>}
                  </td>
                  <td>{v.phone || '-'}</td>
                  <td className="text-sm">{v.address || '-'}</td>
                  <td>
                    <span style={{ color: v.balance > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                      {formatCurrency(v.balance)}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEditModal(v)} title="Edit"><Edit3 size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openLedger(v.id)} title="Ledger"><BookOpen size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openHistory(v)} title="Purchase & Pricing History" style={{ color: 'var(--primary)' }}><History size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ledger Modal */}
      {ledgerVendorId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">Vendor Ledger</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setLedgerVendorId(null)}><X size={16} /></button>
            </div>
            {ledgerLoading ? <p className="text-muted">Loading...</p> : ledgerData.length === 0 ? (
              <p className="text-muted text-sm">No ledger entries for this vendor.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance</th><th>Description</th><th>Ref</th></tr></thead>
                  <tbody>
                    {ledgerData.map((l) => (
                      <tr key={l.id}>
                        <td className="text-xs">{new Date(l.date).toLocaleDateString('en-IN')}</td>
                        <td><span className={l.type === 'DEBIT' ? 'text-success' : 'text-warning'} style={{ fontWeight: 600 }}>{l.type}</span></td>
                        <td>{formatCurrency(l.amount)}</td>
                        <td className="font-semibold">{formatCurrency(l.balance)}</td>
                        <td className="text-sm">{l.description || '-'}</td>
                        <td className="text-xs text-muted">{l.referenceNo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vendor Add/Edit Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Vendor Name *</label>
                <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplier name" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vendor@email.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input type="text" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="form-textarea" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
              </div>
              {!editingVendor && (
                <div className="form-group">
                  <label className="form-label">Opening Balance (₹)</label>
                  <input type="number" className="form-input" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0.00" step="0.01" />
                  <p className="form-hint">Positive = you owe the vendor</p>
                </div>
              )}
              <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Supplier Purchase & Pricing History Drawer ────────── */}
      {historyVendor && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '820px', maxHeight: '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="flex-between">
              <div>
                <h3 className="text-primary font-bold flex gap-2" style={{ alignItems: 'center' }}>
                  <TrendingUp size={18} /> {historyVendor.name} — Purchase & Pricing History
                </h3>
                <p className="text-secondary text-sm">Full transaction history, PO log, and item-level price tracking</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setHistoryVendor(null)}><X size={16} /></button>
            </div>

            {historyLoading ? (
              <p className="text-muted text-sm">Loading supplier history...</p>
            ) : !historyData ? (
              <p className="text-muted text-sm">No data available.</p>
            ) : (
              <>
                {/* Purchase Orders Summary */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
                    Purchase Orders ({historyData.purchaseOrders?.length || 0})
                  </h4>
                  {historyData.purchaseOrders?.length > 0 ? (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr><th>Order No</th><th>Date</th><th>Net Amount</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {historyData.purchaseOrders.map(po => (
                            <tr key={po.id}>
                              <td className="font-semibold text-primary">{po.orderNo}</td>
                              <td className="text-xs">{new Date(po.date).toLocaleDateString('en-IN')}</td>
                              <td className="text-primary font-bold">₹{po.netAmount?.toLocaleString('en-IN')}</td>
                              <td>
                                <span className={`alert-${po.status === 'RECEIVED' ? 'success' : po.status === 'APPROVED' ? 'info' : 'warning'}`} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                                  {po.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-muted text-sm">No purchase orders found.</p>}
                </div>

                {/* Purchase Invoices / Bills Summary */}
                {historyData.purchaseInvoices?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.85rem', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
                      Purchase Bills / Invoices ({historyData.purchaseInvoices.length})
                    </h4>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr><th>Bill No</th><th>Date</th><th>Net Amount</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {historyData.purchaseInvoices.map(bill => (
                            <tr key={bill.id}>
                              <td className="font-semibold text-primary">{bill.billNo}</td>
                              <td className="text-xs">{new Date(bill.date).toLocaleDateString('en-IN')}</td>
                              <td className="text-primary font-bold">₹{bill.netAmount?.toLocaleString('en-IN')}</td>
                              <td>
                                <span className={`alert-${bill.status === 'PAID' ? 'success' : bill.status === 'PARTIALLY_PAID' ? 'warning' : 'danger'}`} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                                  {bill.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Price History */}
                {historyData.priceHistory?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.85rem', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
                      Item Price History
                    </h4>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr><th>Product</th><th>Unit Price</th><th>GST %</th><th>Ref No</th><th>Date</th></tr>
                        </thead>
                        <tbody>
                          {historyData.priceHistory.map((ph, idx) => (
                            <tr key={idx}>
                              <td className="font-medium">{ph.productName || ph.product?.name || '—'}</td>
                              <td className="text-primary font-bold">₹{ph.unitPrice?.toLocaleString('en-IN')}</td>
                              <td className="font-semibold text-info">{ph.gstRate !== undefined ? `${ph.gstRate}%` : '0%'}</td>
                              <td className="text-xs font-semibold text-primary">{ph.referenceNo || ph.orderNo || '—'}</td>
                              <td className="text-xs">{ph.date ? new Date(ph.date).toLocaleDateString('en-IN') : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Ledger Movements */}
                {historyData.ledger?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.85rem', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
                      Ledger Movement
                    </h4>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance</th><th>Ref</th></tr>
                        </thead>
                        <tbody>
                          {historyData.ledger.map(l => (
                            <tr key={l.id}>
                              <td className="text-xs">{new Date(l.date).toLocaleDateString('en-IN')}</td>
                              <td><span className={l.type === 'DEBIT' ? 'text-success' : 'text-warning'} style={{ fontWeight: 600 }}>{l.type}</span></td>
                              <td>{formatCurrency(l.amount)}</td>
                              <td className="font-semibold">{formatCurrency(l.balance)}</td>
                              <td className="text-xs text-muted">{l.referenceNo || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setHistoryVendor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
