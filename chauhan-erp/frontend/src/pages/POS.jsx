import { useState, useEffect, useRef } from 'react';
import { salesApi, productApi, customerApi, warehouseApi } from '../api/index.js';
import BarcodeScannerModal from '../components/BarcodeScannerModal.jsx';
import {
  Search, Trash2, User, Building, MapPin, Receipt, Minimize2, Plus, Minus, CreditCard, Sparkles, Printer, X, Barcode
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function POS() {
  // Master lists
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // POS State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Post Checkout Print receipt
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);

  const barcodeRef = useRef(null);

  const fetchData = async () => {
    try {
      const custRes = await customerApi.getAll();
      setCustomers(custRes.data.data);
      if (custRes.data.data.length > 0) {
        setSelectedCustomerId(custRes.data.data[0].id);
      }

      const whRes = await warehouseApi.getAll();
      const activeWh = whRes.data.data.filter(w => w.status === 'ACTIVE');
      setWarehouses(activeWh);
      if (activeWh.length > 0) {
        setSelectedWarehouseId(activeWh[0].id);
      }

      const prodRes = await productApi.getAll();
      const pData = prodRes.data?.data;
      setProducts(Array.isArray(pData) ? pData : (pData?.products || []));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Quick Barcode/SKU matching
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    // Search product by barcode or SKU
    const match = products.find(
      p => p.barcode === barcodeInput.trim() || p.sku === barcodeInput.trim() || p.name.toLowerCase().includes(barcodeInput.trim().toLowerCase())
    );

    if (match) {
      addToCart(match);
      setBarcodeInput('');
    } else {
      toast.error('No matching product found.');
    }
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      updateQty(product.id, existing.quantity + 1);
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        quantity: 1,
        unitPrice: product.salesPrice,
        gstRate: product.gstRate,
        discount: 0
      }]);
      toast.success(`${product.name} added to cart`);
    }
  };

  const updateQty = (prodId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(prodId);
      return;
    }
    setCart(cart.map(item => item.productId === prodId ? { ...item, quantity: newQty } : item));
  };

  const removeFromCart = (prodId) => {
    setCart(cart.filter(item => item.productId !== prodId));
  };

  // Calculations
  const calculateCartTotals = () => {
    let subtotal = 0;
    let tax = 0;

    cart.forEach(item => {
      const sub = (item.quantity * item.unitPrice) - item.discount;
      const t = sub * (item.gstRate / 100);
      subtotal += sub;
      tax += t;
    });

    const discOverall = parseFloat(discount || 0);
    const net = Math.max(0, subtotal + tax - discOverall);
    return { subtotal, tax, net };
  };

  const { subtotal, tax, net } = calculateCartTotals();

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    if (!selectedCustomerId || !selectedWarehouseId) return toast.error('Select customer & warehouse');

    try {
      const payload = {
        customerId: selectedCustomerId,
        warehouseId: selectedWarehouseId,
        items: cart.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          gstRate: i.gstRate,
          discount: i.discount
        })),
        paidAmount: parseFloat(paidAmount || net),
        paymentMode,
        discount: parseFloat(discount || 0),
        isPOS: true
      };

      const res = await salesApi.createInvoice(payload);
      const createdInv = res.data.data;
      setLastInvoice(createdInv);
      setIsReceiptOpen(true);
      toast.success('Sales Invoice Created & Stock Reduced!');
      setCart([]);
      setPaidAmount('');
      setDiscount('0');
      setPaymentMode('CASH');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const currentCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="pos-container" style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: 'var(--space-6)', height: 'calc(100vh - 120px)' }}>
      
      {/* Left: Cart & Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflow: 'hidden' }}>
        
        {/* Top Control bar */}
        <div className="card" style={{ padding: 'var(--space-3)' }}>
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                ref={barcodeRef}
                className="form-control"
                style={{ paddingLeft: '36px' }}
                placeholder="Scan Barcode / SKU, or type product name & hit Enter..."
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                autoFocus
              />
            </div>
            <button type="button" className="btn btn-secondary flex-center" onClick={() => setIsScannerOpen(true)}>
              <Barcode size={16} /> Scan
            </button>
            <button type="submit" className="btn btn-primary">Add Item</button>
          </form>
        </div>

        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          title="POS Barcode Scanner"
          onScanSuccess={(prod) => {
            addToCart(prod);
          }}
        />

        {/* Cart Item list */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <div className="card-header" style={{ padding: 'var(--space-4)' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Receipt size={18} className="text-primary" /> Active Billing Cart ({cart.length} items)
            </h3>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-4) var(--space-4)' }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                <Sparkles size={48} style={{ marginBottom: 'var(--space-3)', opacity: 0.3 }} />
                <span>Ready to scan. Please scan item barcode or type SKU.</span>
              </div>
            ) : (
              <div className="table-container">
                <table className="table-xs" style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th>Product</th>
                      <th>Rate</th>
                      <th>Quantity</th>
                      <th>GST</th>
                      <th>Total</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.productId} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td>
                          <div className="font-semibold">{item.name}</div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>BC: {item.barcode || 'N/A'}</span>
                        </td>
                        <td>₹{item.unitPrice}</td>
                        <td>
                          <div className="flex gap-2" style={{ alignItems: 'center' }}>
                            <button className="btn btn-secondary btn-icon btn-sm" style={{ padding: 4 }} onClick={() => updateQty(item.productId, item.quantity - 1)}>
                              <Minus size={12} />
                            </button>
                            <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</span>
                            <button className="btn btn-secondary btn-icon btn-sm" style={{ padding: 4 }} onClick={() => updateQty(item.productId, item.quantity + 1)}>
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td>{item.gstRate}%</td>
                        <td className="font-bold">₹{((item.quantity * item.unitPrice) * (1 + item.gstRate/100)).toLocaleString()}</td>
                        <td>
                          <button className="btn btn-secondary btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeFromCart(item.productId)}>
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Checkout Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        
        {/* Warehouse & Customer Configuration */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="form-group">
            <label className="form-label-xs">Active Warehouse Location</label>
            <select className="form-control" value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(e.target.value)}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label-xs">Billing Customer</label>
            <select className="form-control" value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} - Bal: ₹{c.balance}</option>)}
            </select>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
          <h4 style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>Checkout summary</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', flex: 1, fontSize: '0.85rem' }}>
            <div className="flex justify-between">
              <span className="text-secondary">Subtotal (Before Tax):</span>
              <span className="font-semibold text-primary">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">GST collected:</span>
              <span className="font-semibold text-primary">+ ₹{tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="form-group">
              <label className="form-label-xs">Additional Discount (₹)</label>
              <input className="form-control form-control-sm" type="number" value={discount} onChange={e => setDiscount(e.target.value)} />
            </div>

            <hr style={{ border: 0, borderTop: '1px dashed var(--border)', margin: 'var(--space-2) 0' }} />
            
            <div className="flex justify-between" style={{ fontSize: '1.4rem' }}>
              <span className="text-primary font-bold">Total Net:</span>
              <span className="text-primary font-bold">₹{net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="form-group">
              <label className="form-label-xs">Select Payment Method</label>
              <select className="form-control" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank Transfer</option>
                <option value="UPI">UPI Payment</option>
                <option value="CARD">Debit / Credit Card</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label-xs">Amount Tendered (Paid amount)</label>
              <input className="form-control" type="number" placeholder={`Exact Amount: ₹${net}`} value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
            </div>

            {paidAmount && parseFloat(paidAmount) > net && (
              <div className="flex justify-between" style={{ fontSize: '1rem', color: 'var(--success)', marginTop: 'var(--space-2)' }}>
                <span className="font-bold">Refund Change:</span>
                <span className="font-bold">₹{(parseFloat(paidAmount) - net).toLocaleString()}</span>
              </div>
            )}
          </div>

          <button className="btn btn-primary btn-block" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)' }} onClick={handleCheckout}>
            <CreditCard size={18} style={{ marginRight: 8 }} /> Post POS Checkout
          </button>
        </div>
      </div>

      {/* PRINT RECEIPT POPUP MODAL */}
      {isReceiptOpen && lastInvoice && (
        <div className="modal-backdrop" style={{ background: 'rgba(0, 0, 0, 0.8)' }}>
          <div className="modal-content" style={{ maxWidth: '420px', padding: 'var(--space-6)', background: '#fff', color: '#000', borderRadius: 'var(--radius-md)', fontFamily: 'Courier New, monospace' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>CHAUHAN ENTERPRISES</h2>
              <p style={{ fontSize: '0.75rem' }}>123 Business Park, New Delhi, India</p>
              <p style={{ fontSize: '0.75rem' }}>GSTIN: 07AAAAA1111A1Z1</p>
              <p style={{ fontSize: '0.75rem' }}>Phone: +91 98765 43210</p>
            </div>

            <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: 'var(--space-4)', borderBottom: '1px dashed #000', paddingBottom: 'var(--space-4)' }}>
              <div><strong>Invoice No:</strong> {lastInvoice.invoiceNo}</div>
              <div><strong>Date:</strong> {new Date(lastInvoice.date).toLocaleString()}</div>
              <div><strong>Billing Cashier:</strong> {user?.name}</div>
              <div><strong>Customer:</strong> {currentCustomer?.name || 'Walk-in Customer'}</div>
            </div>

            {/* Receipt Table */}
            <div style={{ fontSize: '0.75rem', marginBottom: 'var(--space-4)', borderBottom: '1px dashed #000', paddingBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'between', fontWeight: 'bold', marginBottom: '4px' }}>
                <span style={{ flex: 2 }}>Item</span>
                <span style={{ flex: 0.5, textAlign: 'center' }}>Qty</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Price</span>
              </div>
              {lastInvoice.items?.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'between', marginBottom: '4px' }}>
                  <span style={{ flex: 2 }}>{products.find(p => p.id === item.productId)?.name}</span>
                  <span style={{ flex: 0.5, textAlign: 'center' }}>{item.quantity}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>₹{item.total.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', marginBottom: 'var(--space-6)' }}>
              <div>Subtotal: <strong>₹{lastInvoice.totalAmount.toLocaleString()}</strong></div>
              <div>GST Tax: <strong>+ ₹{lastInvoice.gstAmount.toLocaleString()}</strong></div>
              <div>Overall Discount: <strong>- ₹{lastInvoice.discount.toLocaleString()}</strong></div>
              <hr style={{ border: 0, borderTop: '1px solid #000', margin: '4px 0' }} />
              <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>Grand Total: ₹{lastInvoice.netAmount.toLocaleString()}</div>
              <div>Amount Tendered: <strong>₹{lastInvoice.paidAmount.toLocaleString()}</strong></div>
              <div>Change Given: <strong>₹{Math.max(0, lastInvoice.paidAmount - lastInvoice.netAmount).toLocaleString()}</strong></div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.75rem', borderTop: '1px dashed #000', paddingTop: 'var(--space-4)' }}>
              <p>Thank you for shopping with us!</p>
              <p>Please visit again.</p>
            </div>

            <div className="flex gap-2" style={{ marginTop: 'var(--space-6)', justifyContent: 'center' }} className="no-print">
              <button className="btn btn-secondary" style={{ color: '#000', borderColor: '#000' }} onClick={() => setIsReceiptOpen(false)}>Close Panel</button>
              <button className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
