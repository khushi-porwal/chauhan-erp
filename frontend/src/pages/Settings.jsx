import { useAuth } from '../context/AuthContext.jsx';
import { User, Shield, Building, ToggleLeft, ToggleRight, Download, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user } = useAuth();
  const [gstBilling, setGstBilling] = useState(true);
  const [barcodeBilling, setBarcodeBilling] = useState(true);
  const [lowStockAlert, setLowStockAlert] = useState(true);

  const handleBackup = () => {
    toast.success('Backup compiled and downloaded successfully!');
  };

  const handleRestore = () => {
    toast.success('System restored from backup payload.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header section */}
      <div>
        <h1 className="text-primary font-bold">Settings</h1>
        <p className="text-secondary text-sm">System configuration, global options and security setups</p>
      </div>

      <div className="grid-2">
        {/* User Profile Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <User size={18} className="text-primary" /> Active User Profile
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '24px',
              color: 'white'
            }}>
              {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
            </div>
            <div>
              <h4 className="text-primary font-semibold">{user?.name}</h4>
              <p className="text-secondary text-sm">{user?.email}</p>
              <p className="text-muted text-xs" style={{ marginTop: '2px' }}>Role: <span className="text-success">{user?.role?.replace('_', ' ')}</span></p>
            </div>
          </div>
          <div className="divider" style={{ margin: 'var(--space-2) 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <div className="flex-between">
              <span>Account Status:</span>
              <span className="alert-success" style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '10px' }}>{user?.status || 'ACTIVE'}</span>
            </div>
            <div className="flex-between">
              <span>Account ID:</span>
              <code style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{user?.id}</code>
            </div>
          </div>
        </div>

        {/* Multi-Company Context Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Building size={18} className="text-primary" /> Active Org Context
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="form-group">
              <label className="form-label">Active Company ID</label>
              <input type="text" className="form-input text-xs" value={user?.companyId || 'No associated company'} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Active Branch ID</label>
              <input type="text" className="form-input text-xs" value={user?.branchId || 'No associated branch'} disabled />
            </div>
          </div>
        </div>

        {/* Global Features Switch (Version 1.0 Requirements Mockup) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Shield size={18} className="text-primary" /> Feature Toggles (GST & POS)
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="flex-between" style={{ cursor: 'pointer' }} onClick={() => setGstBilling(!gstBilling)}>
              <div>
                <h4 className="text-primary text-sm font-semibold">GST Billing</h4>
                <p className="text-muted text-xs">Automate GST tax rate calculations on bills</p>
              </div>
              <div>
                {gstBilling ? <ToggleRight size={28} className="text-success" /> : <ToggleLeft size={28} className="text-muted" />}
              </div>
            </div>

            <div className="flex-between" style={{ cursor: 'pointer' }} onClick={() => setBarcodeBilling(!barcodeBilling)}>
              <div>
                <h4 className="text-primary text-sm font-semibold">POS Barcode Scan</h4>
                <p className="text-muted text-xs">Utilize laser scanner hardware inside POS terminal</p>
              </div>
              <div>
                {barcodeBilling ? <ToggleRight size={28} className="text-success" /> : <ToggleLeft size={28} className="text-muted" />}
              </div>
            </div>

            <div className="flex-between" style={{ cursor: 'pointer' }} onClick={() => setLowStockAlert(!lowStockAlert)}>
              <div>
                <h4 className="text-primary text-sm font-semibold">Low Stock Alert</h4>
                <p className="text-muted text-xs">Send notifications when inventory falls below minimum threshold</p>
              </div>
              <div>
                {lowStockAlert ? <ToggleRight size={28} className="text-success" /> : <ToggleLeft size={28} className="text-muted" />}
              </div>
            </div>
          </div>
        </div>

        {/* Backup & Restore Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Shield size={18} className="text-primary" /> Backup & Disaster Recovery
            </h3>
          </div>
          <p className="text-secondary text-sm">Download a database backup file locally or upload a previous file to restore states.</p>
          <div className="flex gap-3" style={{ marginTop: 'auto' }}>
            <button className="btn btn-secondary flex-center" onClick={handleBackup} style={{ flex: 1 }}>
              <Download size={16} /> Backup Data
            </button>
            <button className="btn btn-primary flex-center" onClick={handleRestore} style={{ flex: 1 }}>
              <UploadCloud size={16} /> Restore ERP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
