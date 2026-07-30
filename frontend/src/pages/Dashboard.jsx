import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { m1Api } from '../api/index.js';
import {
  Box, DollarSign, AlertTriangle, Layers, RefreshCw, ArrowRight,
  TrendingUp, ArrowUpRight, ArrowDownRight, Activity, Warehouse,
  Plus, Barcode, FileText, ShieldCheck, CheckCircle2, Package, Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await m1Api.getDashboardStats();
      setStats(res.data?.data || null);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const kpis = [
    {
      label: 'Total Products',
      value: stats ? stats.totalProducts : 0,
      unit: 'Items Catalog',
      meta: stats ? `${stats.activeProducts} Active items` : '0 Active',
      icon: Box,
      accent: 'var(--primary)',
      glow: 'rgba(79, 110, 247, 0.15)',
      link: '/products'
    },
    {
      label: 'Inventory Valuation',
      value: stats ? `₹${(stats.inventoryValue || 0).toLocaleString('en-IN')}` : '₹0',
      unit: 'Cost Value',
      meta: stats ? `Retail Value: ₹${(stats.inventoryRetailValue || 0).toLocaleString('en-IN')}` : '',
      icon: DollarSign,
      accent: 'var(--success)',
      glow: 'rgba(16, 185, 129, 0.15)',
      link: '/inventory'
    },
    {
      label: 'Low Stock Alerts',
      value: stats ? stats.lowStockCount : 0,
      unit: 'Products',
      meta: stats?.lowStockCount > 0 ? 'Action required immediately' : 'All stock levels healthy',
      icon: AlertTriangle,
      accent: stats?.lowStockCount > 0 ? 'var(--danger)' : 'var(--success)',
      glow: stats?.lowStockCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
      link: '/low-stock'
    },
    {
      label: 'Near Expiry / Expired',
      value: stats ? (stats.nearExpiryBatchCount + stats.expiredBatchCount) : 0,
      unit: 'Batches',
      meta: stats ? `${stats.expiredBatchCount} Expired • ${stats.nearExpiryBatchCount} Expiring Soon` : '',
      icon: Layers,
      accent: stats?.expiredBatchCount > 0 ? 'var(--warning)' : 'var(--accent)',
      glow: stats?.expiredBatchCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(124, 58, 237, 0.15)',
      link: '/batch-expiry'
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Top Hero Greeting Banner ─────────────────────────────── */}
      <div className="card border-0" style={{
        background: 'linear-gradient(135deg, rgba(79, 110, 247, 0.12) 0%, rgba(124, 58, 237, 0.08) 100%)',
        border: '1px solid rgba(79, 110, 247, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow orb background effect */}
        <div style={{
          position: 'absolute',
          right: '-50px',
          top: '-50px',
          width: '220px',
          height: '220px',
          background: 'radial-gradient(circle, rgba(79, 110, 247, 0.25) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-primary flex items-center gap-1 text-xs">
                <Sparkles size={12} /> Module 1: Inventory Foundation
              </span>
              <span className="text-xs text-muted font-mono">{time}</span>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Welcome back, {user?.name || 'Manager'}
            </h1>
            <p className="text-sm text-secondary mt-0.5">
              Live inventory overview across warehouses & automated tracking engines
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchDashboardStats}
              disabled={loading}
              className="btn btn-secondary btn-sm flex items-center gap-2"
              title="Refresh dashboard data"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => navigate('/inventory')}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              <Plus size={14} /> Stock Operations
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick Action Shortcuts ───────────────────────────────── */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Quick Actions:</span>
        <Link to="/low-stock" className="badge hover:bg-danger/20 transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <AlertTriangle size={13} /> Low Stock Screen
        </Link>
        <Link to="/batch-expiry" className="badge hover:bg-warning/20 transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <Layers size={13} /> Batch Expiry Manager
        </Link>
        <Link to="/barcode-print" className="badge hover:bg-accent/20 transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs" style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent)', border: '1px solid rgba(124, 58, 237, 0.3)' }}>
          <Barcode size={13} /> Barcode Print Engine
        </Link>
        <Link to="/tax-master" className="badge hover:bg-success/20 transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <FileText size={13} /> Tax & HSN Master
        </Link>
        <Link to="/roles" className="badge hover:bg-primary/20 transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)', border: '1px solid var(--primary-glow)' }}>
          <ShieldCheck size={13} /> Roles & RBAC Matrix
        </Link>
      </div>

      {/* ── KPI Cards Grid ───────────────────────────────────────── */}
      <div className="grid-4">
        {kpis.map((kpi, idx) => {
          const IconComponent = kpi.icon;
          return (
            <div
              key={idx}
              onClick={() => navigate(kpi.link)}
              className="card cursor-pointer transition-all hover:-translate-y-1"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Card top accent line */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: kpi.accent }} />

              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">{kpi.label}</span>
                <div style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  background: kpi.glow,
                  color: kpi.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <IconComponent size={18} />
                </div>
              </div>

              <div className="mb-2">
                <h2 className="font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>
                  {loading ? <span className="animate-pulse opacity-50">...</span> : kpi.value}
                </h2>
                <span className="text-xs text-muted font-medium">{kpi.unit}</span>
              </div>

              <div className="pt-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)' }}>
                <span className="text-secondary font-medium truncate" style={{ maxWidth: '80%' }}>{kpi.meta}</span>
                <ArrowRight size={13} style={{ color: kpi.accent }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Charts & Master Summary Row ──────────────────────────── */}
      <div className="grid-3" style={{ gridTemplateColumns: '2fr 1.2fr' }}>
        {/* Inventory Stock Trend / Health Chart */}
        <div className="card flex flex-col justify-between" style={{ minHeight: '340px' }}>
          <div className="card-header flex items-center justify-between">
            <div>
              <h3 className="card-title text-base font-semibold">Inventory Valuation & Health</h3>
              <p className="card-subtitle text-xs text-muted">Stock catalog distribution & threshold analysis</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)', fontSize: '0.7rem' }}>Valuation Trend</span>
            </div>
          </div>

          {/* Custom Responsive SVG Chart */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: '200px', padding: '10px 0' }}>
            <svg viewBox="0 0 500 180" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="valGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35"/>
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0"/>
                </linearGradient>
                <linearGradient id="healthyGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--success)" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="var(--success)" stopOpacity="0.0"/>
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="160" x2="500" y2="160" stroke="var(--border)" strokeWidth="1" />
              <line x1="0" y1="110" x2="500" y2="110" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="60" x2="500" y2="60" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />

              {/* Area 1: Purchase Value Area */}
              <path
                d="M 0 160 Q 70 120 140 90 T 280 50 T 420 75 T 500 25 L 500 160 L 0 160 Z"
                fill="url(#valGlow)"
              />
              {/* Path 1: Primary line */}
              <path
                d="M 0 160 Q 70 120 140 90 T 280 50 T 420 75 T 500 25"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Data points */}
              <circle cx="140" cy="90" r="4" fill="var(--primary)" stroke="var(--bg-card)" strokeWidth="2" />
              <circle cx="280" cy="50" r="4" fill="var(--primary)" stroke="var(--bg-card)" strokeWidth="2" />
              <circle cx="420" cy="75" r="4" fill="var(--primary)" stroke="var(--bg-card)" strokeWidth="2" />
              <circle cx="500" cy="25" r="5" fill="var(--primary)" stroke="#fff" strokeWidth="2" />

              {/* Labels */}
              <text x="140" y="175" fill="var(--text-muted)" fontSize="10" textAnchor="middle">Q1 Catalog</text>
              <text x="280" y="175" fill="var(--text-muted)" fontSize="10" textAnchor="middle">Q2 Inbound</text>
              <text x="420" y="175" fill="var(--text-muted)" fontSize="10" textAnchor="middle">Q3 Valuation</text>
              <text x="495" y="175" fill="var(--text-muted)" fontSize="10" textAnchor="end">Live Status</text>
            </svg>
          </div>

          <div className="flex items-center justify-between pt-3 border-t text-xs text-secondary" style={{ borderColor: 'var(--border)' }}>
            <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} /> Total Cost Valuation</span>
            <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} /> Retail Valuation</span>
          </div>
        </div>

        {/* Master Catalog Breakdown */}
        <div className="card flex flex-col justify-between" style={{ minHeight: '340px' }}>
          <div>
            <div className="card-header mb-4">
              <h3 className="card-title text-base font-semibold">Storage & Master Metrics</h3>
              <p className="card-subtitle text-xs text-muted">Outlets, Categories & Mappings</p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                    <Warehouse size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-primary">Active Warehouses</h4>
                    <p className="text-xs text-muted">Central, Retail & Cold Storage</p>
                  </div>
                </div>
                <span className="text-xl font-bold" style={{ color: 'var(--info)' }}>
                  {loading ? '...' : (stats?.totalWarehouses || 0)}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                    <Package size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-primary">Categories & Brands</h4>
                    <p className="text-xs text-muted">Product Taxonomy</p>
                  </div>
                </div>
                <span className="text-xl font-bold" style={{ color: 'var(--success)' }}>
                  {loading ? '...' : ((stats?.totalCategories || 0) + (stats?.totalBrands || 0))}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}>
                    <Layers size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-primary">Warehouse Mappings</h4>
                    <p className="text-xs text-muted">Stock Per Outlet Records</p>
                  </div>
                </div>
                <span className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
                  {loading ? '...' : (stats?.warehouseStockRecords || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t text-xs flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-muted">Module 1 Foundation Ready</span>
            <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
          </div>
        </div>
      </div>

      {/* ── Real-Time Stock Movement Audit Log ─────────────────────── */}
      <div className="card">
        <div className="card-header flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={18} style={{ color: 'var(--primary)' }} />
            <div>
              <h3 className="card-title text-base font-semibold">Latest Stock Movements</h3>
              <p className="card-subtitle text-xs text-muted">Audited transactions across all warehouses</p>
            </div>
          </div>
          <Link to="/inventory" className="btn btn-secondary btn-sm flex items-center gap-1" style={{ fontSize: '0.75rem' }}>
            Full Inventory History <ArrowRight size={13} />
          </Link>
        </div>

        {!stats?.recentTransactions || stats.recentTransactions.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            No recent stock movement logs found.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Movement Type</th>
                  <th>Quantity</th>
                  <th>Warehouse</th>
                  <th>Logged By</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentTransactions.map((tx) => {
                  const isIncoming = ['STOCK_IN', 'PURCHASE'].includes(tx.type) || (tx.type === 'STOCK_ADJUSTMENT' && tx.toWarehouseId);

                  return (
                    <tr key={tx.id}>
                      <td>
                        <div>
                          <div className="font-semibold text-primary">{tx.product?.name || 'Product'}</div>
                          <div className="text-xs text-muted font-mono">{tx.product?.sku || '—'}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          tx.type === 'STOCK_IN' ? 'badge-success' :
                          tx.type === 'STOCK_OUT' ? 'badge-danger' :
                          tx.type === 'STOCK_TRANSFER' ? 'badge-info' : 'badge-warning'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td>
                        <span className={`font-bold flex items-center gap-1 ${isIncoming ? 'text-success' : 'text-danger'}`}>
                          {isIncoming ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                          {isIncoming ? '+' : '-'}{tx.quantity}
                        </span>
                      </td>
                      <td className="text-secondary text-sm">
                        {tx.toWarehouse?.name || tx.fromWarehouse?.name || '—'}
                      </td>
                      <td className="text-muted text-xs">
                        {tx.createdBy?.name || 'System User'}
                      </td>
                      <td className="text-muted text-xs">
                        {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
