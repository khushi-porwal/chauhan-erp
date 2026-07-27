import { useState, useEffect } from 'react';
import { userApi, companyApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ClipboardList, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuditLogs() {
  const { isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch Companies if SuperAdmin
  const fetchCompanies = async () => {
    try {
      const res = await companyApi.getAll();
      const companyData = res.data.data;
      setCompanies(companyData);
      if (companyData.length > 0) {
        setSelectedCompanyId(companyData[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load companies');
    }
  };

  // Fetch Logs
  const fetchLogs = async (companyId) => {
    setLoading(true);
    try {
      const res = await userApi.getAuditLogs(companyId);
      setLogs(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    } else {
      fetchLogs();
    }
  }, [isSuperAdmin]);

  // Refetch when SuperAdmin changes active company
  useEffect(() => {
    if (isSuperAdmin && selectedCompanyId) {
      fetchLogs(selectedCompanyId);
    }
  }, [selectedCompanyId, isSuperAdmin]);

  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header section */}
      <div className="flex-between">
        <div>
          <h1 className="text-primary font-bold">Audit Logs</h1>
          <p className="text-secondary text-sm">Security trace list documenting user actions and updates</p>
        </div>
      </div>

      {/* Super Admin Company Selector */}
      {isSuperAdmin && companies.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label className="form-label">
              <span className="flex gap-2" style={{ alignItems: 'center' }}>
                <Filter size={14} /> Active Company Filter
              </span>
            </label>
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

      {/* Logs Table */}
      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <div className="card flex-center" style={{ padding: 'var(--space-10)', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <ClipboardList size={48} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-secondary">No Audit Logs</h3>
          <p className="text-muted text-sm">Activities will be logged when operations are performed</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User Details</th>
                <th>Action</th>
                <th>Module</th>
                <th>IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }} className="font-semibold">{formatTimestamp(log.timestamp)}</td>
                  <td>
                    {log.user ? (
                      <div>
                        <div className="text-primary text-sm font-semibold">{log.user.name}</div>
                        <div className="text-xs text-muted">{log.user.email}</div>
                      </div>
                    ) : (
                      <span className="text-muted">System Agent</span>
                    )}
                  </td>
                  <td>
                    <span className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '11px', cursor: 'default', fontWeight: '600' }}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <span className="alert-info" style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '10px' }}>
                      {log.module}
                    </span>
                  </td>
                  <td className="text-xs text-secondary">{log.ipAddress || '-'}</td>
                  <td>
                    <pre style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', overflowX: 'auto', maxWidth: '300px' }}>
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
