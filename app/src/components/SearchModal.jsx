import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from "../lib/errorHandler";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

const STATUS_COLORS = {
  backlog: 'var(--text3)',
  in_progress: 'var(--gold)',
  done: 'var(--jade)',
  blocked: 'var(--danger)',
};

function GroupHeader({ label }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'var(--text3)', padding: '8px 12px 4px',
    }}>
      {label}
    </div>
  );
}

function ResultRow({ result, type, isActive, onClick }) {
  const icon = type === 'items' ? '📋' : type === 'projects' ? '📁' : '🔄';

  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 12px', cursor: 'pointer', borderRadius: 6,
        background: isActive ? 'var(--jade-dim)' : 'transparent',
        border: isActive ? '1px solid rgba(0,200,150,0.2)' : '1px solid transparent',
        transition: 'background 0.1s',
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 2,
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg3)'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {result.item_code && <span style={{ color: 'var(--text3)', marginRight: 6, fontSize: 11 }}>{result.item_code}</span>}
          {result.title || result.name}
        </div>
        {(result.project_name || result.sprint_name) && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
            {[result.project_name, result.sprint_name].filter(Boolean).join(' › ')}
          </div>
        )}
        {result.description && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.description}
          </div>
        )}
      </div>
      {result.item_status && (
        <span style={{
          fontSize: 10, padding: '2px 6px', borderRadius: 4,
          background: 'var(--bg3)', color: STATUS_COLORS[result.item_status] || 'var(--text3)',
          flexShrink: 0, fontWeight: 600,
        }}>
          {result.item_status}
        </span>
      )}
    </div>
  );
}

export default function SearchModal({ onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ items: [], projects: [], sprints: [] });
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allResults = [
    ...results.projects.map(r => ({ ...r, _type: 'projects' })),
    ...results.items.map(r => ({ ...r, _type: 'items' })),
    ...results.sprints.map(r => ({ ...r, _type: 'sprints' })),
  ];

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults({ items: [], projects: [], sprints: [] });
      return;
    }
    setLoading(true);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=items,projects,sprints`, { headers });
      if (r.ok) {
        setResults(await r.json());
        setActiveIdx(0);
      }
    } catch (e) { handleError(e, "search-api"); }
    setLoading(false);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  function handleSelect(result) {
    const projectId = result.project_id || result.id;
    if (projectId && onNavigate) {
      onNavigate(projectId);
    }
    onClose();
  }

  function handleKey(e) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allResults.length > 0) {
      e.preventDefault();
      handleSelect(allResults[activeIdx]);
    }
  }

  const hasResults = allResults.length > 0;

  // Calculate global index offset for each group
  const projectOffset = 0;
  const itemOffset = results.projects.length;
  const sprintOffset = results.projects.length + results.items.length;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '80px 16px 16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 600,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 16, color: 'var(--text3)' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Søg items, projekter, sprints..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 15, color: 'var(--text)', fontFamily: 'var(--sans)',
            }}
          />
          {loading && <span style={{ fontSize: 11, color: 'var(--text3)' }}>...</span>}
          <kbd style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            color: 'var(--text3)',
          }}>esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: '6px 8px' }}>
          {!hasResults && !loading && query.length >= 2 && (
            <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
              Ingen resultater for "{query}"
            </div>
          )}
          {!hasResults && !loading && query.length < 2 && (
            <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
              Tast mindst 2 tegn for at søge
            </div>
          )}

          {results.projects.length > 0 && (
            <div>
              <GroupHeader label="Projekter" />
              {results.projects.map((r, i) => (
                <ResultRow
                  key={r.id}
                  result={r}
                  type="projects"
                  isActive={activeIdx === projectOffset + i}
                  onClick={() => handleSelect(r)}
                />
              ))}
            </div>
          )}

          {results.items.length > 0 && (
            <div>
              <GroupHeader label="Items" />
              {results.items.map((r, i) => (
                <ResultRow
                  key={r.id}
                  result={r}
                  type="items"
                  isActive={activeIdx === itemOffset + i}
                  onClick={() => handleSelect(r)}
                />
              ))}
            </div>
          )}

          {results.sprints.length > 0 && (
            <div>
              <GroupHeader label="Sprints" />
              {results.sprints.map((r, i) => (
                <ResultRow
                  key={r.id}
                  result={r}
                  type="sprints"
                  isActive={activeIdx === sprintOffset + i}
                  onClick={() => handleSelect(r)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {hasResults && (
          <div style={{
            borderTop: '1px solid var(--border)', padding: '6px 16px',
            display: 'flex', gap: 16, fontSize: 10, color: 'var(--text3)',
          }}>
            <span>↑↓ naviger</span>
            <span>↵ åbn</span>
            <span>esc luk</span>
          </div>
        )}
      </div>
    </div>
  );
}
