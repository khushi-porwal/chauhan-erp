import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Edit2, Trash2, X, Save, Search, Hash, Percent, Shield, Sparkles } from 'lucide-react';
import { taxApi, companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

export default function TaxMaster() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('hsn');
  const [hsnCodes, setHsnCodes] = useState([]);
  const [gstSlabs, setGstSlabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal state
  const [modal, setModal] = useState({ open: false, type: '', mode: 'create', data: null });
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(user?.companyId || '');

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      companyApi.getAll()
        .then(res => {
          const list = res.data?.data || [];
          setCompanies(list);
          if (list.length > 0 && !selectedCompanyId) {
            setSelectedCompanyId(list[0].id);
          }
        })
        .catch(() => {});
    }
  }, [user?.role]);

  const activeCompanyId = selectedCompanyId || user?.companyId;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [hsnRes, gstRes] = await Promise.all([
        taxApi.getHsnCodes(activeCompanyId),
        taxApi.getGstSlabs(activeCompanyId),
      ]);
      setHsnCodes(hsnRes.data?.data || []);
      setGstSlabs(gstRes.data?.data || []);
    } catch {
      setHsnCodes([]);
      setGstSlabs([]);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (type, mode, data = null) => {
    setError('');
    setFormData(data ? { ...data } : {});
    setModal({ open: true, type, mode, data });
  };

  const closeModal = () => {
    setModal({ open: false, type: '', mode: 'create', data: null });
    setFormData({});
    setError('');
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { type, mode, data } = modal;

      if (type === 'hsn') {
        if (!formData.code) { setError('HSN Code is required'); setSaving(false); return; }
        const payload = {
          code: formData.code,
          description: formData.description,
          gstRate: parseFloat(formData.gstRate) || 0,
          companyId: activeCompanyId
        };
        if (mode === 'create') {
          await taxApi.createHsnCode(payload);
          toast.success('HSN Code created successfully');
        } else {
          await taxApi.updateHsnCode(data.id, payload);
          toast.success('HSN Code updated successfully');
        }
      } else {
        if (!formData.name || formData.rate === undefined) { setError('Name and rate are required'); setSaving(false); return; }
        const payload = {
          name: formData.name,
          rate: parseFloat(formData.rate),
          description: formData.description,
          companyId: activeCompanyId
        };
        if (mode === 'create') {
          await taxApi.createGstSlab(payload);
          toast.success('GST Slab created successfully');
        } else {
          await taxApi.updateGstSlab(data.id, payload);
          toast.success('GST Slab updated successfully');
        }
      }

      closeModal();
      fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      if (type === 'hsn') {
        await taxApi.deleteHsnCode(id);
        toast.success('HSN Code deleted');
      } else {
        await taxApi.deleteGstSlab(id);
        toast.success('GST Slab deleted');
      }
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  const filteredHsn = hsnCodes.filter(h =>
    h.code.toLowerCase().includes(search.toLowerCase()) ||
    (h.description || '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredGst = gstSlabs.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const canManage = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(79, 110, 247, 0.05) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
      }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--success-bg)',
              color: 'var(--success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FileText size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Tax & HSN Master</h1>
                <span className="badge badge-success flex items-center gap-1 text-xs">
                  <Sparkles size={11} /> Module 1 Governance
                </span>
              </div>
              <p className="text-xs text-secondary">Manage HSN Codes, Tax Slabs, and Product GST references</p>
            </div>
          </div>

          {canManage && (
            <button
              onClick={() => openModal(activeTab, 'create')}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              <Plus size={15} />
              Add {activeTab === 'hsn' ? 'HSN Code' : 'GST Slab'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-2">
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Registered HSN Codes</span>
            <div className="p-2 rounded-lg" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              <Hash size={16} />
            </div>
          </div>
          <h3 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{hsnCodes.length}</h3>
          <p className="text-xs text-muted mt-1">Harmonized System Nomenclature codes</p>
        </div>

        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">GST Slabs</span>
            <div className="p-2 rounded-lg" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
              <Percent size={16} />
            </div>
          </div>
          <h3 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{gstSlabs.length}</h3>
          <p className="text-xs text-muted mt-1">Standard tax percentage rates</p>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-2" style={{ background: 'var(--bg-surface)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('hsn')}
            className={`btn btn-sm ${activeTab === 'hsn' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.8rem', padding: '6px 16px' }}
          >
            HSN Codes ({hsnCodes.length})
          </button>
          <button
            onClick={() => setActiveTab('gst')}
            className={`btn btn-sm ${activeTab === 'gst' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.8rem', padding: '6px 16px' }}
          >
            GST Slabs ({gstSlabs.length})
          </button>
        </div>

        <div className="relative" style={{ maxWidth: '280px', width: '100%' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search code or slab..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-control"
            style={{ paddingLeft: 34, height: 38, fontSize: '0.8rem' }}
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading tax master records...
          </div>
        ) : activeTab === 'hsn' ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>HSN Code</th>
                  <th>Description</th>
                  <th className="text-center">GST Rate (%)</th>
                  <th className="text-center">Linked Products</th>
                  {canManage && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredHsn.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                      No HSN codes found. {canManage && 'Click "Add HSN Code" above.'}
                    </td>
                  </tr>
                ) : filteredHsn.map(hsn => (
                  <tr key={hsn.id}>
                    <td>
                      <span className="font-mono font-bold px-2 py-0.5 rounded text-xs" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }}>
                        {hsn.code}
                      </span>
                    </td>
                    <td className="text-secondary text-sm">{hsn.description || '—'}</td>
                    <td className="text-center font-semibold text-primary">{hsn.gstRate}%</td>
                    <td className="text-center text-muted text-xs">{hsn._count?.products || 0}</td>
                    {canManage && (
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openModal('hsn', 'edit', hsn)} className="btn btn-secondary btn-icon btn-sm" title="Edit HSN">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDelete('hsn', hsn.id)} className="btn btn-danger btn-icon btn-sm" title="Delete HSN">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>GST Slab Name</th>
                  <th className="text-center">Rate (%)</th>
                  <th>Description</th>
                  <th className="text-center">Linked Products</th>
                  {canManage && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredGst.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                      No GST slabs found. {canManage && 'Click "Add GST Slab" above.'}
                    </td>
                  </tr>
                ) : filteredGst.map(gst => (
                  <tr key={gst.id}>
                    <td className="font-semibold text-primary">{gst.name}</td>
                    <td className="text-center">
                      <span className="badge badge-info font-bold text-xs">
                        {gst.rate}%
                      </span>
                    </td>
                    <td className="text-secondary text-sm">{gst.description || '—'}</td>
                    <td className="text-center text-muted text-xs">{gst._count?.products || 0}</td>
                    {canManage && (
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openModal('gst', 'edit', gst)} className="btn btn-secondary btn-icon btn-sm" title="Edit Slab">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDelete('gst', gst.id)} className="btn btn-danger btn-icon btn-sm" title="Delete Slab">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: 0 }}>
            <div className="card-header flex items-center justify-between" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border)' }}>
              <h3 className="card-title text-base font-semibold">
                {modal.mode === 'create' ? 'Add' : 'Edit'} {modal.type === 'hsn' ? 'HSN Code' : 'GST Slab'}
              </h3>
              <button onClick={closeModal} className="btn btn-ghost btn-icon btn-sm">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {error && (
                <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
                  {error}
                </div>
              )}

              {modal.type === 'hsn' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">HSN Code *</label>
                    <input
                      type="text"
                      value={formData.code || ''}
                      onChange={e => setFormData(f => ({ ...f, code: e.target.value }))}
                      placeholder="e.g. 0901, 33049910"
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input
                      type="text"
                      value={formData.description || ''}
                      onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                      placeholder="Goods / services category description"
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Default GST Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.gstRate ?? ''}
                      onChange={e => setFormData(f => ({ ...f, gstRate: e.target.value }))}
                      placeholder="18"
                      className="form-control"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Slab Name *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. GST 18%, Exempt, 5%"
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Rate (%) *</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.rate ?? ''}
                      onChange={e => setFormData(f => ({ ...f, rate: e.target.value }))}
                      placeholder="18"
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input
                      type="text"
                      value={formData.description || ''}
                      onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                      placeholder="Optional notes"
                      className="form-control"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <button type="button" onClick={closeModal} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                  <Save size={14} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
