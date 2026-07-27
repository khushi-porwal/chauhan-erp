import { useState, useEffect } from 'react';
import { companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Building2, Plus, Edit3, Save, X, Phone, Mail, Globe, MapPin, BadgePercent } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Companies() {
  const { user, isSuperAdmin } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [status, setStatus] = useState('ACTIVE');

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await companyApi.getAll();
      setCompanies(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const openAddModal = () => {
    setEditingCompany(null);
    setName('');
    setLegalName('');
    setEmail('');
    setPhone('');
    setWebsite('');
    setGstNumber('');
    setAddress('');
    setCurrency('INR');
    setStatus('ACTIVE');
    setIsModalOpen(true);
  };

  const openEditModal = (company) => {
    setEditingCompany(company);
    setName(company.name || '');
    setLegalName(company.legalName || '');
    setEmail(company.email || '');
    setPhone(company.phone || '');
    setWebsite(company.website || '');
    setGstNumber(company.gstNumber || '');
    setAddress(company.address || '');
    setCurrency(company.currency || 'INR');
    setStatus(company.status || 'ACTIVE');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return toast.error('Company Name is required');

    const payload = { name, legalName, email, phone, website, gstNumber, address, currency, status };

    try {
      if (editingCompany) {
        await companyApi.update(editingCompany.id, payload);
        toast.success('Company updated successfully');
      } else {
        await companyApi.create(payload);
        toast.success('Company created successfully');
      }
      setIsModalOpen(false);
      fetchCompanies();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to save company';
      toast.error(errMsg);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header section */}
      <div className="flex-between">
        <div>
          <h1 className="text-primary font-bold">Companies</h1>
          <p className="text-secondary text-sm">Manage business units and organizational settings</p>
        </div>
        {isSuperAdmin && (
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Add Company
          </button>
        )}
      </div>

      {/* Companies List */}
      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading companies...</div>
      ) : companies.length === 0 ? (
        <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Building2 size={48} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-secondary">No Companies Registered</h3>
          <p className="text-muted text-sm">Register your first company in the ERP system</p>
          {isSuperAdmin && (
            <button className="btn btn-primary" onClick={openAddModal}>
              Register Company
            </button>
          )}
        </div>
      ) : (
        <div className="grid-2">
          {companies.map((company) => (
            <div key={company.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="flex-between">
                <div>
                  <h3 className="text-primary font-bold" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Building2 size={18} /> {company.name}
                  </h3>
                  {company.legalName && <p className="text-muted text-xs">{company.legalName}</p>}
                </div>
                <div className="flex gap-2" style={{ alignItems: 'center' }}>
                  <span className={`alert-${company.status === 'ACTIVE' ? 'success' : 'danger'}`} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                    {company.status}
                  </span>
                  {(isSuperAdmin || user?.companyId === company.id) && (
                    <button className="btn btn-ghost btn-icon" onClick={() => openEditModal(company)} title="Edit Company">
                      <Edit3 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="divider" style={{ margin: '0' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {company.email && <div className="flex gap-2"><Mail size={14} style={{ color: 'var(--text-muted)' }} /> {company.email}</div>}
                {company.phone && <div className="flex gap-2"><Phone size={14} style={{ color: 'var(--text-muted)' }} /> {company.phone}</div>}
                {company.website && <div className="flex gap-2"><Globe size={14} style={{ color: 'var(--text-muted)' }} /> {company.website}</div>}
                {company.gstNumber && <div className="flex gap-2"><BadgePercent size={14} style={{ color: 'var(--text-muted)' }} /> GST: {company.gstNumber}</div>}
                {company.address && (
                  <div className="flex gap-2" style={{ gridColumn: 'span 2' }}>
                    <MapPin size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ lineHeight: '1.3' }}>{company.address}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal / Dialog for Add & Edit */}
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
              <h3 className="text-primary font-bold">{editingCompany ? 'Edit Company' : 'Add Company'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Company Name *</label>
                  <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chauhan Enterprises" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Legal Name</label>
                  <input type="text" className="form-input" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="e.g. Chauhan Enterprises Pvt. Ltd." />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@company.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input type="text" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 9876543210" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Website</label>
                  <input type="text" className="form-input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.company.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input type="text" className="form-input" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} placeholder="15-digit GSTIN" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="form-textarea" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full physical address" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="form-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
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
