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

export function getDashboardGovernance() {
  return Promise.all([
    request('/api/approval-requests'),
    request('/api/sync/health'),
    request('/api/sync/conflicts')
  ]).then(([approvalRequests, health, conflicts]) => ({ approvalRequests, health, conflicts }));
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

export function getApprovalRequests() {
  return request('/api/approval-requests');
}
