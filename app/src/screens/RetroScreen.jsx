import { useEffect, useMemo, useState, useRef } from 'react';
import { getMembership, reportExportEvent } from '../lib/api';
import { supabase } from '../lib/supabase';
import { fetchProjectsForOrg, fetchSprintsForProjects } from '../lib/helpers/projectHelpers.js';
import { buildSprintExportFileBase, buildSprintExportPayload, buildSprintItemsCsv, resolveNextSprint } from '../domain/session/retro/sprintFlow';
import { Sprite } from '../components/session/SessionPrimitives.jsx';
import { CLASSES } from '../shared/constants.js';
import GameXPBar from '../components/session/GameXPBar.jsx';
import SoundToggle from '../components/session/SoundToggle.jsx';
import { useGameSound } from '../hooks/useGameSound.js';
import XPBadgeNotifier from '../components/XPBadgeNotifier.jsx';

const RETRO_COLS = [
  { key: 'well',    label: '↑ What went well',   color: 'var(--jade)',   bg: 'rgba(0,200,150,0.08)',   border: 'rgba(0,200,150,0.25)' },
  { key: 'improve', label: '→ Improve',           color: 'var(--warn)',   bg: 'rgba(200,168,75,0.08)',  border: 'rgba(200,168,75,0.25)' },
  { key: 'action',  label: '✓ Actions → Next',    color: 'var(--text2)',  bg: 'var(--bg3)',             border: 'var(--border)' },
];

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Sticky note ───────────────────────────────────────────────────────────────
function Sticky({ note, colColor, colBg, colBorder, currentUser, onDelete }) {
  const isOwn = note.user_id && currentUser?.id === note.user_id;
  return (
    <div style={{
      background: colBg, border: `1px solid ${colBorder}`,
      borderRadius: 'var(--radius)', padding: '11px 13px',
      marginBottom: 7, position: 'relative',
    }}>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 6 }}>{note.body}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isOwn && <Sprite m={{ name: '', cls: CLASSES[0], lv: 1, hat: CLASSES[0].color, body: CLASSES[0].color, skin: '#fdd' }} size={0.5} idle />}
          <span style={{ fontSize: 10, color: colColor, fontWeight: 600 }}>— {note.author_name}</span>
        </div>
        {isOwn && (
          <button onClick={() => onDelete(note.id)} style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
        )}
      </div>
    </div>
  );
}

