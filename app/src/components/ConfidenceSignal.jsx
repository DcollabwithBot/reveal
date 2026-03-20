/**
 * ConfidenceSignal — shows risk signal after confidence votes are in.
 * risk_score = (estimate / max_estimate) * (1 - avg_confidence/5)
 */
export default function ConfidenceSignal({ estimate, maxEstimate, avgConfidence, C, PF }) {
  if (avgConfidence == null || estimate == null) return null;

  const normalizedEstimate = maxEstimate > 0 ? estimate / maxEstimate : 0;
  const riskScore = normalizedEstimate * (1 - avgConfidence / 5);

  let signal, color, emoji, label;
  if (riskScore < 0.3) {
    signal = 'low';
    color = C?.grn || '#22c55e';
    emoji = '🟢';
    label = 'Team confident';
  } else if (riskScore < 0.6) {
    signal = 'medium';
    color = C?.yel || '#eab308';
    emoji = '🟡';
    label = 'Some uncertainty — discuss';
  } else {
    signal = 'high';
    color = C?.red || '#e85454';
    emoji = '🔴';
    label = 'HIGH RISK — alignment needed';
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 8px',
      background: `${color}11`,
      border: `2px solid ${color}33`,
      marginTop: 6,
    }}>
      <span style={{ fontSize: 12 }}>{emoji}</span>
      <div>
        <div style={{ fontFamily: PF, fontSize: '6px', color, fontWeight: 'bold' }}>
          {label}
        </div>
        <div style={{ fontFamily: PF, fontSize: '4px', color: C?.dim || '#888' }}>
          Risk score: {(riskScore * 100).toFixed(0)}% · Confidence: {avgConfidence.toFixed(1)}/5
        </div>
      </div>
      {signal === 'high' && (
        <div style={{
          fontFamily: PF, fontSize: '4px',
          background: color, color: '#fff',
          padding: '2px 5px', marginLeft: 'auto',
          animation: 'pulse 1s infinite',
        }}>
          ⚠ RISK
        </div>
      )}
    </div>
  );
}

/**
 * Calculate risk score for an item
 */
export function calculateRiskScore(estimate, maxEstimate, avgConfidence) {
  if (!maxEstimate || avgConfidence == null) return null;
  return (estimate / maxEstimate) * (1 - avgConfidence / 5);
}
