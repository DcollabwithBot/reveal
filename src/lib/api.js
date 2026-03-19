import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || ''

export async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token
}

export async function apiFetch(path, options = {}) {
  const token = await getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'API error')
  }
  return res.json()
}

export function fetchAssignees() {
  return apiFetch('/api/team/assignees')
}
