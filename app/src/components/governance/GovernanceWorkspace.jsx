import { governanceStyles as s, formatShortDate } from './styles';

export default function GovernanceWorkspace({
  loading,
  error,
  pending,
  approvedReady,
  conflicts,
  busyId,
  onApprove,
  onReject,
  onApply,
  onResolveConflict
}) {
  return (
    <div style={s.dashboardGrid}>
      <SectionBox title="PM Actions">
        {error && <div style={s.error}>{error}</div>}
        {loading && <div style={s.muted}>Henter governance data…</div>}

        {!loading && pending.length === 0 && approvedReady.length === 0 && (
          <div style={s.muted}>Ingen governance-actions lige nu.</div>
        )}

        {!loading && pending.map((req) => (
          <div key={req.id} style={s.queueItem}>
            <div style={s.queueMeta}>
              <div style={s.queueTarget}>{req.target_type} · {String(req.target_id).slice(0, 8)}</div>
              <div style={s.queueState}>{req.state}</div>
            </div>
            <div style={s.queueActions}>
              <button style={{ ...s.actionBtn, ...s.approveBtn }} onClick={() => onApprove(req.id)} disabled={Boolean(busyId)}>✅</button>
              <button style={{ ...s.actionBtn, ...s.rejectBtn }} onClick={() => onReject(req.id)} disabled={Boolean(busyId)}>✖</button>
            </div>
          </div>
        ))}

        {!loading && approvedReady.map((req) => (
          <div key={req.id} style={s.queueItemApproved}>
            <div style={s.queueMeta}>
              <div style={s.queueTarget}>{req.target_type} · {String(req.target_id).slice(0, 8)} · klar til apply</div>
              <div style={s.queueState}>approved</div>
            </div>
            <button style={{ ...s.actionBtn, ...s.applyBtn }} onClick={() => onApply(req.id)} disabled={Boolean(busyId)}>Apply</button>
          </div>
        ))}
      </SectionBox>

      <SectionBox title="Conflict Center">
        {(conflicts || []).slice(0, 5).map((c) => {
          const canResolve = Boolean(c?.payload?.attempted_patch && Object.keys(c.payload.attempted_patch || {}).length);
          return (
            <div key={c.id} style={s.conflictRow}>
              <div style={s.conflictMain}>
                <span style={s.conflictTarget}>{c.target_type || 'unknown'} · {String(c.target_id || 'n/a').slice(0, 8)}</span>
                <span style={s.conflictReason}>{c.payload?.reason || 'blocked write'}</span>
              </div>
              <div style={s.conflictMeta}>{c.source_layer || 'unknown'} · {formatShortDate(c.created_at)}</div>
              <div style={s.suggestionRow}>
                <span style={s.suggestionBadge}>Forslag: opret advisory request</span>
                <span style={s.suggestionBadge}>Tjek owner/policy mismatch</span>
                {canResolve && (
                  <button
                    style={{ ...s.actionBtn, ...s.applyBtn }}
                    onClick={() => onResolveConflict?.(c)}
                    disabled={busyId === `conflict-${c.id}`}
                  >
                    Resolve via queue
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!conflicts?.length && <div style={s.muted}>Ingen konflikter registreret.</div>}
      </SectionBox>
    </div>
  );
}

function SectionBox({ title, children }) {
  return (
    <div style={s.sectionBox}>
      <div style={s.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}
