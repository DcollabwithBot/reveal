import { useEffect, useRef, useState } from 'react';
import { closeItem, updateItem } from '../lib/api';
import { Pill } from './ui/Card';
import CommentsPanel from './CommentsPanel';

const STATUS_OPTIONS = [
  { value: 'backlog',     label: 'Backlog',      color: 'var(--text3)' },
  { value: 'in_progress', label: 'In Progress',  color: 'var(--gold)' },
  { value: 'done',        label: 'Done',         color: 'var(--jade)' },
];

const PRIORITY_OPTIONS = [
  { value: 'low',    label: '↓ Low',    color: 'var(--text3)' },
  { value: 'medium', label: '→ Medium', color: 'var(--gold)' },
  { value: 'high',   label: '↑ High',   color: 'var(--danger)' },
];

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export default function ItemDetailModal({ item: initialItem, onClose, onUpdated }) {
  const [item, setItem] = useState(initialItem);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('detail'); // detail | history | comments
  const [confirmClose, setConfirmClose] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    // Close on Escape
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleFieldUpdate(field, value) {
    setSaving(true);
    try {
      const updated = await updateItem(item.id, { [field]: value });
      if (updated) {
        setItem(prev => ({ ...prev, [field]: value }));
        onUpdated && onUpdated({ ...item, [field]: value });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    setSaving(true);
    try {
      const updated = await closeItem(item.id);
      if (updated) {
        setItem(prev => ({ ...prev, item_status: 'done', status: 'completed' }));
        onUpdated && onUpdated({ ...item, item_status: 'done' });
      }
    } finally {
      setSaving(false);
      setConfirmClose(false);
    }
  }

  const statusOpt = STATUS_OPTIONS.find(s => s.value === item.item_status) || STATUS_OPTIONS[0];
  const priorityOpt = PRIORITY_OPTIONS.find(p => p.value === item.priority) || PRIORITY_OPTIONS[1];
  const hasHours = item.hours_fak > 0 || item.hours_int > 0 || item.hours_ub > 0;
  const isDone = item.item_status === 'done';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, backdropFilter: 'blur(2px)' }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 101, width: '100%', maxWidth: 680, maxHeight: '90vh',
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono, monospace)', color: 'var(--text3)', marginBottom: 4 }}>
                {item.item_code}
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
                {item.title}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, padding: 4, flexShrink: 0, lineHeight: 1 }}
            >✕</button>
          </div>

          {/* Status + Priority inline selects */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={item.item_status}
              onChange={e => handleFieldUpdate('item_status', e.target.value)}
              style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                background: 'transparent', border: `1px solid ${statusOpt.color}`,
                color: statusOpt.color, outline: 'none',
              }}
            >
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <select
              value={item.priority}
              onChange={e => handleFieldUpdate('priority', e.target.value)}
              style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                background: 'transparent', border: `1px solid ${priorityOpt.color}`,
                color: priorityOpt.color, outline: 'none',
              }}
            >
              {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>

            {saving && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Gemmer...</span>}

            {/* Close/Done button */}
            {!isDone && (
              <div style={{ marginLeft: 'auto' }}>
                {confirmClose ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)' }}>Marker som done?</span>
                    <button onClick={handleClose} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius)', background: 'var(--jade)', color: '#fff', border: 'none', cursor: 'pointer' }}>Ja, luk</button>
                    <button onClick={() => setConfirmClose(false)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--radius)', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' }}>Annuller</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClose(true)}
                    style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 'var(--radius)', background: 'var(--jade-dim)', color: 'var(--jade)', border: '1px solid rgba(0,200,150,0.3)', cursor: 'pointer' }}
                  >
                    ✓ Luk item
                  </button>
                )}
              </div>
            )}
            {isDone && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--jade)', fontWeight: 600 }}>✓ Afsluttet</span>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {[{ key: 'detail', label: 'Detaljer' }, { key: 'comments', label: 'Kommentarer 💬' }, { key: 'history', label: 'Historik' }].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 18px', fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? 'var(--jade)' : 'var(--text2)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab.key ? '2px solid var(--jade)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >{tab.label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

          {/* ── DETAIL TAB ── */}
          {activeTab === 'detail' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {/* Notes */}
              <div style={{ gridColumn: '1 / -1' }}>
                <Label>Noter</Label>
                <textarea
                  ref={textareaRef}
                  defaultValue={item.notes || ''}
                  placeholder="Tilføj noter..."
                  onBlur={e => { if (e.target.value !== (item.notes || '')) handleFieldUpdate('notes', e.target.value); }}
                  rows={3}
                  style={{
                    width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, padding: '10px 12px',
                    resize: 'vertical', outline: 'none', fontFamily: 'var(--sans)', lineHeight: 1.5,
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--jade)'}
                />
              </div>

              {/* Hours breakdown */}
              <div>
                <Label>Timer (FAK / INT / UB)</Label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['hours_fak', 'hours_int', 'hours_ub'].map(field => (
                    <input
                      key={field}
                      type="number"
                      step="0.5"
                      defaultValue={item[field] || 0}
                      onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== item[field]) handleFieldUpdate(field, v); }}
                      style={{ width: 60, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, padding: '6px 8px', textAlign: 'center', outline: 'none' }}
                      onFocus={e => e.target.style.borderColor = 'var(--jade)'}
                      onBlurCapture={e => e.target.style.borderColor = 'var(--border)'}
                    />
                  ))}
                  <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center' }}>h</span>
                </div>
              </div>

              {/* Est. hours */}
              <div>
                <Label>Estimeret</Label>
                <input
                  type="number"
                  step="1"
                  defaultValue={item.estimated_hours || 0}
                  onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== item.estimated_hours) handleFieldUpdate('estimated_hours', v); }}
                  style={{ width: 80, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, padding: '6px 8px', textAlign: 'center', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = 'var(--jade)'}
                />
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>h</span>
              </div>

              {/* Km */}
              <div>
                <Label>Km kørt</Label>
                <input
                  type="number"
                  step="1"
                  defaultValue={item.km_driven || 0}
                  onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== item.km_driven) handleFieldUpdate('km_driven', v); }}
                  style={{ width: 80, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, padding: '6px 8px', textAlign: 'center', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = 'var(--jade)'}
                />
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>km</span>
              </div>

              {/* Invoiced */}
              <div>
                <Label>Faktureret (DKK)</Label>
                <input
                  type="number"
                  step="100"
                  defaultValue={item.invoiced_dkk || 0}
                  onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== item.invoiced_dkk) handleFieldUpdate('invoiced_dkk', v); }}
                  style={{ width: 100, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, padding: '6px 8px', textAlign: 'center', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = 'var(--jade)'}
                />
              </div>

              {/* Due date */}
              <div>
                <Label>Deadline</Label>
                <input
                  type="date"
                  defaultValue={item.due_date ? item.due_date.slice(0, 10) : ''}
                  onBlur={e => { const v = e.target.value || null; if (v !== item.due_date) handleFieldUpdate('due_date', v); }}
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, padding: '6px 8px', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = 'var(--jade)'}
                />
              </div>

              {/* Progress */}
              <div>
                <Label>Fremdrift</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="range" min={0} max={100} step={5}
                    defaultValue={item.progress || 0}
                    onChange={e => setItem(prev => ({ ...prev, progress: parseInt(e.target.value) }))}
                    onMouseUp={e => handleFieldUpdate('progress', parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--jade)' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text2)', width: 36, textAlign: 'right' }}>{item.progress || 0}%</span>
                </div>
              </div>
            </div>
          )}

          {/* ── COMMENTS TAB ── */}
          {activeTab === 'comments' && (
            <CommentsPanel itemId={item.id} />
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === 'history' && (
            <div>
              <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 12 }}>Ændringshistorik for dette item</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <HistoryRow icon="●" label="Oprettet" value={formatDate(item.created_at)} color="var(--jade)" />
                {item.due_date && <HistoryRow icon="📅" label="Deadline" value={formatDateShort(item.due_date)} />}
                {item.actual_hours > 0 && <HistoryRow icon="⏱" label="Actual timer" value={`${item.actual_hours}h`} />}
                {(item.invoiced_dkk > 0) && <HistoryRow icon="💰" label="Faktureret" value={`${item.invoiced_dkk?.toLocaleString('da-DK')} DKK`} color="var(--jade)" />}
                {(item.to_invoice_dkk > 0) && <HistoryRow icon="📋" label="Mangler fakturering" value={`${item.to_invoice_dkk?.toLocaleString('da-DK')} DKK`} color="var(--warn)" />}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 6 }}>{children}</div>;
}

function HistoryRow({ icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, width: 16, flexShrink: 0, textAlign: 'center' }}>{icon}</span>
      <span style={{ fontSize: 12, color: 'var(--text3)', width: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: color || 'var(--text2)' }}>{value}</span>
    </div>
  );
}
