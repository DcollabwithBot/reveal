import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const DKK = (n) => Number(n || 0).toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kr.';
const H = (n) => Number(n || 0).toFixed(1) + 't';

export default function TimelogScreen({ projectId, onBack }) {
  const [project, setProject] = useState(null);
  const [sprint, setSprint] = useState(null);
  const [items, setItems] = useState([]);
  const [entries, setEntries] = useState({}); // { itemId: [entries] }
  const [expanded, setExpanded] = useState({}); // { itemId: bool }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reg tid form state
  const [regForm, setRegForm] = useState(null); // { itemId } | null
  const [regData, setRegData] = useState({ entry_type: 'FAK', hours: '', km: '', registered_at: new Date().toISOString().slice(0, 10), note: '' });
  const [regBusy, setRegBusy] = useState(false);

  // Excel import state
  const [showImport, setShowImport] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Load project
      const { data: proj, error: pe } = await supabase
        .from('projects')
        .select('id, name, icon, status')
        .eq('id', projectId)
        .single();
      if (pe) throw pe;
      setProject(proj);

      // Load latest sprint for project
      const { data: sprintData, error: se } = await supabase
        .from('sprints')
        .select('id, name, sprint_code, status')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (se) throw se;
      setSprint(sprintData);

      // Load items for sprint
      const { data: itemsData, error: ie } = await supabase
        .from('session_items')
        .select('id, item_code, parent_code, title, status, item_status, estimated_hours, invoiced_dkk, to_invoice_dkk, item_order')
        .eq('sprint_id', sprintData.id)
        .order('item_order', { ascending: true });
      if (ie) throw ie;
      setItems(itemsData || []);

      // Load time_entries for all items
      const itemIds = (itemsData || []).map((i) => i.id);
      if (itemIds.length > 0) {
        const { data: te, error: tee } = await supabase
          .from('time_entries')
          .select('*')
          .in('session_item_id', itemIds)
          .order('registered_at', { ascending: false });
        if (tee) throw tee;
        const byItem = {};
        (te || []).forEach((e) => {
          if (!byItem[e.session_item_id]) byItem[e.session_item_id] = [];
          byItem[e.session_item_id].push(e);
        });
        setEntries(byItem);
      }
    } catch (err) {
      setError(err.message || 'Fejl ved indlæsning');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) load();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aggregate per item
  function itemStats(item) {
    const te = entries[item.id] || [];
    const fak = te.filter((e) => e.entry_type === 'FAK').reduce((a, e) => a + Number(e.hours || 0), 0);
    const int_ = te.filter((e) => e.entry_type === 'INT').reduce((a, e) => a + Number(e.hours || 0), 0);
    const ub = te.filter((e) => e.entry_type === 'UB').reduce((a, e) => a + Number(e.hours || 0), 0);
    const km = te.filter((e) => e.entry_type === 'Kørsel').reduce((a, e) => a + Number(e.km || 0), 0);
    const totalKr = fak * 1200 + km * 3.76;
    return { fak, int: int_, ub, km, totalKr };
  }

  // Project-level KPIs
  const allStats = items.reduce(
    (acc, item) => {
      const s = itemStats(item);
      acc.fak += s.fak;
      acc.int += s.int;
      acc.invoiced += Number(item.invoiced_dkk || 0);
      acc.toInvoice += Number(item.to_invoice_dkk || 0);
      return acc;
    },
    { fak: 0, int: 0, invoiced: 0, toInvoice: 0 }
  );

  async function handleRegSubmit(itemId) {
    setRegBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        session_item_id: itemId,
        entry_type: regData.entry_type,
        hours: regData.entry_type === 'Kørsel' ? (regData.hours || 2) : Number(regData.hours),
        km: regData.entry_type === 'Kørsel' ? Number(regData.km) : null,
        hourly_rate: regData.entry_type === 'FAK' ? 1200 : 0,
        registered_at: regData.registered_at,
        note: regData.note || null,
        user_id: user?.id || null,
      };
      const { error: err } = await supabase.from('time_entries').insert(payload);
      if (err) throw err;

      // Auto-update actual_hours on session_item by summing all time_entries for this item
      if (regData.entry_type !== 'Kørsel') {
        const { data: allEntries } = await supabase
          .from('time_entries')
          .select('hours')
          .eq('session_item_id', itemId)
          .neq('entry_type', 'Kørsel');
        const totalHours = (allEntries || []).reduce((sum, e) => sum + (Number(e.hours) || 0), 0) + Number(regData.hours || 0);
        await supabase
          .from('session_items')
          .update({ actual_hours: Math.round(totalHours * 10) / 10 })
          .eq('id', itemId)
          .catch(() => {});
      }

      setRegForm(null);
      setRegData({ entry_type: 'FAK', hours: '', km: '', registered_at: new Date().toISOString().slice(0, 10), note: '' });
      await load();
    } catch (err) {
      alert('Fejl: ' + err.message);
    } finally {
      setRegBusy(false);
    }
  }

  // Parse pasted tab-separated Excel data
  function parsePaste(text) {
    const lines = text.trim().split('\n').filter((l) => l.trim());
    if (!lines.length) return [];
    const rows = lines.map((line) =>
      line.split('\t').map((c) => c.trim())
    );
    return rows;
  }

  function handlePasteParse() {
    const rows = parsePaste(pasteText);
    setParsedRows(rows);
    setImportMsg('');
  }

  async function handleImport() {
    if (!parsedRows.length) return;
    setImportBusy(true);
    setImportMsg('');
    try {
      // Expected columns: Kode | Type | Timer/km | Dato | Note
      // Row: item_code | entry_type | hours_or_km | date | note
      const itemCodeMap = {};
      items.forEach((i) => { itemCodeMap[i.item_code] = i.id; });

      const toInsert = [];
      const skipped = [];

      for (const row of parsedRows) {
        if (row.length < 3) { skipped.push(row.join('\t')); continue; }
        const [code, type, valueStr, date, note] = row;
        const itemId = itemCodeMap[code];
        if (!itemId) { skipped.push(`Ukendt kode: ${code}`); continue; }
        const validTypes = ['FAK', 'INT', 'UB', 'Kørsel'];
        const entryType = validTypes.find((t) => t.toLowerCase() === type.toLowerCase()) || null;
        if (!entryType) { skipped.push(`Ukendt type: ${type}`); continue; }
        const value = parseFloat(valueStr.replace(',', '.'));
        if (isNaN(value) || value <= 0) { skipped.push(`Ugyldig værdi: ${valueStr}`); continue; }
        toInsert.push({
          session_item_id: itemId,
          entry_type: entryType,
          hours: entryType === 'Kørsel' ? 1 : value,
          km: entryType === 'Kørsel' ? value : null,
          hourly_rate: entryType === 'FAK' ? 1200 : 0,
          registered_at: date || new Date().toISOString().slice(0, 10),
          note: note || null,
        });
      }

      if (toInsert.length > 0) {
        const { error: ie } = await supabase.from('time_entries').insert(toInsert);
        if (ie) throw ie;

        // Log import
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('excel_imports').insert({
          project_id: projectId,
          filename: 'paste-import',
          row_count: toInsert.length,
          imported_by: user?.id || null,
          raw_data: parsedRows,
        });
      }

      setImportMsg(
        `✓ ${toInsert.length} rækker importeret${skipped.length > 0 ? ` · ${skipped.length} skippet: ${skipped.slice(0, 3).join(', ')}` : ''}`
      );
      setPasteText('');
      setParsedRows([]);
      await load();
    } catch (err) {
      setImportMsg('Fejl: ' + err.message);
    } finally {
      setImportBusy(false);
    }
  }

  if (loading) return <div style={s.loading}>Indlæser timelog...</div>;
  if (error) return <div style={s.error}>Fejl: {error}</div>;
  if (!project || !sprint) return <div style={s.error}>Projekt ikke fundet</div>;

  const totals = items.reduce(
    (acc, item) => {
      const st = itemStats(item);
      acc.fak += st.fak;
      acc.int += st.int;
      acc.ub += st.ub;
      acc.km += st.km;
      acc.est += Number(item.estimated_hours || 0);
      acc.invoiced += Number(item.invoiced_dkk || 0);
      acc.toInvoice += Number(item.to_invoice_dkk || 0);
      acc.totalKr += st.totalKr;
      return acc;
    },
    { fak: 0, int: 0, ub: 0, km: 0, est: 0, invoiced: 0, toInvoice: 0, totalKr: 0 }
  );

  return (
    <div style={s.container}>
      <div style={s.scanlines} />
      <div style={s.panel}>
        {/* Header */}
        <div style={s.topbar}>
          <button style={s.ghostBtn} onClick={onBack}>← Tilbage</button>
          <div>
            <div style={s.projectTitle}>{project.icon || '📋'} {project.name}</div>
            <div style={s.projectSub}>Sag {sprint.sprint_code} · {sprint.name}</div>
          </div>
          <button style={s.importBtn} onClick={() => setShowImport(true)}>📥 Excel import</button>
        </div>

        {/* KPI cards */}
        <div style={s.kpiRow}>
          <KpiCard label="Timer FAK" value={H(allStats.fak)} color="#34d399" />
          <KpiCard label="Timer INT" value={H(allStats.int)} color="#60a5fa" />
          <KpiCard label="Faktureret" value={DKK(allStats.invoiced)} color="#fbbf24" />
          <KpiCard label="Til fakturering" value={DKK(allStats.toInvoice)} color="#f472b6" />
        </div>

        {/* Column headers */}
        <div style={s.tableHeader}>
          <span style={{ ...s.col, flex: '0 0 80px' }}>Kode</span>
          <span style={{ ...s.col, flex: 1 }}>Opgave</span>
          <span style={{ ...s.col, flex: '0 0 72px', textAlign: 'right' }}>Est.t</span>
          <span style={{ ...s.col, flex: '0 0 62px', textAlign: 'right' }}>FAK</span>
          <span style={{ ...s.col, flex: '0 0 62px', textAlign: 'right' }}>INT</span>
          <span style={{ ...s.col, flex: '0 0 54px', textAlign: 'right' }}>UB</span>
          <span style={{ ...s.col, flex: '0 0 62px', textAlign: 'right' }}>km</span>
          <span style={{ ...s.col, flex: '0 0 120px', textAlign: 'right' }}>Faktureret</span>
          <span style={{ ...s.col, flex: '0 0 110px', textAlign: 'right' }}>Til fakt.</span>
          <span style={{ ...s.col, flex: '0 0 110px', textAlign: 'right' }}>Total kr.</span>
          <span style={{ flex: '0 0 110px' }} />
        </div>

        {/* Task rows */}
        {items.map((item) => {
          const st = itemStats(item);
          const isOpen = expanded[item.id];
          const itemEntries = entries[item.id] || [];
          const statusColor = item.item_status === 'done' ? '#34d399' : item.item_status === 'in_progress' ? '#fbbf24' : '#6b7280';

          return (
            <div key={item.id} style={s.itemBlock}>
              {/* Main row */}
              <div
                style={{ ...s.itemRow, cursor: 'pointer' }}
                onClick={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}
              >
                <span style={{ ...s.col, flex: '0 0 80px', color: '#a78bfa', fontFamily: 'monospace', fontSize: '11px' }}>
                  {item.item_code || '—'}
                </span>
                <span style={{ ...s.col, flex: 1, color: '#e5e7eb' }}>
                  <span style={{ color: statusColor, marginRight: 6 }}>●</span>
                  {item.title}
                  {isOpen ? ' ▲' : ' ▼'}
                </span>
                <span style={{ ...s.col, flex: '0 0 72px', textAlign: 'right', color: '#9ca3af' }}>{H(item.estimated_hours)}</span>
                <span style={{ ...s.col, flex: '0 0 62px', textAlign: 'right', color: '#34d399' }}>{H(st.fak)}</span>
                <span style={{ ...s.col, flex: '0 0 62px', textAlign: 'right', color: '#60a5fa' }}>{H(st.int)}</span>
                <span style={{ ...s.col, flex: '0 0 54px', textAlign: 'right', color: '#9ca3af' }}>{H(st.ub)}</span>
                <span style={{ ...s.col, flex: '0 0 62px', textAlign: 'right', color: '#9ca3af' }}>{st.km > 0 ? st.km : '—'}</span>
                <span style={{ ...s.col, flex: '0 0 120px', textAlign: 'right', color: '#fbbf24' }}>{DKK(item.invoiced_dkk)}</span>
                <span style={{ ...s.col, flex: '0 0 110px', textAlign: 'right', color: '#f472b6' }}>{DKK(item.to_invoice_dkk)}</span>
                <span style={{ ...s.col, flex: '0 0 110px', textAlign: 'right', color: '#e5e7eb' }}>{DKK(st.totalKr)}</span>
                <span style={{ flex: '0 0 110px', textAlign: 'right' }}>
                  <button
                    style={s.regBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRegForm(item.id);
                      setExpanded((ex) => ({ ...ex, [item.id]: true }));
                    }}
                  >
                    + Tid
                  </button>
                </span>
              </div>

              {/* Expanded: entries datagrid + reg form */}
              {isOpen && (
                <div style={s.entriesBlock}>
                  {itemEntries.length > 0 && (
                    <div style={s.entriesTable}>
                      <div style={s.entryHeader}>
                        <span style={{ flex: '0 0 80px' }}>Dato</span>
                        <span style={{ flex: '0 0 70px' }}>Type</span>
                        <span style={{ flex: '0 0 60px', textAlign: 'right' }}>Timer</span>
                        <span style={{ flex: '0 0 60px', textAlign: 'right' }}>km</span>
                        <span style={{ flex: '0 0 80px', textAlign: 'right' }}>DKK</span>
                        <span style={{ flex: 1 }}>Note</span>
                        <span style={{ flex: '0 0 80px', textAlign: 'right' }}>Faktureret</span>
                      </div>
                      {itemEntries.map((te) => {
                        const dkk = te.entry_type === 'FAK' ? Number(te.hours) * 1200
                          : te.entry_type === 'Kørsel' ? Number(te.km || 0) * 3.76 : 0;
                        return (
                          <div key={te.id} style={s.entryRow}>
                            <span style={{ flex: '0 0 80px', color: '#9ca3af' }}>{te.registered_at}</span>
                            <span style={{ flex: '0 0 70px' }}>
                              <TypeBadge type={te.entry_type} />
                            </span>
                            <span style={{ flex: '0 0 60px', textAlign: 'right', color: '#e5e7eb' }}>{te.entry_type !== 'Kørsel' ? H(te.hours) : '—'}</span>
                            <span style={{ flex: '0 0 60px', textAlign: 'right', color: '#9ca3af' }}>{te.km ? te.km : '—'}</span>
                            <span style={{ flex: '0 0 80px', textAlign: 'right', color: '#fbbf24' }}>{dkk > 0 ? DKK(dkk) : '—'}</span>
                            <span style={{ flex: 1, color: '#6b7280', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{te.note || ''}</span>
                            <span style={{ flex: '0 0 80px', textAlign: 'right', color: te.invoiced ? '#34d399' : '#6b7280' }}>
                              {te.invoiced ? '✓ Fakt.' : 'Pending'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {itemEntries.length === 0 && (
                    <div style={{ padding: '8px 12px', color: '#4b5563', fontSize: '10px' }}>Ingen tidsregistreringer endnu.</div>
                  )}

                  {/* Inline reg form */}
                  {regForm === item.id && (
                    <div style={s.regFormBlock}>
                      <div style={s.regFormTitle}>Registrer tid — {item.title}</div>
                      <div style={s.regFormRow}>
                        <label style={s.label}>Type</label>
                        <select style={s.select} value={regData.entry_type} onChange={(e) => setRegData((d) => ({ ...d, entry_type: e.target.value }))}>
                          {['FAK', 'INT', 'UB', 'Kørsel'].map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {regData.entry_type !== 'Kørsel' ? (
                          <>
                            <label style={s.label}>Timer</label>
                            <input style={s.input} type="number" min="0.25" step="0.25" value={regData.hours} onChange={(e) => setRegData((d) => ({ ...d, hours: e.target.value }))} placeholder="t" />
                          </>
                        ) : (
                          <>
                            <label style={s.label}>km</label>
                            <input style={s.input} type="number" min="1" value={regData.km} onChange={(e) => setRegData((d) => ({ ...d, km: e.target.value }))} placeholder="km" />
                          </>
                        )}
                        <label style={s.label}>Dato</label>
                        <input style={s.input} type="date" value={regData.registered_at} onChange={(e) => setRegData((d) => ({ ...d, registered_at: e.target.value }))} />
                        <label style={s.label}>Note</label>
                        <input style={{ ...s.input, flex: 1 }} type="text" value={regData.note} onChange={(e) => setRegData((d) => ({ ...d, note: e.target.value }))} placeholder="Kort beskrivelse..." />
                        <button style={s.saveBtn} disabled={regBusy} onClick={() => handleRegSubmit(item.id)}>
                          {regBusy ? '...' : '✓ Gem'}
                        </button>
                        <button style={s.cancelBtn} onClick={() => setRegForm(null)}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Totals row */}
        <div style={s.totalsRow}>
          <span style={{ flex: '0 0 80px' }} />
          <span style={{ ...s.col, flex: 1, color: '#9ca3af', fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}>TOTAL</span>
          <span style={{ ...s.col, flex: '0 0 72px', textAlign: 'right', color: '#9ca3af' }}>{H(totals.est)}</span>
          <span style={{ ...s.col, flex: '0 0 62px', textAlign: 'right', color: '#34d399', fontWeight: 'bold' }}>{H(totals.fak)}</span>
          <span style={{ ...s.col, flex: '0 0 62px', textAlign: 'right', color: '#60a5fa', fontWeight: 'bold' }}>{H(totals.int)}</span>
          <span style={{ ...s.col, flex: '0 0 54px', textAlign: 'right', color: '#9ca3af' }}>{H(totals.ub)}</span>
          <span style={{ ...s.col, flex: '0 0 62px', textAlign: 'right', color: '#9ca3af' }}>{totals.km > 0 ? totals.km : '—'}</span>
          <span style={{ ...s.col, flex: '0 0 120px', textAlign: 'right', color: '#fbbf24', fontWeight: 'bold' }}>{DKK(totals.invoiced)}</span>
          <span style={{ ...s.col, flex: '0 0 110px', textAlign: 'right', color: '#f472b6', fontWeight: 'bold' }}>{DKK(totals.toInvoice)}</span>
          <span style={{ ...s.col, flex: '0 0 110px', textAlign: 'right', color: '#e5e7eb', fontWeight: 'bold' }}>{DKK(totals.totalKr)}</span>
          <span style={{ flex: '0 0 110px' }} />
        </div>

        {/* Excel Import Modal */}
        {showImport && (
          <div style={s.modalOverlay}>
            <div style={s.modal}>
              <div style={s.modalTitle}>📥 Excel Import — Paste fra Excel</div>
              <div style={s.modalHint}>
                Kolonner (tab-separeret): <code style={s.code}>Kode | Type | Timer/km | Dato | Note</code><br />
                Eksempel: <code style={s.code}>2001-4	FAK	8	2026-03-15	Dokumentationsdag</code><br />
                Gyldige typer: FAK, INT, UB, Kørsel
              </div>
              <textarea
                style={s.pasteArea}
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setParsedRows([]); setImportMsg(''); }}
                placeholder="Paste Excel-rækker her..."
                rows={8}
              />
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button style={s.parseBtn} onClick={handlePasteParse} disabled={!pasteText.trim()}>
                  🔍 Parse preview
                </button>
              </div>

              {parsedRows.length > 0 && (
                <div style={s.previewBlock}>
                  <div style={{ color: '#9ca3af', fontSize: '10px', marginBottom: 6 }}>Preview — {parsedRows.length} rækker:</div>
                  {parsedRows.slice(0, 10).map((row, i) => (
                    <div key={i} style={s.previewRow}>
                      {row.map((cell, j) => (
                        <span key={j} style={s.previewCell}>{cell}</span>
                      ))}
                    </div>
                  ))}
                  {parsedRows.length > 10 && <div style={{ color: '#6b7280', fontSize: '10px' }}>... og {parsedRows.length - 10} mere</div>}
                </div>
              )}

              {importMsg && <div style={{ color: importMsg.startsWith('✓') ? '#34d399' : '#f87171', fontSize: '10px', marginBottom: 8 }}>{importMsg}</div>}

              <div style={{ display: 'flex', gap: 8 }}>
                {parsedRows.length > 0 && (
                  <button style={s.importConfirmBtn} onClick={handleImport} disabled={importBusy}>
                    {importBusy ? 'Importerer...' : `✓ Importer ${parsedRows.length} rækker`}
                  </button>
                )}
                <button style={s.cancelBtn} onClick={() => { setShowImport(false); setPasteText(''); setParsedRows([]); setImportMsg(''); }}>
                  ✕ Luk
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <div style={{ ...kpi.card, borderColor: color + '44' }}>
      <div style={{ ...kpi.value, color }}>{value}</div>
      <div style={kpi.label}>{label}</div>
    </div>
  );
}

function TypeBadge({ type }) {
  const colors = { FAK: '#34d399', INT: '#60a5fa', UB: '#fbbf24', Kørsel: '#c084fc' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      background: (colors[type] || '#6b7280') + '22',
      color: colors[type] || '#6b7280',
      border: `1px solid ${(colors[type] || '#6b7280')}44`,
      borderRadius: 3,
      fontSize: '9px',
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }}>
      {type}
    </span>
  );
}

const kpi = {
  card: {
    flex: 1,
    padding: '14px 16px',
    background: 'rgba(30,32,48,0.8)',
    border: '1px solid',
    borderRadius: 4,
    minWidth: 0,
  },
  value: {
    fontSize: '18px',
    fontFamily: "'Press Start 2P', monospace",
    marginBottom: 6,
  },
  label: {
    fontSize: '9px',
    color: '#6b7280',
    fontFamily: "'Press Start 2P', monospace",
    letterSpacing: '0.5px',
  },
};

const s = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0e1019',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    fontFamily: "'VT323', monospace",
    fontSize: '14px',
    position: 'relative',
    padding: '24px 16px',
  },
  scanlines: {
    position: 'fixed',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
    pointerEvents: 'none',
    zIndex: 1,
  },
  panel: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: '1200px',
    background: 'rgba(14, 16, 25, 0.97)',
    border: '2px solid #4c1d95',
    boxShadow: '0 0 30px rgba(124,58,237,0.2)',
    padding: '24px',
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  projectTitle: {
    fontSize: '18px',
    color: '#e5e7eb',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '13px',
  },
  projectSub: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  ghostBtn: {
    padding: '8px 12px',
    background: 'transparent',
    border: '1px solid #4b5563',
    color: '#9ca3af',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '8px',
    cursor: 'pointer',
  },
  importBtn: {
    padding: '8px 14px',
    background: 'rgba(124,58,237,0.15)',
    border: '1px solid #7c3aed',
    color: '#a78bfa',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '8px',
    cursor: 'pointer',
  },
  kpiRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 24,
  },
  tableHeader: {
    display: 'flex',
    padding: '6px 12px',
    background: 'rgba(30,32,48,0.6)',
    borderBottom: '1px solid #1f2937',
    fontSize: '10px',
    color: '#4b5563',
    fontFamily: "'Press Start 2P', monospace",
    letterSpacing: '0.3px',
    gap: 8,
  },
  col: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemBlock: {
    borderBottom: '1px solid #1a1c2e',
  },
  itemRow: {
    display: 'flex',
    padding: '10px 12px',
    alignItems: 'center',
    gap: 8,
    transition: 'background 0.15s',
    ':hover': { background: 'rgba(124,58,237,0.05)' },
  },
  entriesBlock: {
    background: 'rgba(10,12,20,0.6)',
    borderTop: '1px solid #1a1c2e',
    padding: '8px 16px 12px',
  },
  entriesTable: {
    marginBottom: 8,
  },
  entryHeader: {
    display: 'flex',
    gap: 8,
    padding: '4px 0',
    borderBottom: '1px solid #1f2937',
    fontSize: '9px',
    color: '#374151',
    fontFamily: "'Press Start 2P', monospace",
    marginBottom: 4,
  },
  entryRow: {
    display: 'flex',
    gap: 8,
    padding: '4px 0',
    fontSize: '12px',
    borderBottom: '1px solid #111827',
    alignItems: 'center',
  },
  regBtn: {
    padding: '4px 10px',
    background: 'rgba(52,211,153,0.1)',
    border: '1px solid #34d39944',
    color: '#34d399',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '7px',
    cursor: 'pointer',
  },
  regFormBlock: {
    background: 'rgba(20,22,34,0.8)',
    border: '1px solid #7c3aed44',
    padding: '12px',
    marginTop: 8,
    borderRadius: 4,
  },
  regFormTitle: {
    fontSize: '10px',
    color: '#a78bfa',
    fontFamily: "'Press Start 2P', monospace",
    marginBottom: 10,
  },
  regFormRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: '10px',
    color: '#6b7280',
    fontFamily: "'Press Start 2P', monospace',",
    whiteSpace: 'nowrap',
  },
  input: {
    padding: '6px 8px',
    background: '#0e1019',
    border: '1px solid #374151',
    color: '#e5e7eb',
    fontFamily: "'VT323', monospace",
    fontSize: '14px',
    width: '80px',
  },
  select: {
    padding: '6px 8px',
    background: '#0e1019',
    border: '1px solid #374151',
    color: '#e5e7eb',
    fontFamily: "'VT323', monospace",
    fontSize: '14px',
  },
  saveBtn: {
    padding: '6px 14px',
    background: '#34d39922',
    border: '1px solid #34d39966',
    color: '#34d399',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '8px',
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '6px 10px',
    background: 'transparent',
    border: '1px solid #374151',
    color: '#6b7280',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '8px',
    cursor: 'pointer',
  },
  totalsRow: {
    display: 'flex',
    padding: '12px 12px',
    borderTop: '2px solid #374151',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    background: 'rgba(30,32,48,0.4)',
  },
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '10px',
    background: '#0e1019',
  },
  error: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#f87171',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '10px',
    background: '#0e1019',
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 700,
    background: '#0e1019',
    border: '2px solid #7c3aed',
    boxShadow: '0 0 40px rgba(124,58,237,0.3)',
    padding: 24,
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalTitle: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '11px',
    color: '#a78bfa',
    marginBottom: 16,
  },
  modalHint: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 1.6,
  },
  code: {
    background: '#1a1c2e',
    padding: '2px 6px',
    color: '#34d399',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  pasteArea: {
    width: '100%',
    background: '#0a0c14',
    border: '1px solid #374151',
    color: '#e5e7eb',
    fontFamily: 'monospace',
    fontSize: '13px',
    padding: '10px',
    resize: 'vertical',
    marginBottom: 12,
    display: 'block',
  },
  parseBtn: {
    padding: '8px 14px',
    background: 'rgba(96,165,250,0.1)',
    border: '1px solid #60a5fa44',
    color: '#60a5fa',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '8px',
    cursor: 'pointer',
  },
  previewBlock: {
    background: '#0a0c14',
    border: '1px solid #1f2937',
    padding: '10px',
    marginBottom: 12,
    maxHeight: 200,
    overflowY: 'auto',
  },
  previewRow: {
    display: 'flex',
    gap: 8,
    padding: '2px 0',
    borderBottom: '1px solid #111827',
    fontSize: '12px',
  },
  previewCell: {
    flex: 1,
    color: '#9ca3af',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'monospace',
  },
  importConfirmBtn: {
    padding: '8px 16px',
    background: '#34d39922',
    border: '1px solid #34d39966',
    color: '#34d399',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '8px',
    cursor: 'pointer',
  },
};
