import { useEffect, useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { buildAuthHeaders } from '../lib/helpers/projectHelpers.js';

const PF = "'Press Start 2P', monospace";

// buildAuthHeaders from projectHelpers replaces inline authHeaders()
const authHeaders = buildAuthHeaders;

const FILTERS = [
  { label: 'Denne sprint', value: 1 },
  { label: '3 sprints', value: 3 },
  { label: '6 sprints', value: 6 },
  { label: '12 sprints', value: 12 },
];

export default function KpiDashboard({ organizationId, onBack }) {
  const [filter, setFilter] = useState(3);
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState(null);

  useEffect(() => {
    if (!organizationId) return;
    loadKpiData();
  }, [organizationId, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadKpiData() {
    setLoading(true);
    try {
      // Fetch team_accuracy_scores for the org (sprint-level accuracy)
      const { data: accuracy } = await supabase
        .from('team_accuracy_scores')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })
        .limit(filter * 5);

      // Fetch sessions for this org
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, created_at, status, metadata, team_id')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(filter * 10);

      const sessionIds = (sessions || []).map(s => s.id);

      // Fetch session_items with estimates vs actual
      const { data: items } = sessionIds.length > 0 ? await supabase
        .from('session_items')
        .select('id, session_id, title, estimated_hours, actual_hours, final_estimate, created_at, decided_at')
        .in('session_id', sessionIds) : { data: [] };

      // Fetch votes for engagement
      const { data: votes } = sessionIds.length > 0 ? await supabase
        .from('votes')
        .select('session_id, user_id, created_at')
        .in('session_id', sessionIds) : { data: [] };

      // Fetch risk items
      const { data: risks } = await supabase
        .from('risk_items')
        .select('id, created_at, resolved_at, type')
        .eq('organization_id', organizationId)
        .limit(filter * 20);

      setKpiData(buildKpiMetrics({ accuracy, sessions, items, votes, risks, filter }));
    } catch (err) {
      console.error('KPI load error:', err);
      setKpiData(null);
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Scanlines overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <button
            onClick={onBack}
            style={{
              fontFamily: PF, fontSize: 8, padding: '6px 12px',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text2)', cursor: 'pointer', borderRadius: 0,
            }}
          >
            ← TILBAGE
          </button>
          <div style={{
            fontFamily: PF, fontSize: 12, color: 'var(--jade)',
            textShadow: '0 0 10px rgba(0,200,150,0.5)',
            letterSpacing: '2px',
          }}>
            📊 TEAM ANALYTICS
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                fontFamily: PF, fontSize: 7, padding: '6px 14px', cursor: 'pointer',
                border: '1px solid',
                borderRadius: 0,
                background: filter === f.value ? 'rgba(0,200,150,0.15)' : 'transparent',
                borderColor: filter === f.value ? 'rgba(0,200,150,0.5)' : 'var(--border)',
                color: filter === f.value ? 'var(--jade)' : 'var(--text3)',
              }}
            >
              {f.label.toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState />
        ) : !kpiData ? (
          <EmptyState />
        ) : (
          <>
            {/* Hero sentence */}
            <HeroSentence kpiData={kpiData} />

            {/* 5 KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 20, marginTop: 24 }}>
              <EstimateDeviationCard data={kpiData.estimateDeviation} />
              <ConfidenceAlignmentCard data={kpiData.confidenceAlignment} />
              <RiskIdentificationCard data={kpiData.riskIdentification} />
              <DecisionSpeedCard data={kpiData.decisionSpeed} />
              <ParticipantEngagementCard data={kpiData.engagement} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HeroSentence({ kpiData }) {
  const pct = kpiData?.heroImprovement;
  if (!pct) return null;
  const positive = pct > 0;

  return (
    <div style={{
      background: positive ? 'rgba(0,200,150,0.08)' : 'rgba(200,168,75,0.08)',
      border: `1px solid ${positive ? 'rgba(0,200,150,0.3)' : 'rgba(200,168,75,0.3)'}`,
      borderLeft: `4px solid ${positive ? 'var(--jade)' : 'var(--warn)'}`,
      borderRadius: 0,
      padding: '14px 20px',
    }}>
      <div style={{
        fontFamily: PF, fontSize: 8,
        color: positive ? 'var(--jade)' : 'var(--warn)',
        letterSpacing: '1px',
        lineHeight: 1.8,
      }}>
        {positive
          ? `🎯 DIT TEAM ER ${Math.abs(pct)}% MERE PRÆCISE END FOR ${kpiData.filterMonths} MÅNEDER SIDEN`
          : `⚠️ DIT TEAM HAR ${Math.abs(pct)}% MERE AFVIGELSE END TIDLIGERE — FOKUSER PÅ KALIBRERING`
        }
      </div>
    </div>
  );
}

function KpiCard({ title, icon, children }) {
  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 0,
      padding: '18px 20px',
      borderTop: '3px solid var(--jade)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
        fontFamily: PF, fontSize: 7, color: 'var(--text2)',
        textTransform: 'uppercase', letterSpacing: '1.5px',
      }}>
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function EstimateDeviationCard({ data }) {
  const hasData = data?.series?.length > 0;
  return (
    <KpiCard title="Estimatafvigelse" icon="📏">
      {!hasData ? (
        <EmptyMetric text="Ingen estimeringsdata endnu" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
            <Stat label="Gns. afvigelse" value={`${data.avgDeviation}%`} color={data.avgDeviation < 20 ? 'var(--jade)' : data.avgDeviation < 40 ? 'var(--warn)' : 'var(--danger)'} />
            <Stat label="Sprints analyseret" value={data.series.length} />
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="sprint" tick={{ fontSize: 8, fill: 'var(--text3)', fontFamily: 'monospace' }} />
              <YAxis tick={{ fontSize: 8, fill: 'var(--text3)' }} unit="%" />
              <Tooltip contentStyle={tooltipStyle()} formatter={(v) => [`${v}%`, '']} />
              <Line type="monotone" dataKey="predicted" stroke="var(--text3)" strokeDasharray="4 4" dot={false} name="Estimate" />
              <Line type="monotone" dataKey="actual" stroke="var(--jade)" strokeWidth={2} dot={{ r: 3, fill: 'var(--jade)' }} name="Faktisk" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </KpiCard>
  );
}

function ConfidenceAlignmentCard({ data }) {
  const hasData = data?.bars?.length > 0;
  return (
    <KpiCard title="Confidence Alignment" icon="🎯">
      {!hasData ? (
        <EmptyMetric text="Ingen confidence-data endnu" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
            <Stat label="High conf. præcision" value={`${data.highConfAccuracy}%`} color="var(--jade)" />
            <Stat label="Low conf. præcision" value={`${data.lowConfAccuracy}%`} color="var(--text2)" />
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={data.bars}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: 'var(--text3)', fontFamily: 'monospace' }} />
              <YAxis tick={{ fontSize: 8, fill: 'var(--text3)' }} unit="%" />
              <Tooltip contentStyle={tooltipStyle()} formatter={(v) => [`${v}%`, 'Præcision']} />
              <Bar dataKey="accuracy" fill="var(--jade)" radius={[2, 2, 0, 0]} name="Præcision" />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </KpiCard>
  );
}

function RiskIdentificationCard({ data }) {
  return (
    <KpiCard title="Risiko-identifikation" icon="⚠️">
      {!data || data.total === 0 ? (
        <EmptyMetric text="Ingen risk cards endnu" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
            <Stat label="Identificerede risks" value={data.total} />
            <Stat label="Realiserede" value={`${data.realizedPct}%`} color={data.realizedPct > 50 ? 'var(--warn)' : 'var(--jade)'} />
            <Stat label="Løste" value={data.resolved} color="var(--jade)" />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <div style={{ flex: 1, height: 12, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 0 }}>
              <div style={{
                height: '100%',
                width: `${data.resolvedPct}%`,
                background: 'var(--jade)',
                transition: 'width 0.6s ease',
              }} />
            </div>
            <span style={{ fontFamily: PF, fontSize: 7, color: 'var(--jade)', whiteSpace: 'nowrap' }}>{data.resolvedPct}% LØST</span>
          </div>
          <div style={{ marginTop: 10, fontFamily: PF, fontSize: 6, color: 'var(--text3)', lineHeight: 2 }}>
            {data.realizedPct < 30
              ? '✅ GOD RISIKO-SCREENING — DE FLESTE RISICI UNDGÅEDE'
              : data.realizedPct < 60
              ? '⚡ HALVDELEN AF RISKS REALISEREDE — OVERVEJ DYBERE ANALYSE'
              : '🔥 HØJE REALISEREDE RISKS — FORBEDRET IDENTIFIKATION ANBEFALET'
            }
          </div>
        </>
      )}
    </KpiCard>
  );
}

function DecisionSpeedCard({ data }) {
  const hasData = data?.series?.length > 0;
  return (
    <KpiCard title="Beslutningshastighed" icon="⚡">
      {!hasData ? (
        <EmptyMetric text="Ingen session-timing data endnu" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
            <Stat label="Gns. min. per item" value={`${data.avgMinutes}m`} color={data.avgMinutes < 5 ? 'var(--jade)' : data.avgMinutes < 10 ? 'var(--warn)' : 'var(--danger)'} />
            <Stat label="Hurtigste sprint" value={`${data.fastestSprint}m`} color="var(--jade)" />
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="sprint" tick={{ fontSize: 8, fill: 'var(--text3)', fontFamily: 'monospace' }} />
              <YAxis tick={{ fontSize: 8, fill: 'var(--text3)' }} unit="m" />
              <Tooltip contentStyle={tooltipStyle()} formatter={(v) => [`${v} min`, 'Per item']} />
              <Line type="monotone" dataKey="minutes" stroke="var(--jade)" strokeWidth={2} dot={{ r: 3, fill: 'var(--jade)' }} name="Min/item" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </KpiCard>
  );
}

function ParticipantEngagementCard({ data }) {
  const hasData = data?.series?.length > 0;
  return (
    <KpiCard title="Deltagerengagement" icon="👥">
      {!hasData ? (
        <EmptyMetric text="Ingen engagement-data endnu" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
            <Stat label="Gns. deltagelse" value={`${data.avgEngagement}%`} color={data.avgEngagement > 80 ? 'var(--jade)' : data.avgEngagement > 60 ? 'var(--warn)' : 'var(--danger)'} />
            <Stat label="Sessioner analyseret" value={data.series.length} />
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: 'var(--text3)', fontFamily: 'monospace' }} />
              <YAxis tick={{ fontSize: 8, fill: 'var(--text3)' }} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle()} formatter={(v) => [`${v}%`, 'Stemte']} />
              <Line type="monotone" dataKey="pct" stroke="var(--jade)" strokeWidth={2} dot={{ r: 3, fill: 'var(--jade)' }} name="Engagement" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </KpiCard>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontFamily: PF, fontSize: 18, fontWeight: 400, color: color || 'var(--text)', fontFamily: "'VT323', monospace", letterSpacing: '1px' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontFamily: PF, fontSize: 6 }}>{label.toUpperCase()}</div>
    </div>
  );
}

function EmptyMetric({ text }) {
  return (
    <div style={{
      height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: PF, fontSize: 7, color: 'var(--text3)', textAlign: 'center',
      border: '1px dashed var(--border)', lineHeight: 2,
    }}>
      {text.toUpperCase()}
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--jade)', animation: 'pulse 1.5s infinite' }}>LOADER DATA...</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--text3)', lineHeight: 2 }}>
        INGEN DATA ENDNU<br />
        <span style={{ fontSize: 8, color: 'var(--text3)' }}>AFSLUT SESSIONER FOR AT SE ANALYTICS</span>
      </div>
    </div>
  );
}

function tooltipStyle() {
  return {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 0,
    fontSize: 11,
    color: 'var(--text)',
    fontFamily: 'monospace',
  };
}

// ── Data processing ──────────────────────────────────────────────

function buildKpiMetrics({ accuracy, sessions, items, votes, risks, filter }) {
  const filterMonths = filter <= 1 ? 1 : filter <= 3 ? 1 : filter <= 6 ? 3 : 6;

  // 1. Estimate deviation — group items by session, compute avg deviation
  const estimateDeviation = buildEstimateDeviation(sessions, items);

  // 2. Confidence alignment — from team_accuracy_scores
  const confidenceAlignment = buildConfidenceAlignment(accuracy);

  // 3. Risk identification
  const riskIdentification = buildRiskIdentification(risks);

  // 4. Decision speed — time from session start to decided_at per item
  const decisionSpeed = buildDecisionSpeed(sessions, items);

  // 5. Participant engagement — votes per session vs expected team size
  const engagement = buildEngagement(sessions, votes);

  // Hero improvement — compare first half vs second half of accuracy
  const heroImprovement = computeHeroImprovement(accuracy);

  return {
    estimateDeviation,
    confidenceAlignment,
    riskIdentification,
    decisionSpeed,
    engagement,
    heroImprovement,
    filterMonths,
  };
}

function buildEstimateDeviation(sessions, items) {
  if (!items?.length) return { series: [], avgDeviation: 0 };

  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));
  const bySession = {};

  (items || []).forEach(item => {
    if (item.final_estimate == null || item.actual_hours == null) return;
    const sessionId = item.session_id;
    if (!bySession[sessionId]) bySession[sessionId] = [];
    const deviation = Math.abs(item.final_estimate - item.actual_hours) / Math.max(item.final_estimate, 1) * 100;
    bySession[sessionId].push({ predicted: item.final_estimate, actual: item.actual_hours, deviation });
  });

  const series = Object.entries(bySession).map(([sessionId, data], idx) => {
    const s = sessionMap.get(sessionId);
    const avgPred = data.reduce((a, b) => a + b.predicted, 0) / data.length;
    const avgActual = data.reduce((a, b) => a + b.actual, 0) / data.length;
    return {
      sprint: `S${idx + 1}`,
      predicted: Math.round(avgPred),
      actual: Math.round(avgActual),
    };
  }).slice(-12);

  const allDeviations = Object.values(bySession).flat().map(d => d.deviation);
  const avgDeviation = allDeviations.length
    ? Math.round(allDeviations.reduce((a, b) => a + b, 0) / allDeviations.length)
    : 0;

  return { series, avgDeviation };
}

function buildConfidenceAlignment(accuracy) {
  if (!accuracy?.length) return { bars: [], highConfAccuracy: 0, lowConfAccuracy: 0 };

  const bars = accuracy.slice(-6).map((row, idx) => ({
    label: `S${idx + 1}`,
    accuracy: row.accuracy_score != null ? Math.round(row.accuracy_score * 100) : 0,
  }));

  const highConf = bars.filter((_, i) => i >= bars.length / 2);
  const lowConf = bars.filter((_, i) => i < bars.length / 2);

  const avg = (arr) => arr.length ? Math.round(arr.reduce((s, b) => s + b.accuracy, 0) / arr.length) : 0;

  return {
    bars,
    highConfAccuracy: avg(highConf),
    lowConfAccuracy: avg(lowConf),
  };
}

function buildRiskIdentification(risks) {
  if (!risks?.length) return { total: 0, resolved: 0, realizedPct: 0, resolvedPct: 0 };

  const total = risks.length;
  const resolved = risks.filter(r => r.resolved_at).length;
  const resolvedPct = Math.round((resolved / total) * 100);
  // "Realized" = risks that were resolved (they became real issues)
  const realized = risks.filter(r => r.resolved_at).length;
  const realizedPct = Math.round((realized / total) * 100);

  return { total, resolved, realizedPct, resolvedPct };
}

function buildDecisionSpeed(sessions, items) {
  if (!sessions?.length || !items?.length) return { series: [], avgMinutes: 0, fastestSprint: 0 };

  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));

  const bySession = {};
  (items || []).forEach(item => {
    if (!item.decided_at || !item.created_at) return;
    const minutes = (new Date(item.decided_at) - new Date(item.created_at)) / 60000;
    if (minutes < 0 || minutes > 120) return; // outlier guard
    if (!bySession[item.session_id]) bySession[item.session_id] = [];
    bySession[item.session_id].push(minutes);
  });

  const series = Object.entries(bySession).map(([sessionId, mins], idx) => ({
    sprint: `S${idx + 1}`,
    minutes: Math.round(mins.reduce((a, b) => a + b, 0) / mins.length),
  })).slice(-12);

  const allMinutes = series.map(s => s.minutes).filter(Boolean);
  const avgMinutes = allMinutes.length
    ? Math.round(allMinutes.reduce((a, b) => a + b, 0) / allMinutes.length)
    : 0;
  const fastestSprint = allMinutes.length ? Math.min(...allMinutes) : 0;

  return { series, avgMinutes, fastestSprint };
}

function buildEngagement(sessions, votes) {
  if (!sessions?.length) return { series: [], avgEngagement: 0 };

  const votesBySess = {};
  (votes || []).forEach(v => {
    if (!votesBySess[v.session_id]) votesBySess[v.session_id] = new Set();
    votesBySess[v.session_id].add(v.user_id);
  });

  const series = (sessions || []).slice(0, 12).reverse().map((s, idx) => {
    const uniqueVoters = votesBySess[s.id]?.size || 0;
    const teamSize = s.metadata?.team_size || 5; // fallback
    const pct = Math.min(100, Math.round((uniqueVoters / teamSize) * 100));
    return {
      label: `S${idx + 1}`,
      pct,
    };
  });

  const avgEngagement = series.length
    ? Math.round(series.reduce((a, b) => a + b.pct, 0) / series.length)
    : 0;

  return { series, avgEngagement };
}

function computeHeroImprovement(accuracy) {
  if (!accuracy?.length || accuracy.length < 4) return null;
  const scores = accuracy.map(a => a.accuracy_score || 0);
  const mid = Math.floor(scores.length / 2);
  const older = scores.slice(0, mid);
  const newer = scores.slice(mid);
  const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
  const avgNewer = newer.reduce((a, b) => a + b, 0) / newer.length;
  const delta = Math.round((avgNewer - avgOlder) * 100);
  return delta !== 0 ? delta : null;
}
