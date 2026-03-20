import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function edgeFn(fnName, body = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Edge function error');
  }
  return res.json();
}

function Toast({ message, type = 'info', onClose }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: type === 'error' ? 'var(--danger)' : 'var(--jade)',
      color: type === 'error' ? '#fff' : '#0c0c0f',
      borderRadius: 'var(--radius)', padding: '12px 18px',
      fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      maxWidth: 400, cursor: 'pointer',
    }} onClick={onClose}>
      {message}
    </div>
  );
}

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: value ? 'var(--jade)' : 'var(--bg3)',
        position: 'relative', transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3,
        left: value ? 23 : 3,
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

// ── SMTP Settings ─────────────────────────────────────────────────────────────

function SmtpSettings({ organizationId, toast, setToast }) {
  const [smtp, setSmtp] = useState({
    host: '', port: 587, tls: true, username: '', password: '', from_address: '', from_name: 'Reveal',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      const { data } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (data) {
        setSmtp({
          host: data.host || '',
          port: data.port || 587,
          tls: data.tls !== false,
          username: data.username || '',
          password: data.password || '',
          from_address: data.from_address || '',
          from_name: data.from_name || 'Reveal',
        });
      }
      setLoading(false);
    })();
  }, [organizationId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('smtp_configs')
        .upsert({
          organization_id: organizationId,
          ...smtp,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id' });
      if (error) throw new Error(error.message);
      setToast({ message: 'SMTP config gemt ✓', type: 'info' });
    } catch (e) {
      setToast({ message: `Fejl: ${e.message}`, type: 'error' });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await edgeFn('send-email', {
        to: user.email,
        subject: 'Reveal SMTP Test',
        html: '<p style="color:#e0e0e0;">This is a test email from Reveal. If you see this, email is working! ✓</p>',
        org_id: organizationId,
      });
      setToast({ message: `Test email sendt til ${user.email} ✓`, type: 'info' });
    } catch (e) {
      setToast({ message: `Test fejlede: ${e.message}`, type: 'error' });
    }
    setTesting(false);
  };

  if (loading) return <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>Henter SMTP config...</div>;

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>📧 SMTP Konfiguration</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Konfigurer email-afsendelse. Fallback til Resend hvis tomt.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Host</label>
          <input style={inputStyle} value={smtp.host} onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))} placeholder="smtp.gmail.com" />
        </div>
        <div>
          <label style={labelStyle}>Port</label>
          <input style={inputStyle} type="number" value={smtp.port} onChange={e => setSmtp(s => ({ ...s, port: Number(e.target.value) }))} />
        </div>
        <div>
          <label style={labelStyle}>TLS</label>
          <div style={{ paddingTop: 8 }}>
            <Toggle value={smtp.tls} onChange={v => setSmtp(s => ({ ...s, tls: v }))} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Username</label>
          <input style={inputStyle} value={smtp.username} onChange={e => setSmtp(s => ({ ...s, username: e.target.value }))} placeholder="user@domain.com" />
        </div>
        <div>
          <label style={labelStyle}>Password</label>
          <input style={inputStyle} type="password" value={smtp.password} onChange={e => setSmtp(s => ({ ...s, password: e.target.value }))} placeholder="••••••••" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>From Address</label>
          <input style={inputStyle} value={smtp.from_address} onChange={e => setSmtp(s => ({ ...s, from_address: e.target.value }))} placeholder="noreply@company.com" />
        </div>
        <div>
          <label style={labelStyle}>From Name</label>
          <input style={inputStyle} value={smtp.from_name} onChange={e => setSmtp(s => ({ ...s, from_name: e.target.value }))} placeholder="Reveal" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleTest} disabled={testing} style={{ ...btnStyle, background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          {testing ? 'Sender...' : '🧪 Test Connection'}
        </button>
        <button onClick={handleSave} disabled={saving} style={btnStyle}>
          {saving ? 'Gemmer...' : '💾 Save'}
        </button>
      </div>
    </div>
  );
}

// ── Integration Connections (Jira, Slack, Teams) ──────────────────────────────

