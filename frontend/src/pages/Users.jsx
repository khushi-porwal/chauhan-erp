import { useState, useEffect } from 'react';
import { userApi, companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Users as UsersIcon, Plus, Edit3, X, Save, ShieldAlert, Key } from 'lucide-react';
import toast from 'react-hot-toast';

const AVAILABLE_ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'COMPANY_ADMIN', label: 'Company Admin' },
  { value: 'BRANCH_MANAGER', label: 'Branch Manager' },
  { value: 'USER', label: 'Regular User' }
];

const SYSTEM_PERMISSIONS = [
  { value: 'company:read', label: 'View Company' },
  { value: 'company:write', label: 'Manage Company' },
  { value: 'branch:read', label: 'View Branches' },
  { value: 'branch:write', label: 'Manage Branches' },
  { value: 'fy:read', label: 'View Financial Years' },
  { value: 'fy:write', label: 'Manage Financial Years' },
  { value: 'user:read', label: 'View Users' },
  { value: 'user:write', label: 'Manage Users' },
  { value: 'audit:read', label: 'View Audit Logs' }
];

export default function Users() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [status, setStatus] = useState('ACTIVE');
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formBranchId, setFormBranchId] = useState('');
  const [permissions, setPermissions] = useState([]);

  // Fetch Companies if SuperAdmin
  const fetchCompanies = async () => {
    try {
      const res = await companyApi.getAll();
      const companyData = res.data.data;
      setCompanies(companyData);
      if (companyData.length > 0) {
        setSelectedCompanyId(companyData[0].id);
        setFormCompanyId(companyData[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load companies');
    }
  };

  // Fetch branches for user form
  const fetchBranchesForCompany = async (companyId) => {
    if (!companyId) {
      setBranches([]);
      return;
    }
    try {
      const res = await companyApi.getBranches(companyId);
      setBranches(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load branches');
    }
  };

  // Fetch Users
  const fetchUsers = async (companyId) => {
    setLoading(true);
    try {
      const res = await userApi.getAll(companyId);
      setUsers(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    } else {
      fetchUsers();
      fetchBranchesForCompany(user?.companyId);
    }
  }, [isSuperAdmin]);

  // Refetch list when SuperAdmin changes selected company
  useEffect(() => {
    if (isSuperAdmin && selectedCompanyId) {
      fetchUsers(selectedCompanyId);
      fetchBranchesForCompany(selectedCompanyId);
    }
  }, [selectedCompanyId, isSuperAdmin]);

  // Handle company change in Add Form
  useEffect(() => {
    if (formCompanyId) {
      fetchBranchesForCompany(formCompanyId);
    }
  }, [formCompanyId]);

  const openAddModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('USER');
    setStatus('ACTIVE');
    setPermissions([]);
    if (isSuperAdmin) {
      setFormCompanyId(selectedCompanyId || (companies[0]?.id || ''));
    } else {
      setFormCompanyId(user?.companyId || '');
    }
    setFormBranchId('');
    setIsModalOpen(true);
  };

  const openEditModal = (targetUser) => {
    setEditingUser(targetUser);
    setName(targetUser.name || '');
    setEmail(targetUser.email || '');
    setPassword(''); // never pre-fill password for edit
    setRole(targetUser.role || 'USER');
    setStatus(targetUser.status || 'ACTIVE');
    setFormCompanyId(targetUser.companyId || '');
    setFormBranchId(targetUser.branchId || '');
    
    let parsedPerms = [];
    if (targetUser.permissions) {
      parsedPerms = Array.isArray(targetUser.permissions) 
        ? targetUser.permissions 
        : JSON.parse(targetUser.permissions);
    }
    setPermissions(parsedPerms);
    setIsModalOpen(true);
  };

  const handleTogglePermission = (perm) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSelectAllPermissions = () => {
    if (permissions.length === SYSTEM_PERMISSIONS.length) {
      setPermissions([]);
    } else {
      setPermissions(SYSTEM_PERMISSIONS.map((p) => p.value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || (!editingUser && !password)) {
      return toast.error('Required fields are missing');
    }

    try {
      if (editingUser) {
        // Edit User
        const payload = {
          name,
          role,
          status,
          branchId: formBranchId || null,
          permissions
        };
        await userApi.update(editingUser.id, payload);
        toast.success('User updated successfully');
      } else {
        // Create User
        const payload = {
          name,
          email,
          password,
          role,
          permissions,
          companyId: isSuperAdmin ? formCompanyId : undefined,
          branchId: formBranchId || undefined
        };
        await userApi.create(payload);
        toast.success('User created successfully');
      }
      setIsModalOpen(false);
      fetchUsers(isSuperAdmin ? selectedCompanyId : undefined);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to save user';
      toast.error(errMsg);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header section */}
      <div className="flex-between">
        <div>
          <h1 className="text-primary font-bold">Users</h1>
          <p className="text-secondary text-sm">Manage user access credentials, roles, and functional permissions</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      {/* Super Admin Company Selector */}
      {isSuperAdmin && companies.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label className="form-label">Active Company Filter</label>
            <select
              className="form-select"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Users List */}
      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading users...</div>
      ) : users.length === 0 ? (
        <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <UsersIcon size={48} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-secondary">No Users Found</h3>
          <p className="text-muted text-sm">Register user credentials to grant system access</p>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAddModal}>
              Create User
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>User Detail</th>
                <th>Role</th>
                <th>Status</th>
                <th>Branch</th>
                {isSuperAdmin && <th>Company</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div>
                      <div className="font-semibold text-primary">{u.name}</div>
                      <div className="text-xs text-muted">{u.email}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`btn btn-secondary btn-sm role-${u.role.toLowerCase()}`} style={{ cursor: 'default' }}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`alert-${u.status === 'ACTIVE' ? 'success' : 'danger'}`} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      {u.status}
                    </span>
                  </td>
                  <td>{u.branch?.name || '-'}</td>
                  {isSuperAdmin && <td>{u.company?.name || '-'}</td>}
                  <td>
                    <div className="flex gap-2">
                      {(isSuperAdmin || (isAdmin && u.role !== 'SUPER_ADMIN')) && (
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEditModal(u)} title="Edit User">
                          <Edit3 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Add / Edit User */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1001, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">{editingUser ? 'Edit User Credentials' : 'Add New User'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {isSuperAdmin && !editingUser && (
                <div className="form-group">
                  <label className="form-label">Associate to Company *</label>
                  <select
                    className="form-select"
                    value={formCompanyId}
                    onChange={(e) => setFormCompanyId(e.target.value)}
                    required
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Chauhan"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@chauhanerp.com"
                    disabled={!!editingUser}
                    required
                  />
                </div>
              </div>

              {!editingUser && (
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="password"
                      className="form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      style={{ paddingLeft: '40px' }}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Role Assignment *</label>
                  <select
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                  >
                    {AVAILABLE_ROLES.filter(r => isSuperAdmin || r.value !== 'SUPER_ADMIN').map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Branch Assignment</label>
                  <select
                    className="form-select"
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value)}
                  >
                    <option value="">No Branch Association</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">User Status</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              {/* Granular Permissions Section */}
              <div className="divider" />
              <div>
                <div className="flex-between mb-4">
                  <h4 className="text-secondary font-semibold" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <ShieldAlert size={16} style={{ color: 'var(--warning)' }} />
                    Granular Access Permissions
                  </h4>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleSelectAllPermissions}>
                    {permissions.length === SYSTEM_PERMISSIONS.length ? 'Clear All' : 'Select All'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                  {SYSTEM_PERMISSIONS.map((perm) => (
                    <label key={perm.value} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.775rem', cursor: 'pointer', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)' }}>
                      <input
                        type="checkbox"
                        checked={permissions.includes(perm.value)}
                        onChange={() => handleTogglePermission(perm.value)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span className="text-primary">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
