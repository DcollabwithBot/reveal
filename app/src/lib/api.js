import { supabase } from './supabase';

async function authHeaders(extra = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  };
}

async function request(path, options = {}) {
  const headers = await authHeaders(options.headers || {});
  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
  return body;
}

export function getDashboard() {
  return request('/api/dashboard');
}

export function getDashboardGovernance() {
  return Promise.all([
    getDashboard(),
    request('/api/approval-requests'),
    request('/api/sync/health'),
    request('/api/sync/conflicts')
  ]).then(([dashboard, approvalRequests, health, conflicts]) => ({
    dashboard,
    approvalRequests,
    health,
    conflicts
  }));
}

export async function getLatestApprovalState(targetId) {
  const rows = await getApprovalRequests();
  const match = (rows || []).find((r) => String(r.target_id) === String(targetId));
  return match?.state || null;
}

export function approveRequest(requestId) {
  return request(`/api/approval-requests/${requestId}/approve`, {
    method: 'POST',
    headers: { 'x-reveal-actor': 'pm' },
    body: JSON.stringify({})
  });
}

export function rejectRequest(requestId, reason) {
  return request(`/api/approval-requests/${requestId}/reject`, {
    method: 'POST',
    headers: { 'x-reveal-actor': 'pm' },
    body: JSON.stringify({ reason: reason || null })
  });
}

export function applyRequest(requestId) {
  return request(`/api/approval-requests/${requestId}/apply`, {
    method: 'POST',
    headers: { 'x-reveal-actor': 'system' },
    body: JSON.stringify({})
  });
}

export function submitAdvisoryRequest(payload) {
  return request('/api/approval-requests', {
    method: 'POST',
    headers: { 'x-reveal-actor': 'game' },
    body: JSON.stringify(payload)
  });
}

export function createConflictResolutionRequest(conflict) {
  const attemptedPatch = conflict?.payload?.attempted_patch || {};
  const { source_layer, approval_request_id, id, ...requestedPatch } = attemptedPatch;
  return submitAdvisoryRequest({
    target_type: conflict?.target_type,
    target_id: conflict?.target_id,
    requested_patch: requestedPatch,
    idempotency_key: `conflict:${conflict?.id}:${Date.now()}`
  });
}

export function getApprovalRequests() {
  return request('/api/approval-requests');
}
