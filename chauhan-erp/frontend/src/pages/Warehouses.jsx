import { useState, useEffect } from 'react';
import { warehouseApi, companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Warehouse, Plus, Edit3, X, Save, MapPin, Key, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Warehouses() {
  const { user, isSuperAdmin, isAdmin, hasPermission } = useAuth();
  const canManage = isAdmin || hasPermission('warehouses') || hasPermission('inventory');
  const [warehouses, setWarehouses] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
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
      toast.error('Failed to load companies');
    }
  };

  // Fetch Branches
  const fetchBranches = async (companyId) => {
    try {
      const res = await companyApi.getBranches(companyId);
      setBranches(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Warehouses
  const fetchWarehouses = async (companyId) => {
    setLoading(true);
    try {
      const res = await warehouseApi.getAll(companyId);
      setWarehouses(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    } else {
      fetchWarehouses();
      fetchBranches();
    }
  }, [isSuperAdmin]);

  // Refetch when selected company changes (for SuperAdmin)
  useEffect(() => {
    if (isSuperAdmin && selectedCompanyId) {
      fetchWarehouses(selectedCompanyId);
      fetchBranches(selectedCompanyId);
    }
  }, [selectedCompanyId, isSuperAdmin]);

  // Refetch branches when formCompanyId changes (in Add Modal)
  useEffect(() => {
    if (formCompanyId) {
      fetchBranches(formCompanyId);
    }
  }, [formCompanyId]);

  const openAddModal = () => {
    setEditingWarehouse(null);
    setName('');
    setCode('');
    setAddress('');
    setBranchId('');
    setStatus('ACTIVE');
    if (isSuperAdmin) {
      setFormCompanyId(selectedCompanyId || (companies[0]?.id || ''));
    } else {
      setFormCompanyId(user?.companyId || '');
    }
    setIsModalOpen(true);
  };

  const openEditModal = (wh) => {
    setEditingWarehouse(wh);
    setName(wh.name || '');
    setCode(wh.code || '');
    setAddress(wh.address || '');
    setBranchId(wh.branchId || '');
    setStatus(wh.status || 'ACTIVE');
    setFormCompanyId(wh.companyId || '');
    setIsModalOpen(true);
  };

  const handleDeleteWarehouse = async (id, whName) => {
    if (!window.confirm(`Are you sure you want to delete warehouse "${whName}"?`)) return;
    try {
      await warehouseApi.delete(id);
      toast.success('Warehouse deleted successfully');
      fetchWarehouses(isSuperAdmin ? selectedCompanyId : undefined);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to delete warehouse';
      toast.error(errMsg);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !code) {
      return toast.error('Warehouse Name and Code are required');
    }

    const payload = {
      name,
      code: code.toUpperCase().trim(),
      address,
      branchId: branchId || undefined,
      status,
      companyId: isSuperAdmin ? formCompanyId : undefined
    };

    try {
      if (editingWarehouse) {
        await warehouseApi.update(editingWarehouse.id, {
          name,
          address,
          branchId: branchId || null,
          status
        });
        toast.success('Warehouse updated successfully');
      } else {
        await warehouseApi.create(payload);
        toast.success('Warehouse created successfully');
      }
      setIsModalOpen(false);
      fetchWarehouses(isSuperAdmin ? selectedCompanyId : undefined);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to save warehouse';
      toast.error(errMsg);
    }
  };

  const filteredWarehouses = warehouses.filter((wh) => {
    const query = searchQuery.toLowerCase();
    return (
      wh.name?.toLowerCase().includes(query) ||
      wh.code?.toLowerCase().includes(query) ||
      wh.address?.toLowerCase().includes(query)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header section */}
      <div className="flex-between">
        <div>
          <h1 className="text-primary font-bold">Warehouse Management</h1>
          <p className="text-secondary text-sm">Manage physical storage facilities, inventory depots, and stock distribution units</p>
        </div>
        {canManage && (
          <button className="btn btn-primary flex-center" onClick={openAddModal}>
            <Plus size={16} /> Add Warehouse
          </button>
        )}
      </div>

      {/* Control bar: Super Admin Company & Search */}
      <div className="flex gap-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {isSuperAdmin && companies.length > 0 && (
          <div className="form-group" style={{ minWidth: '240px' }}>
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
        )}
        <div className="form-group" style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '34px' }}
              placeholder="Search by code, name or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Warehouses List */}
      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading warehouses...</div>
      ) : filteredWarehouses.length === 0 ? (
        <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Warehouse size={48} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-secondary">No Warehouses Found</h3>
          <p className="text-muted text-sm">{searchQuery ? 'Try clearing your search query' : 'Define storage warehouses to begin tracking product inventory'}</p>
          {canManage && !searchQuery && (
            <button className="btn btn-primary" onClick={openAddModal}>
              Create Warehouse
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Warehouse Name</th>
                <th>Associated Branch</th>
                <th>Status</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWarehouses.map((wh) => (
                <tr key={wh.id}>
                  <td>
                    <span className="flex gap-2" style={{ alignItems: 'center', fontWeight: '600', color: 'var(--text-primary)' }}>
                      <Key size={14} style={{ color: 'var(--primary)' }} />
                      {wh.code}
                    </span>
                  </td>
                  <td>
                    <span className="flex gap-2" style={{ alignItems: 'center', fontWeight: '500' }}>
                      <Warehouse size={14} style={{ color: 'var(--text-muted)' }} />
                      {wh.name}
                    </span>
                  </td>
                  <td>
                    {wh.branch ? (
                      <span className="alert-info" style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '10px' }}>
                        {wh.branch.name} ({wh.branch.code})
                      </span>
                    ) : (
                      <span className="text-muted text-xs">No associated branch</span>
                    )}
                  </td>
                  <td>
                    <span className={`alert-${wh.status === 'ACTIVE' ? 'success' : 'danger'}`} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      {wh.status}
                    </span>
                  </td>
                  <td>
                    {wh.address ? (
                      <span className="flex gap-2" style={{ alignItems: 'center' }}>
                        <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
                        {wh.address}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {canManage && (
                        <>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEditModal(wh)} title="Edit Warehouse">
                            <Edit3 size={14} />
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleDeleteWarehouse(wh.id, wh.name)} title="Delete Warehouse">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Add / Edit Warehouse */}
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
              <h3 className="text-primary font-bold">{editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {isSuperAdmin && !editingWarehouse && (
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
                  <label className="form-label">Warehouse Code *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. WH01, WH-DEL"
                    maxLength={10}
                    disabled={!!editingWarehouse}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Warehouse Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Main Delhi Depot"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Associated Branch</label>
                  <select
                    className="form-select"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                  >
                    <option value="">No branch association</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea
                  className="form-textarea"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full location address of the warehouse depot"
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
