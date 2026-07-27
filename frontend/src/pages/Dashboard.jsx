import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { productApi, inventoryApi, warehouseApi } from '../api/index.js';
import { TrendingUp, ShoppingBag, Box, DollarSign, Activity, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, hasPermission, isAdmin } = useAuth();
  const [metrics, setMetrics] = useState({ totalProducts: 0, lowStockCount: 0, totalStockUnits: 0 });
  const [lowStockList, setLowStockList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [pRes, lowRes] = await Promise.all([
          productApi.getAll(),
          inventoryApi.getLowStock()
        ]);

        const prods = pRes.data.data || [];
        const lowItems = lowRes.data.data || [];

        const totalUnits = prods.reduce((sum, p) => sum + (Number(p.currentStock) || 0), 0);

        setMetrics({
          totalProducts: prods.length,
          lowStockCount: lowItems.length,
          totalStockUnits: totalUnits
        });
        setLowStockList(lowItems.slice(0, 5));
      } catch {
        /* fallback to defaults */
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // Metric cards with module-level permission rules
  const allStats = [
    { label: 'Total Products', value: metrics.totalProducts ? `${metrics.totalProducts} Items` : '0 Items', icon: Box, change: `${metrics.totalStockUnits} Total Stock Units`, color: 'blue', permission: 'products' },
    { label: 'Low Stock Alerts', value: `${metrics.lowStockCount} Items`, icon: AlertTriangle, change: metrics.lowStockCount > 0 ? 'Requires immediate reorder' : 'All stock levels healthy', color: metrics.lowStockCount > 0 ? 'red' : 'green', permission: 'inventory' },
    { label: 'Sales Overview', value: 'Module 2 Ready', icon: TrendingUp, change: 'Phase 2 POS & GST Billing', color: 'orange', permission: 'sales' },
    { label: 'Purchase Overview', value: 'Module 2 Ready', icon: ShoppingBag, change: 'Phase 2 Purchase Orders', color: 'green', permission: 'purchases' },
  ];

  const visibleStats = allStats.filter(stat => isAdmin || hasPermission(stat.permission));

  const recentActivities = [
    { description: 'Super Admin created Chauhan Enterprises Company profile', time: '10 mins ago', type: 'system' },
    { description: 'New branch Code "HQ" added to Chauhan Enterprises', time: '1 hour ago', type: 'company' },
    { description: 'Active financial year set to FY 2026-27', time: '2 hours ago', type: 'financial' },
    { description: 'Logged in session active', time: '4 hours ago', type: 'auth' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Welcome Banner */}
      <div>
        <h1 className="text-primary font-bold">Dashboard</h1>
        <p className="text-secondary text-sm">Welcome back, <strong>{user?.name || 'User'}</strong>. Here is your business overview today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid-4" style={{ gridTemplateColumns: `repeat(${Math.max(visibleStats.length, 1)}, minmax(0, 1fr))` }}>
        {visibleStats.map((stat, i) => (
          <div key={i} className={`stat-card ${stat.color}`}>
            <div className={`stat-icon ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div className="stat-body">
              <span className="stat-label">{stat.label}</span>
              <h3 className="stat-value">{stat.value}</h3>
              <p className="stat-meta">{stat.change}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Sections: Charts and Activities */}
      <div className="grid-3" style={{ gridTemplateColumns: '2fr 1.2fr' }}>
        {/* SVG charts & reports */}
        <div className="card" style={{ minHeight: '320px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Sales & Purchase Analysis</h3>
              <p className="card-subtitle">Monthly overview of current financial year</p>
            </div>
            <div className="flex gap-2">
              <span className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>Sales</span>
              <span className="btn btn-secondary btn-sm">Purchases</span>
            </div>
          </div>

          {/* Premium Custom SVG Chart */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: '200px' }}>
            <svg viewBox="0 0 500 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0"/>
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="180" x2="500" y2="180" stroke="var(--border)" strokeWidth="1" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="60" x2="500" y2="60" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />

              {/* Area Under Sales Path */}
              <path
                d="M 0 180 Q 80 140 120 120 T 240 60 T 360 80 T 500 30 L 500 180 L 0 180 Z"
                fill="url(#chartGlow)"
              />

              {/* Sales Line */}
              <path
                d="M 0 180 Q 80 140 120 120 T 240 60 T 360 80 T 500 30"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Points */}
              <circle cx="120" cy="120" r="4" fill="var(--primary)" stroke="var(--bg-card)" strokeWidth="2" />
              <circle cx="240" cy="60" r="4" fill="var(--primary)" stroke="var(--bg-card)" strokeWidth="2" />
              <circle cx="360" cy="80" r="4" fill="var(--primary)" stroke="var(--bg-card)" strokeWidth="2" />
              <circle cx="500" cy="30" r="4" fill="var(--primary)" stroke="var(--bg-card)" strokeWidth="2" />

              {/* Labels */}
              <text x="120" y="145" fill="var(--text-muted)" fontSize="10" textAnchor="middle">Apr</text>
              <text x="240" y="85" fill="var(--text-muted)" fontSize="10" textAnchor="middle">Jul</text>
              <text x="360" y="105" fill="var(--text-muted)" fontSize="10" textAnchor="middle">Oct</text>
              <text x="490" y="55" fill="var(--text-muted)" fontSize="10" textAnchor="end">Jan</text>
            </svg>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h3 className="card-title">Recent Activity</h3>
            <Activity size={16} className="text-muted" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', flex: 1 }}>
            {recentActivities.map((act, i) => (
              <div key={i} className="flex gap-3" style={{ alignItems: 'flex-start' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: act.type === 'system' ? 'var(--accent)' : act.type === 'company' ? 'var(--primary)' : 'var(--success)',
                  marginTop: '6px',
                  flexShrink: 0
                }} />
                <div>
                  <p className="text-sm text-primary" style={{ lineHeight: '1.4' }}>{act.description}</p>
                  <span className="text-xs text-muted">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low Stock Alerts Section */}
      {lowStockList.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="card-header">
            <div className="flex gap-2" style={{ alignItems: 'center' }}>
              <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
              <h3 className="card-title">Active Low-Stock Alerts ({lowStockList.length})</h3>
            </div>
            <Link to="/inventory" className="btn btn-secondary btn-sm flex-center">
              View All Inventory <ArrowRight size={14} style={{ marginLeft: 4 }} />
            </Link>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Threshold</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockList.map(item => (
                  <tr key={item.id}>
                    <td className="font-semibold text-primary">{item.name}</td>
                    <td>{item.category?.name || '-'}</td>
                    <td className="font-bold" style={{ color: 'var(--danger)' }}>{item.currentStock}</td>
                    <td>{item.lowStockThreshold}</td>
                    <td><span className="badge badge-warning">Low Stock</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
