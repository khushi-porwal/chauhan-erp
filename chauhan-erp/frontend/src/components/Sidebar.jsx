import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, ClipboardList,
  Settings, LogOut, ChevronLeft, ChevronRight, GitBranch, Calendar,
  Contact, Truck, Package, Warehouse, Boxes, ShoppingCart, ShoppingBag,
  Receipt, DollarSign, BarChart3, Shield, AlertTriangle, Layers, Barcode, FileText, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

/**
 * Role & Permission Guide
 * ─────────────────────────────────────────────────
 *  SUPER_ADMIN      → everything
 *  COMPANY_ADMIN    → everything except super-admin-only
 *  BRANCH_MANAGER   → transactions, inventory, limited master data, finance
 *  USER             → only pages listed in their permissions[] array
 *
 * Each nav item carries:
 *   allowedRoles  – roles that always see this item (regardless of permissions)
 *   permission    – granular key stored in user.permissions JSON array
 *                   If set, USER role can access when this key is in their array
 *
 * Logic (in Sidebar render):
 *   isAdmin/isSuperAdmin → see everything
 *   isBranchManager      → sees items where allowedRoles includes BRANCH_MANAGER
 *   isUser               → sees items where user.permissions contains item.permission
 */

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      {
        to: '/',
        icon: LayoutDashboard,
        label: 'Dashboard',
        exact: true,
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER', 'USER'],
        permission: 'dashboard',
      },
    ],
  },
  {
    label: 'Transactions',
    items: [
      {
        to: '/pos',
        icon: Receipt,
        label: 'Retail POS',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'],
        permission: 'pos',
      },
      {
        to: '/sales',
        icon: ShoppingCart,
        label: 'Sales',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'],
        permission: 'sales',
      },
      {
        to: '/purchases',
        icon: ShoppingBag,
        label: 'Purchases',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'],
        permission: 'purchases',
      },
    ],
  },
  {
    label: 'Master Data',
    items: [
      {
        to: '/customers',
        icon: Contact,
        label: 'Customers',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'],
        permission: 'customers',
      },
      {
        to: '/vendors',
        icon: Truck,
        label: 'Vendors',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'],
        permission: 'vendors',
      },
      {
        to: '/products',
        icon: Package,
        label: 'Products',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'],
        permission: 'products',
      },
      {
        to: '/warehouses',
        icon: Warehouse,
        label: 'Warehouses',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'],
        permission: 'warehouses',
      },
      {
        to: '/inventory',
        icon: Boxes,
        label: 'Inventory',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'],
        permission: 'inventory',
      },
      {
        to: '/low-stock',
        icon: AlertTriangle,
        label: 'Low Stock Alerts',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'],
        permission: 'inventory',
      },
      {
        to: '/batch-expiry',
        icon: Layers,
        label: 'Batch & Expiry',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'],
        permission: 'batch.manage',
      },
      {
        to: '/barcode-print',
        icon: Barcode,
        label: 'Barcode Print',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'],
        permission: 'barcode.print',
      },
      {
        to: '/tax-master',
        icon: FileText,
        label: 'Tax Master',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
        permission: 'taxes.manage',
      },
    ],
  },
  {
    label: 'Financials & Analytics',
    items: [
      {
        to: '/finance',
        icon: DollarSign,
        label: 'Finance',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
        permission: 'finance',
      },
      {
        to: '/reports',
        icon: BarChart3,
        label: 'Reports',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
        permission: 'reports',
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        to: '/companies',
        icon: Building2,
        label: 'Companies',
        allowedRoles: ['SUPER_ADMIN'],
        permission: null, // super-admin only, no granular override
      },
      {
        to: '/branches',
        icon: GitBranch,
        label: 'Branches',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
        permission: 'branches',
      },
      {
        to: '/financial-years',
        icon: Calendar,
        label: 'Financial Years',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
        permission: 'financial_years',
      },
      {
        to: '/users',
        icon: Users,
        label: 'Users',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
        permission: null, // admin only
      },
      {
        to: '/roles',
        icon: ShieldCheck,
        label: 'Roles & Permissions',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
        permission: 'roles.manage',
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        to: '/audit-logs',
        icon: ClipboardList,
        label: 'Audit Logs',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
        permission: null,
      },
      {
        to: '/settings',
        icon: Settings,
        label: 'Settings',
        allowedRoles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER'],
        permission: 'settings',
      },
    ],
  },
];

// Role display badge config
const ROLE_CONFIG = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'var(--accent)' },
  COMPANY_ADMIN: { label: 'Company Admin', color: 'var(--primary)' },
  BRANCH_MANAGER: { label: 'Branch Manager', color: 'var(--success)' },
  USER: { label: 'Staff / User', color: 'var(--warning)' },
};

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout, isSuperAdmin, isAdmin, isBranchManager, isUser, hasPermission } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // Determine if a nav item is visible to the current user
  const isItemVisible = (item) => {
    // Admins (ERP Admin) see everything
    if (isAdmin || isSuperAdmin) return true;

    // Dashboard is accessible to all authenticated users
    if (item.to === '/') return true;

    // For all other items, check if the user explicitly possesses the module permission
    if (item.permission) {
      return hasPermission(item.permission);
    }

    return false;
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const roleConf = ROLE_CONFIG[user?.role] || ROLE_CONFIG.USER;

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">C</div>
        <div className="logo-text">
          <h3>Chauhan ERP</h3>
          <p>Enterprise Suite</p>
        </div>
      </div>

      {/* Role badge (only when expanded) */}
      {!collapsed && (
        <div style={{
          margin: '0 var(--space-3) var(--space-2)',
          padding: '5px var(--space-3)',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${roleConf.color}33`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.7rem',
        }}>
          <Shield size={11} style={{ color: roleConf.color }} />
          <span style={{ color: roleConf.color, fontWeight: 600, letterSpacing: '0.04em' }}>
            {roleConf.label}
          </span>
          {user?.branch && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '0.65rem' }}>
              {user.branch.name}
            </span>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(isItemVisible);
          if (!visibleItems.length) return null;

          return (
            <div key={section.label}>
              {!collapsed && (
                <div className="nav-section-label">{section.label}</div>
              )}
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) =>
                    `nav-item${isActive ? ' active' : ''}`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={18} />
                  {!collapsed && (
                    <span className="nav-item-label">{item.label}</span>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* Collapse toggle */}
        <button
          className="nav-item btn-ghost"
          style={{ width: '100%', border: '1px solid var(--border)', marginBottom: 8 }}
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span className="nav-item-label">Collapse</span>}
        </button>

        {/* User card */}
        <div className="user-card" onClick={handleLogout} title="Click to logout">
          <div className="user-avatar">{initials}</div>
          {!collapsed && (
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role" style={{ color: roleConf.color, fontSize: '0.65rem', fontWeight: 600 }}>
                {roleConf.label}
              </div>
            </div>
          )}
          {!collapsed && (
            <LogOut size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
          )}
        </div>
      </div>
    </aside>
  );
}
