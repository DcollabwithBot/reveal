export function approvalStateLabel(state) {
  if (state === 'pending_approval') return 'Pending';
  if (state === 'approved') return 'Approved';
  if (state === 'rejected') return 'Rejected';
  if (state === 'applied') return 'Applied';
  return 'Advisory';
}

export function approvalStateColor(state, colors = {}) {
  if (state === 'pending_approval') return colors.yel || '#facc15';
  if (state === 'approved') return colors.blu || '#60a5fa';
  if (state === 'rejected') return colors.red || '#f87171';
  if (state === 'applied') return colors.grn || '#34d399';
  return colors.dim || '#94a3b8';
}

export function projectApprovalOverlay(state, colors = {}) {
  return {
    state,
    label: approvalStateLabel(state),
    color: approvalStateColor(state, colors),
    canSubmitAdvisory: state !== 'pending_approval',
  };
}
