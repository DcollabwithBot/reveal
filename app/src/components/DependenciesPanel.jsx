import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export default function DependenciesPanel({ itemId }) {
  const [deps, setDeps] = useState({ blocks: [], blocked_by: [] });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDepId, setNewDepId] = useState('');
  const [depType, setDepType] = useState('blocks');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDeps();
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDeps() {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/items/${itemId}/dependencies`, { headers });
      if (r.ok) {
        const data = await r.json();
        setDeps(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleAdd() {
    if (!newDepId.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/items/${itemId}/dependencies`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ depends_on_id: newDepId.trim(), dependency_type: depType }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || 'Fejl');
      } else {
        setNewDepId('');
        await loadDeps();
      }
    } catch (e) {
      setError(e.message);
    }
    setAdding(false);
  }

  async function handleRemove(depId) {
    try {
      const headers = await authHeaders();
      await fetch(`/api/dependencies/${depId}`, { method: 'DELETE', headers });
      await loadDeps();
    } catch { /* ignore */ }
  }

  if (loading) {
    return <div style={{ fontSize: 12, color: 'var(--text3)', padding: 12 }}>Loading dependencies...</div>;
  }

  return (
    <div>
      {/* Blocks (this item depends on) */}
      <Section
        title="🚫 Blocked by"
        subtitle="Dette item er blokeret af følgende items"
        items={deps.blocks}
        renderItem={(dep) => (
          <DepRow
            key={dep.id}
            depId={dep.id}
            item={dep.item}
            type={dep.dependency_type}
            onRemove={handleRemove}
          />
        )}
        emptyText="Ingen blockers"
      />

      {/* Blocked by (items depending on this) */}
      <Section
        title="⬇️ Blocks"
        subtitle="Følgende items afhænger af dette item"
        items={deps.blocked_by}
        renderItem={(dep) => (
          <DepRow
            key={dep.id}
            depId={dep.id}
            item={dep.item}
            type={dep.dependency_type}
            onRemove={handleRemove}
          />
        )}
        emptyText="Blokerer ingen items"
      />

      {/* Add dependency */}
      <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
          Tilføj dependency
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={newDepId}
            onChange={e => setNewDepId(e.target.value)}
            placeholder="Item ID (UUID)"
            style={{
              flex: 1, minWidth: 180,
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text)',
              fontSize: 11, padding: '6px 10px', outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--jade)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <select
            value={depType}
            onChange={e => setDepType(e.target.value)}
            style={{
              fontSize: 11, padding: '5px 8px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text)',
              outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="blocks">Blocks</option>
            <option value="relates_to">Relates to</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={adding || !newDepId.trim()}
            style={{
              fontSize: 11, fontWeight: 600, padding: '6px 14px',
              borderRadius: 'var(--radius)', cursor: adding ? 'wait' : 'pointer',
              background: 'var(--jade)', color: '#0c0c0f', border: 'none',
              opacity: adding ? 0.7 : 1,
            }}
          >
            {adding ? '...' : 'Tilføj'}
          </button>
        </div>
        {error && (
          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, items, renderItem, emptyText }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>{subtitle}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic', padding: '6px 0' }}>
          {emptyText}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );
}

function DepRow({ depId, item, type, onRemove }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px',
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 600,
        background: type === 'blocks' ? 'rgba(232,84,84,0.1)' : 'rgba(0,200,150,0.1)',
        color: type === 'blocks' ? 'var(--danger)' : 'var(--jade)',
        padding: '1px 6px', borderRadius: 10,
        border: `1px solid ${type === 'blocks' ? 'rgba(232,84,84,0.3)' : 'rgba(0,200,150,0.3)'}`,
      }}>
        {type === 'blocks' ? 'blocks' : 'relates'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--mono, monospace)', color: 'var(--text3)', marginRight: 6 }}>
          {item?.item_code || '—'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>
          {item?.title || 'Unknown item'}
        </span>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 500,
        color: item?.item_status === 'done' ? 'var(--jade)' : 'var(--text3)',
      }}>
        {item?.item_status || '—'}
      </span>
      <button
        onClick={() => onRemove(depId)}
        style={{
          fontSize: 12, color: 'var(--text3)', background: 'none',
          border: 'none', cursor: 'pointer', padding: '2px 4px',
          lineHeight: 1,
        }}
        title="Fjern dependency"
      >
        ✕
      </button>
    </div>
  );
}
