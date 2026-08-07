import { useState, useEffect } from 'react';
import { reportApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  TrendingUp, ShoppingBag, Box, DollarSign, FileText, ArrowRight, Printer
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Reports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profit-loss');
  const [loading, setLoading] = useState(false);

  // States for different reports
  const [salesReport, setSalesReport] = useState(null);
  const [purchaseReport, setPurchaseReport] = useState(null);
  const [stockReport, setStockReport] = useState(null);
  const [gstReport, setGstReport] = useState(null);
  const [profitLossReport, setProfitLossReport] = useState(null);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sales') {
        const res = await reportApi.getSales();
        setSalesReport(res.data.data);
      } else if (activeTab === 'purchases') {
        const res = await reportApi.getPurchases();
        setPurchaseReport(res.data.data);
      } else if (activeTab === 'stock') {
        const res = await reportApi.getStock();
        setStockReport(res.data.data);
      } else if (activeTab === 'gst') {
        const res = await reportApi.getGst();
        setGstReport(res.data.data);
      } else if (activeTab === 'profit-loss') {
        const res = await reportApi.getProfitLoss();
        setProfitLossReport(res.data.data);
      }
    } catch {
      toast.error('Failed to load report analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeTab]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div className="flex justify-between" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="text-primary font-bold">Reports & Analytics</h1>
          <p className="text-secondary text-sm">Financial health indices, valuation trackers, and tax audits.</p>
        </div>
        <button className="btn btn-secondary" onClick={handlePrint}>
          <Printer size={16} /> Print Sheet
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs no-print" style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>
        {[
          { key: 'profit-loss', label: 'Profit & Loss Statement', icon: DollarSign },
          { key: 'sales', label: 'Sales Reports', icon: TrendingUp },
          { key: 'purchases', label: 'Purchase Reports', icon: ShoppingBag },
          { key: 'stock', label: 'Stock Valuation', icon: Box },
          { key: 'gst', label: 'GST Tax Ledger', icon: FileText }
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

      {/* Content wrapper */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            Generating ledger summary sheet...
          </div>
        ) : (
          <>
            {/* ── PROFIT & LOSS ── */}
            {activeTab === 'profit-loss' && profitLossReport && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                {/* Metric Summary Grid */}
                <div className="grid-4">
                  <div className="stat-card blue">
                    <div className="stat-icon blue"><TrendingUp size={24} /></div>
                    <div className="stat-body">
                      <span className="stat-label">Total Revenue</span>
                      <h3 className="stat-value">₹{profitLossReport.revenue.toLocaleString()}</h3>
                      <p className="stat-meta">Sales minus Sales Returns</p>
                    </div>
                  </div>
                  <div className="stat-card orange">
                    <div className="stat-icon orange"><ShoppingBag size={24} /></div>
                    <div className="stat-body">
                      <span className="stat-label">Cost of Purchases</span>
                      <h3 className="stat-value">₹{profitLossReport.purchaseCost.toLocaleString()}</h3>
                      <p className="stat-meta">Bills minus Purchase Returns</p>
                    </div>
                  </div>
                  <div className="stat-card red">
                    <div className="stat-icon red"><DollarSign size={24} /></div>
                    <div className="stat-body">
                      <span className="stat-label">Operating Expenses</span>
                      <h3 className="stat-value">₹{profitLossReport.expenses.toLocaleString()}</h3>
                      <p className="stat-meta">Total logged expenditures</p>
                    </div>
                  </div>
                  <div className="stat-card green">
                    <div className="stat-icon green"><TrendingUp size={24} /></div>
                    <div className="stat-body">
                      <span className="stat-label">Net Profit</span>
                      <h3 className="stat-value" style={{ color: profitLossReport.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        ₹{profitLossReport.netProfit.toLocaleString()}
                      </h3>
                      <p className="stat-meta">Take-home net earnings</p>
                    </div>
                  </div>
                </div>

                {/* Analytical Card */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Profitability Analysis Summary</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="flex justify-between" style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)' }}>
                      <span>Gross Sales Revenues (+)</span>
                      <span className="font-semibold text-success">₹{profitLossReport.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between" style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)' }}>
                      <span>Cost of Goods Purchased (-)</span>
                      <span className="font-semibold text-primary">₹{profitLossReport.purchaseCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between" style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)', fontSize: '1.05rem' }}>
                      <strong>Gross Operating Profit (=)</strong>
                      <strong className="text-primary">₹{profitLossReport.grossProfit.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between" style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)' }}>
                      <span>General & Administrative Expenses (-)</span>
                      <span className="font-semibold" style={{ color: 'var(--danger)' }}>₹{profitLossReport.expenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between" style={{ padding: 'var(--space-3) 0', fontSize: '1.25rem' }}>
                      <span className="text-primary font-bold">Estimated Net Profit (=)</span>
                      <span className="font-bold" style={{ color: profitLossReport.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        ₹{profitLossReport.netProfit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── SALES REPORT ── */}
            {activeTab === 'sales' && salesReport && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div className="grid-3">
                  <div className="stat-card blue">
                    <div className="stat-body">
                      <span className="stat-label">Net Sales Value</span>
                      <h3 className="stat-value">₹{salesReport.summary.totalSalesValue.toLocaleString()}</h3>
                    </div>
                  </div>
                  <div className="stat-card green">
                    <div className="stat-body">
                      <span className="stat-label">Tax Collected</span>
                      <h3 className="stat-value">₹{salesReport.summary.totalTaxCollected.toLocaleString()}</h3>
                    </div>
                  </div>
                  <div className="stat-card red">
                    <div className="stat-body">
                      <span className="stat-label">Invoices Count</span>
                      <h3 className="stat-value">{salesReport.summary.totalInvoiceCount} Bills</h3>
                    </div>
                  </div>
                </div>

                <div className="grid-2" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
                  <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Invoices Ledger</h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Invoice No</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Paid Amount</th>
                            <th>Net Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesReport.invoices.map((inv, i) => (
                            <tr key={i}>
                              <td className="font-semibold">{inv.invoiceNo}</td>
                              <td>{new Date(inv.date).toLocaleDateString()}</td>
                              <td>{inv.customer?.name}</td>
                              <td className="text-success">₹{inv.paidAmount.toLocaleString()}</td>
                              <td className="text-primary font-bold">₹{inv.netAmount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Sales by Customer</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {Object.entries(salesReport.customerSales).map(([cust, val], idx) => (
                        <div key={idx} className="flex justify-between" style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                          <span className="text-secondary">{cust}</span>
                          <strong className="text-primary">₹{val.toLocaleString()}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── PURCHASE REPORT ── */}
            {activeTab === 'purchases' && purchaseReport && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div className="grid-3">
                  <div className="stat-card orange">
                    <div className="stat-body">
                      <span className="stat-label">Total Bills Value</span>
                      <h3 className="stat-value">₹{purchaseReport.summary.totalPurchaseValue.toLocaleString()}</h3>
                    </div>
                  </div>
                  <div className="stat-card blue">
                    <div className="stat-body">
                      <span className="stat-label">GST Tax Inward</span>
                      <h3 className="stat-value">₹{purchaseReport.summary.totalTaxPaid.toLocaleString()}</h3>
                    </div>
                  </div>
                  <div className="stat-card red">
                    <div className="stat-body">
                      <span className="stat-label">Bills Count</span>
                      <h3 className="stat-value">{purchaseReport.summary.totalInvoiceCount} Bills</h3>
                    </div>
                  </div>
                </div>

                <div className="grid-2" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
                  <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Purchase Ledger</h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Bill No</th>
                            <th>Date</th>
                            <th>Supplier</th>
                            <th>Paid Amount</th>
                            <th>Net Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchaseReport.invoices.map((inv, i) => (
                            <tr key={i}>
                              <td className="font-semibold">{inv.billNo}</td>
                              <td>{new Date(inv.date).toLocaleDateString()}</td>
                              <td>{inv.vendor?.name}</td>
                              <td className="text-success">₹{inv.paidAmount.toLocaleString()}</td>
                              <td className="text-primary font-bold">₹{inv.netAmount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Purchases by Vendor</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {Object.entries(purchaseReport.vendorPurchases).map(([vend, val], idx) => (
                        <div key={idx} className="flex justify-between" style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                          <span className="text-secondary">{vend}</span>
                          <strong className="text-primary">₹{val.toLocaleString()}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── STOCK VALUATION ── */}
            {activeTab === 'stock' && stockReport && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div className="grid-3">
                  <div className="stat-card blue">
                    <div className="stat-body">
                      <span className="stat-label">Total Units Stocked</span>
                      <h3 className="stat-value">{stockReport.summary.totalQuantity.toLocaleString()} Units</h3>
                    </div>
                  </div>
                  <div className="stat-card orange">
                    <div className="stat-body">
                      <span className="stat-label">Valuation (at Purchase Price)</span>
                      <h3 className="stat-value">₹{stockReport.summary.totalValuationAtPurchasePrice.toLocaleString()}</h3>
                    </div>
                  </div>
                  <div className="stat-card green">
                    <div className="stat-body">
                      <span className="stat-label">Valuation (at Sales Price)</span>
                      <h3 className="stat-value">₹{stockReport.summary.totalValuationAtSalesPrice.toLocaleString()}</h3>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Stock Valuation Ledger</h3>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Warehouse</th>
                          <th>Product Name</th>
                          <th>SKU</th>
                          <th>Quantity</th>
                          <th>Purchase Price</th>
                          <th>Valuation (Cost)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockReport.stocks.map((row, i) => (
                          <tr key={i}>
                            <td className="font-semibold">{row.warehouse?.name}</td>
                            <td className="font-semibold">{row.product?.name}</td>
                            <td>{row.product?.sku || 'N/A'}</td>
                            <td>{row.quantity}</td>
                            <td>₹{row.product?.purchasePrice}</td>
                            <td className="text-primary font-bold">₹{(row.quantity * row.product?.purchasePrice).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── GST LEDGER ── */}
            {activeTab === 'gst' && gstReport && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div className="grid-3">
                  <div className="stat-card green">
                    <div className="stat-body">
                      <span className="stat-label">Output GST (Collected)</span>
                      <h3 className="stat-value">₹{gstReport.summary.totalGstCollected.toLocaleString()}</h3>
                    </div>
                  </div>
                  <div className="stat-card orange">
                    <div className="stat-body">
                      <span className="stat-label">Input GST (Paid)</span>
                      <h3 className="stat-value">₹{gstReport.summary.totalGstPaid.toLocaleString()}</h3>
                    </div>
                  </div>
                  <div className="stat-card blue">
                    <div className="stat-body">
                      <span className="stat-label">Net GST Liability</span>
                      <h3 className="stat-value" style={{ color: gstReport.summary.netGstLiability >= 0 ? 'var(--danger)' : 'var(--success)' }}>
                        ₹{gstReport.summary.netGstLiability.toLocaleString()}
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>GST Output (Collected on Sales)</h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Invoice No</th>
                            <th>Date</th>
                            <th>GST Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gstReport.salesInvoices.map((row, i) => (
                            <tr key={i}>
                              <td className="font-semibold">{row.invoiceNo}</td>
                              <td>{new Date(row.date).toLocaleDateString()}</td>
                              <td className="text-success font-bold">₹{row.gstAmount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>GST Input (Paid on Purchases)</h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Bill No</th>
                            <th>Date</th>
                            <th>GST Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gstReport.purchaseInvoices.map((row, i) => (
                            <tr key={i}>
                              <td className="font-semibold">{row.billNo}</td>
                              <td>{new Date(row.date).toLocaleDateString()}</td>
                              <td className="text-primary font-bold">₹{row.gstAmount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
