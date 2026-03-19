export function parseTabSeparated(text) {
  const lines = (text || '').trim().split('\n').filter(Boolean)
  if (!lines.length) return { headers: [], rows: [] }
  const rows = lines.map(line => line.split('\t').map(cell => cell.trim()))
  return { headers: rows[0], rows: rows.slice(1) }
}

export function mapToItems(rows, mapping) {
  return (rows || []).map((row) => ({
    title: row[mapping.title] || '',
    description: row[mapping.description] || '',
    priority: (row[mapping.priority] || 'medium').toLowerCase()
  })).filter(item => item.title.trim())
}
