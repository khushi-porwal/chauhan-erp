import { useState, useEffect } from 'react';
import { salesApi, productApi, customerApi, warehouseApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import BarcodeScannerModal from '../components/BarcodeScannerModal.jsx';
import {
  FileText, Plus, Clipboard, Truck, ShoppingCart, RefreshCcw, Save, Trash2, X, Eye, Barcode
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Sales() {
  const { user, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('invoices');
  const [loading, setLoading] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Master lists
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Data lists
  const [invoices, setInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [challans, setChallans] = useState([]);
  const [returns, setReturns] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null); // for view details
  const [isCreateOpen, setIsCreateOpen] = useState(false); // for new invoice

  // Create form state
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formDiscount, setFormDiscount] = useState('0');
  const [formPaidAmount, setFormPaidAmount] = useState('0');
  const [formPaymentMode, setFormPaymentMode] = useState('CASH');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState([{ productId: '', quantity: 1, unitPrice: 0, gstRate: 0, discount: 0 }]);

  const fetchMasterData = async () => {
    try {
      const custRes = await customerApi.getAll();
      setCustomers(custRes.data.data);
      const prodRes = await productApi.getAll();
      const pData = prodRes.data?.data;
      setProducts(Array.isArray(pData) ? pData : (pData?.products || []));
      const whRes = await warehouseApi.getAll();
      setWarehouses(whRes.data.data.filter(w => w.status === 'ACTIVE'));

      if (custRes.data.data.length > 0) setFormCustomerId(custRes.data.data[0].id);
      if (whRes.data.data.length > 0) setFormWarehouseId(whRes.data.data[0].id);
    } catch { /* ignore */ }
  };

  const fetchTxData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'invoices') {
        const res = await salesApi.getInvoices();
        setInvoices(res.data.data);
      } else if (activeTab === 'quotations') {
        const res = await salesApi.getQuotations();
        setQuotations(res.data.data);
      } else if (activeTab === 'orders') {
        const res = await salesApi.getSalesOrders();
        setOrders(res.data.data);
      } else if (activeTab === 'challans') {
        const res = await salesApi.getDeliveryChallans();
        setChallans(res.data.data);
      } else if (activeTab === 'returns') {
        const res = await salesApi.getReturns();
        setReturns(res.data.data);
      }
    } catch {
      toast.error('Failed to load transaction data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    fetchTxData();
  }, [activeTab]);

  // Form Row Actions
  const handleProductChange = (index, prodId) => {
    const selectedProd = products.find(p => p.id === prodId);
    const updated = [...formItems];
    updated[index] = {
      productId: prodId,
      quantity: updated[index].quantity,
      unitPrice: selectedProd ? selectedProd.salesPrice : 0,
      gstRate: selectedProd ? selectedProd.gstRate : 0,
      discount: updated[index].discount
    };
    setFormItems(updated);
  };

  const handleItemFieldChange = (index, field, val) => {
    const updated = [...formItems];
    updated[index][field] = val;
    setFormItems(updated);
  };

  const addFormRow = () => {
    setFormItems([...formItems, { productId: '', quantity: 1, unitPrice: 0, gstRate: 0, discount: 0 }]);
  };

  const removeFormRow = (index) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  // Calculations
  const calculateTotals = () => {
    let subtotal = 0;
    let gst = 0;

    formItems.forEach(item => {
      const q = parseFloat(item.quantity || 0);
      const p = parseFloat(item.unitPrice || 0);
      const disc = parseFloat(item.discount || 0);
      const g = parseFloat(item.gstRate || 0);

      const rowSub = (q * p) - disc;
      const rowTax = rowSub * (g / 100);

      subtotal += rowSub;
      gst += rowTax;
    });

    const net = subtotal + gst - parseFloat(formDiscount || 0);
    return { subtotal, gst, net };
  };

  const { subtotal, gst, net } = calculateTotals();

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formCustomerId || !formWarehouseId || formItems.some(i => !i.productId)) {
      return toast.error('Please complete all line items and selections.');
    }

    try {
      await salesApi.createInvoice({
        customerId: formCustomerId,
        warehouseId: formWarehouseId,
        items: formItems,
        discount: parseFloat(formDiscount),
        paidAmount: parseFloat(formPaidAmount),
        paymentMode: formPaymentMode,
        notes: formNotes
      });

      toast.success('Invoice created successfully');
      setIsCreateOpen(false);
      // Reset form
      setFormItems([{ productId: '', quantity: 1, unitPrice: 0, gstRate: 0, discount: 0 }]);
      setFormDiscount('0');
      setFormPaidAmount('0');
      setFormNotes('');
      fetchTxData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invoice posting failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div className="flex justify-between" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="text-primary font-bold">Sales Management</h1>
          <p className="text-secondary text-sm">Post bills, log quotes, track deliveries, and process customer returns.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} /> New Sales Invoice
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>
        {[
          { key: 'invoices', label: 'Invoices', icon: FileText },
          { key: 'quotations', label: 'Quotations', icon: Clipboard },
          { key: 'orders', label: 'Sales Orders', icon: ShoppingCart },
          { key: 'challans', label: 'Challans', icon: Truck },
          { key: 'returns', label: 'Sales Returns', icon: RefreshCcw }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* List Card */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-secondary)' }}>Loading ledger list...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                {activeTab === 'invoices' && (
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Payment Mode</th>
                    <th>Net Amount</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                )}
                {activeTab === 'quotations' && (
                  <tr>
                    <th>Quotation No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Net Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                )}
                {activeTab === 'orders' && (
                  <tr>
                    <th>Order No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Net Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                )}
                {activeTab === 'challans' && (
                  <tr>
                    <th>Challan No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Net Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                )}
                {activeTab === 'returns' && (
                  <tr>
                    <th>Return No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Net Amount</th>
                    <th>Actions</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {activeTab === 'invoices' && invoices.map(row => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.invoiceNo}</td>
                    <td>{new Date(row.date).toLocaleDateString()}</td>
                    <td>{row.customer?.name}</td>
                    <td>{row.paymentMode}</td>
                    <td className="text-primary font-bold">₹{row.netAmount.toLocaleString()}</td>
                    <td className="text-success font-semibold">₹{row.paidAmount.toLocaleString()}</td>
                    <td style={{ color: row.balanceAmount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>₹{row.balanceAmount.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${row.status === 'PAID' ? 'badge-success' : 'badge-danger'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => { setSelectedTx(row); setIsModalOpen(true); }}>
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {activeTab === 'quotations' && quotations.map(row => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.quotationNo}</td>
                    <td>{new Date(row.date).toLocaleDateString()}</td>
                    <td>{row.customer?.name}</td>
                    <td className="text-primary font-bold">₹{row.netAmount.toLocaleString()}</td>
                    <td><span className="badge badge-warning">{row.status}</span></td>
                    <td>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => { setSelectedTx(row); setIsModalOpen(true); }}>
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {activeTab === 'orders' && orders.map(row => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.orderNo}</td>
                    <td>{new Date(row.date).toLocaleDateString()}</td>
                    <td>{row.customer?.name}</td>
                    <td className="text-primary font-bold">₹{row.netAmount.toLocaleString()}</td>
                    <td><span className="badge badge-warning">{row.status}</span></td>
                    <td>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => { setSelectedTx(row); setIsModalOpen(true); }}>
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {activeTab === 'challans' && challans.map(row => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.challanNo}</td>
                    <td>{new Date(row.date).toLocaleDateString()}</td>
                    <td>{row.customer?.name}</td>
                    <td className="text-primary font-bold">₹{row.netAmount.toLocaleString()}</td>
                    <td><span className="badge badge-success">{row.status}</span></td>
                    <td>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => { setSelectedTx(row); setIsModalOpen(true); }}>
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {activeTab === 'returns' && returns.map(row => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.returnNo}</td>
                    <td>{new Date(row.date).toLocaleDateString()}</td>
                    <td>{row.customer?.name}</td>
                    <td className="text-primary font-bold">₹{row.netAmount.toLocaleString()}</td>
                    <td>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => { setSelectedTx(row); setIsModalOpen(true); }}>
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL (NEW INVOICE) */}
      {isCreateOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '900px', width: '95%' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Sales Invoice</h3>
              <button className="btn-close" onClick={() => setIsCreateOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Customer</label>
                  <select className="form-control" value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)} required>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} - (Balance: ₹{c.balance})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Warehouse (Stock Source)</label>
                  <select className="form-control" value={formWarehouseId} onChange={e => setFormWarehouseId(e.target.value)} required>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h4 style={{ marginBottom: 'var(--space-2)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Line Items</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {formItems.map((item, index) => (
                    <div key={index} className="flex gap-2" style={{ alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ flex: 3 }}>
                        <label className="form-label-xs">Product</label>
                        <select className="form-control form-control-sm" value={item.productId} onChange={e => handleProductChange(index, e.target.value)} required>
                          <option value="">-- Choose Product --</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku || 'N/A'}) - Price: ₹{p.salesPrice}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label-xs">Qty</label>
                        <input className="form-control form-control-sm" type="number" min="1" step="any" value={item.quantity} onChange={e => handleItemFieldChange(index, 'quantity', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1.5 }}>
                        <label className="form-label-xs">Price (₹)</label>
                        <input className="form-control form-control-sm" type="number" step="any" value={item.unitPrice} onChange={e => handleItemFieldChange(index, 'unitPrice', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label-xs">GST (%)</label>
                        <input className="form-control form-control-sm" type="number" step="any" value={item.gstRate} onChange={e => handleItemFieldChange(index, 'gstRate', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1.2 }}>
                        <label className="form-label-xs">Discount (₹)</label>
                        <input className="form-control form-control-sm" type="number" step="any" value={item.discount} onChange={e => handleItemFieldChange(index, 'discount', e.target.value)} />
                      </div>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '8px', color: 'var(--danger)' }} onClick={() => removeFormRow(index)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-2)' }} onClick={addFormRow}>
                  + Add Line Item
                </button>
              </div>

              {/* Payment Details & Summary */}
              <div className="grid-2" style={{ gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-6)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Discount Overall (₹)</label>
                      <input className="form-control" type="number" value={formDiscount} onChange={e => setFormDiscount(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Payment Mode</label>
                      <select className="form-control" value={formPaymentMode} onChange={e => setFormPaymentMode(e.target.value)}>
                        <option value="CASH">Cash</option>
                        <option value="BANK">Bank Transfer</option>
                        <option value="UPI">UPI</option>
                        <option value="CARD">Debit/Credit Card</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Paid Amount (₹)</label>
                    <input className="form-control" type="number" value={formPaidAmount} onChange={e => setFormPaidAmount(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-control" rows="2" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Terms & conditions or billing notes..."></textarea>
                  </div>
                </div>

                {/* Live Computation Cards */}
                <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>Summary Sheet</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.85rem' }}>
                    <div className="flex justify-between">
                      <span className="text-secondary">Subtotal (Before Tax & Discount):</span>
                      <span className="font-semibold text-primary">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">GST / Tax Calculated:</span>
                      <span className="font-semibold text-primary">+ ₹{gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Additional Discount:</span>
                      <span className="font-semibold" style={{ color: 'var(--danger)' }}>- ₹{parseFloat(formDiscount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <hr style={{ border: '0', borderTop: '1px solid var(--border)', margin: 'var(--space-2) 0' }} />
                    <div className="flex justify-between" style={{ fontSize: '1.15rem' }}>
                      <span className="text-primary font-bold">Total Payable:</span>
                      <span className="text-primary font-bold">₹{net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between" style={{ fontSize: '0.9rem', marginTop: 'var(--space-2)' }}>
                      <span className="text-success font-bold">Amount Paid:</span>
                      <span className="text-success font-bold">₹{parseFloat(formPaidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between" style={{ fontSize: '0.9rem', color: 'var(--danger)' }}>
                      <span className="font-bold">Remaining Due:</span>
                      <span className="font-bold">₹{Math.max(0, net - parseFloat(formPaidAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={16} /> Save & Issue Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS VIEW MODAL */}
      {isModalOpen && selectedTx && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '750px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title">Transaction Details</h3>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="grid-3" style={{ fontSize: '0.8rem', background: 'var(--bg-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <span className="text-muted block">Transaction ID/No:</span>
                  <strong className="text-primary font-semibold">{selectedTx.invoiceNo || selectedTx.quotationNo || selectedTx.orderNo || selectedTx.challanNo || selectedTx.returnNo}</strong>
                </div>
                <div>
                  <span className="text-muted block">Date:</span>
                  <strong className="text-primary">{new Date(selectedTx.date).toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-muted block">Customer Name:</span>
                  <strong className="text-primary">{selectedTx.customer?.name}</strong>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>Line items listed</h4>
                <table className="table-xs" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px' }}>Product</th>
                      <th style={{ padding: '8px' }}>Qty</th>
                      <th style={{ padding: '8px' }}>Unit Price</th>
                      <th style={{ padding: '8px' }}>GST Rate</th>
                      <th style={{ padding: '8px' }}>Discount</th>
                      <th style={{ padding: '8px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTx.items?.map((item, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '8px' }}>{item.product?.name}</td>
                        <td style={{ padding: '8px' }}>{item.quantity}</td>
                        <td style={{ padding: '8px' }}>₹{item.unitPrice}</td>
                        <td style={{ padding: '8px' }}>{item.gstRate}%</td>
                        <td style={{ padding: '8px' }}>₹{item.discount}</td>
                        <td style={{ padding: '8px' }} className="font-semibold">₹{item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between" style={{ alignItems: 'flex-start', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
                <div style={{ maxWidth: '300px' }}>
                  <span className="text-muted block text-xs">Internal Notes/Terms:</span>
                  <p className="text-secondary text-xs">{selectedTx.notes || 'No terms specified.'}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'right', fontSize: '0.85rem' }}>
                  <div><span className="text-muted">Total (Net Tax + Discount):</span> <strong className="text-primary font-bold">₹{selectedTx.netAmount.toLocaleString()}</strong></div>
                  {selectedTx.paidAmount !== undefined && (
                    <>
                      <div><span className="text-muted">Amount Paid:</span> <strong className="text-success font-semibold">₹{selectedTx.paidAmount.toLocaleString()}</strong></div>
                      <div><span className="text-muted">Remaining Balance:</span> <strong style={{ color: selectedTx.balanceAmount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>₹{selectedTx.balanceAmount.toLocaleString()}</strong></div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: 'var(--space-4)' }}>
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Close Panel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
