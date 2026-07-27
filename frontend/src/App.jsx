import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Companies from './pages/Companies.jsx';
import Branches from './pages/Branches.jsx';
import FinancialYears from './pages/FinancialYears.jsx';
import Users from './pages/Users.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import Settings from './pages/Settings.jsx';
import Customers from './pages/Customers.jsx';
import Vendors from './pages/Vendors.jsx';
import Products from './pages/Products.jsx';
import Warehouses from './pages/Warehouses.jsx';
import Inventory from './pages/Inventory.jsx';
import Sales from './pages/Sales.jsx';
import Purchases from './pages/Purchases.jsx';
import POS from './pages/POS.jsx';
import Finance from './pages/Finance.jsx';
import Reports from './pages/Reports.jsx';
import { Menu, Building, Calendar, MapPin, User, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

// ── PROTECTED ROUTES WRAPPER ─────────────────────────────────
function ProtectedRoute({ adminOnly = false, permission = null }) {
  const { accessToken, loading, isAdmin, isSuperAdmin, hasPermission } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
        Restoring ERP session...
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin && !isSuperAdmin) {
    toast.error('Access denied. Admin permissions required.');
    return <Navigate to="/" replace />;
  }

  if (permission && !isAdmin && !isSuperAdmin && !hasPermission(permission)) {
    toast.error('Access denied. You do not have access to this module.');
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

// ── PUBLIC ONLY ROUTES WRAPPER (LOGIN, ETC) ──────────────────
function PublicRoute() {
  const { accessToken, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
        Loading Chauhan ERP...
      </div>
    );
  }

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

// ── APP LAYOUT ───────────────────────────────────────────────
function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  // Get formatted breadcrumb label based on active route path
  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/') return { title: 'Dashboard', sub: 'Business Performance Overview' };
    if (path === '/companies') return { title: 'Company Management', sub: 'Global ERP Companies' };
    if (path === '/branches') return { title: 'Branch Management', sub: 'Operational Outlets' };
    if (path === '/financial-years') return { title: 'Financial Calendar', sub: 'Accounting Periods' };
    if (path === '/users') return { title: 'User Management', sub: 'Employee Accounts' };
    if (path === '/audit-logs') return { title: 'Audit Trail Logs', sub: 'Security Logs' };
    if (path === '/settings') return { title: 'Settings', sub: 'ERP Setup Configurations' };
    if (path === '/customers') return { title: 'Customer Management', sub: 'Customer Master & Ledger' };
    if (path === '/vendors') return { title: 'Vendor Management', sub: 'Supplier Master & Ledger' };
    if (path === '/products') return { title: 'Product Master', sub: 'Catalog, Categories, Brands & Units' };
    if (path === '/warehouses') return { title: 'Warehouse Management', sub: 'Locations & Storage Outlets' };
    if (path === '/inventory') return { title: 'Inventory Control', sub: 'Current Stocks, Transfers & History' };
    if (path === '/sales') return { title: 'Sales Management', sub: 'Quotations, Orders, Invoices & Returns' };
    if (path === '/purchases') return { title: 'Purchase Management', sub: 'Supplier Orders, Bills & Returns' };
    if (path === '/pos') return { title: 'Retail POS Terminal', sub: 'Barcode Billing & Receipt Printing' };
    if (path === '/finance') return { title: 'Financial Ledger', sub: 'Payments, Expenses & Books' };
    if (path === '/reports') return { title: 'Reports & Analytics', sub: 'Tax Liability & Profit Summary' };
    return { title: 'Chauhan ERP', sub: 'Enterprise Management' };
  };

  const breadcrumb = getBreadcrumb();

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      {/* Main Content Area */}
      <div className={`main-content${collapsed ? ' sidebar-collapsed' : ''}`}>
        
        {/* Top Header */}
        <header className={`header${collapsed ? ' sidebar-collapsed' : ''}`}>
          <button className="header-toggle-btn" onClick={() => setCollapsed(!collapsed)} title="Toggle navigation panel">
            <Menu size={18} />
          </button>
          
          <div className="header-breadcrumb">
            <h2 className="breadcrumb-title" style={{ fontSize: '0.95rem' }}>{breadcrumb.title}</h2>
            <p className="breadcrumb-sub" style={{ fontSize: '0.7rem' }}>{breadcrumb.sub}</p>
          </div>

          {/* Active Settings HUD */}
          <div className="header-actions">
            {user?.companyId && (
              <div className="flex gap-2" style={{ alignItems: 'center', background: 'var(--bg-elevated)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-secondary)' }} title="Associated Company ID">
                <Building size={12} className="text-primary" />
                <span className="font-semibold" style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Comp: {user.companyId.slice(0, 8)}...
                </span>
              </div>
            )}

            {user?.branchId && (
              <div className="flex gap-2" style={{ alignItems: 'center', background: 'var(--bg-elevated)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-secondary)' }} title="Associated Branch ID">
                <MapPin size={12} className="text-primary" />
                <span className="font-semibold">
                  Branch: {user.branchId.slice(0, 8)}...
                </span>
              </div>
            )}

            <button className="btn btn-secondary btn-icon btn-sm" onClick={logout} title="Sign Out">
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ── ROOT APP ROUTES ──────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          {/* Protected Main App Layout Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />

              {/* Module-Specific Permission Protected Routes */}
              <Route element={<ProtectedRoute permission="customers" />}>
                <Route path="/customers" element={<Customers />} />
              </Route>

              <Route element={<ProtectedRoute permission="vendors" />}>
                <Route path="/vendors" element={<Vendors />} />
              </Route>

              <Route element={<ProtectedRoute permission="products" />}>
                <Route path="/products" element={<Products />} />
              </Route>

              <Route element={<ProtectedRoute permission="warehouses" />}>
                <Route path="/warehouses" element={<Warehouses />} />
              </Route>

              <Route element={<ProtectedRoute permission="inventory" />}>
                <Route path="/inventory" element={<Inventory />} />
              </Route>

              <Route element={<ProtectedRoute permission="sales" />}>
                <Route path="/sales" element={<Sales />} />
              </Route>

              <Route element={<ProtectedRoute permission="purchases" />}>
                <Route path="/purchases" element={<Purchases />} />
              </Route>

              <Route element={<ProtectedRoute permission="pos" />}>
                <Route path="/pos" element={<POS />} />
              </Route>

              <Route element={<ProtectedRoute permission="finance" />}>
                <Route path="/finance" element={<Finance />} />
              </Route>

              <Route element={<ProtectedRoute permission="reports" />}>
                <Route path="/reports" element={<Reports />} />
              </Route>

              <Route element={<ProtectedRoute permission="settings" />}>
                <Route path="/settings" element={<Settings />} />
              </Route>

              <Route element={<ProtectedRoute permission="branches" />}>
                <Route path="/branches" element={<Branches />} />
              </Route>

              <Route element={<ProtectedRoute permission="financial_years" />}>
                <Route path="/financial-years" element={<FinancialYears />} />
              </Route>

              {/* Admin/SuperAdmin Exclusive Routes */}
              <Route element={<ProtectedRoute adminOnly={true} />}>
                <Route path="/companies" element={<Companies />} />
                <Route path="/users" element={<Users />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
              </Route>
            </Route>
          </Route>

          {/* Wildcard Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      
      {/* Toast Notification Container */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            fontSize: '0.85rem',
            borderRadius: 'var(--radius-md)',
          },
        }}
      />
    </AuthProvider>
  );
}
