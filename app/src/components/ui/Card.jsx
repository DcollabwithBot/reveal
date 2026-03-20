export function Card({ children, style, className, onClick }) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        ...style
      }}
    >
      {children}
    </div>
  );
}

export function KpiCard({ label, value, sub, color }) {
  return (
    <Card style={{ padding: 22 }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 38, lineHeight: 1, color: color || 'var(--text)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 7 }}>{sub}</div>}
    </Card>
  );
}

export function Pill({ children, variant = 'muted' }) {
  const styles = {
    jade: { background: 'var(--jade-dim)', borderColor: 'rgba(0,200,150,0.28)', color: 'var(--jade)' },
    warn: { background: 'var(--warn-dim)', borderColor: 'rgba(232,160,32,0.28)', color: 'var(--warn)' },
    danger: { background: 'var(--danger-dim)', borderColor: 'rgba(232,84,84,0.28)', color: 'var(--danger)' },
    epic: { background: 'var(--epic-dim)', borderColor: 'var(--epic-border)', color: 'var(--epic)' },
    gold: { background: 'var(--gold-dim)', borderColor: 'rgba(200,168,75,0.28)', color: 'var(--gold)' },
    muted: { background: 'var(--border)', borderColor: 'var(--border2)', color: 'var(--text2)' },
  };
  return (
    <span style={{ padding: '4px 11px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: '1px solid', ...styles[variant] }}>
      {children}
    </span>
  );
}
