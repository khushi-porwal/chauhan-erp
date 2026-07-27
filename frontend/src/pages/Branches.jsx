import { useState, useEffect } from 'react';
import { companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { GitBranch, Plus, X, Save, Phone, MapPin, Building, Key } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Branches() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [branches, setBranches] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [formCompanyId, setFormCompanyId] = useState('');

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
      toast.error('Failed to load companies list');
    }
  };

  // Fetch Branches
  const fetchBranches = async (companyId) => {
    setLoading(true);
    try {
      const res = await companyApi.getBranches(companyId);
      setBranches(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    } else {
      // For company admin or users, companyId is implicit on backend
      fetchBranches();
    }
  }, [isSuperAdmin]);

  // Refetch when SuperAdmin changes selected company
  useEffect(() => {
    if (isSuperAdmin && selectedCompanyId) {
      fetchBranches(selectedCompanyId);
    }
  }, [selectedCompanyId, isSuperAdmin]);

  const openAddModal = () => {
    setName('');
    setCode('');
    setAddress('');
    setPhone('');
    if (isSuperAdmin) {
      setFormCompanyId(selectedCompanyId || (companies[0]?.id || ''));
    } else {
      setFormCompanyId(user?.companyId || '');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !code) {
      return toast.error('Branch Name and Code are required');
    }

    const payload = {
      name,
      code: code.toUpperCase().trim(),
      address,
      phone,
      companyId: isSuperAdmin ? formCompanyId : undefined
    };

    try {
      await companyApi.createBranch(payload);
      toast.success('Branch created successfully');
      setIsModalOpen(false);
      fetchBranches(isSuperAdmin ? selectedCompanyId : undefined);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to create branch';
      toast.error(errMsg);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header section */}
      <div className="flex-between">
        <div>
          <h1 className="text-primary font-bold">Branches</h1>
          <p className="text-secondary text-sm">Manage business outlets, stores and physical locations</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Add Branch
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

      {/* Branches List */}
      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading branches...</div>
      ) : branches.length === 0 ? (
        <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <GitBranch size={48} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-secondary">No Branches Registered</h3>
          <p className="text-muted text-sm">Create a branch outlet for business operations</p>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAddModal}>
              Create Branch
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Branch Code</th>
                <th>Branch Name</th>
                <th>Phone</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id}>
                  <td>
                    <span className="flex gap-2" style={{ alignItems: 'center', fontWeight: '600', color: 'var(--text-primary)' }}>
                      <Key size={14} style={{ color: 'var(--primary)' }} />
                      {branch.code}
                    </span>
                  </td>
                  <td>
                    <span className="flex gap-2" style={{ alignItems: 'center' }}>
                      <GitBranch size={14} style={{ color: 'var(--text-muted)' }} />
                      {branch.name}
                    </span>
                  </td>
                  <td>{branch.phone || '-'}</td>
                  <td>
                    {branch.address ? (
                      <span className="flex gap-2" style={{ alignItems: 'center' }}>
                        <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
                        {branch.address}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Add Branch */}
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
          <div className="card" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', zIndex: 1001 }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">Add Branch</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {isSuperAdmin && (
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
                  <label className="form-label">Branch Code *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. HQ, BR01"
                    maxLength={10}
                    required
                  />
                  <p className="form-hint">Unique identifier for branch</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Branch Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Head Office Delhi"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea
                  className="form-textarea"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full location address of the branch"
                />
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
