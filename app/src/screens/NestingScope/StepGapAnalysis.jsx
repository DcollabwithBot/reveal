import { PF, VT } from './nsHelpers.js';

export default function StepGapAnalysis({ item, mergedItems, allEstimates, total, onContinue }) {
  const original = item?.estimate || 0;
  const pctDiff = original > 0 ? Math.round(((total - original) / original) * 100) : 0;
  const color = Math.abs(pctDiff) <= 20 ? 'var(--jade)' : Math.abs(pctDiff) <= 50 ? 'var(--warn)' : 'var(--danger)';
  const maxH = 160;
  const origH = original > 0 ? Math.round((original / Math.max(original, total)) * maxH) : maxH / 2;
  const totalH = Math.round((total / Math.max(original, total)) * maxH);

  const complexItems = mergedItems.filter(m => {
    const sz = Object.values(allEstimates[m.id]?.votes || {});
    return sz.includes('XL') || sz.includes('XXL');
  }).length;

  return (
    <div className="ns-step ns-gap">
      <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--text)', marginBottom: 8 }}>GAP ANALYSIS</div>
      <div style={{ fontFamily: PF, fontSize: 12, color, textAlign: 'center', lineHeight: 2, marginBottom: 24 }}>
        {pctDiff > 0 ? `SCOPE WAS ${pctDiff}% LARGER` : pctDiff < 0 ? `SCOPE WAS ${Math.abs(pctDiff)}% SMALLER` : 'SCOPE WAS ON TARGET'}
      </div>

      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end', height: maxH + 40, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)' }}>{original}p</div>
          <div className="ns-bar" style={{ width: 64, height: origH, background: 'var(--border2)', animationDelay: '0s' }} />
          <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)' }}>ORIGINAL</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: VT, fontSize: 18, color }}>{total}p</div>
          <div className="ns-bar" style={{ width: 64, height: totalH, background: color, animationDelay: '0.3s' }} />
          <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)' }}>ACTUAL</div>
        </div>
      </div>

      <div style={{ fontFamily: VT, fontSize: 22, color: 'var(--text2)', textAlign: 'center' }}>
        Hidden complexity found in <span style={{ color: 'var(--warn)' }}>{complexItems}</span> items
      </div>

      <button className="ns-btn ns-btn-primary" onClick={onContinue} style={{ marginTop: 24 }}>
        CONTINUE →
      </button>
    </div>
  );
}
