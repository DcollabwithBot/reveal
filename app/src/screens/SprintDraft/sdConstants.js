export const STEPS = ['lobby', 'priority', 'draft', 'summary'];
export const PRIORITY_TOKENS = 5;
export const VOTE_TIMER_SECONDS = 60;
export const TSHIRT_MAP = { S: 2, M: 5, L: 8, XL: 13 };
export const QUICK_ESTIMATE_SECONDS = 15;

export const screenStyles = {
  container: {
    minHeight: '100vh', backgroundColor: '#0e1019', display: 'flex', justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace", padding: '24px 16px',
  },
  panel: {
    width: '100%', maxWidth: 800, padding: '24px',
    background: 'rgba(14, 16, 25, 0.95)', border: '2px solid var(--epic)',
    boxShadow: '0 0 30px rgba(124,58,237,0.2)', borderRadius: 'var(--radius)',
  },
  title: {
    margin: '0 0 8px', fontSize: 16, color: 'var(--epic)', textAlign: 'center',
    textShadow: '0 0 10px rgba(167,139,250,0.5)', letterSpacing: 2,
  },
  subtitle: { margin: '0 0 20px', fontSize: 10, color: 'var(--text2)', textAlign: 'center', letterSpacing: 1 },
  statRow: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  stat: { flex: 1, minWidth: 100, padding: '10px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center' },
  statLabel: { display: 'block', fontSize: 8, color: 'var(--text3)', marginBottom: 4, letterSpacing: 1 },
  statValue: { display: 'block', fontSize: 14, color: 'var(--text)', fontWeight: 700 },
  primaryBtn: {
    width: '100%', padding: '14px 20px', background: 'linear-gradient(135deg, var(--epic), #4f46e5)',
    border: '2px solid var(--epic)', color: '#fff', fontSize: 10, cursor: 'pointer', letterSpacing: 1,
    fontFamily: "'Press Start 2P', monospace", borderRadius: 'var(--radius)',
  },
  secondaryBtn: {
    width: '100%', padding: '10px 16px', background: 'transparent',
    border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 9, cursor: 'pointer',
    fontFamily: "'Press Start 2P', monospace", borderRadius: 'var(--radius)',
  },
  backBtn: {
    background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer',
    fontSize: 10, fontFamily: "'Press Start 2P', monospace", marginBottom: 16,
  },
  loading: { color: 'var(--text2)', padding: 48, textAlign: 'center', fontSize: 12 },
};

export const gaugeStyles = {
  container: { marginBottom: 16 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontFamily: "'Press Start 2P', monospace" },
  track: { height: 14, background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 'var(--radius)', transition: 'width 0.5s ease, background 0.3s ease' },
};

export const tokenBtnStyle = {
  width: 28, height: 28, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)',
  borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 14, fontWeight: 700,
  fontFamily: "'Press Start 2P', monospace",
};

export const actionBtn = {
  padding: '6px 12px', border: '1px solid', background: 'transparent',
  borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 10, fontWeight: 700,
  fontFamily: "'Press Start 2P', monospace",
};