// ── Add note form ─────────────────────────────────────────────────────────────
function AddNoteForm({ colKey, colColor, sprintId, orgId, currentUser, onAdded }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      const authorName = currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Unknown';
      const { data } = await supabase
        .from('retro_notes')
        .insert({ sprint_id: sprintId, organization_id: orgId, cat: colKey, body: text.trim(), author_name: authorName, user_id: currentUser?.id || null })
        .select().single();
      if (data) { onAdded(data); setText(''); }
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 5, marginTop: 4 }}>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Tilføj note..."
        style={{ flex: 1, background: 'var(--bg)', border: `1px solid ${colColor}`, borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, padding: '6px 10px', outline: 'none' }}
      />
      <button type="submit" disabled={saving || !text.trim()} style={{ fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--radius)', background: colColor, color: colKey === 'action' ? 'var(--text)' : '#fff', border: 'none', cursor: text.trim() ? 'pointer' : 'default' }}>
        +
      </button>
    </form>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RetroScreen({ onNavigate }) {
  const { soundEnabled, toggleSound } = useGameSound();
  const [sprints, setSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [projects, setProjects] = useState({});
  const [notes, setNotes] = useState([]);
  const [items, setItems] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retroTableExists, setRetroTableExists] = useState(true);
  const [dismissed, setDismissed] = useState([]);
  const [actionMessage, setActionMessage] = useState(null);
  const [acceptingNoteId, setAcceptingNoteId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const veteranTriggered = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data?.user || null)); // TODO: replace with useAuth hook
    loadData();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (selectedSprintId) {
      setDismissed([]);
      loadNotes(selectedSprintId);
    }
  }, [selectedSprintId]); // eslint-disable-line

  async function loadData() {
    setLoading(true);
    try {
      const membership = await getMembership();
      if (!membership?.organization_id) { setLoading(false); return; }
      setOrgId(membership.organization_id);

      const projs = await fetchProjectsForOrg(membership.organization_id);
      const pMap = {};
      projs.forEach(p => { pMap[p.id] = p; });
      setProjects(pMap);

      const projIds = projs.map(p => p.id);
      if (!projIds.length) { setLoading(false); return; }

      const sprintData = await fetchSprintsForProjects(projIds, {
        fields: 'id,name,project_id,status,sprint_code,start_date,created_at,updated_at',
      });
      // Sort: active first
      sprintData.sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1));
      setSprints(sprintData);
      if (sprintData.length) setSelectedSprintId(sprintData[0].id);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  async function loadNotes(sprintId) {
    // Load sprint items
    const { data: itemData } = await supabase
      .from('session_items').select('id,title,item_status,item_code,estimated_hours,hours_fak,hours_int,hours_ub')
      .eq('sprint_id', sprintId).order('item_order', { ascending: true });
    setItems(itemData || []);

    // Load retro notes (tabel kan mangle)
    try {
      const { data: noteData, error: noteErr } = await supabase
        .from('retro_notes').select('*').eq('sprint_id', sprintId).order('created_at', { ascending: true });
      if (noteErr?.message?.includes('does not exist') || noteErr?.code === 'PGRST205') {
        setRetroTableExists(false);
        setNotes([]);
      } else {
        setRetroTableExists(true);
        setNotes(noteData || []);
      }
    } catch { setRetroTableExists(false); setNotes([]); }
  }

  async function handleDeleteNote(noteId) {
    await supabase.from('retro_notes').delete().eq('id', noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
  }

  function handleNoteAdded(note) {
    setNotes(prev => {
      const updated = [...prev, note];
      // Retrospective Veteran: 10+ notes by this user → achievement
      if (currentUser?.id && !veteranTriggered.current) {
        const myCount = updated.filter(n => n.user_id === currentUser.id).length;
        if (myCount >= 10) {
          veteranTriggered.current = true;
          supabase.from('achievement_unlocks').insert({
            user_id: currentUser.id,
            achievement_key: 'retrospective_veteran',
            xp_awarded: 75,
          }).then(() => {}).catch(() => {});
        }
      }
      return updated;
    });
  }

  async function handleAcceptToNextSprint(note) {
    if (!selectedSprintId || !note || acceptingNoteId) return;
    setAcceptingNoteId(note.id);
    setActionMessage(null);

    try {
      const currentSprint = sprints.find(s => s.id === selectedSprintId) || null;
      const nextSprint = resolveNextSprint({ allSprints: sprints, currentSprintId: selectedSprintId });

      if (!nextSprint?.id) throw new Error('Ingen næste sprint fundet i sekvensen');

      const title = note.body.trim().slice(0, 180) || 'Action fra retro';
      const description = `Auto-oprettet fra retro note ${note.id} (${currentSprint?.name || selectedSprintId}).\n\nOriginal note:\n${note.body}`;

      const { error } = await supabase
        .from('session_items')
        .insert({
          sprint_id: nextSprint.id,
          title,
          description,
          priority: 'medium',
          item_status: 'backlog',
          status: 'pending',
          progress: 0,
        });

      if (error) throw error;

      setDismissed(prev => [...prev, note.id]);
      setActionMessage(`✅ Action flyttet til ${nextSprint.name}`);
    } catch (err) {
      setActionMessage(`❌ Kunne ikke flytte action: ${err.message}`);
    } finally {
      setAcceptingNoteId(null);
    }
  }

  function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleExportSprintReport(format = 'markdown') {
    if (!selectedSprint) return;
    setExporting(true);
    setActionMessage(null);

    try {
      const payload = buildSprintExportPayload({ sprint: selectedSprint, project, notes, items });
      const fileBase = buildSprintExportFileBase(selectedSprint);

      if (format === 'json') {
        downloadTextFile(JSON.stringify(payload, null, 2), `${fileBase}.json`, 'application/json;charset=utf-8');
      } else if (format === 'csv') {
        downloadTextFile(buildSprintItemsCsv(items), `${fileBase}.csv`, 'text/csv;charset=utf-8');
      } else {
        const report = [
          `# Sprint rapport — ${selectedSprint.name}`,
          '',
          `Eksporteret: ${payload.exported_at}`,
          `Projekt: ${project?.name || 'Ukendt'}`,
          '',
          '## Summary',
          `- Leveret: ${payload.summary.items_done}/${payload.summary.items_total}`,
          `- Rolled over: ${payload.summary.items_open}`,
          `- Timer logget: ${payload.summary.total_hours.toFixed(1)}h`,
          `- Retro noter: ${payload.summary.notes_total}`,
          '',
          '## What went well',
          ...(payload.notes.filter(n => n.category === 'well').length
            ? payload.notes.filter(n => n.category === 'well').map(n => `- ${n.body} (${n.author_name})`)
            : ['- Ingen noter']),
          '',
          '## Improve',
          ...(payload.notes.filter(n => n.category === 'improve').length
            ? payload.notes.filter(n => n.category === 'improve').map(n => `- ${n.body} (${n.author_name})`)
            : ['- Ingen noter']),
          '',
          '## Actions til næste sprint',
          ...(payload.notes.filter(n => n.category === 'action').length
            ? payload.notes.filter(n => n.category === 'action').map(n => `- ${n.body} (${n.author_name})`)
            : ['- Ingen actions']),
          '',
          '## Sprint items',
          ...(payload.items.length
            ? payload.items.map(item => {
                const h = (item.hours_fak || 0) + (item.hours_int || 0) + (item.hours_ub || 0);
                return `- [${item.status === 'done' ? 'x' : ' '}] ${item.code || 'ITEM'} ${item.title} · est ${item.estimated_hours || '-'}h · log ${h || 0}h`;
              })
            : ['- Ingen items']),
          '',
        ].join('\n');
        downloadTextFile(report, `${fileBase}.md`, 'text/markdown;charset=utf-8');
      }

      setActionMessage(`✅ Sprint rapport eksporteret (${format.toUpperCase()})`);
      reportExportEvent({
        projectId: project?.id,
        sprintId: selectedSprint?.id,
        format,
        ok: true,
      }).catch(() => {});
    } catch (err) {
      setActionMessage(`❌ Kunne ikke eksportere rapport: ${err.message}`);
      reportExportEvent({
        projectId: project?.id,
        sprintId: selectedSprint?.id,
        format,
        ok: false,
        error: err.message,
      }).catch(() => {});
    } finally {
      setExporting(false);
    }
  }

  const selectedSprint = sprints.find(s => s.id === selectedSprintId);
  const project = selectedSprint ? projects[selectedSprint.project_id] : null;
  const done = items.filter(i => i.item_status === 'done');
  const rolledOver = items.filter(i => i.item_status !== 'done');
  const totalH = items.reduce((s, i) => s + (i.hours_fak || 0) + (i.hours_int || 0) + (i.hours_ub || 0), 0);

  if (loading) return <div style={{ padding: 32, color: 'var(--text2)', fontSize: 13 }}>Loader retro...</div>;

  return (
    <div style={{ padding: 32 }}>
      {/* Game soul: XP bar + sound toggle */}
      {currentUser?.id && <XPBadgeNotifier userId={currentUser.id} />}
      {currentUser?.id && (
        <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 50, display: 'flex', gap: 8, alignItems: 'center' }}>
          <SoundToggle soundEnabled={soundEnabled} onToggle={toggleSound} size="sm" />
          <GameXPBar userId={currentUser.id} />
        </div>
      )}
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 30, letterSpacing: '-0.02em', marginBottom: 5 }}>
          {project?.icon || '📋'} {selectedSprint?.name || 'Retro & Close'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
          {done.length}/{items.length} items leveret · {totalH.toFixed(1)}h logget
        </div>

        {/* Sprint selector */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {sprints.map(s => {
            const p = projects[s.project_id];
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSprintId(s.id)}
                style={{
                  fontSize: 11, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: 'none',
                  background: selectedSprintId === s.id ? 'var(--jade-dim)' : 'var(--bg3)',
                  color: selectedSprintId === s.id ? 'var(--jade)' : 'var(--text2)',
                  outline: selectedSprintId === s.id ? '1px solid rgba(0,200,150,0.3)' : '1px solid var(--border)',
                }}
              >
                {p?.icon || '📋'} {s.name.replace('Sag ', '')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Leveret', value: `${done.length}/${items.length}`, color: done.length === items.length ? 'var(--jade)' : 'var(--text)', sub: `${rolledOver.length} rolled over` },
          { label: 'Timer logget', value: `${totalH.toFixed(0)}h`, color: 'var(--text)', sub: 'FAK + INT + UB' },
          { label: 'Done %', value: `${items.length ? Math.round(done.length / items.length * 100) : 0}%`, color: done.length / items.length >= 0.8 ? 'var(--jade)' : 'var(--warn)', sub: 'af sprint' },
          { label: 'Retro noter', value: notes.length, color: 'var(--text)', sub: `${notes.filter(n => n.cat === 'action').length} actions` },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 30, color: stat.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Achievement banner — V8+ gold style */}
      {done.length > 0 && items.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          background: 'linear-gradient(135deg, rgba(200,168,75,0.12) 0%, rgba(200,168,75,0.05) 100%)',
          border: '1px solid rgba(200,168,75,0.3)',
          borderRadius: 'var(--radius-lg)', padding: '18px 22px', marginBottom: 24,
        }}>
          <span style={{ fontSize: 30 }}>🏆</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)', marginBottom: 3 }}>
              {done.length === items.length
                ? 'Challenge Defeated: Perfekt sprint!'
                : `${done.length}/${items.length} items leveret`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {done.length === items.length
                ? `Alle ${items.length} items afsluttet · ${totalH.toFixed(0)}h investeret`
                : `${rolledOver.length} item${rolledOver.length !== 1 ? 's' : ''} rolled over · ${totalH.toFixed(0)}h logget`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--gold)', letterSpacing: '-0.02em' }}>
              +{done.length * 20} XP
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Team reward</div>
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', background: 'rgba(200,168,75,0.12)', border: '1px solid rgba(200,168,75,0.25)', borderRadius: 20, padding: '2px 10px' }}>
                Lv.{Math.floor(done.length / 3) + 4} → Lv.{Math.floor(done.length / 3) + 5} progress
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Retro board */}
      {!retroTableExists ? (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>Retro-noter er ikke aktiveret endnu.</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Kontakt admin for at køre retro_notes migration.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, letterSpacing: '-0.01em', margin: 0 }}>Retrospective Board</h2>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{selectedSprint?.name} · {notes.length} noter</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
            {RETRO_COLS.map(col => {
              const colNotes = notes.filter(n => n.cat === col.key);
              return (
                <div key={col.key}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: col.color, marginBottom: 10 }}>{col.label}</div>
                  {colNotes.map(note => (
                    <Sticky key={note.id} note={note} colColor={col.color} colBg={col.bg} colBorder={col.border} currentUser={currentUser} onDelete={handleDeleteNote} />
                  ))}
                  {colNotes.length === 0 && (
                    <div style={{ border: `1px dashed ${col.border}`, borderRadius: 'var(--radius)', padding: '14px', textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginBottom: 7 }}>
                      Ingen noter endnu
                    </div>
                  )}
                  {selectedSprintId && orgId && (
                    <AddNoteForm colKey={col.key} colColor={col.color} sprintId={selectedSprintId} orgId={orgId} currentUser={currentUser} onAdded={handleNoteAdded} />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Side Quest Discovery — auto-generated fra action-noter */}
      {retroTableExists && (() => {
        const actionNotes = notes.filter(n => n.cat === 'action');
        const pending = actionNotes.filter(n => !dismissed.includes(n.id));
        if (!pending.length) return null;
        return (
          <div style={{ background: 'var(--epic-dim)', border: '1px solid var(--epic-border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--epic)', marginBottom: 12 }}>
              ⚔ {pending.length} New Side Quest{pending.length > 1 ? 's' : ''} discovered from retro
            </div>
            {pending.map(note => (
              <div key={note.id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 3 }}>
                  "{note.body.slice(0, 60)}{note.body.length > 60 ? '…' : ''}" · auto-generated from retro action
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>
                  Oprettet af {note.author_name} · Kan konverteres til sprint task
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleAcceptToNextSprint(note)}
                    disabled={acceptingNoteId === note.id}
                    style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 'var(--radius)', background: 'var(--epic)', color: '#fff', border: 'none', cursor: acceptingNoteId === note.id ? 'wait' : 'pointer', opacity: acceptingNoteId === note.id ? 0.6 : 1 }}
                  >
                    {acceptingNoteId === note.id ? 'Flytter…' : 'Accept → Næste sprint'}
                  </button>
                  <button
                    onClick={() => setDismissed(prev => [...prev, note.id])}
                    style={{ fontSize: 12, padding: '7px 14px', borderRadius: 'var(--radius)', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Items overview */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, letterSpacing: '-0.01em', margin: 0 }}>Sprint items</h2>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{done.length} done · {rolledOver.length} rolled over</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 12, padding: '8px 16px', background: 'var(--bg3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)' }}>
          <span>Item</span><span>Status</span><span>FAK/INT/UB</span><span style={{ textAlign: 'right' }}>Est.</span>
        </div>
        {items.map(item => {
          const isDone = item.item_status === 'done';
          const h = (item.hours_fak || 0) + (item.hours_int || 0) + (item.hours_ub || 0);
          return (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 12, padding: '10px 16px', background: 'var(--bg2)', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)', marginRight: 8 }}>{item.item_code}</span>
                <span style={{ fontSize: 12, color: isDone ? 'var(--text2)' : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none' }}>{item.title}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: isDone ? 'var(--jade)' : 'var(--text3)' }}>{isDone ? '✓ Done' : 'Open'}</span>
              <span style={{ fontSize: 11, color: h > 0 ? 'var(--text2)' : 'var(--text3)' }}>{h > 0 ? `${h}h` : '—'}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>{item.estimated_hours || '—'}h</span>
            </div>
          );
        })}
      </div>

      {actionMessage && (
        <div style={{ marginBottom: 12, fontSize: 12, color: actionMessage.startsWith('❌') ? 'var(--danger, #ef4444)' : 'var(--jade)' }}>
          {actionMessage}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => onNavigate && onNavigate('game')}
          style={{ padding: '11px 20px', borderRadius: 'var(--radius)', background: 'var(--jade)', color: '#0c0c0f', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          ⚡ Start næste sprint estimation
        </button>
        <button
          onClick={() => handleExportSprintReport('markdown')}
          disabled={exporting || !selectedSprint}
          style={{ padding: '11px 20px', borderRadius: 'var(--radius)', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', fontSize: 13, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1 }}
        >
          {exporting ? 'Eksporterer…' : 'Export MD'}
        </button>
        <button
          onClick={() => handleExportSprintReport('json')}
          disabled={exporting || !selectedSprint}
          style={{ padding: '11px 20px', borderRadius: 'var(--radius)', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', fontSize: 13, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1 }}
        >
          Export JSON
        </button>
        <button
          onClick={() => handleExportSprintReport('csv')}
          disabled={exporting || !selectedSprint}
          style={{ padding: '11px 20px', borderRadius: 'var(--radius)', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', fontSize: 13, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1 }}
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
