import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'

function download(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function SessionResultsScreen({ sessionId, onBack }) {
  const [data, setData] = useState(null)
  const token = new URLSearchParams(window.location.search).get('token')

  useEffect(() => {
    const q = token ? `?token=${token}` : ''
    apiFetch(`/api/sessions/${sessionId}/results${q}`).then(setData).catch(() => {})
  }, [sessionId, token])

  const shareUrl = useMemo(() => {
    if (!data?.session?.share_token) return null
    return `${window.location.origin}/sessions/${sessionId}/results?token=${data.session.share_token}`
  }, [data, sessionId])

  if (!data) return <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#e0d8f0', padding: 16 }}>Loading...</div>

  const perspectiveMode = data?.session?.voting_mode === 'perspective_poker'

  const exportCsv = () => {
    const rows = data.items.map(i => [
      i.title,
      i.consensus ?? '',
      i.recommended_estimate ?? '',
      (i.perspective_consensus || []).map(p => `${p.perspective}:${p.consensus}`).join(' | '),
      i.avg_confidence ?? '',
      i.outlier ? 'YES' : 'NO'
    ])
    const csv = ['Title,Consensus,Recommended,PerspectiveConsensus,Confidence,Outlier', ...rows.map(r => r.map(x => `"${x}"`).join(','))].join('\n')
    download(csv, `reveal-results-${sessionId}.csv`)
  }

  const makeShare = async () => {
    const updated = await apiFetch(`/api/sessions/${sessionId}/share-token`, { method: 'POST' })
    setData(d => ({ ...d, session: { ...d.session, ...updated } }))
  }

  return <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#e0d8f0', padding: 16 }}>
    <button onClick={onBack}>← Back</button>
    <h2>{data.session.name} · Results</h2>
    <div>
      Total {data.summary.total_items} · Estimated {data.summary.estimated_items} · Outliers {data.summary.outliers} · Confidence {data.summary.avg_confidence}
      {perspectiveMode && ` · Mode Perspective Poker`}
    </div>
    <div style={{ margin: '10px 0' }}>
      <button onClick={exportCsv}>Export CSV</button>
      {!shareUrl ? <button onClick={makeShare} style={{ marginLeft: 8 }}>Generate share link</button> : <input readOnly value={shareUrl} style={{ marginLeft: 8, width: 420 }} />}
    </div>

    {data.items.map(item => <div key={item.id} style={{ border: '1px solid #2a2a5a', padding: 10, marginBottom: 8 }}>
      <strong>{item.title}</strong> {item.outlier && <span style={{ color: '#f87171' }}>⚠ outlier</span>}
      <div>
        Consensus: {item.consensus ?? '-'} · Median: {item.median || '-'}
        {perspectiveMode && <> · Recommended: {item.recommended_estimate ?? '-'}</>}
      </div>

      {perspectiveMode && item.perspective_consensus?.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {item.perspective_consensus.map((row) => (
            <span key={row.perspective} style={{ padding: '2px 6px', border: '1px solid #2a2a5a', color: '#f0c040' }}>
              {row.perspective}: {row.consensus} ({row.count})
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {item.votes.map((v, idx) => <span key={idx} style={{ padding: '2px 6px', border: '1px solid #2a2a5a' }}>
          {v.name}: {v.value}
          {v.perspective ? ` [${v.perspective}]` : ''}
          {v.outlier ? ' ⚠' : ''}
          {' '}({v.confidence ?? '-'})
        </span>)}
      </div>
    </div>)}
  </div>
}
