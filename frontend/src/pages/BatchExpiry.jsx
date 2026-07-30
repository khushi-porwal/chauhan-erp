import { useState, useEffect, useCallback } from 'react';
import { Layers, Calendar, AlertTriangle, CheckCircle, XCircle, RefreshCw, Search, Filter, ChevronDown } from 'lucide-react';
import { m1Api } from '../api/index.js';

const STATUS_TABS = [
  { key: '', label: 'All Batches', color: 'text-gray-600' },
  { key: 'ACTIVE', label: 'Active', color: 'text-green-600' },
  { key: 'NEAR_EXPIRY', label: 'Near Expiry', color: 'text-orange-600' },
  { key: 'EXPIRED', label: 'Expired', color: 'text-red-600' },
];

const statusConfig = {
  ACTIVE: { label: 'Active', cls: 'bg-green-100 text-green-700 border border-green-200', icon: CheckCircle },
  NEAR_EXPIRY: { label: 'Near Expiry', cls: 'bg-orange-100 text-orange-700 border border-orange-200', icon: AlertTriangle },
  EXPIRED: { label: 'Expired', cls: 'bg-red-100 text-red-700 border border-red-200', icon: XCircle },
};

function daysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;
  const now = new Date();
  const exp = new Date(expiryDate);
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

export default function BatchExpiry() {
  const [activeTab, setActiveTab] = useState('');
  const [batches, setBatches] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, nearExpiry: 0, expired: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20, ...(activeTab ? { status: activeTab } : {}) };
      const res = await m1Api.getBatchExpiry(params);
      const data = res.data?.data;
      let batchList = data?.batches || [];

      if (search) {
        batchList = batchList.filter(b =>
          b.batchNumber?.toLowerCase().includes(search.toLowerCase()) ||
          b.product?.name?.toLowerCase().includes(search.toLowerCase())
        );
      }

      setBatches(batchList);
      setSummary(data?.summary || { total: 0, active: 0, nearExpiry: 0, expired: 0 });
      setPagination(data?.pagination || { total: 0, page: 1, totalPages: 1 });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load batch data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, search]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const handleTabChange = (key) => {
    setActiveTab(key);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 rounded-xl">
            <Layers className="w-7 h-7 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Batch & Expiry Management</h1>
            <p className="text-sm text-gray-500">Track batch numbers and monitor product expiry</p>
          </div>
        </div>
        <button
          onClick={fetchBatches}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Batches', value: summary.total, color: 'bg-blue-50 border-blue-100', textColor: 'text-blue-600', icon: Layers },
          { label: 'Active', value: summary.active, color: 'bg-green-50 border-green-100', textColor: 'text-green-600', icon: CheckCircle },
          { label: 'Near Expiry', value: summary.nearExpiry, color: 'bg-orange-50 border-orange-100', textColor: 'text-orange-600', icon: AlertTriangle },
          { label: 'Expired', value: summary.expired, color: 'bg-red-50 border-red-100', textColor: 'text-red-600', icon: XCircle },
        ].map(card => (
          <div key={card.label} className={`rounded-xl p-5 border shadow-sm ${card.color}`}>
            <div className="flex items-center gap-3">
              <card.icon className={`w-5 h-5 ${card.textColor}`} />
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
                <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search batch or product..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading batches...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Layers className="w-12 h-12 text-gray-300" />
            <p className="text-lg font-medium text-gray-500">No batches found</p>
            <p className="text-sm">No batch records match your current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch #</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Warehouse</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Quantity</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Mfg Date</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Expiry Date</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Left</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {batches.map(batch => {
                  const config = statusConfig[batch.expiryStatus] || statusConfig.ACTIVE;
                  const StatusIcon = config.icon;
                  const days = daysUntilExpiry(batch.expiryDate);

                  return (
                    <tr key={batch.id} className={`hover:bg-gray-50 transition-colors ${
                      batch.expiryStatus === 'EXPIRED' ? 'bg-red-50/30' :
                      batch.expiryStatus === 'NEAR_EXPIRY' ? 'bg-orange-50/30' : ''
                    }`}>
                      <td className="px-5 py-4">
                        <span className="font-mono font-semibold text-gray-800 bg-gray-100 px-2 py-1 rounded text-xs">
                          {batch.batchNumber}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-800">{batch.product?.name || '—'}</p>
                        <p className="text-xs text-gray-400">{batch.product?.sku || ''}</p>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{batch.warehouse?.name || '—'}</td>
                      <td className="px-5 py-4 text-center font-semibold text-gray-800">{batch.quantity}</td>
                      <td className="px-5 py-4 text-center text-gray-500 text-xs">
                        {batch.mfgDate ? new Date(batch.mfgDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {batch.expiryDate ? (
                          <span className={`text-xs font-medium ${
                            batch.expiryStatus === 'EXPIRED' ? 'text-red-600' :
                            batch.expiryStatus === 'NEAR_EXPIRY' ? 'text-orange-600' : 'text-gray-600'
                          }`}>
                            {new Date(batch.expiryDate).toLocaleDateString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No expiry</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {days !== null ? (
                          <span className={`font-bold text-sm ${
                            days < 0 ? 'text-red-600' :
                            days <= 30 ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${config.cls}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                p === page ? 'bg-orange-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
