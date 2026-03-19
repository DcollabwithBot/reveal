import { useMemo, useState } from 'react'
import { parseTabSeparated, mapToItems } from '../utils/importUtils'

export default function ImportModal({ onClose, onConfirm }) {
  const [step, setStep] = useState(1)
  const [raw, setRaw] = useState('')
  const [mapping, setMapping] = useState({ title: 0, description: 1, priority: 2 })

  const parsed = useMemo(() => parseTabSeparated(raw), [raw])
  const previewItems = useMemo(() => mapToItems(parsed.rows, mapping), [parsed, mapping])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0009', zIndex: 90, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 'min(900px, 95vw)', background: '#111130', border: '2px solid #2a2a5a', borderRadius: 8, padding: 16, color: '#e0d8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <strong>Paste from Excel/Sheets</strong>
          <button onClick={onClose}>✕</button>
        </div>

        {step === 1 && (
          <>
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10} style={{ width: '100%', background: '#050510', color: '#e0d8f0' }} placeholder={'Title\tDescription\tPriority\nTask A\tFix login\thigh'} />
            <button disabled={!parsed.rows.length} onClick={() => setStep(2)} style={{ marginTop: 10 }}>Next: map columns</button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {['title', 'description', 'priority'].map((field) => (
                <label key={field}>
                  {field}
                  <select value={mapping[field]} onChange={(e) => setMapping((m) => ({ ...m, [field]: Number(e.target.value) }))}>
                    {parsed.headers.map((h, idx) => <option key={idx} value={idx}>{h || `Col ${idx + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div style={{ maxHeight: 200, overflow: 'auto', background: '#050510', padding: 8 }}>
              {previewItems.slice(0, 8).map((it, idx) => <div key={idx}>{it.title} · {it.priority}</div>)}
            </div>
            <div style={{ marginTop: 10 }}>
              <button onClick={() => setStep(1)}>Back</button>
              <button onClick={() => setStep(3)} style={{ marginLeft: 8 }}>Preview</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>Found {previewItems.length} items.</div>
            <div style={{ maxHeight: 260, overflow: 'auto', background: '#050510', padding: 8, marginTop: 10 }}>
              {previewItems.map((it, idx) => <div key={idx}>{idx + 1}. {it.title} ({it.priority})</div>)}
            </div>
            <div style={{ marginTop: 10 }}>
              <button onClick={() => setStep(2)}>Back</button>
              <button style={{ marginLeft: 8 }} onClick={() => onConfirm(previewItems)}>Confirm insert</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
