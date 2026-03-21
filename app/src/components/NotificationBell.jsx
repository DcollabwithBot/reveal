import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from "../lib/errorHandler";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

const EVENT_ICONS = {
  'item.assigned': '📋',
  'approval.pending': '⏳',
  'session.started': '🎮',
  'session.completed': '✅',
  'comment.mention': '💬',
  'sprint.started': '🏃',
  'sprint.completed': '🏁',
  'item.blocked': '🚫',
  'item.status_changed': '🔄',
  'retro.action_item_created': '🎯',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'lige nu';
  if (mins < 60) return `${mins}m siden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}t siden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d siden`;
  return new Date(dateStr).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export default function NotificationBell({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  // Load unread count on mount and every 30s
  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function loadUnreadCount() {
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/notifications/unread-count', { headers });
      if (r.ok) {
        const data = await r.json();
        setUnreadCount(data.count || 0);
      }
    } catch (e) { handleError(e, "notifications-api"); }
  }

  async function loadNotifications() {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/notifications', { headers });
      if (r.ok) {
        const data = await r.json();
        setNotifications(data || []);
      }
    } catch (e) { handleError(e, "notifications-api"); }
    setLoading(false);
  }

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) await loadNotifications();
  }

  async function handleMarkRead(notif) {
    if (!notif.read_at) {
      try {
        const headers = await authHeaders();
        await fetch(`/api/notifications/${notif.id}/read`, { method: 'PATCH', headers });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) { handleError(e, "notifications-api"); }
    }
    if (notif.link && onNavigate) {
      onNavigate(notif.link);
    }
    setOpen(false);
  }

  async function handleMarkAllRead() {
    try {
      const headers = await authHeaders();
      await fetch('/api/notifications/read-all', { method: 'PATCH', headers });
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
    } catch (e) { handleError(e, "notifications-api"); }
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border2)',
          borderRadius: 'var(--radius)',
          color: 'var(--text2)',
          cursor: 'pointer',
          fontSize: 15,
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
        title="Notifikationer"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: 'var(--danger)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            borderRadius: 10,
            minWidth: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 40,
          right: 0,
          width: 380,
          maxHeight: 500,
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Notifikationer
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  fontSize: 10, fontWeight: 600,
                  color: 'var(--jade)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                Markér alle som læst
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {loading && (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
                Loading...
              </div>
            )}
            {!loading && notifications.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
                Ingen notifikationer endnu
              </div>
            )}
            {!loading && notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => handleMarkRead(notif)}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  background: notif.read_at ? 'transparent' : 'rgba(0,200,150,0.04)',
                  borderLeft: notif.read_at ? '3px solid transparent' : '3px solid var(--jade)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                onMouseLeave={e => e.currentTarget.style.background = notif.read_at ? 'transparent' : 'rgba(0,200,150,0.04)'}
              >
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                  {EVENT_ICONS[notif.event_type] || '📌'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: notif.read_at ? 400 : 600,
                    color: 'var(--text)',
                    marginBottom: 2,
                    lineHeight: 1.3,
                  }}>
                    {notif.title}
                  </div>
                  {notif.body && (
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text3)',
                      marginBottom: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {notif.body}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                    {timeAgo(notif.created_at)}
                  </div>
                </div>
                {!notif.read_at && (
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--jade)',
                    flexShrink: 0,
                    marginTop: 6,
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
