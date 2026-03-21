/**
 * ExplosionPredictor — rule-based pattern recognition for risky items.
 * Checks if an item matches historical explosion patterns.
 * Renders a small warning badge inline.
 */
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';

// Singleton cache: org → { patterns, loadedAt }
const patternCache = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Keywords that historically cause explosions
const RISK_KEYWORDS = [
  'integrat', 'migration', 'refactor', 'legacy', 'api', 'third-party',
  'auth', 'permission', 'import', 'export', 'sync', 'deploy', 'infrastructure',
  'performance', 'optimiz',
];

async function loadExplosionPatterns(organizationId) {
  const now = Date.now();
  const cached = patternCache[organizationId];
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) {
    return cached.patterns;
  }

  // Fetch historical items where actual exploded vs estimate
  const { data } = await supabase
    .from('session_items')
    .select('title, final_estimate, actual_hours')
    .not('final_estimate', 'is', null)
    .not('actual_hours', 'is', null)
    .gt('actual_hours', 0);

  if (!data?.length) {
    patternCache[organizationId] = { patterns: { keywords: {}, estimateExplosions: 0, totalItems: 0 }, loadedAt: now };
    return patternCache[organizationId].patterns;
  }

  // Find "exploded" items: actual > estimate * 2
  const exploded = data.filter(item => item.actual_hours > item.final_estimate * 2);
  const total = data.length;

  // Count keyword occurrences in exploded vs all
  const keywordStats = {};
  RISK_KEYWORDS.forEach(kw => {
    const inExploded = exploded.filter(i => i.title?.toLowerCase().includes(kw)).length;
    const inAll = data.filter(i => i.title?.toLowerCase().includes(kw)).length;
    if (inAll > 0) {
      keywordStats[kw] = { exploded: inExploded, total: inAll, rate: inExploded / inAll };
    }
  });

  // Low estimate explosions (estimated <= 5, actual > 13)
  const lowEstHighActual = data.filter(i => i.final_estimate <= 5 && i.actual_hours > 13).length;
  const lowEstTotal = data.filter(i => i.final_estimate <= 5).length;

  const patterns = {
    keywords: keywordStats,
    lowEstExplosionRate: lowEstTotal > 0 ? lowEstHighActual / lowEstTotal : 0,
    overallExplosionRate: total > 0 ? exploded.length / total : 0,
    totalItems: total,
    explodedCount: exploded.length,
    avgMultiplier: exploded.length > 0
      ? exploded.reduce((sum, i) => sum + i.actual_hours / Math.max(i.final_estimate, 1), 0) / exploded.length
      : 1,
  };

  patternCache[organizationId] = { patterns, loadedAt: now };
  return patterns;
}

function computeRiskScore(itemTitle, estimatedHours, patterns) {
  if (!patterns || patterns.totalItems < 5) return null; // not enough data

  let score = 0;
  const reasons = [];
  const titleLower = (itemTitle || '').toLowerCase();

  // Check keywords
  RISK_KEYWORDS.forEach(kw => {
    const stat = patterns.keywords[kw];
    if (stat && titleLower.includes(kw) && stat.rate > 0.4 && stat.total >= 2) {
      score += stat.rate * 0.4;
      reasons.push(`"${kw}"-items overskrides typisk ${Math.round(stat.rate * 100)}% af gangen`);
    }
  });

  // Low estimate risk
  if (estimatedHours && estimatedHours <= 5 && patterns.lowEstExplosionRate > 0.3) {
    score += patterns.lowEstExplosionRate * 0.5;
    reasons.push(`Lave estimater (≤5) overskrides ${Math.round(patterns.lowEstExplosionRate * 100)}% af gangen`);
  }

  // Overall risk baseline
  score += patterns.overallExplosionRate * 0.1;

  const clampedScore = Math.min(1, score);
  const avgMultiplier = patterns.avgMultiplier > 1
    ? `${Math.round(patterns.avgMultiplier * 10) / 10}x`
    : null;

  return clampedScore > 0.25 ? { score: clampedScore, reasons, avgMultiplier } : null;
}

export default function ExplosionPredictor({ itemTitle, estimatedHours, organizationId }) {
  const [risk, setRisk] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!organizationId || !itemTitle || loadedRef.current) return;
    loadedRef.current = true;

    loadExplosionPatterns(organizationId).then(patterns => {
      const result = computeRiskScore(itemTitle, estimatedHours, patterns);
      setRisk(result);
    }).catch(() => {});
  }, [organizationId, itemTitle, estimatedHours]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!risk) return null;

  const isHigh = risk.score > 0.6;
  const color = isHigh ? 'var(--danger)' : 'var(--warn)';
  const bg = isHigh ? 'rgba(232,84,84,0.1)' : 'rgba(200,168,75,0.1)';
  const borderColor = isHigh ? 'rgba(232,84,84,0.3)' : 'rgba(200,168,75,0.3)';

  const topReason = risk.reasons[0] || 'Historisk mønster matcher';
  const warningText = risk.avgMultiplier
    ? `⚠️ Lignende tasks overskrides typisk med ${risk.avgMultiplier} — overvej lavere confidence`
    : `⚠️ ${topReason}`;

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 10, fontWeight: 600,
        color, background: bg, border: `1px solid ${borderColor}`,
        borderRadius: 4, padding: '1px 5px',
        cursor: 'default',
      }}>
        ⚠️ {Math.round(risk.score * 100)}%
      </span>

      {showTooltip && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0,
          marginBottom: 6, zIndex: 200,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderLeft: `3px solid ${color}`,
          borderRadius: 6, padding: '8px 10px',
          minWidth: 240, maxWidth: 300,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 5 }}>
            {warningText}
          </div>
          {risk.reasons.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>
              · {r}
            </div>
          ))}
          <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 6 }}>
            Risk score: {Math.round(risk.score * 100)}% · Baseret på historisk data
          </div>
        </div>
      )}
    </div>
  );
}
