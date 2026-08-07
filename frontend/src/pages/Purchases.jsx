import React, { useState, useEffect, useCallback } from 'react';
import {
  purchaseApi,
  vendorApi,
  productApi,
  warehouseApi,
} from '../api/index.js';

// ─── Status Badge ──────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    PENDING: 'badge-warning',
    APPROVED: 'badge-success',
    REJECTED: 'badge-danger',
    PARTIALLY_RECEIVED: 'badge-info',
    RECEIVED: 'badge-success',
    CANCELLED: 'badge-neutral',
    PAID: 'badge-success',
    PARTIALLY_PAID: 'badge-warning',
    UNPAID: 'badge-danger',
    DRAFT: 'badge-neutral',
    SUBMITTED: 'badge-info',
    CONVERTED_TO_PO: 'badge-purple',
  };
  return <span className={`status-badge ${map[status] || 'badge-neutral'}`}>{(status || '').replace(/_/g, ' ')}</span>;
};

// ─── Rupee format ──────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Toast ─────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };
  return { toasts, success: (m) => add(m, 'success'), error: (m) => add(m, 'error'), info: (m) => add(m, 'info') };
}

// ─── Main Component ────────────────────────────────────────────
export default function Purchases() {
  const { toasts, success, error } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const companyId = user.companyId;

  const [activeTab, setActiveTab] = useState('orders');
  const [loading, setLoading] = useState(false);

  // Data
  const [orders, setOrders] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [returns, setReturns] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Modals
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateReq, setShowCreateReq] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showReqConvertModal, setShowReqConvertModal] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showCreateReturn, setShowCreateReturn] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedReq, setSelectedReq] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [historyData, setHistoryData] = useState(null);

  // ── Fetch helpers ──
  const fetchOrders = useCallback(async () => {
    try {
      const r = await purchaseApi.getOrders(companyId);
      setOrders(r.data?.data || []);
    } catch { /* silent */ }
  }, [companyId]);

  const fetchRequisitions = useCallback(async () => {
    try {
      const r = await purchaseApi.getRequisitions(companyId);
      setRequisitions(r.data?.data || []);
    } catch { /* silent */ }
  }, [companyId]);

  const fetchInvoices = useCallback(async () => {
    try {
      const r = await purchaseApi.getInvoices(companyId);
      setInvoices(r.data?.data || []);
    } catch { /* silent */ }
  }, [companyId]);

  const fetchReturns = useCallback(async () => {
    try {
      const r = await purchaseApi.getReturns(companyId);
      setReturns(r.data?.data || []);
    } catch { /* silent */ }
  }, [companyId]);

  const fetchMasterData = useCallback(async () => {
    try {
      const [v, p, w] = await Promise.all([
        vendorApi.getAll(companyId),
        productApi.getAll(companyId),
        warehouseApi.getAll(companyId),
      ]);
      setVendors(v.data?.data || []);
      setProducts(p.data?.data || []);
      setWarehouses(w.data?.data || []);
    } catch { /* silent */ }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchOrders(), fetchRequisitions(), fetchInvoices(), fetchReturns(), fetchMasterData()])
      .finally(() => setLoading(false));
  }, [fetchOrders, fetchRequisitions, fetchInvoices, fetchReturns, fetchMasterData]);

  // ── KPI Metrics ──
  const pendingOrders = orders.filter(o => o.status === 'PENDING').length;
  const pendingReqs = requisitions.filter(r => r.status === 'SUBMITTED').length;
  const unpaidBills = invoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID')
    .reduce((s, i) => s + (i.balanceAmount || 0), 0);
  const totalReturns = returns.reduce((s, r) => s + (r.netAmount || 0), 0);

  // ── Print PO PDF ──
  const handlePrintPO = async (orderId) => {
    try {
      const r = await purchaseApi.getOrderPdf(orderId);
      const url = URL.createObjectURL(new Blob([r.data], { type: 'text/html' }));
      window.open(url, '_blank');
    } catch { error('Failed to generate PO PDF'); }
  };

  // ── Approve / Reject PO ──
  const handleApproveOrder = async (order, action) => {
    try {
      await purchaseApi.approveOrder(order.id, { action });
      success(`Purchase Order ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`);
      fetchOrders();
    } catch (e) {
      error(e.response?.data?.message || 'Action failed');
    }
  };

  // ── View Vendor Ledger ──
  const handleViewLedger = async (vendorId) => {
    try {
      const r = await purchaseApi.getVendorLedger(vendorId, companyId);
      setLedgerData(r.data?.data);
      setShowLedgerModal(true);
    } catch { error('Failed to load ledger'); }
  };

  // ── Vendor History ──
  const handleViewHistory = async (vendorId) => {
    try {
      const r = await purchaseApi.getVendorHistory(vendorId, companyId);
      setHistoryData(r.data?.data);
      setShowHistoryModal(true);
    } catch { error('Failed to load vendor history'); }
  };

  const TABS = [
    { key: 'requisitions', label: 'Requisitions', count: pendingReqs },
    { key: 'orders', label: 'Purchase Orders', count: pendingOrders },
    { key: 'invoices', label: 'Bills / Invoices', count: null },
    { key: 'returns', label: 'Returns', count: null },
  ];

  return (
    <div className="purchases-page">
      {/* Toast */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Management</h1>
          <p className="page-subtitle">Manage requisitions, orders, invoices, and supplier relationships</p>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-purple">
          <div className="kpi-icon">📋</div>
          <div>
            <div className="kpi-value">{pendingReqs}</div>
            <div className="kpi-label">Pending Requisitions</div>
          </div>
        </div>
        <div className="kpi-card kpi-blue">
          <div className="kpi-icon">🛒</div>
          <div>
            <div className="kpi-value">{pendingOrders}</div>
            <div className="kpi-label">Pending Orders</div>
          </div>
        </div>
        <div className="kpi-card kpi-red">
          <div className="kpi-icon">💳</div>
          <div>
            <div className="kpi-value">{fmt(unpaidBills)}</div>
            <div className="kpi-label">Outstanding Bills</div>
          </div>
        </div>
        <div className="kpi-card kpi-orange">
          <div className="kpi-icon">↩️</div>
          <div>
            <div className="kpi-value">{fmt(totalReturns)}</div>
            <div className="kpi-label">Total Returns</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.count > 0 && <span className="tab-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {loading && <div className="loading-bar"><div className="loading-fill"></div></div>}

      {/* ── REQUISITIONS TAB ── */}
      {activeTab === 'requisitions' && (
        <div className="tab-content">
          <div className="section-header">
            <h2>Purchase Requisitions</h2>
            <button className="btn btn-primary" onClick={() => setShowCreateReq(true)}>+ New Requisition</button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Req No</th>
                  <th>Department</th>
                  <th>Requested By</th>
                  <th>Items</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.length === 0 && (
                  <tr><td colSpan={7} className="empty-row">No requisitions found</td></tr>
                )}
                {requisitions.map(req => (
                  <tr key={req.id}>
                    <td><span className="mono">{req.requisitionNo}</span></td>
                    <td>{req.department || '—'}</td>
                    <td>{req.requestedBy?.name || '—'}</td>
                    <td><span className="badge-count">{req.items?.length || 0} items</span></td>
                    <td>{new Date(req.createdAt).toLocaleDateString('en-IN')}</td>
                    <td><StatusBadge status={req.status} /></td>
                    <td className="action-cell">
                      {req.status === 'SUBMITTED' && (
                        <>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={async () => {
                              await purchaseApi.updateRequisitionStatus(req.id, { status: 'APPROVED' });
                              success('Requisition approved'); fetchRequisitions();
                            }}
                          >Approve</button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={async () => {
                              await purchaseApi.updateRequisitionStatus(req.id, { status: 'REJECTED' });
                              success('Requisition rejected'); fetchRequisitions();
                            }}
                          >Reject</button>
                        </>
                      )}
                      {req.status === 'APPROVED' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => { setSelectedReq(req); setShowReqConvertModal(true); }}
                        >→ Convert to PO</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ORDERS TAB ── */}
      {activeTab === 'orders' && (
        <div className="tab-content">
          <div className="section-header">
            <h2>Purchase Orders</h2>
            <button className="btn btn-primary" onClick={() => setShowCreateOrder(true)}>+ New PO</button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO No</th>
                  <th>Vendor</th>
                  <th>Date</th>
                  <th>Net Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={6} className="empty-row">No purchase orders found</td></tr>
                )}
                {orders.map(order => (
                  <tr key={order.id}>
                    <td><span className="mono">{order.orderNo}</span></td>
                    <td>
                      <div>{order.vendor?.name}</div>
                      <div className="sub-text">{order.items?.length || 0} line items</div>
                    </td>
                    <td>{new Date(order.date).toLocaleDateString('en-IN')}</td>
                    <td className="amount-cell">{fmt(order.netAmount)}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="action-cell">
                      <button className="btn btn-sm btn-outline" onClick={() => handlePrintPO(order.id)}>🖨 PDF</button>
                      {order.status === 'PENDING' && (
                        <>
                          <button className="btn btn-sm btn-success" onClick={() => handleApproveOrder(order, 'APPROVE')}>✓ Approve</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleApproveOrder(order, 'REJECT')}>✗ Reject</button>
                        </>
                      )}
                      {(order.status === 'APPROVED' || order.status === 'PARTIALLY_RECEIVED') && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => { setSelectedOrder(order); setShowReceiveModal(true); }}
                        >📦 Receive</button>
                      )}
                      {order.status === 'APPROVED' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => { setSelectedOrder(order); setShowConvertModal(true); }}
                        >→ Invoice</button>
                      )}
                      {order.vendorId && (
                        <button className="btn btn-sm btn-ghost" onClick={() => handleViewLedger(order.vendorId)}>📒 Ledger</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── INVOICES TAB ── */}
      {activeTab === 'invoices' && (
        <div className="tab-content">
          <div className="section-header">
            <h2>Purchase Bills / Invoices</h2>
            <button className="btn btn-primary" onClick={() => setShowCreateInvoice(true)}>+ Direct Bill</button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Vendor</th>
                  <th>Date</th>
                  <th>Net Amount</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr><td colSpan={8} className="empty-row">No invoices found</td></tr>
                )}
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><span className="mono">{inv.billNo}</span></td>
                    <td>{inv.vendor?.name}</td>
                    <td>{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                    <td className="amount-cell">{fmt(inv.netAmount)}</td>
                    <td className="amount-cell text-success">{fmt(inv.paidAmount)}</td>
                    <td className="amount-cell text-danger">{fmt(inv.balanceAmount)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td className="action-cell">
                      {inv.status !== 'PAID' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => { setSelectedInvoice(inv); setShowPayModal(true); }}
                        >💰 Pay</button>
                      )}
                      {inv.vendorId && (
                        <button className="btn btn-sm btn-ghost" onClick={() => handleViewLedger(inv.vendorId)}>📒 Ledger</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RETURNS TAB ── */}
      {activeTab === 'returns' && (
        <div className="tab-content">
          <div className="section-header">
            <h2>Purchase Returns</h2>
            <button className="btn btn-primary" onClick={() => setShowCreateReturn(true)}>+ New Return</button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return No</th>
                  <th>Vendor</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Net Amount</th>
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 && (
                  <tr><td colSpan={5} className="empty-row">No returns found</td></tr>
                )}
                {returns.map(ret => (
                  <tr key={ret.id}>
                    <td><span className="mono">{ret.returnNo}</span></td>
                    <td>{ret.vendor?.name}</td>
                    <td>{new Date(ret.date).toLocaleDateString('en-IN')}</td>
                    <td><span className="badge-count">{ret.items?.length || 0} items</span></td>
                    <td className="amount-cell">{fmt(ret.netAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
           MODALS
      ══════════════════════════════════════════════════════════════ */}

      {/* ── Create Requisition Modal ── */}
      {showCreateReq && (
        <RequisitionModal
          products={products}
          onClose={() => setShowCreateReq(false)}
          onSuccess={() => { success('Requisition created'); fetchRequisitions(); setShowCreateReq(false); }}
          onError={error}
        />
      )}

      {/* ── Convert Requisition to PO Modal ── */}
      {showReqConvertModal && selectedReq && (
        <ReqConvertModal
          requisition={selectedReq}
          vendors={vendors}
          onClose={() => { setShowReqConvertModal(false); setSelectedReq(null); }}
          onSuccess={() => { success('Converted to PO'); fetchOrders(); fetchRequisitions(); setShowReqConvertModal(false); setSelectedReq(null); }}
          onError={error}
        />
      )}

      {/* ── Create PO Modal ── */}
      {showCreateOrder && (
        <CreateOrderModal
          vendors={vendors}
          products={products}
          onClose={() => setShowCreateOrder(false)}
          onSuccess={() => { success('Purchase Order created'); fetchOrders(); setShowCreateOrder(false); }}
          onError={error}
        />
      )}

      {/* ── Receive Items Modal ── */}
      {showReceiveModal && selectedOrder && (
        <ReceiveModal
          order={selectedOrder}
          warehouses={warehouses}
          onClose={() => { setShowReceiveModal(false); setSelectedOrder(null); }}
          onSuccess={() => { success('Items received & inventory updated'); fetchOrders(); setShowReceiveModal(false); setSelectedOrder(null); }}
          onError={error}
        />
      )}

      {/* ── Convert PO to Invoice Modal ── */}
      {showConvertModal && selectedOrder && (
        <ConvertToInvoiceModal
          order={selectedOrder}
          warehouses={warehouses}
          onClose={() => { setShowConvertModal(false); setSelectedOrder(null); }}
          onSuccess={() => { success('Converted to Invoice'); fetchOrders(); fetchInvoices(); setShowConvertModal(false); setSelectedOrder(null); }}
          onError={error}
        />
      )}

      {/* ── Create Direct Invoice Modal ── */}
      {showCreateInvoice && (
        <CreateInvoiceModal
          vendors={vendors}
          products={products}
          warehouses={warehouses}
          onClose={() => setShowCreateInvoice(false)}
          onSuccess={() => { success('Invoice created'); fetchInvoices(); setShowCreateInvoice(false); }}
          onError={error}
        />
      )}

      {/* ── Pay Invoice Modal ── */}
      {showPayModal && selectedInvoice && (
        <PayModal
          invoice={selectedInvoice}
          onClose={() => { setShowPayModal(false); setSelectedInvoice(null); }}
          onSuccess={() => { success('Payment recorded'); fetchInvoices(); setShowPayModal(false); setSelectedInvoice(null); }}
          onError={error}
        />
      )}

      {/* ── Create Return Modal ── */}
      {showCreateReturn && (
        <CreateReturnModal
          vendors={vendors}
          products={products}
          warehouses={warehouses}
          invoices={invoices}
          onClose={() => setShowCreateReturn(false)}
          onSuccess={() => { success('Purchase Return logged'); fetchReturns(); setShowCreateReturn(false); }}
          onError={error}
        />
      )}

      {/* ── Vendor Ledger Modal ── */}
      {showLedgerModal && ledgerData && (
        <LedgerModal
          data={ledgerData}
          onClose={() => { setShowLedgerModal(false); setLedgerData(null); }}
        />
      )}

      {/* Styles */}
      <style>{purchaseStyles}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────

// ── Requisition Modal ──────────────────────────────────────────
function RequisitionModal({ products, onClose, onSuccess, onError }) {
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1, estimatedPrice: '' }]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems(p => [...p, { productId: '', quantity: 1, estimatedPrice: '' }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const setItem = (i, field, val) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.some(it => !it.productId)) return onError('All items must have a product selected');
    setSaving(true);
    try {
      await purchaseApi.createRequisition({ department, notes, items });
      onSuccess();
    } catch (err) {
      onError(err.response?.data?.message || 'Failed to create requisition');
    } finally { setSaving(false); }
  };

  return (
    <Modal title="New Purchase Requisition" onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Department</label>
            <input className="form-input" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g., Production, Accounts" />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <div className="items-section">
          <div className="items-header">
            <h4>Items</h4>
            <button type="button" className="btn btn-sm btn-outline" onClick={addItem}>+ Add Item</button>
          </div>
          {items.map((item, i) => (
            <div key={i} className="item-row">
              <select className="form-input" value={item.productId} onChange={e => setItem(i, 'productId', e.target.value)} required>
                <option value="">Select Product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>)}
              </select>
              <input className="form-input w80" type="number" min="0.01" step="any" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} placeholder="Qty" required />
              <input className="form-input w100" type="number" min="0" step="any" value={item.estimatedPrice} onChange={e => setItem(i, 'estimatedPrice', e.target.value)} placeholder="Est. Price ₹" />
              {items.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(i)}>✕</button>}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit Requisition'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Req → PO Convert Modal ────────────────────────────────────
function ReqConvertModal({ requisition, vendors, onClose, onSuccess, onError }) {
  const [vendorId, setVendorId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendorId) return onError('Please select a vendor');
    setSaving(true);
    try {
      await purchaseApi.convertRequisitionToPO(requisition.id, { vendorId, discount, notes, expectedDeliveryDate });
      onSuccess();
    } catch (err) {
      onError(err.response?.data?.message || 'Conversion failed');
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Convert ${requisition.requisitionNo} → Purchase Order`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="req-items-preview">
          {requisition.items?.map((item, i) => (
            <div key={i} className="preview-item">
              <span>{item.product?.name}</span>
              <span>Qty: {item.quantity}</span>
              <span>Est: ₹{item.estimatedPrice || 0}</span>
            </div>
          ))}
        </div>
        <div className="form-group mt-16">
          <label>Vendor *</label>
          <select className="form-input" value={vendorId} onChange={e => setVendorId(e.target.value)} required>
            <option value="">Select Vendor</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Discount (₹)</label>
            <input className="form-input" type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Expected Delivery</label>
            <input className="form-input" type="date" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Notes</label>
          <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Converting…' : 'Convert to PO'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Create PO Modal ────────────────────────────────────────────
function CreateOrderModal({ vendors, products, onClose, onSuccess, onError }) {
  const [vendorId, setVendorId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitPrice: '', gstRate: 0, discount: 0 }]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems(p => [...p, { productId: '', quantity: 1, unitPrice: '', gstRate: 0, discount: 0 }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const setItem = (i, field, val) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const handleProductChange = (i, productId) => {
    const prod = products.find(p => p.id === productId);
    setItems(prev => prev.map((it, idx) => idx === i
      ? { ...it, productId, unitPrice: prod?.purchasePrice || '', gstRate: prod?.gstRate || 0 }
      : it));
  };

  const calcTotal = () => {
    let total = 0, gst = 0;
    items.forEach(it => {
      const q = parseFloat(it.quantity || 0);
      const p = parseFloat(it.unitPrice || 0);
      const g = parseFloat(it.gstRate || 0);
      const d = parseFloat(it.discount || 0);
      const sub = q * p - d;
      const tax = sub * g / 100;
      total += sub; gst += tax;
    });
    return { total, gst, net: total + gst - parseFloat(discount || 0) };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendorId) return onError('Please select a vendor');
    if (items.some(it => !it.productId || !it.unitPrice)) return onError('Complete all item fields');
    setSaving(true);
    try {
      await purchaseApi.createOrder({ vendorId, discount, notes, expectedDeliveryDate, items });
      onSuccess();
    } catch (err) {
      onError(err.response?.data?.message || 'Failed to create PO');
    } finally { setSaving(false); }
  };

  const totals = calcTotal();

  return (
    <Modal title="Create Purchase Order" onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Vendor *</label>
            <select className="form-input" value={vendorId} onChange={e => setVendorId(e.target.value)} required>
              <option value="">Select Vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Expected Delivery Date</label>
            <input className="form-input" type="date" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} />
          </div>
        </div>

        <div className="items-section">
          <div className="items-header">
            <h4>Order Items</h4>
            <button type="button" className="btn btn-sm btn-outline" onClick={addItem}>+ Add Item</button>
          </div>
          {items.map((item, i) => (
            <div key={i} className="item-row-multi">
              <select className="form-input" value={item.productId} onChange={e => handleProductChange(i, e.target.value)} required>
                <option value="">Product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="form-input w70" type="number" min="0.01" step="any" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} placeholder="Qty" required />
              <input className="form-input w90" type="number" min="0" step="any" value={item.unitPrice} onChange={e => setItem(i, 'unitPrice', e.target.value)} placeholder="Price ₹" required />
              <input className="form-input w70" type="number" min="0" max="100" value={item.gstRate} onChange={e => setItem(i, 'gstRate', e.target.value)} placeholder="GST%" />
              <input className="form-input w80" type="number" min="0" value={item.discount} onChange={e => setItem(i, 'discount', e.target.value)} placeholder="Disc ₹" />
              {items.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(i)}>✕</button>}
            </div>
          ))}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Notes</label>
            <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div className="form-group">
            <label>Header Discount (₹)</label>
            <input className="form-input" type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} />
          </div>
        </div>

        <div className="totals-preview">
          <div><span>Sub Total</span><span>{`₹${totals.total.toFixed(2)}`}</span></div>
          <div><span>GST</span><span>{`₹${totals.gst.toFixed(2)}`}</span></div>
          <div className="total-row"><span>Net Amount</span><strong>{`₹${totals.net.toFixed(2)}`}</strong></div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Purchase Order'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Receive Items Modal (Partial / Full GRN) ──────────────────
function ReceiveModal({ order, warehouses, onClose, onSuccess, onError }) {
  const [warehouseId, setWarehouseId] = useState('');
  const [receiving, setReceiving] = useState(
    order.items?.map(item => ({
      itemId: item.id,
      productId: item.productId,
      productName: item.product?.name,
      orderedQty: item.quantity,
      receivedQty: item.receivedQuantity || 0,
      remaining: item.quantity - (item.receivedQuantity || 0),
      quantity: item.quantity - (item.receivedQuantity || 0),
      batchNumber: '',
      expiryDate: '',
    })) || []
  );
  const [saving, setSaving] = useState(false);

  const setQty = (i, val) => setReceiving(p => p.map((r, idx) => idx === i ? { ...r, quantity: val } : r));
  const setBatch = (i, val) => setReceiving(p => p.map((r, idx) => idx === i ? { ...r, batchNumber: val } : r));
  const setExpiry = (i, val) => setReceiving(p => p.map((r, idx) => idx === i ? { ...r, expiryDate: val } : r));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseId) return onError('Please select a warehouse');
    const items = receiving
      .filter(r => parseFloat(r.quantity) > 0 && r.remaining > 0)
      .map(r => ({
        itemId: r.itemId,
        productId: r.productId,
        quantity: parseFloat(r.quantity),
        batchNumber: r.batchNumber || undefined,
        expiryDate: r.expiryDate || undefined,
      }));
    if (items.length === 0) return onError('No items to receive');
    setSaving(true);
    try {
      await purchaseApi.partialReceiveOrder(order.id, { warehouseId, items });
      onSuccess();
    } catch (err) {
      onError(err.response?.data?.message || 'Failed to receive items');
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Receive Items — ${order.orderNo}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Warehouse *</label>
          <select className="form-input" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
            <option value="">Select Warehouse</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
          </select>
        </div>

        <div className="receive-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-right">Ordered</th>
                <th className="text-right">Already Received</th>
                <th className="text-right">Remaining</th>
                <th className="text-right">Receive Now</th>
                <th>Batch No</th>
                <th>Expiry Date</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {receiving.map((r, i) => (
                <tr key={i} className={r.remaining <= 0 ? 'row-done' : ''}>
                  <td>{r.productName}</td>
                  <td className="text-right">{r.orderedQty}</td>
                  <td className="text-right text-success">{r.receivedQty}</td>
                  <td className="text-right text-warning">{r.remaining}</td>
                  <td>
                    <input
                      className="form-input w70 text-right"
                      type="number"
                      min="0"
                      max={r.remaining}
                      step="any"
                      value={r.quantity}
                      onChange={e => setQty(i, e.target.value)}
                      disabled={r.remaining <= 0}
                    />
                  </td>
                  <td>
                    <input className="form-input w100" value={r.batchNumber} onChange={e => setBatch(i, e.target.value)} placeholder="Batch" />
                  </td>
                  <td>
                    <input className="form-input w120" type="date" value={r.expiryDate} onChange={e => setExpiry(i, e.target.value)} />
                  </td>
                  <td>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${Math.round((r.receivedQty / r.orderedQty) * 100)}%` }}></div>
                    </div>
                    <span className="progress-label">{Math.round((r.receivedQty / r.orderedQty) * 100)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Processing…' : 'Confirm Receipt'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Convert PO to Invoice Modal ────────────────────────────────
function ConvertToInvoiceModal({ order, warehouses, onClose, onSuccess, onError }) {
  const [warehouseId, setWarehouseId] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseId) return onError('Please select a warehouse');
    setSaving(true);
    try {
      await purchaseApi.convertOrderToInvoice(order.id, { warehouseId, paidAmount, paymentMode, notes });
      onSuccess();
    } catch (err) {
      onError(err.response?.data?.message || 'Conversion failed');
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Convert ${order.orderNo} → Invoice`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="info-banner">
          <strong>Net Amount:</strong> ₹{order.netAmount?.toFixed(2)}<br/>
          <strong>Vendor:</strong> {order.vendor?.name}<br/>
          <strong>Items:</strong> {order.items?.length} line items
        </div>
        <div className="form-group mt-16">
          <label>Receive Into Warehouse *</label>
          <select className="form-input" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
            <option value="">Select Warehouse</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Paid Now (₹)</label>
            <input className="form-input" type="number" min="0" max={order.netAmount} value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Payment Mode</label>
            <select className="form-input" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
              <option>CASH</option><option>BANK</option><option>CHEQUE</option><option>UPI</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Notes</label>
          <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Converting…' : 'Convert to Invoice'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Create Direct Invoice Modal ────────────────────────────────
function CreateInvoiceModal({ vendors, products, warehouses, onClose, onSuccess, onError }) {
  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitPrice: '', gstRate: 0, discount: 0 }]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems(p => [...p, { productId: '', quantity: 1, unitPrice: '', gstRate: 0, discount: 0 }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const setItem = (i, field, val) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const handleProductChange = (i, productId) => {
    const prod = products.find(p => p.id === productId);
    setItems(prev => prev.map((it, idx) => idx === i
      ? { ...it, productId, unitPrice: prod?.purchasePrice || '', gstRate: prod?.gstRate || 0 }
      : it));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendorId || !warehouseId) return onError('Vendor and warehouse are required');
    setSaving(true);
    try {
      await purchaseApi.createInvoice({ vendorId, warehouseId, paidAmount, paymentMode, notes, discount, items });
      onSuccess();
    } catch (err) {
      onError(err.response?.data?.message || 'Failed to create invoice');
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Create Direct Purchase Bill" onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Vendor *</label>
            <select className="form-input" value={vendorId} onChange={e => setVendorId(e.target.value)} required>
              <option value="">Select Vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Warehouse *</label>
            <select className="form-input" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
              <option value="">Select Warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>

        <div className="items-section">
          <div className="items-header">
            <h4>Items</h4>
            <button type="button" className="btn btn-sm btn-outline" onClick={addItem}>+ Add</button>
          </div>
          {items.map((item, i) => (
            <div key={i} className="item-row-multi">
              <select className="form-input" value={item.productId} onChange={e => handleProductChange(i, e.target.value)} required>
                <option value="">Product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="form-input w70" type="number" min="0.01" step="any" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} placeholder="Qty" required />
              <input className="form-input w90" type="number" min="0" step="any" value={item.unitPrice} onChange={e => setItem(i, 'unitPrice', e.target.value)} placeholder="Price ₹" required />
              <input className="form-input w70" type="number" min="0" max="100" value={item.gstRate} onChange={e => setItem(i, 'gstRate', e.target.value)} placeholder="GST%" />
              <input className="form-input w80" type="number" min="0" value={item.discount} onChange={e => setItem(i, 'discount', e.target.value)} placeholder="Disc ₹" />
              {items.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(i)}>✕</button>}
            </div>
          ))}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Paid Now (₹)</label>
            <input className="form-input" type="number" min="0" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Payment Mode</label>
            <select className="form-input" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
              <option>CASH</option><option>BANK</option><option>CHEQUE</option><option>UPI</option>
            </select>
          </div>
          <div className="form-group">
            <label>Header Discount</label>
            <input className="form-input" type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Invoice'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Pay Invoice Modal ──────────────────────────────────────────
function PayModal({ invoice, onClose, onSuccess, onError }) {
  const [amount, setAmount] = useState(invoice.balanceAmount || 0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return onError('Enter a valid amount');
    setSaving(true);
    try {
      await purchaseApi.payInvoice(invoice.id, { amount, paymentMode, notes });
      onSuccess();
    } catch (err) {
      onError(err.response?.data?.message || 'Payment failed');
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Pay Bill — ${invoice.billNo}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="info-banner">
          <div><strong>Vendor:</strong> {invoice.vendor?.name}</div>
          <div><strong>Net Amount:</strong> ₹{invoice.netAmount?.toFixed(2)}</div>
          <div><strong>Paid:</strong> ₹{invoice.paidAmount?.toFixed(2)}</div>
          <div><strong>Balance:</strong> <span className="text-danger">₹{invoice.balanceAmount?.toFixed(2)}</span></div>
        </div>
        <div className="form-row mt-16">
          <div className="form-group">
            <label>Payment Amount (₹) *</label>
            <input className="form-input" type="number" min="0.01" max={invoice.balanceAmount} step="any" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Payment Mode</label>
            <select className="form-input" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
              <option>CASH</option><option>BANK</option><option>CHEQUE</option><option>UPI</option><option>NEFT</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Notes</label>
          <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Processing…' : '💰 Record Payment'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Create Return Modal ────────────────────────────────────────
function CreateReturnModal({ vendors, products, warehouses, invoices, onClose, onSuccess, onError }) {
  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitPrice: '', gstRate: 0, discount: 0 }]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems(p => [...p, { productId: '', quantity: 1, unitPrice: '', gstRate: 0, discount: 0 }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const setItem = (i, field, val) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendorId || !warehouseId) return onError('Vendor and warehouse are required');
    setSaving(true);
    try {
      await purchaseApi.createReturn({ vendorId, warehouseId, invoiceId: invoiceId || undefined, notes, discount, items });
      onSuccess();
    } catch (err) {
      onError(err.response?.data?.message || 'Failed to create return');
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Create Purchase Return" onClose={onClose} wide>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Vendor *</label>
            <select className="form-input" value={vendorId} onChange={e => setVendorId(e.target.value)} required>
              <option value="">Select Vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Warehouse *</label>
            <select className="form-input" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
              <option value="">Select Warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Against Invoice (optional)</label>
            <select className="form-input" value={invoiceId} onChange={e => setInvoiceId(e.target.value)}>
              <option value="">None</option>
              {invoices.filter(inv => !vendorId || inv.vendorId === vendorId).map(inv => (
                <option key={inv.id} value={inv.id}>{inv.billNo}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="items-section">
          <div className="items-header">
            <h4>Return Items</h4>
            <button type="button" className="btn btn-sm btn-outline" onClick={addItem}>+ Add</button>
          </div>
          {items.map((item, i) => (
            <div key={i} className="item-row-multi">
              <select className="form-input" value={item.productId} onChange={e => setItem(i, 'productId', e.target.value)} required>
                <option value="">Product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="form-input w70" type="number" min="0.01" step="any" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} placeholder="Qty" required />
              <input className="form-input w90" type="number" min="0" step="any" value={item.unitPrice} onChange={e => setItem(i, 'unitPrice', e.target.value)} placeholder="Price ₹" required />
              <input className="form-input w70" type="number" min="0" max="100" value={item.gstRate} onChange={e => setItem(i, 'gstRate', e.target.value)} placeholder="GST%" />
              {items.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(i)}>✕</button>}
            </div>
          ))}
        </div>

        <div className="form-group">
          <label>Notes</label>
          <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for return" />
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-danger" disabled={saving}>{saving ? 'Processing…' : 'Create Return'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Ledger Modal ──────────────────────────────────────────────
function LedgerModal({ data, onClose }) {
  return (
    <Modal title={`Ledger — ${data.vendor?.name}`} onClose={onClose} wide>
      <div className="vendor-balance-bar">
        <span>Outstanding Balance</span>
        <strong className={data.vendor?.balance > 0 ? 'text-danger' : 'text-success'}>
          ₹{(data.vendor?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </strong>
      </div>
      <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Ref No</th>
              <th>Type</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {(data.ledger || []).length === 0 && (
              <tr><td colSpan={6} className="empty-row">No transactions found</td></tr>
            )}
            {(data.ledger || []).map(entry => (
              <tr key={entry.id}>
                <td>{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                <td>{entry.description}</td>
                <td><span className="mono">{entry.referenceNo || '—'}</span></td>
                <td>
                  <span className={`ledger-type ${entry.type === 'CREDIT' ? 'ledger-credit' : 'ledger-debit'}`}>
                    {entry.type}
                  </span>
                </td>
                <td className="text-right">₹{entry.amount.toFixed(2)}</td>
                <td className="text-right">₹{entry.balance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="modal-footer">
        <button className="btn btn-outline" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

// ── Generic Modal Wrapper ─────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box ${wide ? 'modal-wide' : ''}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const purchaseStyles = `
.purchases-page { padding: 24px; background: #f8fafc; min-height: 100vh; font-family: 'Inter', system-ui, sans-serif; }

/* Header */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.page-title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0; }
.page-subtitle { font-size: 13px; color: #64748b; margin: 4px 0 0; }

/* KPI Grid */
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.kpi-card { background: white; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.06); border: 1px solid #e2e8f0; }
.kpi-icon { font-size: 28px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: #f1f5f9; }
.kpi-value { font-size: 22px; font-weight: 700; color: #0f172a; }
.kpi-label { font-size: 12px; color: #64748b; margin-top: 2px; }
.kpi-purple .kpi-icon { background: #ede9fe; }
.kpi-blue .kpi-icon { background: #dbeafe; }
.kpi-red .kpi-icon { background: #fee2e2; }
.kpi-orange .kpi-icon { background: #ffedd5; }

/* Tabs */
.tab-bar { display: flex; gap: 4px; background: #f1f5f9; border-radius: 10px; padding: 4px; margin-bottom: 20px; }
.tab-btn { padding: 8px 20px; border-radius: 7px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; color: #64748b; background: transparent; transition: all .15s; position: relative; display: flex; align-items: center; gap: 6px; }
.tab-btn:hover { color: #334155; background: #e2e8f0; }
.tab-btn.active { background: white; color: #6366f1; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.tab-badge { background: #ef4444; color: white; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; }

/* Loading */
.loading-bar { height: 3px; background: #e2e8f0; border-radius: 2px; margin-bottom: 16px; overflow: hidden; }
.loading-fill { height: 100%; width: 40%; background: linear-gradient(90deg, #6366f1, #8b5cf6); animation: shimmer 1.2s ease-in-out infinite; border-radius: 2px; }
@keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }

/* Section Header */
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-header h2 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 0; }

/* Tab Content */
.tab-content { }

/* Table */
.table-container { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { background: #f8fafc; padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid #e2e8f0; }
.data-table td { padding: 12px 14px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: #fafbfc; }
.empty-row { text-align: center; color: #94a3b8; padding: 32px !important; }
.sub-text { font-size: 11px; color: #94a3b8; margin-top: 2px; }
.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
.amount-cell { text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 13px; }
.text-right { text-align: right; }
.text-success { color: #16a34a; }
.text-danger { color: #dc2626; }
.text-warning { color: #d97706; }
.badge-count { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 500; }
.action-cell { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.row-done td { opacity: 0.5; }

/* Status Badges */
.status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: capitalize; white-space: nowrap; }
.badge-warning { background: #fef9c3; color: #854d0e; }
.badge-success { background: #dcfce7; color: #14532d; }
.badge-danger { background: #fee2e2; color: #7f1d1d; }
.badge-info { background: #dbeafe; color: #1e40af; }
.badge-neutral { background: #f1f5f9; color: #475569; }
.badge-purple { background: #ede9fe; color: #5b21b6; }

/* Buttons */
.btn { padding: 8px 16px; border-radius: 7px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; transition: all .15s; display: inline-flex; align-items: center; gap: 4px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: #6366f1; color: white; }
.btn-primary:hover:not(:disabled) { background: #4f46e5; }
.btn-success { background: #16a34a; color: white; }
.btn-success:hover:not(:disabled) { background: #15803d; }
.btn-danger { background: #dc2626; color: white; }
.btn-danger:hover:not(:disabled) { background: #b91c1c; }
.btn-secondary { background: #64748b; color: white; }
.btn-secondary:hover:not(:disabled) { background: #475569; }
.btn-outline { background: white; color: #374151; border: 1px solid #d1d5db; }
.btn-outline:hover:not(:disabled) { background: #f9fafb; }
.btn-ghost { background: transparent; color: #6366f1; border: 1px solid transparent; }
.btn-ghost:hover:not(:disabled) { background: #ede9fe; }
.btn-sm { padding: 5px 10px; font-size: 12px; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; backdrop-filter: blur(2px); }
.modal-box { background: white; border-radius: 16px; width: 540px; max-width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.2); }
.modal-wide { width: 820px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; background: white; z-index: 1; }
.modal-header h3 { margin: 0; font-size: 16px; font-weight: 600; color: #0f172a; }
.modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #64748b; padding: 4px; border-radius: 6px; }
.modal-close:hover { background: #f1f5f9; }
.modal-body { padding: 20px 24px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 20px; margin-top: 12px; border-top: 1px solid #f1f5f9; }

/* Forms */
.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.form-group label { font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.3px; }
.form-input { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 7px; font-size: 13px; color: #1e293b; background: white; outline: none; transition: border-color .15s; }
.form-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,.12); }
.form-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.w70 { width: 70px !important; }
.w80 { width: 80px !important; }
.w90 { width: 90px !important; }
.w100 { width: 100px !important; }
.w120 { width: 120px !important; }
.mt-16 { margin-top: 16px; }

/* Item Rows */
.items-section { background: #fafbfc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.items-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.items-header h4 { margin: 0; font-size: 13px; font-weight: 600; color: #374151; }
.item-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.item-row-multi { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }

/* Totals Preview */
.totals-preview { background: #f8fafc; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
.totals-preview div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #475569; }
.totals-preview .total-row { border-top: 1px solid #e2e8f0; margin-top: 4px; padding-top: 8px; font-size: 15px; color: #0f172a; font-weight: 600; }

/* Info Banner */
.info-banner { background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 14px 16px; font-size: 13px; color: #374151; line-height: 1.8; }

/* Receive table */
.receive-table-wrapper { overflow-x: auto; margin-bottom: 12px; }

/* Progress bar */
.progress-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; width: 80px; display: inline-block; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 3px; transition: width .3s ease; }
.progress-label { font-size: 11px; color: #64748b; margin-left: 6px; }

/* Requisition Preview */
.req-items-preview { background: #fafbfc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
.preview-item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
.preview-item:last-child { border-bottom: none; }

/* Ledger */
.vendor-balance-bar { display: flex; justify-content: space-between; align-items: center; background: #fafbfc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 14px; }
.ledger-type { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.ledger-credit { background: #dcfce7; color: #14532d; }
.ledger-debit { background: #fee2e2; color: #7f1d1d; }

/* Toasts */
.toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; }
.toast { padding: 12px 18px; border-radius: 10px; font-size: 13px; font-weight: 500; box-shadow: 0 4px 20px rgba(0,0,0,.12); animation: fadeIn .25s ease; max-width: 320px; }
.toast-success { background: #16a34a; color: white; }
.toast-error { background: #dc2626; color: white; }
.toast-info { background: #6366f1; color: white; }
@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

@media (max-width: 768px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .form-row { grid-template-columns: 1fr; }
  .tab-bar { flex-wrap: wrap; }
  .modal-wide { width: 100%; }
}
`;
