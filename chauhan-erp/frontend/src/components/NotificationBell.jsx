import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, AlertTriangle, Layers, CheckCheck, X } from 'lucide-react';
import { m1Api } from '../api/index.js';

/**
 * NotificationBell — Polls for low-stock and expiry notifications.
 * Shows a badge count and a dropdown panel.
 */
export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await m1Api.getNotifications({ limit: 15 });
      const data = res.data?.data;
      // Handle both plain array and paginated object responses
      const list = Array.isArray(data) ? data : (data?.notifications || data?.items || []);
      setNotifications(list);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000); // re-poll every 60s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAll = async () => {
    try {
      await m1Api.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  const handleMarkOne = async (id) => {
    try {
      await m1Api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const getIcon = (type) => {
    if (type === 'LOW_STOCK') return <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />;
    if (type === 'EXPIRY') return <Layers size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />;
    return <Bell size={14} style={{ color: 'var(--info)', flexShrink: 0 }} />;
  };

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Bell Button */}
      <button
        className="btn btn-secondary btn-icon"
        style={{ position: 'relative', height: 36, width: 36 }}
        onClick={() => setOpen(v => !v)}
        title="System Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 2, right: 2,
            background: 'var(--danger)',
            color: 'white',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.6rem',
            fontWeight: 700,
            minWidth: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            padding: '0 3px',
            border: '2px solid var(--bg-surface)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 340,
          maxHeight: 420,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 9999,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Panel Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid var(--border)',
            background: 'var(--bg-surface)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={14} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Notifications</span>
              {unreadCount > 0 && (
                <span className="badge badge-danger" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{unreadCount} new</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {unreadCount > 0 && (
                <button className="btn btn-ghost btn-sm flex items-center gap-1" style={{ fontSize: '0.7rem' }} onClick={handleMarkAll}>
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} title="Close">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <Bell size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                No notifications at this time.
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    background: n.isRead ? 'transparent' : 'rgba(79, 110, 247, 0.04)',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                  onClick={() => handleMarkOne(n.id)}
                >
                  <div style={{ marginTop: 2 }}>{getIcon(n.type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.78rem',
                      fontWeight: n.isRead ? 400 : 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {n.title || n.message}
                    </p>
                    {n.message && n.title && (
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1 }}>{n.message}</p>
                    )}
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 3 }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!n.isRead && (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)',
                      flexShrink: 0, marginTop: 4
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
