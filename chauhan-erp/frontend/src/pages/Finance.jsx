import { useState, useEffect } from 'react';
import { financeApi, customerApi, vendorApi, companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  TrendingUp, TrendingDown, BookOpen, Coffee, Plus, DollarSign, ArrowUpRight, ArrowDownLeft, X, Save, MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Finance() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('cash-book');
  const [loading, setLoading] = useState(false);

  // Master lists
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [branches, setBranches] = useState([]);

  // Data lists
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cashBook, setCashBook] = useState([]);
  const [bankBook, setBankBook] = useState([]);

  // Modal toggles
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);

  // Selected Branch for Form
  const [selectedBranchId, setSelectedBranchId] = useState(user?.branchId || '');

  // Payment Form
  const [paymentType, setPaymentType] = useState('PAYMENT_IN'); // PAYMENT_IN or PAYMENT_OUT
  const [paymentCategory, setPaymentCategory] = useState('CUSTOMER'); // CUSTOMER or VENDOR or OTHER
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('CASH');
  const [payRefNo, setPayRefNo] = useState('');
  const [payDesc, setPayDesc] = useState('');
  const [payCustomerId, setPayCustomerId] = useState('');
  const [payVendorId, setPayVendorId] = useState('');

  // Expense Form
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState('RENT'); // RENT, SALARY, UTILITIES, TRAVEL, MARKETING, OTHER
  const [expAmount, setExpAmount] = useState('');
  const [expMode, setExpMode] = useState('CASH');
  const [expDesc, setExpDesc] = useState('');

  const fetchMasterData = async () => {
    try {
      const custRes = await customerApi.getAll();
      setCustomers(custRes.data.data || []);
      const vendRes = await vendorApi.getAll();
      setVendors(vendRes.data.data || []);
      const branchRes = await companyApi.getBranches();
      if (branchRes.data?.data) {
        setBranches(branchRes.data.data);
        if (!selectedBranchId && branchRes.data.data.length > 0) {
          setSelectedBranchId(user?.branchId || branchRes.data.data[0].id);
        }
      }

      if (custRes.data.data?.length > 0) setPayCustomerId(custRes.data.data[0].id);
      if (vendRes.data.data?.length > 0) setPayVendorId(vendRes.data.data[0].id);
    } catch { /* ignore */ }
  };

  const fetchFinancials = async () => {
    setLoading(true);
    try {
      if (activeTab === 'cash-book') {
        const res = await financeApi.getCashBook();
        setCashBook(res.data.data);
      } else if (activeTab === 'bank-book') {
        const res = await financeApi.getBankBook();
        setBankBook(res.data.data);
      } else if (activeTab === 'payments') {
        const res = await financeApi.getPayments();
        setPayments(res.data.data);
      } else if (activeTab === 'expenses') {
        const res = await financeApi.getExpenses();
        setExpenses(res.data.data);
      }
    } catch {
      toast.error('Failed to load financial book record');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    fetchFinancials();
  }, [activeTab]);

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) return toast.error('Amount must be positive');

    try {
      await financeApi.createPayment({
        type: paymentType,
        category: paymentCategory,
        amount: amt,
        paymentMode: payMode,
        referenceNo: payRefNo,
        description: payDesc,
        customerId: paymentCategory === 'CUSTOMER' ? payCustomerId : null,
        vendorId: paymentCategory === 'VENDOR' ? payVendorId : null,
        branchId: selectedBranchId || user?.branchId
      });

      toast.success('Payment recorded successfully');
      setIsPaymentOpen(false);
      // Reset
      setPayAmount('');
      setPayRefNo('');
      setPayDesc('');
      fetchFinancials();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) return toast.error('Amount must be positive');

    try {
      await financeApi.createExpense({
        title: expTitle,
        category: expCategory,
        amount: amt,
        paymentMode: expMode,
        description: expDesc,
        branchId: selectedBranchId || user?.branchId
      });

      toast.success('Expense recorded successfully');
      setIsExpenseOpen(false);
      // Reset
      setExpTitle('');
      setExpAmount('');
      setExpDesc('');
      fetchFinancials();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log expense');
    }
  };

  // Adjust category automatically based on payment type
  const handlePaymentTypeChange = (type) => {
    setPaymentType(type);
    if (type === 'PAYMENT_IN') {
      setPaymentCategory('CUSTOMER');
    } else {
      setPaymentCategory('VENDOR');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div className="flex justify-between" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="text-primary font-bold">Financial Ledger</h1>
          <p className="text-secondary text-sm">Manage receipts, customer dues, vendor payouts, and operational expenses.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setIsExpenseOpen(true)}>
            <Coffee size={16} /> Log Expense
          </button>
          <button className="btn btn-primary" onClick={() => setIsPaymentOpen(true)}>
            <DollarSign size={16} /> Record Payment Transaction
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>
        {[
          { key: 'cash-book', label: 'Cash Book', icon: BookOpen },
          { key: 'bank-book', label: 'Bank Book', icon: BookOpen },
          { key: 'payments', label: 'Payments Trail', icon: ArrowUpRight },
          { key: 'expenses', label: 'Expenses Ledger', icon: Coffee }
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
          <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-secondary)' }}>Loading ledger trails...</div>
        ) : (
          <div className="table-container">
            <table>
              {['cash-book', 'bank-book', 'payments'].includes(activeTab) && (
                <>
                  <thead>
                    <tr>
                      <th>Payment No</th>
                      <th>Date</th>
                      <th>Branch</th>
                      <th>Type</th>
                      <th>Party/Category</th>
                      <th>Payment Mode</th>
                      <th>Amount</th>
                      <th>Ref/Invoice No</th>
                      <th>Logged By</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeTab === 'cash-book' ? cashBook : activeTab === 'bank-book' ? bankBook : payments).map(row => (
                      <tr key={row.id}>
                        <td className="font-semibold">{row.paymentNo}</td>
                        <td>{new Date(row.date).toLocaleString()}</td>
                        <td>
                          <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                            {row.branch?.name || row.branch?.code || 'Main HQ'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${row.type === 'PAYMENT_IN' ? 'badge-success' : 'badge-danger'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {row.type === 'PAYMENT_IN' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                            {row.type === 'PAYMENT_IN' ? 'RECEIPT' : 'PAYOUT'}
                          </span>
                        </td>
                        <td>
                          <div className="font-semibold">{row.category}</div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {row.customer?.name || row.vendor?.name || row.expense?.title || 'General'}
                          </span>
                        </td>
                        <td>{row.paymentMode}</td>
                        <td className={`font-bold ${row.type === 'PAYMENT_IN' ? 'text-success' : 'text-primary'}`}>
                          {row.type === 'PAYMENT_IN' ? '+' : '-'} ₹{row.amount.toLocaleString()}
                        </td>
                        <td>{row.referenceNo || 'N/A'}</td>
                        <td>
                          <span className="text-xs text-secondary font-semibold">
                            {row.createdBy?.name || 'System User'}
                          </span>
                        </td>
                        <td>{row.description || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {activeTab === 'expenses' && (
                <>
                  <thead>
                    <tr>
                      <th>Expense No</th>
                      <th>Date</th>
                      <th>Branch</th>
                      <th>Expense Item</th>
                      <th>Expense Category</th>
                      <th>Payment Mode</th>
                      <th>Amount</th>
                      <th>Logged By</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(row => (
                      <tr key={row.id}>
                        <td className="font-semibold">{row.expenseNo}</td>
                        <td>{new Date(row.date).toLocaleDateString()}</td>
                        <td>
                          <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                            {row.branch?.name || row.branch?.code || 'Main HQ'}
                          </span>
                        </td>
                        <td className="font-bold">{row.title}</td>
                        <td><span className="badge badge-warning">{row.category}</span></td>
                        <td>{row.paymentMode}</td>
                        <td className="text-primary font-bold">₹{row.amount.toLocaleString()}</td>
                        <td>
                          <span className="text-xs text-secondary font-semibold">
                            {row.createdBy?.name || 'System User'}
                          </span>
                        </td>
                        <td>{row.description || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        )}
      </div>

      {/* RECORD PAYMENT MODAL */}
      {isPaymentOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title">Record Payment</h3>
              <button className="btn-close" onClick={() => setIsPaymentOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Branch Location</label>
                  <select className="form-control" value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Payment Direction</label>
                <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                  <label className="flex gap-2" style={{ cursor: 'pointer', alignItems: 'center' }}>
                    <input type="radio" name="payType" checked={paymentType === 'PAYMENT_IN'} onChange={() => handlePaymentTypeChange('PAYMENT_IN')} />
                    Receipt (Payment In)
                  </label>
                  <label className="flex gap-2" style={{ cursor: 'pointer', alignItems: 'center' }}>
                    <input type="radio" name="payType" checked={paymentType === 'PAYMENT_OUT'} onChange={() => handlePaymentTypeChange('PAYMENT_OUT')} />
                    Payout (Payment Out)
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-control" value={paymentCategory} onChange={e => setPaymentCategory(e.target.value)}>
                  {paymentType === 'PAYMENT_IN' ? (
                    <>
                      <option value="CUSTOMER">Customer Collection</option>
                      <option value="OTHER">Other Income</option>
                    </>
                  ) : (
                    <>
                      <option value="VENDOR">Vendor Payment</option>
                      <option value="OTHER">Other Outflow</option>
                    </>
                  )}
                </select>
              </div>

              {paymentCategory === 'CUSTOMER' && (
                <div className="form-group">
                  <label className="form-label">Customer</label>
                  <select className="form-control" value={payCustomerId} onChange={e => setPayCustomerId(e.target.value)} required>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} - (Balance: ₹{c.balance})</option>)}
                  </select>
                </div>
              )}

              {paymentCategory === 'VENDOR' && (
                <div className="form-group">
                  <label className="form-label">Supplier / Vendor</label>
                  <select className="form-control" value={payVendorId} onChange={e => setPayVendorId(e.target.value)} required>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name} - (Balance: ₹{v.balance})</option>)}
                  </select>
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Amount (₹)</label>
                  <input className="form-control" type="number" step="any" value={payAmount} onChange={e => setPayAmount(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Mode</label>
                  <select className="form-control" value={payMode} onChange={e => setPayMode(e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Debit / Credit Card</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reference No (Invoice/Bill details)</label>
                <input className="form-control" type="text" value={payRefNo} onChange={e => setPayRefNo(e.target.value)} placeholder="e.g. INV-1234, CHQ-7889" />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Remarks</label>
                <textarea className="form-control" rows="2" value={payDesc} onChange={e => setPayDesc(e.target.value)} placeholder="Ledger remark..."></textarea>
              </div>

              <div className="modal-footer" style={{ marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} style={{ marginRight: 8 }} /> Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOG EXPENSE MODAL */}
      {isExpenseOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title">Log Expense</h3>
              <button className="btn-close" onClick={() => setIsExpenseOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Branch Location</label>
                  <select className="form-control" value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Expense Title</label>
                <input className="form-control" type="text" value={expTitle} onChange={e => setExpTitle(e.target.value)} placeholder="e.g. Office Rent, Jan Salary, Electricity bill" required />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Expense Category</label>
                  <select className="form-control" value={expCategory} onChange={e => setExpCategory(e.target.value)}>
                    <option value="RENT">Rent / Lease</option>
                    <option value="SALARY">Salary / Wage</option>
                    <option value="UTILITIES">Utilities (Water, Power, Net)</option>
                    <option value="TRAVEL">Travel / Lodging</option>
                    <option value="MARKETING">Marketing & Advert</option>
                    <option value="OTHER">Other Misc Expense</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-control" value={expMode} onChange={e => setExpMode(e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Debit / Credit Card</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Expense Amount (₹)</label>
                <input className="form-control" type="number" step="any" value={expAmount} onChange={e => setExpAmount(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Remarks</label>
                <textarea className="form-control" rows="2" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Attach bills details or descriptions..."></textarea>
              </div>

              <div className="modal-footer" style={{ marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsExpenseOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} style={{ marginRight: 8 }} /> Log Expense Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
