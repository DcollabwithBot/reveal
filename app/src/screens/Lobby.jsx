export default function Lobby({ user, onContinue, onGuest }) {
  const displayName = user?.user_metadata?.full_name || user?.email || 'Spiller'
  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <div style={styles.container}>
      <div style={styles.scanlines} />

      <div style={styles.panel}>
        <div style={styles.titleBlock}>
          <h1 style={styles.title}>REVEAL</h1>
          <p style={styles.subtitle}>Planning Poker RPG</p>
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>VELKOMMEN</span>
          <span style={styles.dividerLine} />
        </div>

        {/* Player card */}
        <div style={styles.playerCard}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={styles.avatar} />
          ) : (
            <div style={styles.avatarPlaceholder}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={styles.playerInfo}>
            <p style={styles.playerLabel}>SPILLER</p>
            <p style={styles.playerName}>{displayName}</p>
          </div>
        </div>

        <button style={styles.continueBtn} onClick={onContinue}>
          ▶ FORTSÆT SOM {displayName.split(' ')[0].toUpperCase()}
        </button>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>ELLER</span>
          <span style={styles.dividerLine} />
        </div>

        <button style={styles.guestBtn} onClick={onGuest}>
          👤 SPIL SOM GÆST
        </button>

        <p style={styles.guestNote}>
          Som gæst gemmes XP og stats ikke
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0e1019',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace",
    position: 'relative',
    overflow: 'hidden',
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
    pointerEvents: 'none',
    zIndex: 1,
  },
  panel: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: '380px',
    padding: '32px 28px',
    background: 'rgba(14, 16, 25, 0.95)',
    border: '2px solid #7c3aed',
    boxShadow: '0 0 0 1px #4c1d95, 0 0 30px rgba(124,58,237,0.3)',
  },
  titleBlock: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    color: '#a78bfa',
    textShadow: '0 0 10px rgba(167,139,250,0.8), 2px 2px 0 #4c1d95',
    letterSpacing: '4px',
    fontFamily: "'Press Start 2P', monospace",
  },
  subtitle: {
    margin: '8px 0 0',
    fontSize: '8px',
    color: '#6b7280',
    letterSpacing: '2px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '20px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #4c1d95, transparent)',
  },
  dividerText: {
    fontSize: '8px',
    color: '#6b7280',
    letterSpacing: '2px',
    whiteSpace: 'nowrap',
  },
  playerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: '#1a1c2e',
    border: '1px solid #374151',
    marginBottom: '20px',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '2px',
    border: '2px solid #7c3aed',
    imageRendering: 'pixelated',
  },
  avatarPlaceholder: {
    width: '48px',
    height: '48px',
    borderRadius: '2px',
    border: '2px solid #7c3aed',
    background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    color: '#a78bfa',
    fontFamily: "'Press Start 2P', monospace",
    flexShrink: 0,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerLabel: {
    margin: '0 0 4px',
    fontSize: '7px',
    color: '#6b7280',
    letterSpacing: '2px',
  },
  playerName: {
    margin: 0,
    fontSize: '11px',
    color: '#e5e7eb',
    letterSpacing: '1px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  continueBtn: {
    width: '100%',
    padding: '14px 20px',
    background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #7c3aed 100%)',
    border: '2px solid #a78bfa',
    boxShadow: '0 0 0 1px #4c1d95, 4px 4px 0 #1e1b4b, 0 0 20px rgba(124,58,237,0.4)',
    color: '#fff',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '9px',
    cursor: 'pointer',
    letterSpacing: '1px',
  },
  guestBtn: {
    width: '100%',
    padding: '12px 20px',
    background: 'transparent',
    border: '2px solid #374151',
    color: '#9ca3af',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '9px',
    cursor: 'pointer',
    letterSpacing: '1px',
  },
  guestNote: {
    margin: '12px 0 0',
    fontSize: '7px',
    color: '#4b5563',
    textAlign: 'center',
    letterSpacing: '1px',
    lineHeight: '1.6',
  },
}