function IntegrationCard({ provider, icon, organizationId, setToast }) {
  const [config, setConfig] = useState({});
  const [status, setStatus] = useState('disconnected');
  const [connectionId, setConnectionId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      const { data } = await supabase
        .from('integration_connections')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('provider', provider)
        .maybeSingle();
      if (data) {
        setConfig(data.config || {});
        setStatus(data.status || 'disconnected');
        setConnectionId(data.id);
      }
    })();
  }, [organizationId, provider]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const row = {
        organization_id: organizationId,
        provider,
        config,
        status: 'active',
        updated_at: new Date().toISOString(),
      };

      if (connectionId) {
        const { error } = await supabase
          .from('integration_connections')
          .update(row)
          .eq('id', connectionId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from('integration_connections')
          .insert(row)
          .select()
          .single();
        if (error) throw new Error(error.message);
        setConnectionId(data.id);
      }
      setStatus('active');
      setToast({ message: `${provider} saved ✓`, type: 'info' });
    } catch (e) {
      setToast({ message: `Fejl: ${e.message}`, type: 'error' });
    }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    if (!connectionId) return;
    setSaving(true);
    try {
      await supabase
        .from('integration_connections')
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('id', connectionId);
      setStatus('disconnected');
      setToast({ message: `${provider} disconnected`, type: 'info' });
    } catch (e) {
      setToast({ message: `Fejl: ${e.message}`, type: 'error' });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      if (provider === 'jira') {
        await edgeFn('jira-import', {
          action: 'preview',
          base_url: config.base_url,
          jira_token: config.api_token,
          jira_email: config.email,
          project_key: config.project_key,
        });
        setToast({ message: 'Jira connection OK ✓', type: 'info' });
      } else {
        // For Slack/Teams — send test webhook
        await edgeFn('send-webhook', {
          org_id: organizationId,
          event_type: 'test',
          data: { message: 'Test notification from Reveal' },
        });
        setToast({ message: `${provider} webhook test sent ✓`, type: 'info' });
      }
    } catch (e) {
      setToast({ message: `Test failed: ${e.message}`, type: 'error' });
    }
    setTesting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await edgeFn('jira-sync', { org_id: organizationId });
      const r = result.results?.[0];
      setToast({ message: `Synced ${r?.synced || 0} items from Jira ✓`, type: 'info' });
    } catch (e) {
      setToast({ message: `Sync failed: ${e.message}`, type: 'error' });
    }
    setSyncing(false);
  };

  const isConnected = status === 'active';

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {provider.charAt(0).toUpperCase() + provider.slice(1)}
          </span>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 10,
            background: isConnected ? 'var(--jade-dim)' : 'var(--bg3)',
            color: isConnected ? 'var(--jade)' : 'var(--text3)',
            border: `1px solid ${isConnected ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`,
          }}>
            {isConnected ? 'Connected ✓' : 'Not connected'}
          </span>
        </div>
      </div>

      {provider === 'jira' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Base URL</label>
            <input style={inputStyle} value={config.base_url || ''} onChange={e => setConfig(c => ({ ...c, base_url: e.target.value }))} placeholder="https://team.atlassian.net" />
          </div>
          <div>
            <label style={labelStyle}>Project Key</label>
            <input style={inputStyle} value={config.project_key || ''} onChange={e => setConfig(c => ({ ...c, project_key: e.target.value }))} placeholder="PROJ" />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} value={config.email || ''} onChange={e => setConfig(c => ({ ...c, email: e.target.value }))} placeholder="you@company.com" />
          </div>
          <div>
            <label style={labelStyle}>API Token</label>
            <input style={inputStyle} type="password" value={config.api_token || ''} onChange={e => setConfig(c => ({ ...c, api_token: e.target.value }))} placeholder="Jira API token" />
          </div>
        </div>
      )}

      {(provider === 'slack' || provider === 'teams') && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Webhook URL</label>
          <input style={inputStyle} value={config.webhook_url || ''} onChange={e => setConfig(c => ({ ...c, webhook_url: e.target.value }))} placeholder={provider === 'slack' ? 'https://hooks.slack.com/services/...' : 'https://outlook.office.com/webhook/...'} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleTest} disabled={testing} style={{ ...btnStyle, background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          {testing ? 'Testing...' : '🧪 Test'}
        </button>
        <button onClick={handleSave} disabled={saving} style={btnStyle}>
          {saving ? 'Saving...' : '💾 Save'}
        </button>
        {provider === 'jira' && isConnected && (
          <button onClick={handleSync} disabled={syncing} style={{ ...btnStyle, background: 'var(--epic)', color: '#fff' }}>
            {syncing ? 'Syncing...' : '🔄 Sync Now'}
          </button>
        )}
        {isConnected && (
          <button onClick={handleDisconnect} disabled={saving} style={{ ...btnStyle, background: 'var(--bg3)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Admin Panel ──────────────────────────────────────────────────────────

export default function AdminPanel({ organizationId }) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (!organizationId) {
    return <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>Ingen organisation fundet.</div>;
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* SMTP */}
      <div style={{ marginBottom: 32 }}>
        <SmtpSettings organizationId={organizationId} toast={toast} setToast={setToast} />
      </div>

      {/* Integrations */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>🔌 Integrations</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Forbind Jira, Slack og Teams. Webhooks sender notifikationer ved events.</div>

        <IntegrationCard provider="jira" icon="🔗" organizationId={organizationId} setToast={setToast} />
        <IntegrationCard provider="slack" icon="💬" organizationId={organizationId} setToast={setToast} />
        <IntegrationCard provider="teams" icon="👥" organizationId={organizationId} setToast={setToast} />
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 };

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', color: 'var(--text)',
  fontSize: 13, padding: '8px 12px',
};

const btnStyle = {
  fontSize: 12, fontWeight: 600, padding: '8px 16px',
  borderRadius: 'var(--radius)', cursor: 'pointer',
  border: 'none', background: 'var(--jade)', color: '#0c0c0f',
};
