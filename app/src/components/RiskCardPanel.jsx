import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from "../lib/errorHandler";

const RISK_CARDS = [
  { type: 'dependency_risk', icon: '🔗', label: 'Dependency Risk', desc: 'Afhænger af noget vi ikke kontrollerer' },
  { type: 'legacy_complexity', icon: '🏛️', label: 'Legacy Complexity', desc: 'Der er gammel kode/system involveret' },
  { type: 'unknown_unknowns', icon: '❓', label: 'Unknown Unknowns', desc: 'Vi ved ikke hvad vi ikke ved' },
  { type: 'single_point_of_knowledge', icon: '👤', label: 'Single PoK', desc: 'Kun én person kender dette' },
  { type: 'scope_creep', icon: '🎯', label: 'Scope Creep', desc: 'Scope er bredere end beskrevet' },
  { type: 'integration_risk', icon: '🔌', label: 'Integration Risk', desc: 'Ekstern integration involveret' },
];

export default function RiskCardPanel({ sessionId, sessionItemId, userId, displayName, isGm, C, PF }) {
  const [playedCards, setPlayedCards] = useState([]);
  const [feed, setFeed] = useState([]);
  const [noteModal, setNoteModal] = useState(null); // { type, icon, label }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    // Load existing cards
    supabase.from('session_risk_cards')
      .select('id, card_type, note, played_by, acknowledged, created_at, profiles(display_name)')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setFeed(data);
          setPlayedCards(data.filter(c => c.played_by === userId).map(c => c.card_type));
        }
      });

    // Realtime subscription
    const channel = supabase.channel(`risk-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'session_risk_cards',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        const newCard = payload.new;
        setFeed(prev => [newCard, ...prev]);
        if (newCard.played_by === userId) {
          setPlayedCards(prev => [...prev, newCard.card_type]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, userId]);

  async function playCard(cardType) {
    if (playedCards.includes(cardType)) return;
    setBusy(true);
    try {
      await supabase.from('session_risk_cards').insert({
        session_id: sessionId,
        session_item_id: sessionItemId || null,
        played_by: userId,
        card_type: cardType,
        note: note || null,
      });
      setNoteModal(null);
      setNote('');
    } catch (e) { handleError(e, "save-risk-note"); }
    setBusy(false);
  }

  function openNoteModal(card) {
    setNoteModal(card);
    setNote('');
  }

  const riskSummary = {};
  feed.forEach(c => {
    riskSummary[c.card_type] = (riskSummary[c.card_type] || 0) + 1;
  });

  return (
    <div style={{ marginTop: 12, padding: '10px', background: `${C?.bgL || '#1a1c2e'}dd`, border: `2px solid ${C?.brd || '#333'}`, position: 'relative' }}>
      <div style={{ fontFamily: PF, fontSize: '5px', color: C?.dim || '#666', letterSpacing: '2px', marginBottom: '6px', textAlign: 'center' }}>
        ◈ RISK CARDS ◈
      </div>

      {/* Card Grid */}
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
        {RISK_CARDS.map(card => {
          const played = playedCards.includes(card.type);
          const count = riskSummary[card.type] || 0;
          return (
            <div
              key={card.type}
              onClick={() => !played && openNoteModal(card)}
              title={card.desc}
              style={{
                fontFamily: PF, fontSize: '5px', padding: '5px 7px', cursor: played ? 'default' : 'pointer',
                background: played ? (C?.acc || '#f59e0b') : `${C?.bgL || '#1a1c2e'}dd`,
                color: played ? (C?.wht || '#fff') : (C?.txt || '#ddd'),
                border: `2px solid ${played ? (C?.acc || '#f59e0b') : (C?.brd || '#333')}`,
                opacity: played ? 1 : 0.85,
                transition: 'all 0.15s',
                position: 'relative',
                textAlign: 'center',
                minWidth: 52,
              }}
            >
              <div style={{ fontSize: '12px' }}>{card.icon}</div>
              <div style={{ fontSize: '4px', marginTop: 1 }}>{card.label}</div>
              {count > 0 && (
                <div style={{
                  position: 'absolute', top: -4, right: -4,
                  background: C?.red || '#e85454', color: '#fff',
                  fontSize: '4px', fontFamily: PF,
                  width: 12, height: 12, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {count}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Feed */}
      {feed.length > 0 && (
        <div style={{ maxHeight: 80, overflowY: 'auto', marginBottom: 4 }}>
          {feed.slice(0, 5).map((c, i) => {
            const cardDef = RISK_CARDS.find(r => r.type === c.card_type);
            const name = c.profiles?.display_name || 'Someone';
            return (
              <div key={c.id || i} style={{
                fontFamily: PF, fontSize: '5px', color: C?.dim || '#888',
                padding: '2px 0', borderBottom: `1px solid ${C?.brd || '#222'}44`,
              }}>
                {cardDef?.icon} <span style={{ color: C?.txt || '#ddd' }}>{name}</span> played{' '}
                <span style={{ color: C?.acc || '#f59e0b' }}>{cardDef?.label}</span>
                {c.note && <span style={{ color: C?.dim || '#666' }}> — "{c.note}"</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* GM Risk Summary */}
      {isGm && feed.length > 0 && (
        <div style={{
          fontFamily: PF, fontSize: '5px', color: C?.yel || '#eab308',
          padding: '4px 6px', background: `${C?.yel || '#eab308'}11`,
          border: `1px solid ${C?.yel || '#eab308'}33`,
          textAlign: 'center', marginTop: 4,
        }}>
          GM RISK OVERVIEW: {Object.entries(riskSummary).map(([type, count]) => {
            const card = RISK_CARDS.find(r => r.type === type);
            return `${card?.icon} ${count}`;
          }).join(' · ')} — Total: {feed.length} cards played
        </div>
      )}

      {/* Note Modal */}
      {noteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 300,
        }}
          onClick={() => setNoteModal(null)}
        >
          <div style={{
            background: C?.bgC || '#14162a', border: `3px solid ${C?.acc || '#f59e0b'}`,
            padding: '16px', maxWidth: 320, width: '90%',
          }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontFamily: PF, fontSize: '7px', color: C?.acc || '#f59e0b', marginBottom: 8, textAlign: 'center' }}>
              {noteModal.icon} {noteModal.label}
            </div>
            <div style={{ fontFamily: PF, fontSize: '5px', color: C?.dim || '#888', textAlign: 'center', marginBottom: 8 }}>
              {noteModal.desc || RISK_CARDS.find(r => r.type === noteModal.type)?.desc}
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Tilføj en note (valgfri)..."
              style={{
                width: '100%', minHeight: 50, fontFamily: PF, fontSize: '6px',
                background: C?.bg || '#0e1019', color: C?.txt || '#ddd',
                border: `2px solid ${C?.brd || '#333'}`, padding: 6,
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'center' }}>
              <button
                onClick={() => playCard(noteModal.type)}
                disabled={busy}
                style={{
                  fontFamily: PF, fontSize: '6px', padding: '6px 14px',
                  background: C?.acc || '#f59e0b', color: C?.bg || '#0e1019',
                  border: `2px solid ${C?.acc || '#f59e0b'}`, cursor: busy ? 'default' : 'pointer',
                }}
              >
                {busy ? '...' : `SPIL ${noteModal.icon}`}
              </button>
              <button
                onClick={() => setNoteModal(null)}
                style={{
                  fontFamily: PF, fontSize: '6px', padding: '6px 14px',
                  background: 'transparent', color: C?.dim || '#888',
                  border: `2px solid ${C?.brd || '#333'}`, cursor: 'pointer',
                }}
              >
                ANNULLER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { RISK_CARDS };
