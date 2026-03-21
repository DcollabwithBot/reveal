import { useState, useEffect, useRef } from 'react';
import { getLeaderboard, getCurrentUserProfile } from '../../lib/api';

const CATEGORIES = [
  { id: 'xp',       icon: '🏆', label: 'XP Total' },
  { id: 'accuracy', icon: '🎯', label: 'Præcision' },
];

const RANK_COLORS = {
  1: '#feae34',  // gold
  2: '#5fcde4',  // silver/jade
  3: '#d77643',  // bronze
};

const RANK_LABELS = { 1: '👑', 2: '🥈', 3: '🥉' };

// Mini avatar sprite (pixel-art feel, CSS only)
function MiniAvatar({ avatarClass, size = 22 }) {
  const color = avatarClass?.color || '#f04f78';
  const icon = avatarClass?.icon || '⚔️';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color + '33',
      border: `2px solid ${color}66`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, flexShrink: 0,
    }}>
      {icon}
    </div>
  );
}

// Animated score counter
function AnimatedScore({ value, label, delay = 0 }) {
  const [displayed, setDisplayed] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = setTimeout(() => {
      const duration = 800;
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayed(Math.round(eased * value));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return <span>{displayed}{label?.replace(/^\d+/, '')}</span>;
}

// Single leaderboard row
function LeaderRow({ entry, currentUserId, animate, animDelay, compact }) {
  const isMe = entry.user_id === currentUserId;
  const rankColor = RANK_COLORS[entry.rank] || 'var(--text3)';
  const rankIcon = RANK_LABELS[entry.rank] || `#${entry.rank}`;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: compact ? 6 : 10,
      padding: compact ? '5px 8px' : '8px 12px',
      borderRadius: 8,
      background: isMe ? 'rgba(0,200,150,0.08)' : 'var(--bg2)',
      border: `1px solid ${isMe ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`,
      fontSize: compact ? 11 : 12,
      transition: 'background 0.2s',
    }}>
      {/* Rank */}
      <div style={{
        minWidth: compact ? 20 : 28, textAlign: 'center',
        fontSize: entry.rank <= 3 ? (compact ? 12 : 16) : (compact ? 10 : 12),
        color: rankColor, fontWeight: 700,
      }}>
        {rankIcon}
      </div>
      {/* Avatar */}
      {!compact && <MiniAvatar avatarClass={entry.avatar_class} size={28} />}
      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: isMe ? 700 : 500,
          color: isMe ? 'var(--jade)' : 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {entry.display_name}
          {isMe && <span style={{ fontSize: 9, marginLeft: 5, color: 'var(--jade)', opacity: 0.8 }}>▼ DIG</span>}
        </div>
        {!compact && (
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>
            Lv.{entry.level || 1}
          </div>
        )}
      </div>
      {/* Score */}
      <div style={{ fontWeight: 700, color: rankColor, fontFamily: compact ? 'inherit' : 'var(--mono, monospace)', fontSize: compact ? 11 : 13 }}>
        {animate
          ? <AnimatedScore value={entry.score} label={entry.scoreLabel} delay={animDelay} />
          : entry.scoreLabel}
      </div>
    </div>
  );
}

export default function Leaderboard({
  orgId,
  mode = 'full',   // 'full' | 'mini' | 'lobby' | 'widget'
  category: initialCategory = 'xp',
  currentUserId,
  title,
  showCategoryTabs = true,
  maxRows,
}) {
  const [category, setCategory] = useState(initialCategory);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [expanded, setExpanded] = useState(mode === 'full');

  const limit = maxRows || (mode === 'mini' || mode === 'widget' ? 3 : mode === 'lobby' ? 5 : 10);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getLeaderboard({ organizationId: orgId, category, limit }),
      currentUserId ? Promise.resolve(null) : getCurrentUserProfile(),
    ]).then(([lb, profile]) => {
      setEntries(lb);
      if (profile) setMe(profile);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [orgId, category, limit, currentUserId]);

  const resolvedUserId = currentUserId || me?.id;

  // WIDGET mode — collapsed pill
  if (mode === 'widget') {
    const top = entries[0];
    if (!top && !loading) return null;
    return (
      <div style={{ fontSize: 11, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>🏆</span>
        {loading ? '...' : top ? (
          <span>
            <span style={{ fontWeight: 700 }}>{top.display_name}</span>
            {' — '}{top.scoreLabel}
          </span>
        ) : '—'}
      </div>
    );
  }

  // MINI mode (inline top-3)
  if (mode === 'mini') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {title && (
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            🏆 {title || 'Top 3'}
          </div>
        )}
        {loading && <div style={{ fontSize: 11, color: 'var(--text3)' }}>Indlæser...</div>}
        {!loading && entries.slice(0, 3).map((e, i) => (
          <LeaderRow key={e.user_id} entry={e} currentUserId={resolvedUserId} compact animate animDelay={i * 150} />
        ))}
      </div>
    );
  }

  // LOBBY mode — compact top-5 with title
  if (mode === 'lobby') {
    return (
      <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 9, fontFamily: 'var(--pixel, monospace)', color: '#feae34', letterSpacing: '2px', marginBottom: 8, textTransform: 'uppercase' }}>
          🏆 Hvem er bedst i rummet?
        </div>
        {loading && <div style={{ fontSize: 10, color: '#888' }}>Indlæser...</div>}
        {!loading && entries.slice(0, 5).map((e, i) => (
          <LeaderRow key={e.user_id} entry={e} currentUserId={resolvedUserId} compact animate animDelay={i * 120} />
        ))}
      </div>
    );
  }

  // FULL mode
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 400, letterSpacing: '-0.01em' }}>
          🏆 Hall of Fame
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text3)', cursor: 'pointer' }}
        >
          {expanded ? '▲ Skjul' : '▼ Vis'}
        </button>
      </div>

      {expanded && (
        <>
          {/* Category tabs */}
          {showCategoryTabs && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  style={{
                    fontSize: 11, padding: '5px 12px', borderRadius: 16, cursor: 'pointer', border: '1px solid',
                    background: category === c.id ? 'rgba(200,168,75,0.12)' : 'none',
                    borderColor: category === c.id ? 'rgba(200,168,75,0.4)' : 'var(--border)',
                    color: category === c.id ? 'var(--gold)' : 'var(--text3)',
                    fontWeight: category === c.id ? 700 : 400,
                  }}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Entries */}
          {loading ? (
            <div style={{ color: 'var(--text3)', fontSize: 12 }}>Indlæser...</div>
          ) : entries.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 12 }}>Ingen data endnu — start en session!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {entries.map((e, i) => (
                <LeaderRow key={e.user_id} entry={e} currentUserId={resolvedUserId} animate animDelay={i * 100} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
