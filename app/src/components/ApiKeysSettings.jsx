import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const ALL_SCOPES = [
  { key: 'read:projects', label: 'Projects', desc: 'Adgang til projekter og metadata' },
  { key: 'read:sprints', label: 'Sprints', desc: 'Adgang til sprints og sprint-data' },
  { key: 'read:items', label: 'Items', desc: 'Adgang til backlog-items og estimater' },
  { key: 'read:time', label: 'Time Entries', desc: 'Adgang til tidsregistreringer' },
  { key: 'read:sessions', label: 'Sessions', desc: 'Adgang til game sessions og historik' },
  { key: 'read:team', label: 'Team / Leaderboard', desc: 'Adgang til teammedlemmer og leaderboard' },
];

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} style={{
      padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      background: copied ? 'var(--jade-dim)' : 'var(--bg3)',
      border: `1px solid ${copied ? 'var(--jade)' : 'var(--border)'}`,
      color: copied ? 'var(--jade)' : 'var(--text)',
      borderRadius: 6, transition: 'all 0.15s',
    }}>
      {copied ? '✓ Kopieret' : '📋 Kopiér'}
    </button>
  );
}

function NewKeyModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState(ALL_SCOPES.map(s => s.key));
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [error, setError] = useState(null);

  const toggleScope = (key) => {
    setScopes(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  const generateKey = async () => {
    if (!name.trim()) { setError('Navn er påkrævet'); return; }
    if (scopes.length === 0) { setError('Vælg mindst ét scope'); return; }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Ikke logget ind');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/reveal-api/generate-key`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          scopes,
          expires_at: expiresAt || null,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Fejl ved oprettelse');

      setNewKey(body.key);
      onCreated();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 32, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
      }}>
        {!newKey ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 24 }}>
              🔑 Opret ny API-nøgle
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                Navn *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="fx PowerBI rapport, Zapier integration..."
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 6,
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  color: 'var(--text)', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>
                Scopes
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ALL_SCOPES.map(s => (
                  <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={scopes.includes(s.key)}
                      onChange={() => toggleScope(s.key)}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                Udløbsdato (valgfrit)
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                style={{
                  padding: '10px 12px', fontSize: 14, borderRadius: 6,
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: '#ff4e4e', marginBottom: 16, padding: '10px 12px', background: 'rgba(255,78,78,0.1)', borderRadius: 6 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={onClose} disabled={loading} style={{
                padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'var(--bg3)', border: '1px solid var(--border)',
                color: 'var(--text)', borderRadius: 6,
              }}>
                Annullér
              </button>
              <button onClick={generateKey} disabled={loading} style={{
                padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6,
                opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Genererer...' : '🔑 Generér nøgle'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--jade)', marginBottom: 8 }}>
              ✅ API-nøgle oprettet!
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>
              <strong style={{ color: '#ff4e4e' }}>Kopiér nøglen NU.</strong> Den vises kun én gang og gemmes aldrig i systemet.
            </div>

            <div style={{
              background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '14px 16px', marginBottom: 16, wordBreak: 'break-all',
              fontFamily: 'monospace', fontSize: 13, color: 'var(--text)',
            }}>
              {newKey}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <CopyButton value={newKey} />
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
              Brug nøglen som: <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>Authorization: Bearer {newKey}</code>
            </div>

            <button onClick={onClose} style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6,
            }}>
              Luk
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ApiKeysSettings() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchKeys = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, key_prefix, name, scopes, last_used_at, created_at, expires_at, revoked_at')
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    if (!error) setKeys(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const revokeKey = async (keyId) => {
    if (!confirm('Er du sikker på du vil tilbagekalde denne nøgle? Det kan ikke fortrydes.')) return;
    setRevoking(keyId);
    const { error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyId);
    if (error) {
      showToast('Fejl ved tilbagekaldelse: ' + error.message, 'error');
    } else {
      showToast('Nøgle tilbagekaldt');
      fetchKeys();
    }
    setRevoking(null);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('da-DK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div style={{ position: 'relative' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 2000,
          background: toast.type === 'error' ? 'rgba(255,78,78,0.95)' : 'rgba(0,200,150,0.95)',
          color: '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>🔑 API-nøgler</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            Tilgå Reveal-data fra PowerBI, Zapier, Make eller andre integrationer.
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6,
            whiteSpace: 'nowrap',
          }}
        >
          + Ny nøgle
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '20px 0' }}>Henter nøgler...</div>
      ) : keys.length === 0 ? (
        <div style={{
          background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔑</div>
          <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 6 }}>Ingen API-nøgler endnu</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Opret en nøgle for at komme i gang med PowerBI eller andre integrationer.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Nøgle', 'Navn', 'Scopes', 'Sidst brugt', 'Oprettet', 'Udløber', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text2)' }}>{k.key_prefix}...</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>{k.name}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(k.scopes || []).map(s => (
                        <span key={s} style={{
                          fontSize: 10, padding: '2px 6px', borderRadius: 4,
                          background: 'var(--bg3)', border: '1px solid var(--border)',
                          color: 'var(--text2)', fontFamily: 'monospace',
                        }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{formatDate(k.last_used_at)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{formatDate(k.created_at)}</td>
                  <td style={{ padding: '10px 12px', color: k.expires_at && new Date(k.expires_at) < new Date() ? '#ff4e4e' : 'var(--text2)', whiteSpace: 'nowrap' }}>
                    {formatDate(k.expires_at)}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={() => revokeKey(k.id)}
                      disabled={revoking === k.id}
                      style={{
                        padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: 'rgba(255,78,78,0.1)', border: '1px solid rgba(255,78,78,0.3)',
                        color: '#ff4e4e', borderRadius: 5,
                        opacity: revoking === k.id ? 0.5 : 1,
                      }}
                    >
                      {revoking === k.id ? '...' : 'Tilbagekald'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <NewKeyModal
          onClose={() => setShowModal(false)}
          onCreated={() => { fetchKeys(); }}
        />
      )}
    </div>
  );
}
