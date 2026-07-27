import { useState, useEffect } from 'react';
import { purchaseApi, productApi, vendorApi, warehouseApi, financeApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  FileText, Plus, Clipboard, RefreshCcw, Save, Trash2, X, Eye,
  DollarSign, CheckCircle, ArrowRight, QrCode, CreditCard, Search,
  ShieldCheck, Receipt, Building, AlertCircle, Boxes, Barcode
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Purchases() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('invoices'); // invoices, orders, returns, payments
  const [loading, setLoading] = useState(false);

  // Master lists
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Data lists
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [payments, setPayments] = useState([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeScanInput, setBarcodeScanInput] = useState('');

  // Modals State
  const [selectedTx, setSelectedTx] = useState(null); // for view details modal
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Receive Goods Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receivingPo, setReceivingPo] = useState(null);
  const [receiveWarehouseId, setReceiveWarehouseId] = useState('');
  const [receiveItems, setReceiveItems] = useState([]);

  // Create Modals State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertingPo, setConvertingPo] = useState(null);

  // Digital Payment Gateway Simulation State
  const [isGatewayOpen, setIsGatewayOpen] = useState(false);
  const [gatewayTxData, setGatewayTxData] = useState(null);

  // Form State: Purchase Invoice / Order / Return
  const [formVendorId, setFormVendorId] = useState('');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formDiscount, setFormDiscount] = useState('0');
  const [formPaidAmount, setFormPaidAmount] = useState('0');
  const [formPaymentMode, setFormPaymentMode] = useState('CASH');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState([{ productId: '', quantity: 1, unitPrice: 0, gstRate: 0, discount: 0 }]);

  // Form State: Supplier Payout
  const [payoutVendorId, setPayoutVendorId] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMode, setPayoutMode] = useState('CASH'); // CASH, BANK, UPI, CARD, DIGITAL_GATEWAY
  const [payoutRefNo, setPayoutRefNo] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');

  // Form State: Convert PO
  const [convertWarehouseId, setConvertWarehouseId] = useState('');
  const [convertPaidAmount, setConvertPaidAmount] = useState('0');
  const [convertPaymentMode, setConvertPaymentMode] = useState('CASH');

  const fetchMasterData = async () => {
    try {
      const vendRes = await vendorApi.getAll();
      setVendors(vendRes.data.data);
      const prodRes = await productApi.getAll();
      setProducts(prodRes.data.data);
      const whRes = await warehouseApi.getAll();
      const activeWh = whRes.data.data.filter(w => w.status === 'ACTIVE');
      setWarehouses(activeWh);

      if (vendRes.data.data.length > 0) {
        setFormVendorId(vendRes.data.data[0].id);
        setPayoutVendorId(vendRes.data.data[0].id);
      }
      if (activeWh.length > 0) {
        setFormWarehouseId(activeWh[0].id);
        setConvertWarehouseId(activeWh[0].id);
      }
    } catch { /* ignore */ }
  };

  const fetchTxData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'invoices') {
        const res = await purchaseApi.getInvoices();
        setInvoices(res.data.data);
      } else if (activeTab === 'orders') {
        const res = await purchaseApi.getOrders();
        setOrders(res.data.data);
      } else if (activeTab === 'returns') {
        const res = await purchaseApi.getReturns();
        setReturns(res.data.data);
      } else if (activeTab === 'payments') {
        const res = await financeApi.getPayments();
        const vendorPmts = res.data.data.filter(p => p.type === 'PAYMENT_OUT' && p.category === 'VENDOR');
        setPayments(vendorPmts);
      }
    } catch {
      toast.error('Failed to load purchase data');
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
      unitPrice: selectedProd ? selectedProd.purchasePrice : 0,
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

  // Reset form
  const resetForm = () => {
    setFormItems([{ productId: '', quantity: 1, unitPrice: 0, gstRate: 0, discount: 0 }]);
    setFormDiscount('0');
    setFormPaidAmount('0');
    setFormNotes('');
  };

  // Handlers for Submission
  const handleCreateInvoiceSubmit = async (e) => {
    e.preventDefault();
    if (!formVendorId || !formWarehouseId || formItems.some(i => !i.productId)) {
      return toast.error('Please complete all line items and vendor details');
    }
    const selectedVendor = vendors.find(v => v.id === formVendorId);
    const targetCompId = user?.companyId || selectedVendor?.companyId;
    try {
      await purchaseApi.createInvoice({
        vendorId: formVendorId,
        warehouseId: formWarehouseId,
        items: formItems,
        discount: parseFloat(formDiscount),
        paidAmount: parseFloat(formPaidAmount),
        paymentMode: formPaymentMode,
        notes: formNotes,
        companyId: targetCompId,
      });
      toast.success('Purchase Invoice recorded successfully');
      setIsInvoiceModalOpen(false);
      resetForm();
      fetchTxData();
      fetchMasterData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invoice entry failed');
    }
  };

  const handleCreateOrderSubmit = async (e) => {
    e.preventDefault();
    if (!formVendorId || formItems.some(i => !i.productId)) {
      return toast.error('Please complete all line items and vendor details');
    }
    const selectedVendor = vendors.find(v => v.id === formVendorId);
    const targetCompId = user?.companyId || selectedVendor?.companyId;
    try {
      await purchaseApi.createOrder({
        vendorId: formVendorId,
        items: formItems,
        discount: parseFloat(formDiscount),
        notes: formNotes,
        companyId: targetCompId,
      });
      toast.success('Purchase Order created successfully');
      setIsOrderModalOpen(false);
      resetForm();
      fetchTxData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Order creation failed');
    }
  };

  const handleCreateReturnSubmit = async (e) => {
    e.preventDefault();
    if (!formVendorId || !formWarehouseId || formItems.some(i => !i.productId)) {
      return toast.error('Please complete all line items, vendor, and warehouse details');
    }
    const selectedVendor = vendors.find(v => v.id === formVendorId);
    const targetCompId = user?.companyId || selectedVendor?.companyId;
    try {
      await purchaseApi.createReturn({
        vendorId: formVendorId,
        warehouseId: formWarehouseId,
        items: formItems,
        discount: parseFloat(formDiscount),
        notes: formNotes,
        companyId: targetCompId,
      });
      toast.success('Purchase Return logged successfully');
      setIsReturnModalOpen(false);
      resetForm();
      fetchTxData();
      fetchMasterData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Return logging failed');
    }
  };

  // Convert PO Handler
  const handleConvertPoSubmit = async (e) => {
    e.preventDefault();
    if (!convertingPo || !convertWarehouseId) return toast.error('Warehouse is required');
    try {
      await purchaseApi.convertOrderToInvoice(convertingPo.id, {
        warehouseId: convertWarehouseId,
        paidAmount: parseFloat(convertPaidAmount),
        paymentMode: convertPaymentMode
      });
      toast.success(`Purchase Order ${convertingPo.orderNo} converted to Invoice!`);
      setIsConvertModalOpen(false);
      setConvertingPo(null);
      fetchTxData();
      fetchMasterData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'PO conversion failed');
    }
  };

  // Approve PO Handler
  const handleApprovePo = async (orderId) => {
    try {
      await purchaseApi.updateOrderStatus(orderId, { status: 'APPROVED' });
      toast.success('Purchase Order Approved');
      fetchTxData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve order');
    }
  };

  // Barcode Scanner Quick Add Helper
  const handleBarcodeScan = (code) => {
    if (!code) return;
    const cleanCode = code.trim().toLowerCase();
    const matched = products.find(p =>
      (p.barcode && p.barcode.toLowerCase() === cleanCode) ||
      (p.sku && p.sku.toLowerCase() === cleanCode)
    );

    if (matched) {
      setFormItems(prevItems => {
        const existingIdx = prevItems.findIndex(i => i.productId === matched.id);
        if (existingIdx >= 0) {
          const updated = [...prevItems];
          updated[existingIdx].quantity += 1;
          return updated;
        } else {
          if (prevItems.length === 1 && !prevItems[0].productId) {
            return [{
              productId: matched.id,
              quantity: 1,
              unitPrice: matched.purchasePrice || matched.salesPrice || 0,
              gstRate: matched.gstRate || 0,
              discount: 0
            }];
          }
          return [...prevItems, {
            productId: matched.id,
            quantity: 1,
            unitPrice: matched.purchasePrice || matched.salesPrice || 0,
            gstRate: matched.gstRate || 0,
            discount: 0
          }];
        }
      });
      toast.success(`Added ${matched.name} via barcode scan`);
      setBarcodeScanInput('');
    } else {
      toast.error(`No product found with Barcode/SKU '${code}'`);
    }
  };

  // Goods Receiving (GRN) Handlers
  const openReceiveModal = (po) => {
    setReceivingPo(po);
    setReceiveWarehouseId(warehouses[0]?.id || '');
    setReceiveItems((po.items || []).map(item => ({
      productId: item.productId,
      productName: item.product?.name || 'Product',
      variantId: item.variantId || null,
      orderedQuantity: item.quantity,
      quantity: item.quantity,
      batchNumber: '',
      mfgDate: '',
      expiryDate: ''
    })));
    setIsReceiveModalOpen(true);
  };

  const handleReceiveGoodsSubmit = async (e) => {
    e.preventDefault();
    if (!receiveWarehouseId) return toast.error('Please select a destination warehouse');
    if (!receiveItems || receiveItems.length === 0) return toast.error('No items to receive');

    try {
      await purchaseApi.receiveOrder(receivingPo.id, {
        warehouseId: receiveWarehouseId,
        items: receiveItems
      });
      toast.success('Goods received & inventory updated in real-time');
      setIsReceiveModalOpen(false);
      setReceivingPo(null);
      fetchTxData();
      fetchMasterData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to receive goods');
    }
  };

  // Supplier Payout Submission Handler
  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (!payoutVendorId || !payoutAmount || parseFloat(payoutAmount) <= 0) {
      return toast.error('Please enter a valid vendor and payout amount');
    }

    if (payoutMode === 'DIGITAL_GATEWAY') {
      // Trigger Digital Payment Gateway Checkout Modal
      const selectedV = vendors.find(v => v.id === payoutVendorId);
      setGatewayTxData({
        vendorId: payoutVendorId,
        vendorName: selectedV?.name || 'Vendor',
        amount: parseFloat(payoutAmount),
        description: payoutNotes || `Supplier Payment to ${selectedV?.name}`,
      });
      setIsPayoutModalOpen(false);
      setIsGatewayOpen(true);
      return;
    }

    try {
      await financeApi.createPayment({
        type: 'PAYMENT_OUT',
        category: 'VENDOR',
        vendorId: payoutVendorId,
        amount: parseFloat(payoutAmount),
        paymentMode: payoutMode,
        referenceNo: payoutRefNo || `PMT-${Date.now()}`,
        description: payoutNotes || 'Supplier Payout'
      });
      toast.success('Supplier Payment registered successfully');
      setIsPayoutModalOpen(false);
      setPayoutAmount('');
      setPayoutRefNo('');
      setPayoutNotes('');
      fetchTxData();
      fetchMasterData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payout registration failed');
    }
  };

  // Complete Payment Gateway Simulation
  const handleGatewaySuccess = async () => {
    if (!gatewayTxData) return;
    const gatewayTxnId = `pay_rzp_${Date.now()}`;
    try {
      await financeApi.createPayment({
        type: 'PAYMENT_OUT',
        category: 'VENDOR',
        vendorId: gatewayTxData.vendorId,
        amount: gatewayTxData.amount,
        paymentMode: 'ONLINE_GATEWAY',
        referenceNo: gatewayTxnId,
        description: `${gatewayTxData.description} (Gateway Ref: ${gatewayTxnId})`
      });
      toast.success(`Online Payment Gateway Settlement Successful! Ref: ${gatewayTxnId}`);
      setIsGatewayOpen(false);
      setGatewayTxData(null);
      setPayoutAmount('');
      setPayoutRefNo('');
      setPayoutNotes('');
      fetchTxData();
      fetchMasterData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gateway settlement failed');
    }
  };

  // Total balance owed across all vendors
  const totalVendorBalanceOwed = vendors.reduce((sum, v) => sum + (v.balance || 0), 0);

  // Filtered rows for active tab
  const getFilteredData = (list) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(item => (
      item.billNo?.toLowerCase().includes(q) ||
      item.orderNo?.toLowerCase().includes(q) ||
      item.returnNo?.toLowerCase().includes(q) ||
      item.paymentNo?.toLowerCase().includes(q) ||
      item.vendor?.name?.toLowerCase().includes(q) ||
      item.status?.toLowerCase().includes(q)
    ));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="text-primary font-bold">Purchase Management</h1>
          <p className="text-secondary text-sm">Manage Purchase Orders, Bills, Returns & Supplier Payouts with Digital Gateway Integration</p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {activeTab === 'invoices' && (
            <button className="btn btn-primary flex-center" onClick={() => { resetForm(); setIsInvoiceModalOpen(true); }}>
              <Plus size={16} /> New Purchase Bill
            </button>
          )}
          {activeTab === 'orders' && (
            <button className="btn btn-primary flex-center" onClick={() => { resetForm(); setIsOrderModalOpen(true); }}>
              <Plus size={16} /> Create Purchase Order
            </button>
          )}
          {activeTab === 'returns' && (
            <button className="btn btn-primary flex-center" onClick={() => { resetForm(); setIsReturnModalOpen(true); }}>
              <Plus size={16} /> New Purchase Return
            </button>
          )}
          {activeTab === 'payments' && (
            <button className="btn btn-primary flex-center" onClick={() => setIsPayoutModalOpen(true)}>
              <DollarSign size={16} /> Record Supplier Payout
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards HUD for Payments Tab */}
      {activeTab === 'payments' && (
        <div className="grid-3">
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: 'var(--radius-lg)', color: '#ef4444' }}>
              <Building size={24} />
            </div>
            <div>
              <span className="text-muted text-xs block">Total Supplier Balance Owed</span>
              <h2 className="text-primary font-bold">₹{totalVendorBalanceOwed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '12px', borderRadius: 'var(--radius-lg)', color: '#10b981' }}>
              <Receipt size={24} />
            </div>
            <div>
              <span className="text-muted text-xs block">Supplier Payouts Count</span>
              <h2 className="text-primary font-bold">{payments.length} Records</h2>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '12px', borderRadius: 'var(--radius-lg)', color: '#3b82f6' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <span className="text-muted text-xs block">Payment Integration</span>
              <h4 className="text-success font-semibold flex gap-1" style={{ alignItems: 'center', marginTop: '4px' }}>
                <CheckCircle size={14} /> Active Gateway
              </h4>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar: Nav Tabs & Search */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div className="tabs">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`tab-btn${activeTab === 'invoices' ? ' active' : ''}`}
          >
            <span className="flex gap-2" style={{ alignItems: 'center' }}>
              <FileText size={14} /> Purchase Invoices ({invoices.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`tab-btn${activeTab === 'orders' ? ' active' : ''}`}
          >
            <span className="flex gap-2" style={{ alignItems: 'center' }}>
              <Clipboard size={14} /> Purchase Orders ({orders.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('returns')}
            className={`tab-btn${activeTab === 'returns' ? ' active' : ''}`}
          >
            <span className="flex gap-2" style={{ alignItems: 'center' }}>
              <RefreshCcw size={14} /> Returns ({returns.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`tab-btn${activeTab === 'payments' ? ' active' : ''}`}
          >
            <span className="flex gap-2" style={{ alignItems: 'center' }}>
              <DollarSign size={14} /> Supplier Payments ({payments.length})
            </span>
          </button>
        </div>

        <div className="form-group" style={{ minWidth: '260px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '34px' }}
              placeholder="Search purchases or vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-muted)' }}>Loading ledger list...</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              {activeTab === 'invoices' && (
                <tr>
                  <th>Bill/Invoice No</th>
                  <th>Date</th>
                  <th>Supplier/Vendor</th>
                  <th>Payment Mode</th>
                  <th>Net Amount</th>
                  <th>Paid Amount</th>
                  <th>Balance Due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              )}
              {activeTab === 'orders' && (
                <tr>
                  <th>Order No</th>
                  <th>Date</th>
                  <th>Supplier/Vendor</th>
                  <th>Net Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              )}
              {activeTab === 'returns' && (
                <tr>
                  <th>Return No</th>
                  <th>Date</th>
                  <th>Supplier/Vendor</th>
                  <th>Net Amount</th>
                  <th>Warehouse</th>
                  <th>Actions</th>
                </tr>
              )}
              {activeTab === 'payments' && (
                <tr>
                  <th>Payment No</th>
                  <th>Date</th>
                  <th>Supplier/Vendor</th>
                  <th>Amount Paid</th>
                  <th>Mode</th>
                  <th>Reference No</th>
                  <th>Actions</th>
                </tr>
              )}
            </thead>
            <tbody>
              {/* Invoices Tab */}
              {activeTab === 'invoices' && getFilteredData(invoices).map(row => (
                <tr key={row.id}>
                  <td className="font-semibold text-primary">{row.billNo}</td>
                  <td className="text-xs">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                  <td className="font-medium">{row.vendor?.name}</td>
                  <td className="text-xs">{row.paymentMode}</td>
                  <td className="text-primary font-bold">₹{row.netAmount.toLocaleString('en-IN')}</td>
                  <td className="text-success font-semibold">₹{row.paidAmount.toLocaleString('en-IN')}</td>
                  <td style={{ color: row.balanceAmount > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: '600' }}>
                    ₹{row.balanceAmount.toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span className={`alert-${row.status === 'PAID' ? 'success' : row.status === 'PARTIALLY_PAID' ? 'warning' : 'danger'}`} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-icon btn-sm" onClick={() => { setSelectedTx(row); setIsDetailOpen(true); }} title="View Details">
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Orders Tab */}
              {activeTab === 'orders' && getFilteredData(orders).map(row => (
                <tr key={row.id}>
                  <td className="font-semibold text-primary">{row.orderNo}</td>
                  <td className="text-xs">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                  <td className="font-medium">{row.vendor?.name}</td>
                  <td className="text-primary font-bold">₹{row.netAmount.toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`alert-${row.status === 'RECEIVED' ? 'success' : row.status === 'APPROVED' ? 'info' : row.status === 'CANCELLED' ? 'danger' : 'warning'}`} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => { setSelectedTx(row); setIsDetailOpen(true); }} title="View Details">
                        <Eye size={14} />
                      </button>
                      {row.status === 'PENDING' && (
                        <button className="btn btn-secondary btn-sm flex-center text-success" onClick={() => handleApprovePo(row.id)}>
                          <CheckCircle size={12} style={{ marginRight: 4 }} /> Approve
                        </button>
                      )}
                      {(row.status === 'APPROVED' || row.status === 'PENDING') && (
                        <button className="btn btn-secondary btn-sm flex-center text-primary" onClick={() => openReceiveModal(row)}>
                          <Boxes size={12} style={{ marginRight: 4 }} /> Receive Goods
                        </button>
                      )}
                      {(row.status === 'APPROVED' || row.status === 'PENDING') && (
                        <button
                          className="btn btn-primary btn-sm flex-center"
                          onClick={() => {
                            setConvertingPo(row);
                            setConvertPaidAmount('0');
                            setIsConvertModalOpen(true);
                          }}
                        >
                          <ArrowRight size={12} style={{ marginRight: 4 }} /> Convert to Bill
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {/* Returns Tab */}
              {activeTab === 'returns' && getFilteredData(returns).map(row => (
                <tr key={row.id}>
                  <td className="font-semibold text-primary">{row.returnNo}</td>
                  <td className="text-xs">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                  <td className="font-medium">{row.vendor?.name}</td>
                  <td className="text-primary font-bold">₹{row.netAmount.toLocaleString('en-IN')}</td>
                  <td className="text-xs text-secondary">{row.warehouseId ? 'Depot Location' : 'Main'}</td>
                  <td>
                    <button className="btn btn-secondary btn-icon btn-sm" onClick={() => { setSelectedTx(row); setIsDetailOpen(true); }} title="View Details">
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Payments Tab */}
              {activeTab === 'payments' && getFilteredData(payments).map(row => (
                <tr key={row.id}>
                  <td className="font-semibold text-primary">{row.paymentNo}</td>
                  <td className="text-xs">{new Date(row.date).toLocaleDateString('en-IN')}</td>
                  <td className="font-medium">{row.vendor?.name || '-'}</td>
                  <td className="text-success font-bold">₹{row.amount.toLocaleString('en-IN')}</td>
                  <td>
                    <span className="alert-info" style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      {row.paymentMode}
                    </span>
                  </td>
                  <td className="text-xs text-secondary">{row.referenceNo || '-'}</td>
                  <td>
                    <button className="btn btn-secondary btn-icon btn-sm" onClick={() => { setSelectedTx(row); setIsDetailOpen(true); }} title="View Payment Voucher">
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: CREATE PURCHASE INVOICE (BILL) */}
      {isInvoiceModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1001, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">Create Purchase Invoice (Bill)</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsInvoiceModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateInvoiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Supplier / Vendor *</label>
                  <select className="form-select" value={formVendorId} onChange={e => setFormVendorId(e.target.value)} required>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name} (Balance Owed: ₹{v.balance})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Warehouse (Stock Destination) *</label>
                  <select className="form-select" value={formWarehouseId} onChange={e => setFormWarehouseId(e.target.value)} required>
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
                        <label className="form-label text-xs">Product *</label>
                        <select className="form-select" value={item.productId} onChange={e => handleProductChange(index, e.target.value)} required>
                          <option value="">-- Select Product --</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku || 'N/A'}) - Buy: ₹{p.purchasePrice}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label text-xs">Qty *</label>
                        <input className="form-input" type="number" min="1" step="any" value={item.quantity} onChange={e => handleItemFieldChange(index, 'quantity', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1.5 }}>
                        <label className="form-label text-xs">Unit Cost (₹) *</label>
                        <input className="form-input" type="number" step="any" value={item.unitPrice} onChange={e => handleItemFieldChange(index, 'unitPrice', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label text-xs">GST (%)</label>
                        <input className="form-input" type="number" step="any" value={item.gstRate} onChange={e => handleItemFieldChange(index, 'gstRate', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1.2 }}>
                        <label className="form-label text-xs">Discount (₹)</label>
                        <input className="form-input" type="number" step="any" value={item.discount} onChange={e => handleItemFieldChange(index, 'discount', e.target.value)} />
                      </div>
                      <button type="button" className="btn btn-secondary btn-sm text-danger" style={{ height: '38px', width: '38px', padding: 0 }} onClick={() => removeFormRow(index)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-2)' }} onClick={addFormRow}>
                  + Add Line Item
                </button>
              </div>

              {/* Payment Details & Summary Sheet */}
              <div className="form-row" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Overall Bill Discount (₹)</label>
                      <input className="form-input" type="number" value={formDiscount} onChange={e => setFormDiscount(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Payment Mode</label>
                      <select className="form-select" value={formPaymentMode} onChange={e => setFormPaymentMode(e.target.value)}>
                        <option value="CASH">Cash</option>
                        <option value="BANK">Bank Transfer</option>
                        <option value="UPI">UPI Payment</option>
                        <option value="CARD">Card</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Immediate Paid Amount (₹)</label>
                    <input className="form-input" type="number" value={formPaidAmount} onChange={e => setFormPaidAmount(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Supplier Notes / Terms</label>
                    <textarea className="form-textarea" rows="2" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Terms & conditions..."></textarea>
                  </div>
                </div>

                {/* Calculation Summary Sheet */}
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>Summary Sheet</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.85rem' }}>
                    <div className="flex-between">
                      <span className="text-secondary">Subtotal:</span>
                      <span className="font-semibold text-primary">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex-between">
                      <span className="text-secondary">GST / Tax:</span>
                      <span className="font-semibold text-primary">+ ₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex-between">
                      <span className="text-secondary">Discount:</span>
                      <span className="font-semibold text-danger">- ₹{parseFloat(formDiscount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <hr style={{ border: '0', borderTop: '1px solid var(--border)', margin: 'var(--space-2) 0' }} />
                    <div className="flex-between" style={{ fontSize: '1.1rem' }}>
                      <span className="text-primary font-bold">Total Bill:</span>
                      <span className="text-primary font-bold">₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex-between" style={{ fontSize: '0.9rem' }}>
                      <span className="text-success font-bold">Amount Paid:</span>
                      <span className="text-success font-bold">₹{parseFloat(formPaidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex-between" style={{ fontSize: '0.9rem', color: '#ef4444' }}>
                      <span className="font-bold">Remaining Owed:</span>
                      <span className="font-bold">₹{Math.max(0, net - parseFloat(formPaidAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsInvoiceModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Save & Record Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PURCHASE ORDER */}
      {isOrderModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '850px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1001, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">Create Purchase Order (PO)</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsOrderModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Supplier / Vendor *</label>
                <select className="form-select" value={formVendorId} onChange={e => setFormVendorId(e.target.value)} required>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name} (Balance Owed: ₹{v.balance})</option>)}
                </select>
              </div>

              {/* Line Items */}
              <div>
                <h4 style={{ marginBottom: 'var(--space-2)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Line Items</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {formItems.map((item, index) => (
                    <div key={index} className="flex gap-2" style={{ alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ flex: 3 }}>
                        <label className="form-label text-xs">Product *</label>
                        <select className="form-select" value={item.productId} onChange={e => handleProductChange(index, e.target.value)} required>
                          <option value="">-- Select Product --</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku || 'N/A'}) - Buy: ₹{p.purchasePrice}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label text-xs">Qty *</label>
                        <input className="form-input" type="number" min="1" step="any" value={item.quantity} onChange={e => handleItemFieldChange(index, 'quantity', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1.5 }}>
                        <label className="form-label text-xs">Unit Cost (₹) *</label>
                        <input className="form-input" type="number" step="any" value={item.unitPrice} onChange={e => handleItemFieldChange(index, 'unitPrice', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label text-xs">GST (%)</label>
                        <input className="form-input" type="number" step="any" value={item.gstRate} onChange={e => handleItemFieldChange(index, 'gstRate', e.target.value)} required />
                      </div>
                      <button type="button" className="btn btn-secondary btn-sm text-danger" style={{ height: '38px', width: '38px', padding: 0 }} onClick={() => removeFormRow(index)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-2)' }} onClick={addFormRow}>
                  + Add Line Item
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Order Notes / Terms</label>
                <textarea className="form-textarea" rows="2" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Delivery terms..."></textarea>
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsOrderModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Issue Purchase Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PURCHASE RETURN */}
      {isReturnModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '850px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1001, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">Create Purchase Return (Debit Note)</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsReturnModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateReturnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Supplier / Vendor *</label>
                  <select className="form-select" value={formVendorId} onChange={e => setFormVendorId(e.target.value)} required>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Warehouse (Stock Deduction Source) *</label>
                  <select className="form-select" value={formWarehouseId} onChange={e => setFormWarehouseId(e.target.value)} required>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h4 style={{ marginBottom: 'var(--space-2)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Return Line Items</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {formItems.map((item, index) => (
                    <div key={index} className="flex gap-2" style={{ alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ flex: 3 }}>
                        <label className="form-label text-xs">Product *</label>
                        <select className="form-select" value={item.productId} onChange={e => handleProductChange(index, e.target.value)} required>
                          <option value="">-- Select Product --</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku || 'N/A'})</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label text-xs">Return Qty *</label>
                        <input className="form-input" type="number" min="1" step="any" value={item.quantity} onChange={e => handleItemFieldChange(index, 'quantity', e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1.5 }}>
                        <label className="form-label text-xs">Unit Price (₹) *</label>
                        <input className="form-input" type="number" step="any" value={item.unitPrice} onChange={e => handleItemFieldChange(index, 'unitPrice', e.target.value)} required />
                      </div>
                      <button type="button" className="btn btn-secondary btn-sm text-danger" style={{ height: '38px', width: '38px', padding: 0 }} onClick={() => removeFormRow(index)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-2)' }} onClick={addFormRow}>
                  + Add Line Item
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Return Reason / Notes</label>
                <textarea className="form-textarea" rows="2" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Damaged goods, wrong items sent..."></textarea>
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsReturnModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Record Purchase Return</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONVERT PO TO INVOICE */}
      {isConvertModalOpen && convertingPo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1001 }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">Convert PO {convertingPo.orderNo}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsConvertModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleConvertPoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <p className="text-secondary text-sm">
                Converting this PO into a Purchase Bill will automatically increment stock levels in the destination warehouse and record the vendor bill amount (<strong>₹{convertingPo.netAmount.toLocaleString('en-IN')}</strong>).
              </p>

              <div className="form-group">
                <label className="form-label">Warehouse (Stock Receiving Location) *</label>
                <select className="form-select" value={convertWarehouseId} onChange={e => setConvertWarehouseId(e.target.value)} required>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Immediate Paid Amount (₹)</label>
                  <input className="form-input" type="number" value={convertPaidAmount} onChange={e => setConvertPaidAmount(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-select" value={convertPaymentMode} onChange={e => setConvertPaymentMode(e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsConvertModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><CheckCircle size={16} /> Confirm Conversion</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD SUPPLIER PAYOUT */}
      {isPayoutModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1001 }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">Record Supplier Payout</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsPayoutModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handlePayoutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Select Vendor / Supplier *</label>
                <select className="form-select" value={payoutVendorId} onChange={e => setPayoutVendorId(e.target.value)} required>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} (Current Balance Owed: ₹{v.balance})</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Payout Amount (₹) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={payoutAmount}
                    onChange={e => setPayoutAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    step="0.01"
                    min="0.01"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Method *</label>
                  <select className="form-select" value={payoutMode} onChange={e => setPayoutMode(e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">Manual UPI</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="DIGITAL_GATEWAY">⚡ Online Digital Payment Gateway (Instant Settlement)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reference / UTR Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={payoutRefNo}
                  onChange={e => setPayoutRefNo(e.target.value)}
                  placeholder="e.g. UTR9847291823"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Remarks</label>
                <textarea className="form-textarea" rows="2" value={payoutNotes} onChange={e => setPayoutNotes(e.target.value)} placeholder="Payment note or bill reference..."></textarea>
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPayoutModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center">
                  {payoutMode === 'DIGITAL_GATEWAY' ? 'Proceed to Online Gateway ⚡' : <><Save size={16} /> Record Payout</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DIGITAL PAYMENT GATEWAY CHECKOUT SIMULATION */}
      {isGatewayOpen && gatewayTxData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 2001, border: '1px solid var(--primary)', borderRadius: 'var(--radius-lg)' }}>
            <div className="flex-between">
              <div className="flex gap-2" style={{ alignItems: 'center' }}>
                <ShieldCheck size={20} className="text-success" />
                <h3 className="text-primary font-bold">Online Payment Gateway</h3>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsGatewayOpen(false)}><X size={16} /></button>
            </div>

            <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <span className="text-muted text-xs block">Paying Supplier:</span>
              <strong className="text-primary font-semibold text-lg">{gatewayTxData.vendorName}</strong>
              <div style={{ marginTop: 'var(--space-2)', fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--success)' }}>
                ₹{gatewayTxData.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* UPI QR Code Display Simulation */}
            <div style={{ textAlign: 'center', padding: 'var(--space-2)' }}>
              <div style={{ display: 'inline-block', background: '#ffffff', padding: '12px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <QrCode size={160} style={{ color: '#000000' }} />
              </div>
              <p className="text-xs text-muted" style={{ marginTop: '8px' }}>Scan QR Code with any UPI App (GPay, PhonePe, Paytm, BHIM) to execute instant settlement</p>
            </div>

            <div className="alert-info" style={{ padding: '8px 12px', fontSize: '11px', borderRadius: '8px', textAlign: 'center' }}>
              🔒 Secured by 256-bit ERP Payment Gateway Engine
            </div>

            <div className="flex gap-3" style={{ justifyContent: 'center', marginTop: 'var(--space-2)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsGatewayOpen(false)}>Cancel Gateway</button>
              <button type="button" className="btn btn-primary flex-center" onClick={handleGatewaySuccess}>
                <CheckCircle size={16} /> Confirm Payment Success ⚡
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW DETAILS */}
      {isDetailOpen && selectedTx && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '750px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1001, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">Transaction Record</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsDetailOpen(false)}><X size={16} /></button>
            </div>

            <div className="grid-3" style={{ fontSize: '0.8rem', background: 'var(--bg-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <span className="text-muted block">Transaction Ref/No:</span>
                <strong className="text-primary font-semibold">{selectedTx.billNo || selectedTx.orderNo || selectedTx.returnNo || selectedTx.paymentNo}</strong>
              </div>
              <div>
                <span className="text-muted block">Date:</span>
                <strong className="text-primary">{new Date(selectedTx.date).toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span className="text-muted block">Supplier / Vendor:</span>
                <strong className="text-primary">{selectedTx.vendor?.name || '-'}</strong>
              </div>
            </div>

            {/* Line items if available */}
            {selectedTx.items && selectedTx.items.length > 0 && (
              <div>
                <h4 style={{ marginBottom: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>Line Items</h4>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Unit Cost</th>
                        <th>GST Rate</th>
                        <th>Discount</th>
                        <th>Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTx.items.map((item, index) => (
                        <tr key={index}>
                          <td className="font-medium">{item.product?.name || '-'}</td>
                          <td>{item.quantity}</td>
                          <td>₹{item.unitPrice}</td>
                          <td>{item.gstRate}%</td>
                          <td>₹{item.discount}</td>
                          <td className="font-semibold text-primary">₹{item.total?.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex-between" style={{ alignItems: 'flex-start', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
              <div style={{ maxWidth: '300px' }}>
                <span className="text-muted block text-xs">Notes / Remarks:</span>
                <p className="text-secondary text-xs">{selectedTx.notes || selectedTx.description || 'No additional remarks.'}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', textAlign: 'right', fontSize: '0.85rem' }}>
                {selectedTx.netAmount !== undefined && (
                  <div><span className="text-muted">Total Net Amount:</span> <strong className="text-primary font-bold">₹{selectedTx.netAmount.toLocaleString('en-IN')}</strong></div>
                )}
                {selectedTx.amount !== undefined && (
                  <div><span className="text-muted">Payment Amount:</span> <strong className="text-success font-bold">₹{selectedTx.amount.toLocaleString('en-IN')}</strong></div>
                )}
                {selectedTx.paidAmount !== undefined && (
                  <>
                    <div><span className="text-muted">Amount Paid:</span> <strong className="text-success font-semibold">₹{selectedTx.paidAmount.toLocaleString('en-IN')}</strong></div>
                    <div><span className="text-muted">Balance Due:</span> <strong style={{ color: selectedTx.balanceAmount > 0 ? '#ef4444' : 'var(--text-muted)' }}>₹{selectedTx.balanceAmount.toLocaleString('en-IN')}</strong></div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <button className="btn btn-secondary" onClick={() => setIsDetailOpen(false)}>Close Panel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: GOODS RECEIVING (GRN WORKFLOW) ──────── */}
      {isReceiveModalOpen && receivingPo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 1150,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1151, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between">
              <div>
                <h3 className="text-primary font-bold">Receive Goods (GRN)</h3>
                <p className="text-secondary text-sm">Purchase Order #{receivingPo.orderNo} ({receivingPo.vendor?.name})</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsReceiveModalOpen(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleReceiveGoodsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Destination Warehouse *</label>
                <select className="form-select" value={receiveWarehouseId} onChange={(e) => setReceiveWarehouseId(e.target.value)} required>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
              </div>

              <div>
                <h4 style={{ marginBottom: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>Ordered Items & Goods Receipt Details</h4>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Ordered Qty</th>
                        <th>Received Qty</th>
                        <th>Batch # (Optional)</th>
                        <th>Expiry Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiveItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-semibold text-primary">{item.productName}</td>
                          <td className="text-muted">{item.orderedQuantity}</td>
                          <td style={{ width: '100px' }}>
                            <input
                              type="number"
                              className="form-input"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setReceiveItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: val } : it));
                              }}
                              required
                            />
                          </td>
                          <td style={{ width: '130px' }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="e.g. BATCH-101"
                              value={item.batchNumber}
                              onChange={(e) => {
                                const val = e.target.value;
                                setReceiveItems(prev => prev.map((it, i) => i === idx ? { ...it, batchNumber: val } : it));
                              }}
                            />
                          </td>
                          <td style={{ width: '140px' }}>
                            <input
                              type="date"
                              className="form-input"
                              value={item.expiryDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setReceiveItems(prev => prev.map((it, i) => i === idx ? { ...it, expiryDate: val } : it));
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="alert-info flex gap-2" style={{ alignItems: 'center', fontSize: '11px', borderRadius: '8px' }}>
                <Boxes size={16} /> Submitting this form automatically updates warehouse stock levels and records real-time STOCK_IN logs.
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsReceiveModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Complete Goods Receiving</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
