export default function SessionChrome({
  C,
  PF,
  combo,
  step,
  modeLabel,
  modeColor,
  title,
  approvalLabel,
  approvalColor,
  advisoryBusy,
  canSubmitAdvisory,
  advisoryError,
  onBack,
  onSendToApprovalQueue,
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <button onClick={onBack} style={{ fontFamily: PF, fontSize: '6px', color: C.wht, background: C.bgL, border: `3px solid ${C.bgL}`, borderBottom: `5px solid ${C.bg}`, padding: '4px 8px', cursor: 'pointer' }}>←</button>
        <div style={{ fontFamily: PF, fontSize: '6px', padding: '3px 6px', background: modeColor, color: C.bg }}>{modeLabel}</div>
        <div style={{ fontFamily: PF, fontSize: '5px', color: modeColor }}>{title}</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: PF, fontSize: '5px', color: approvalColor, marginRight: '8px', padding: '2px 5px', background: C.bgL, border: `1px solid ${approvalColor}` }}>{approvalLabel}</div>
        <div style={{ fontFamily: PF, fontSize: '5px', color: C.org, marginRight: '4px' }}>🔥{combo}</div>
        {['ESTIMÉR', 'REVEAL', 'DISK.', 'CONF.', 'VICTORY'].map((s, i) => (
          <div key={i} style={{ height: '9px', padding: '0 3px', background: i < step ? C.grn : i === step ? C.acc : C.bgL, fontFamily: PF, fontSize: '4px', color: C.wht, display: 'flex', alignItems: 'center' }}>
            {i === step ? s : i < step ? '✓' : ''}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '8px', border: `2px solid ${approvalColor}`, background: C.bgC + 'dd', padding: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ fontFamily: PF, fontSize: '5px', color: approvalColor }}>
            Advisory Overlay · Outcome: {approvalLabel}
          </div>
          <button
            onClick={onSendToApprovalQueue}
            disabled={advisoryBusy || !canSubmitAdvisory}
            style={{
              fontFamily: PF,
              fontSize: '5px',
              color: C.wht,
              background: C.pur,
              border: `2px solid ${C.pur}`,
              padding: '4px 6px',
              cursor: advisoryBusy ? 'wait' : 'pointer',
              opacity: advisoryBusy || !canSubmitAdvisory ? 0.5 : 1,
            }}
          >
            Send til approval queue
          </button>
        </div>
        {advisoryError && <div style={{ fontFamily: 'Bitcount Grid Single, monospace', fontSize: '13px', color: C.red, marginTop: '4px' }}>{advisoryError}</div>}
      </div>
    </>
  );
}
