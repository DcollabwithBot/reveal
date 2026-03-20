import { useState, useCallback } from 'react';
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

export default function IntegrationsSettings({ sprints, projectId }) {
  const [baseUrl, setBaseUrl] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [targetSprintId, setTargetSprintId] = useState('');
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);

  const handleTestConnection = useCallback(async () => {
    if (!baseUrl || !jiraToken || !projectKey) {
      setToast({ message: 'Udfyld base URL, token og project key', type: 'error' });
      return;
    }
    setTesting(true);
    setPreview(null);
    try {
      const data = await edgeFn('jira-import', {
        action: 'preview',
        jira_token: jiraToken,
        jira_email: jiraEmail || undefined,
        base_url: baseUrl,
        project_key: projectKey,
      });
      setPreview(data);
      setToast({ message: `Fundet ${data.total} issues fra Jira`, type: 'info' });
    } catch (e) {
      setToast({ message: `Fejl: ${e.message}`, type: 'error' });
    }
    setTesting(false);
  }, [baseUrl, jiraToken, jiraEmail, projectKey]);

  const handleImport = useCallback(async () => {
    if (!preview?.issues?.length) return;
    setImporting(true);
    try {
      const data = await edgeFn('jira-import', {
        action: 'import',
        project_id: projectId,
        sprint_id: targetSprintId || undefined,
        items: preview.issues,
      });
      setResult(data);
      setPreview(null);
      setToast({ message: `✅ Importerede ${data.imported} items`, type: 'info' });
    } catch (e) {
      setToast({ message: `Import fejl: ${e.message}`, type: 'error' });
    }
    setImporting(false);
  }, [preview, projectId, targetSprintId]);

  const statusColor = (status) => {
    if (status === 'completed') return 'var(--jade)';
    if (status === 'active') return 'var(--gold)';
    return 'var(--text3)';
  };

  const priorityIcon = (p) => {
    if (p === 'high') return '🔴';
    if (p === 'medium') return '🟡';
    return '🟢';
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Jira Connection Section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 24 }}>🔗</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Connect Jira</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Importer issues fra Jira Cloud til Reveal</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Jira Base URL</label>
            <input
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://yourteam.atlassian.net"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Project Key</label>
            <input
              value={projectKey}
              onChange={e => setProjectKey(e.target.value)}
              placeholder="PROJ"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Email (Jira account)</label>
            <input
              value={jiraEmail}
              onChange={e => setJiraEmail(e.target.value)}
              placeholder="you@company.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>API Token</label>
            <input
              type="password"
              value={jiraToken}
              onChange={e => setJiraToken(e.target.value)}
              placeholder="Jira API token"
              style={inputStyle}
            />
          </div>
        </div>

        <button
          onClick={handleTestConnection}
          disabled={testing}
          style={{
            fontSize: 13, fontWeight: 600, padding: '8px 18px',
            borderRadius: 'var(--radius)', cursor: testing ? 'wait' : 'pointer',
            border: 'none', background: 'var(--jade)', color: '#0c0c0f',
            opacity: testing ? 0.7 : 1,
          }}
        >
          {testing ? 'Tester...' : '🔍 Test Connection & Preview'}
        </button>
      </div>

      {/* Preview Modal */}
      {preview && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                Preview: {preview.total} issues
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Review mapping inden import</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={targetSprintId}
                onChange={e => setTargetSprintId(e.target.value)}
                style={{
                  ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12,
                }}
              >
                <option value="">Vælg sprint...</option>
                {(sprints || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.sprint_code}</option>
                ))}
              </select>
              <button
                onClick={handleImport}
                disabled={importing}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '7px 16px',
                  borderRadius: 'var(--radius)', cursor: importing ? 'wait' : 'pointer',
                  border: 'none', background: 'var(--jade)', color: '#0c0c0f',
                }}
              >
                {importing ? 'Importerer...' : `✅ Import ${preview.total} issues`}
              </button>
              <button
                onClick={() => setPreview(null)}
                style={{
                  fontSize: 12, padding: '7px 12px', borderRadius: 'var(--radius)',
                  background: 'var(--bg3)', color: 'var(--text2)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                }}
              >
                Annuller
              </button>
            </div>
          </div>

          {/* Issues table */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>Key</th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Estimate</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Priority</th>
                  <th style={thStyle}>Assignee</th>
                </tr>
              </thead>
              <tbody>
                {preview.issues.map((issue, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--epic)', fontWeight: 600, fontSize: 11 }}>{issue.jira_key}</span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {issue.title}
                    </td>
                    <td style={tdStyle}>
                      {issue.estimated_hours ? `${issue.estimated_hours}h` : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: statusColor(issue.item_status), fontWeight: 500 }}>{issue.item_status}</span>
                    </td>
                    <td style={tdStyle}>{priorityIcon(issue.priority)} {issue.priority}</td>
                    <td style={tdStyle}>
                      {issue.assignee_name || issue.assignee_email || <span style={{ color: 'var(--text3)' }}>—</span>}
                      {issue.assigned_to && <span style={{ color: 'var(--jade)', marginLeft: 4 }}>✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Result */}
      {result && (
        <div style={{
          background: 'var(--jade-dim)', border: '1px solid rgba(0,200,150,0.3)',
          borderRadius: 'var(--radius)', padding: 16, marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--jade)', marginBottom: 4 }}>
            ✅ Import færdig
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            {result.imported} items importeret{result.sprint_id ? ` til sprint` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', color: 'var(--text)',
  fontSize: 13, padding: '8px 12px',
};

const thStyle = {
  textAlign: 'left', padding: '8px 10px',
  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.07em', color: 'var(--text3)',
};

const tdStyle = {
  padding: '8px 10px', color: 'var(--text)',
};
