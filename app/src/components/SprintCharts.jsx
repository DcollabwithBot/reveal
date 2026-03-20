import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { supabase } from '../lib/supabase';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export default function SprintCharts({ sprintId, projectId }) {
  const [burndown, setBurndown] = useState(null);
  const [velocity, setVelocity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('burndown');

  useEffect(() => {
    if (!sprintId && !projectId) return;
    loadCharts();
  }, [sprintId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCharts() {
    setLoading(true);
    const headers = await authHeaders();

    const promises = [];

    if (sprintId) {
      // Take a snapshot first so we always have latest data
      promises.push(
        fetch(`/api/sprints/${sprintId}/snapshot`, { method: 'POST', headers })
          .then(() => fetch(`/api/sprints/${sprintId}/burndown`, { headers }))
          .then(r => r.json())
          .then(data => setBurndown(data))
          .catch(() => {})
      );
    }

    if (projectId) {
      promises.push(
        fetch(`/api/projects/${projectId}/velocity`, { headers })
          .then(r => r.json())
          .then(data => setVelocity(data))
          .catch(() => {})
      );
    }

    await Promise.all(promises);
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 20, color: 'var(--text3)', fontSize: 12 }}>
        Loading charts...
      </div>
    );
  }

  // Merge burndown data: snapshots + ideal into one array for the chart
  const burndownData = (() => {
    if (!burndown?.snapshots?.length && !burndown?.ideal?.length) return [];

    const snapMap = new Map();
    (burndown?.snapshots || []).forEach(s => {
      snapMap.set(s.snapshot_date, s);
    });

    const idealMap = new Map();
    (burndown?.ideal || []).forEach(i => {
      idealMap.set(i.date, i);
    });

    const allDates = [...new Set([...snapMap.keys(), ...idealMap.keys()])].sort();

    return allDates.map(date => ({
      date,
      label: formatDate(date),
      actual: snapMap.get(date)?.hours_remaining ?? null,
      ideal: idealMap.get(date)?.hours_remaining ?? null,
    }));
  })();

  const velocityData = (velocity || []).map(v => ({
    name: v.sprint_name || 'Sprint',
    hours_completed: Number(v.hours_completed) || 0,
    items_completed: Number(v.items_completed) || 0,
  }));

  const tabs = [
    { id: 'burndown', label: 'Burndown' },
    { id: 'velocity', label: 'Velocity' },
  ];

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 18,
    }}>
      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              fontSize: 11, fontWeight: 600, padding: '5px 14px',
              borderRadius: 16, cursor: 'pointer',
              border: '1px solid',
              background: activeTab === tab.id ? 'var(--jade-dim)' : 'transparent',
              borderColor: activeTab === tab.id ? 'rgba(0,200,150,0.3)' : 'var(--border2)',
              color: activeTab === tab.id ? 'var(--jade)' : 'var(--text3)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Burndown Chart */}
      {activeTab === 'burndown' && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 12,
          }}>
            Sprint Burndown
          </div>
          {burndownData.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '20px 0' }}>
              Ingen burndown data endnu. Snapshots genereres automatisk.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={burndownData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border2)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text3)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 11,
                    color: 'var(--text)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="ideal"
                  stroke="var(--text3)"
                  strokeDasharray="5 5"
                  dot={false}
                  name="Ideal"
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="var(--jade)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--jade)' }}
                  name="Actual"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Velocity Chart */}
      {activeTab === 'velocity' && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 12,
          }}>
            Velocity per Sprint
          </div>
          {velocityData.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '20px 0' }}>
              Ingen velocity data endnu. Afslut sprints for at se velocity.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={velocityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border2)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text3)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 11,
                    color: 'var(--text)',
                  }}
                />
                <Bar
                  dataKey="hours_completed"
                  fill="var(--jade)"
                  radius={[4, 4, 0, 0]}
                  name="Hours Completed"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
