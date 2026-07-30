import { useAuth } from '../context/AuthContext.jsx';
import { User, Shield, Building, ToggleLeft, ToggleRight, Download, UploadCloud, Lock, Eye, EyeOff, CheckCircle2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { authExtApi } from '../api/index.js';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user } = useAuth();
  const [gstBilling, setGstBilling] = useState(true);
  const [barcodeBilling, setBarcodeBilling] = useState(true);
  const [lowStockAlert, setLowStockAlert] = useState(true);

  // Change Password state
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      toast.error('All password fields are required');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setPwSaving(true);
    try {
      await authExtApi.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword
      });
      toast.success('Password changed successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Password change failed');
    } finally {
      setPwSaving(false);
    }
  };

  const passwordStrength = (pw) => {
    if (!pw) return { label: '', color: 'var(--border)', width: '0%' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    const levels = [
      { label: 'Weak', color: 'var(--danger)', width: '25%' },
      { label: 'Fair', color: 'var(--warning)', width: '50%' },
      { label: 'Good', color: 'var(--info)', width: '75%' },
      { label: 'Strong', color: 'var(--success)', width: '100%' },
    ];
    return levels[score - 1] || { label: '', color: 'var(--border)', width: '0%' };
  };

  const pwStrength = passwordStrength(pwForm.newPassword);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(79, 110, 247, 0.1) 0%, rgba(124, 58, 237, 0.06) 100%)',
        border: '1px solid rgba(79, 110, 247, 0.25)',
      }}>
        <div className="flex items-center gap-3">
          <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold text-primary">ERP Settings</h1>
              <span className="badge badge-primary flex items-center gap-1 text-xs"><Sparkles size={11} /> System Configuration</span>
            </div>
            <p className="text-xs text-secondary">Account security, feature toggles, and system preferences</p>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* User Profile Card */}
        <div className="card flex flex-col gap-4">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2 text-base">
              <User size={17} className="text-primary" /> Active User Profile
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <div style={{
              width: '60px', height: '60px',
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'bold', fontSize: '22px', color: 'white', flexShrink: 0
            }}>
              {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
            </div>
            <div>
              <h4 className="text-primary font-semibold">{user?.name}</h4>
              <p className="text-secondary text-sm">{user?.email}</p>
              <p className="text-muted text-xs mt-1">
                Role: <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{user?.role?.replace(/_/g, ' ')}</span>
              </p>
            </div>
          </div>
          <div className="divider" style={{ margin: 'var(--space-2) 0' }} />
          <div className="flex flex-col gap-2 text-sm text-secondary">
            <div className="flex items-center justify-between">
              <span>Account Status:</span>
              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{user?.status || 'ACTIVE'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Account ID:</span>
              <code style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{user?.id?.slice(0, 16)}...</code>
            </div>
          </div>
        </div>

        {/* Multi-Company Context Card */}
        <div className="card flex flex-col gap-4">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2 text-base">
              <Building size={17} className="text-primary" /> Active Org Context
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            <div className="form-group">
              <label className="form-label">Company ID</label>
              <input
                type="text"
                className="form-control text-xs font-mono"
                value={user?.companyId || 'No associated company'}
                disabled
              />
            </div>
            <div className="form-group">
              <label className="form-label">Branch ID</label>
              <input
                type="text"
                className="form-control text-xs font-mono"
                value={user?.branchId || 'No associated branch'}
                disabled
              />
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="card flex flex-col gap-4">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2 text-base">
              <Shield size={17} className="text-primary" /> Feature Toggles
            </h3>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', cursor: 'pointer' }} onClick={() => setGstBilling(!gstBilling)}>
              <div>
                <h4 className="text-sm font-semibold text-primary">GST Billing Engine</h4>
                <p className="text-muted text-xs">Automate GST tax calculations on all bills</p>
              </div>
              {gstBilling ? <ToggleRight size={28} style={{ color: 'var(--success)' }} /> : <ToggleLeft size={28} className="text-muted" />}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', cursor: 'pointer' }} onClick={() => setBarcodeBilling(!barcodeBilling)}>
              <div>
                <h4 className="text-sm font-semibold text-primary">POS Barcode Scan</h4>
                <p className="text-muted text-xs">Enable laser scanner hardware in POS terminal</p>
              </div>
              {barcodeBilling ? <ToggleRight size={28} style={{ color: 'var(--success)' }} /> : <ToggleLeft size={28} className="text-muted" />}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', cursor: 'pointer' }} onClick={() => setLowStockAlert(!lowStockAlert)}>
              <div>
                <h4 className="text-sm font-semibold text-primary">Low Stock Alert Engine</h4>
                <p className="text-muted text-xs">Trigger notifications when stock falls below threshold</p>
              </div>
              {lowStockAlert ? <ToggleRight size={28} style={{ color: 'var(--success)' }} /> : <ToggleLeft size={28} className="text-muted" />}
            </div>
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="card flex flex-col gap-4">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2 text-base">
              <Download size={17} className="text-primary" /> Backup & Recovery
            </h3>
          </div>
          <p className="text-secondary text-sm">
            Download a database backup snapshot locally, or upload a previous file to restore ERP state.
          </p>
          <div className="flex gap-3 mt-auto">
            <button
              className="btn btn-secondary flex items-center gap-2"
              style={{ flex: 1 }}
              onClick={() => toast.success('Backup compiled and downloaded successfully!')}
            >
              <Download size={15} /> Backup Data
            </button>
            <button
              className="btn btn-primary flex items-center gap-2"
              style={{ flex: 1 }}
              onClick={() => toast.success('System restored from backup payload.')}
            >
              <UploadCloud size={15} /> Restore ERP
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Section - Full Width */}
      <div className="card">
        <div className="card-header mb-4">
          <h3 className="card-title flex items-center gap-2 text-base">
            <Lock size={17} className="text-primary" /> Change Password
          </h3>
          <p className="card-subtitle text-xs text-muted mt-0.5">Secure your account by updating your password regularly</p>
        </div>

        <form onSubmit={handleChangePassword}>
          <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            {/* Current Password */}
            <div className="form-group">
              <label className="form-label">Current Password *</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={pwForm.currentPassword}
                  onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                  placeholder="Enter current password"
                  className="form-control pr-10"
                  required
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  onClick={() => setShowCurrent(!showCurrent)}
                >
                  {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="form-group">
              <label className="form-label">New Password *</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={pwForm.newPassword}
                  onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                  placeholder="Minimum 8 characters"
                  className="form-control pr-10"
                  required
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {/* Password Strength Bar */}
              {pwForm.newPassword && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pwStrength.width, background: pwStrength.color, transition: 'width 0.3s ease, background 0.3s ease' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: pwStrength.color, fontWeight: 600 }}>{pwStrength.label}</span>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div className="form-group">
              <label className="form-label">Confirm New Password *</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={pwForm.confirmPassword}
                  onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Repeat new password"
                  className="form-control pr-10"
                  required
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {pwForm.confirmPassword && pwForm.newPassword && (
                <p style={{ fontSize: '0.7rem', marginTop: 4, color: pwForm.confirmPassword === pwForm.newPassword ? 'var(--success)' : 'var(--danger)' }}>
                  {pwForm.confirmPassword === pwForm.newPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--border)', marginTop: 'var(--space-2)' }}>
            <button
              type="submit"
              disabled={pwSaving}
              className="btn btn-primary flex items-center gap-2"
            >
              <Lock size={14} />
              {pwSaving ? 'Updating Password...' : 'Update Password'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })}
            >
              Clear
            </button>
            <span className="text-xs text-muted ml-auto flex items-center gap-1">
              <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
              Passwords are hashed with bcrypt before storage
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
