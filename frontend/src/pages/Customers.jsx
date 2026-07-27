import { useState, useEffect } from 'react';
import { customerApi, companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Contact, Plus, Edit3, X, Save, Phone, Mail, MapPin, CreditCard, Users, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Customers() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState('customers');
  const [ledgerCustomerId, setLedgerCustomerId] = useState(null);
  const [ledgerData, setLedgerData] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Customer Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [customerGroupId, setCustomerGroupId] = useState('');

  // Group Form
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  const fetchCompanies = async () => {
    try {
      const res = await companyApi.getAll();
      setCompanies(res.data.data);
      if (res.data.data.length > 0) setSelectedCompanyId(res.data.data[0].id);
    } catch { /* ignore */ }
  };

  const fetchCustomers = async (companyId) => {
    setLoading(true);
    try {
      const res = await customerApi.getAll(companyId);
      setCustomers(res.data.data);
    } catch (err) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async (companyId) => {
    try {
      const res = await customerApi.getGroups(companyId);
      setGroups(res.data.data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    } else {
      fetchCustomers();
      fetchGroups();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && selectedCompanyId) {
      fetchCustomers(selectedCompanyId);
      fetchGroups(selectedCompanyId);
    }
  }, [selectedCompanyId, isSuperAdmin]);

  const openAddModal = () => {
    setEditingCustomer(null);
    setName(''); setEmail(''); setPhone(''); setAddress('');
    setCreditLimit(''); setOpeningBalance(''); setCustomerGroupId('');
    setIsModalOpen(true);
  };

  const openEditModal = (c) => {
    setEditingCustomer(c);
    setName(c.name || ''); setEmail(c.email || ''); setPhone(c.phone || '');
    setAddress(c.address || ''); setCreditLimit(c.creditLimit?.toString() || '');
    setOpeningBalance(''); setCustomerGroupId(c.customerGroupId || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return toast.error('Customer name is required');
    const payload = {
      name, email, phone, address,
      creditLimit: creditLimit || 0,
      openingBalance: openingBalance || 0,
      customerGroupId: customerGroupId || undefined,
      companyId: isSuperAdmin ? selectedCompanyId : undefined
    };
    try {
      if (editingCustomer) {
        await customerApi.update(editingCustomer.id, payload);
        toast.success('Customer updated');
      } else {
        await customerApi.create(payload);
        toast.success('Customer created');
      }
      setIsModalOpen(false);
      fetchCustomers(isSuperAdmin ? selectedCompanyId : undefined);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save customer');
    }
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupName) return toast.error('Group name is required');
    try {
      await customerApi.createGroup({
        name: groupName,
        description: groupDescription,
        companyId: isSuperAdmin ? selectedCompanyId : undefined
      });
      toast.success('Customer group created');
      setIsGroupModalOpen(false);
      setGroupName(''); setGroupDescription('');
      fetchGroups(isSuperAdmin ? selectedCompanyId : undefined);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    }
  };

  const openLedger = async (customerId) => {
    setLedgerCustomerId(customerId);
    setLedgerLoading(true);
    try {
      const res = await customerApi.getLedger(customerId);
      setLedgerData(res.data.data);
    } catch {
      toast.error('Failed to load ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="flex-between">
        <div>
          <h1 className="text-primary font-bold">Customer Management</h1>
          <p className="text-secondary text-sm">Manage customers, credit limits, groups, and ledgers</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => { setGroupName(''); setGroupDescription(''); setIsGroupModalOpen(true); }}>
            <Users size={16} /> Add Group
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {isSuperAdmin && companies.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label className="form-label">Company Filter</label>
            <select className="form-select" value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)}>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn${activeTab === 'customers' ? ' active' : ''}`} onClick={() => setActiveTab('customers')}>Customers ({customers.length})</button>
        <button className={`tab-btn${activeTab === 'groups' ? ' active' : ''}`} onClick={() => setActiveTab('groups')}>Groups ({groups.length})</button>
      </div>

      {activeTab === 'customers' && (
        <>
          {loading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading customers...</div>
          ) : customers.length === 0 ? (
            <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Contact size={48} style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-secondary">No Customers Yet</h3>
              <p className="text-muted text-sm">Create your first customer record</p>
              <button className="btn btn-primary" onClick={openAddModal}>Add Customer</button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Group</th>
                    <th>Phone</th>
                    <th>Credit Limit</th>
                    <th>Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="font-semibold text-primary">{c.name}</div>
                        {c.email && <div className="text-xs text-muted">{c.email}</div>}
                      </td>
                      <td>
                        {c.customerGroup ? (
                          <span className="alert-info" style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '10px', display: 'inline-block' }}>
                            {c.customerGroup.name}
                          </span>
                        ) : '-'}
                      </td>
                      <td>{c.phone || '-'}</td>
                      <td className="font-semibold">{formatCurrency(c.creditLimit)}</td>
                      <td>
                        <span style={{ color: c.balance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                          {formatCurrency(c.balance)}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEditModal(c)} title="Edit"><Edit3 size={14} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openLedger(c.id)} title="View Ledger"><BookOpen size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'groups' && (
        <>
          {groups.length === 0 ? (
            <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Users size={48} style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-secondary">No Customer Groups</h3>
              <button className="btn btn-primary" onClick={() => setIsGroupModalOpen(true)}>Create Group</button>
            </div>
          ) : (
            <div className="grid-3">
              {groups.map((g) => (
                <div key={g.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <h4 className="text-primary font-semibold">{g.name}</h4>
                  {g.description && <p className="text-muted text-sm">{g.description}</p>}
                  <p className="text-xs text-muted">ID: {g.id.slice(0, 8)}...</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Ledger Modal */}
      {ledgerCustomerId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">Customer Ledger</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setLedgerCustomerId(null)}><X size={16} /></button>
            </div>
            {ledgerLoading ? <p className="text-muted">Loading...</p> : ledgerData.length === 0 ? (
              <p className="text-muted text-sm">No ledger entries found for this customer.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance</th><th>Description</th><th>Ref</th></tr></thead>
                  <tbody>
                    {ledgerData.map((l) => (
                      <tr key={l.id}>
                        <td className="text-xs">{new Date(l.date).toLocaleDateString('en-IN')}</td>
                        <td><span className={l.type === 'DEBIT' ? 'text-danger' : 'text-success'} style={{ fontWeight: 600 }}>{l.type}</span></td>
                        <td>{formatCurrency(l.amount)}</td>
                        <td className="font-semibold">{formatCurrency(l.balance)}</td>
                        <td className="text-sm">{l.description || '-'}</td>
                        <td className="text-xs text-muted">{l.referenceNo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Add/Edit Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Group</label>
                  <select className="form-select" value={customerGroupId} onChange={(e) => setCustomerGroupId(e.target.value)}>
                    <option value="">No Group</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input type="text" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="form-textarea" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Credit Limit (₹)</label>
                  <input type="number" className="form-input" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="0.00" min="0" step="0.01" />
                </div>
                {!editingCustomer && (
                  <div className="form-group">
                    <label className="form-label">Opening Balance (₹)</label>
                    <input type="number" className="form-input" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0.00" step="0.01" />
                    <p className="form-hint">Positive = customer owes you</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Add Modal */}
      {isGroupModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="flex-between">
              <h3 className="text-primary font-bold">Add Customer Group</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsGroupModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleGroupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Group Name *</label>
                <input type="text" className="form-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Wholesale Customers" required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="Optional description" />
              </div>
              <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsGroupModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-center"><Save size={16} /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
