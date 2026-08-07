import { useState, useEffect } from 'react';
import { companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Calendar, Plus, X, Save, CalendarRange, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FinancialYears() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [financialYears, setFinancialYears] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(false);
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

  // Fetch Financial Years
  const fetchFinancialYears = async (companyId) => {
    setLoading(true);
    try {
      const res = await companyApi.getFinancialYears(companyId);
      setFinancialYears(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load financial years');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    } else {
      fetchFinancialYears();
    }
  }, [isSuperAdmin]);

  // Refetch when SuperAdmin changes selected company
  useEffect(() => {
    if (isSuperAdmin && selectedCompanyId) {
      fetchFinancialYears(selectedCompanyId);
    }
  }, [selectedCompanyId, isSuperAdmin]);

  const openAddModal = () => {
    setName('');
    setStartDate('');
    setEndDate('');
    setIsActive(false);
    if (isSuperAdmin) {
      setFormCompanyId(selectedCompanyId || (companies[0]?.id || ''));
    } else {
      setFormCompanyId(user?.companyId || '');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !startDate || !endDate) {
      return toast.error('Name, Start Date, and End Date are required');
    }

    const payload = {
      name,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      isActive,
      companyId: isSuperAdmin ? formCompanyId : undefined
    };

    try {
      await companyApi.createFinancialYear(payload);
      toast.success('Financial Year created successfully');
      setIsModalOpen(false);
      fetchFinancialYears(isSuperAdmin ? selectedCompanyId : undefined);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to create financial year';
      toast.error(errMsg);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header section */}
      <div className="flex-between">
        <div>
          <h1 className="text-primary font-bold">Financial Years</h1>
          <p className="text-secondary text-sm">Define and select accounting periods for record transactions</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Add Financial Year
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

      {/* Financial Years List */}
      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading financial years...</div>
      ) : financialYears.length === 0 ? (
        <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Calendar size={48} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-secondary">No Financial Years Defined</h3>
          <p className="text-muted text-sm">Define your first accounting period</p>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAddModal}>
              Create Financial Year
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Period Name</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {financialYears.map((fy) => (
                <tr key={fy.id} style={fy.isActive ? { background: 'rgba(16,185,129,0.04)' } : undefined}>
                  <td>
                    <span className="flex gap-2" style={{ alignItems: 'center', fontWeight: '600', color: fy.isActive ? 'var(--success)' : 'var(--text-primary)' }}>
                      <CalendarRange size={14} />
                      {fy.name}
                    </span>
                  </td>
                  <td>{formatDate(fy.startDate)}</td>
                  <td>{formatDate(fy.endDate)}</td>
                  <td>
                    {fy.isActive ? (
                      <span className="flex gap-1 alert-success" style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '10px' }}>
                        <CheckCircle2 size={10} /> Active Year
                      </span>
                    ) : (
                      <span className="text-muted text-xs">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Add Financial Year */}
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
              <h3 className="text-primary font-bold">Add Financial Year</h3>
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

              <div className="form-group">
                <label className="form-label">Period Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. FY 2026-27"
                  required
                />
                <p className="form-hint">Standard format represents the financial window</p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                />
                <label className="form-label" htmlFor="isActive" style={{ cursor: 'pointer', margin: 0 }}>
                  Set as Active Financial Year
                </label>
              </div>
              <p className="form-hint" style={{ marginTop: '-8px' }}>
                Note: Setting this as active will deactivate all other financial years for this company.
              </p>

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
