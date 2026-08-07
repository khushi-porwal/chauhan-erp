import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Edit2, Trash2, CheckCircle, Lock, Save, X, Sparkles, Check, Users } from 'lucide-react';
import { roleApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

export default function RolesPermissions() {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [systemPermissions, setSystemPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, mode: 'create', role: null });
  const [formData, setFormData] = useState({ name: '', description: '', permissions: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchRolesAndPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        roleApi.getAll(user?.companyId),
        roleApi.getSystemPermissions()
      ]);
      setRoles(rolesRes.data?.data || []);
      setSystemPermissions(permsRes.data?.data || []);
    } catch {
      setRoles([]);
      setSystemPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.companyId]);

  useEffect(() => { fetchRolesAndPermissions(); }, [fetchRolesAndPermissions]);

  // Group permissions by module
  const groupedPermissions = systemPermissions.reduce((acc, perm) => {
    const mod = perm.module || 'GENERAL';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(perm);
    return acc;
  }, {});

  const openModal = (mode, role = null) => {
    setError('');
    if (mode === 'create') {
      setFormData({ name: '', description: '', permissions: [] });
    } else if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
        permissions: Array.isArray(role.permissions)
          ? role.permissions
          : (typeof role.permissions === 'string' ? JSON.parse(role.permissions || '[]') : [])
      });
    }
    setModal({ open: true, mode, role });
  };

  const closeModal = () => {
    setModal({ open: false, mode: 'create', role: null });
    setFormData({ name: '', description: '', permissions: [] });
    setError('');
  };

  const togglePermission = (code) => {
    setFormData(prev => {
      const current = prev.permissions || [];
      const updated = current.includes(code)
        ? current.filter(p => p !== code)
        : [...current, code];
      return { ...prev, permissions: updated };
    });
  };

  const toggleModuleAll = (modulePerms) => {
    const codes = modulePerms.map(p => p.code);
    const current = formData.permissions || [];
    const allSelected = codes.every(c => current.includes(c));

    if (allSelected) {
      setFormData(prev => ({ ...prev, permissions: prev.permissions.filter(c => !codes.includes(c)) }));
    } else {
      const merged = Array.from(new Set([...current, ...codes]));
      setFormData(prev => ({ ...prev, permissions: merged }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { setError('Role name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (modal.mode === 'create') {
        await roleApi.create({ ...formData, companyId: user?.companyId });
        toast.success('Role created successfully');
      } else {
        await roleApi.update(modal.role.id, formData);
        toast.success('Role updated successfully');
      }
      closeModal();
      fetchRolesAndPermissions();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this custom role?')) return;
    try {
      await roleApi.delete(id);
      toast.success('Role deleted');
      fetchRolesAndPermissions();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  const canManage = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(79, 110, 247, 0.06) 100%)',
        border: '1px solid rgba(124, 58, 237, 0.25)',
      }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(124, 58, 237, 0.15)',
              color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Shield size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Roles & Dynamic Permissions</h1>
                <span className="badge badge-primary flex items-center gap-1 text-xs" style={{ background: 'rgba(124, 58, 237, 0.15)', color: 'var(--accent)', border: '1px solid rgba(124, 58, 237, 0.3)' }}>
                  <Sparkles size={11} /> Dynamic RBAC
                </span>
              </div>
              <p className="text-xs text-secondary">Configure role permissions matrices and assign access policies</p>
            </div>
          </div>

          {canManage && (
            <button
              onClick={() => openModal('create')}
              className="btn btn-primary btn-sm flex items-center gap-2"
              style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
            >
              <Plus size={15} />
              Create Custom Role
            </button>
          )}
        </div>
      </div>

      {/* Role Cards Grid */}
      <div className="grid-3">
        {loading ? (
          <div className="col-span-full text-center py-12 text-muted">Loading role profiles...</div>
        ) : roles.map(role => {
          const perms = Array.isArray(role.permissions)
            ? role.permissions
            : (typeof role.permissions === 'string' ? JSON.parse(role.permissions || '[]') : []);

          return (
            <div key={role.id} className="card flex flex-col justify-between hover:-translate-y-1 transition-all" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-primary">{role.name}</h3>
                    {role.isSystem && (
                      <span className="badge font-mono" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', fontSize: '0.65rem' }}>System</span>
                    )}
                  </div>
                  {!role.isSystem && canManage && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => openModal('edit', role)} className="btn btn-secondary btn-icon btn-sm" title="Edit Role">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(role.id)} className="btn btn-danger btn-icon btn-sm" title="Delete Role">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-secondary mb-4" style={{ minHeight: '32px' }}>
                  {role.description || 'System access role definition.'}
                </p>

                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Permissions ({role.name === 'SUPER_ADMIN' ? 'ALL' : perms.length})
                  </span>

                  <div className="flex flex-wrap gap-1.5" style={{ maxHeight: '110px', overflowY: 'auto' }}>
                    {role.isSystem && role.name === 'SUPER_ADMIN' ? (
                      <span className="badge badge-success font-semibold" style={{ fontSize: '0.7rem' }}>
                        Full System Access (Bypass)
                      </span>
                    ) : perms.length === 0 ? (
                      <span className="text-xs text-muted italic">No granular permissions assigned</span>
                    ) : (
                      perms.map(p => (
                        <span key={p} className="badge font-mono text-xs" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)', border: '1px solid var(--primary-glow)', fontSize: '0.68rem' }}>
                          {p}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t flex items-center justify-between text-xs text-muted" style={{ borderColor: 'var(--border)' }}>
                <span className="flex items-center gap-1"><Users size={12} /> {role._count?.users || 0} user(s) assigned</span>
                {role.isSystem ? <Lock size={12} className="text-muted" /> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Creation / Edit Modal */}
      {modal.open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', items: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '720px', maxHeight: '88vh', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header flex items-center justify-between" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border)' }}>
              <h3 className="card-title text-base font-semibold">
                {modal.mode === 'create' ? 'Create Custom Role' : `Edit Role: ${modal.role?.name}`}
              </h3>
              <button onClick={closeModal} className="btn btn-ghost btn-icon btn-sm">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: 'var(--space-5)', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {error && (
                <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
                  {error}
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Role Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Inventory Manager"
                    className="form-control"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe role responsibilities"
                    className="form-control"
                  />
                </div>
              </div>

              {/* Permission Matrix */}
              <div>
                <h4 className="text-sm font-semibold text-primary mb-3">Permissions Matrix</h4>
                <div className="space-y-4">
                  {Object.entries(groupedPermissions).map(([moduleName, perms]) => {
                    const codes = perms.map(p => p.code);
                    const current = formData.permissions || [];
                    const allSelected = codes.every(c => current.includes(c));

                    return (
                      <div key={moduleName} className="p-3.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between pb-2 mb-2 border-b" style={{ borderColor: 'var(--border)' }}>
                          <span className="font-bold text-xs text-primary uppercase tracking-wide">{moduleName}</span>
                          <button
                            type="button"
                            onClick={() => toggleModuleAll(perms)}
                            className="text-xs font-semibold text-accent hover:underline"
                          >
                            {allSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                          {perms.map(p => {
                            const isChecked = current.includes(p.code);
                            return (
                              <label
                                key={p.code}
                                className="flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all"
                                style={{
                                  background: isChecked ? 'var(--primary-subtle)' : 'var(--bg-card)',
                                  borderColor: isChecked ? 'var(--primary-glow)' : 'var(--border)'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(p.code)}
                                  style={{ marginTop: 2 }}
                                />
                                <div>
                                  <div className="text-xs font-semibold text-primary">{p.name}</div>
                                  <div className="text-[10px] text-muted font-mono">{p.code}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <button type="button" onClick={closeModal} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1, background: 'var(--accent)', borderColor: 'var(--accent)' }}>
                  <Save size={14} />
                  {saving ? 'Saving...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
