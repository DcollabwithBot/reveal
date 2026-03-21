/**
 * HistoricalContext — Mini-komponent der viser teamets fremgang over tid.
 *
 * Henter fra Supabase: team_accuracy_scores, sprint_daily_snapshots, votes.
 * Vises som del af PostSessionSummary.
 *
 * Props:
 *  sessionId   — string
 *  teamId      — string (world_id / project_id)
 *  sessionType — string
 */
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const PF = '"Press Start 2P", monospace';
const VT = '"VT323", monospace';

export default function HistoricalContext({ sessionId, teamId, sessionType }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId && !sessionId) {
      setLoading(false);
      return;
    }
    loadHistoricalData();
  }, [teamId, sessionId]);

  async function loadHistoricalData() {
    try {
      // Fetch accuracy snapshots for team
      const queries = [];

      // 1. Team accuracy scores (per-session accuracy metrics)
      if (teamId) {
        queries.push(
          supabase
            .from('team_accuracy_scores')
            .select('accuracy_pct, session_id, created_at')
            .eq('world_id', teamId)
            .order('created_at', { ascending: false })
            .limit(10)
        );
      } else {
        queries.push(Promise.resolve({ data: null }));
      }

      // 2. Sprint daily snapshots (for trend)
      if (teamId) {
        queries.push(
          supabase
            .from('sprint_daily_snapshots')
            .select('date, outlier_count, accuracy_delta')
            .eq('world_id', teamId)
            .order('date', { ascending: false })
            .limit(30)
        );
      } else {
        queries.push(Promise.resolve({ data: null }));
      }

      // 3. Recent session votes (to check outliers in THIS session)
      if (sessionId) {
        queries.push(
          supabase
            .from('votes')
            .select('estimate, user_id')
            .eq('session_id', sessionId)
        );
      } else {
        queries.push(Promise.resolve({ data: null }));
      }

      const [accuracyRes, snapshotRes, votesRes] = await Promise.all(queries);

      const accuracyRows = accuracyRes?.data || [];
      const snapshotRows = snapshotRes?.data || [];
      const voteRows = votesRes?.data || [];

      if (accuracyRows.length === 0 && snapshotRows.length === 0) {
        // No historical data yet
        setData({ firstSession: true });
        setLoading(false);
        return;
      }

      // Compute current accuracy
      const latestAccuracy = accuracyRows[0]?.accuracy_pct ?? null;

      // Compute accuracy 30 days ago (approx)
      const oldAccuracy = accuracyRows.length > 5
        ? accuracyRows[accuracyRows.length - 1]?.accuracy_pct
        : null;

      const accuracyDelta = (latestAccuracy != null && oldAccuracy != null)
        ? Math.round(latestAccuracy - oldAccuracy)
        : null;

      // Compute outliers in THIS session
      let sessionOutliers = 0;
      if (voteRows.length > 1) {
        const estimates = voteRows.map(v => v.estimate).filter(e => e != null);
        if (estimates.length > 1) {
          const median = getMedian(estimates);
          const iqr = getIQR(estimates);
          sessionOutliers = estimates.filter(e => Math.abs(e - median) > 1.5 * iqr).length;
        }
      }

      // Team avg outliers (from snapshots)
      const avgOutliers = snapshotRows.length > 0
        ? Math.round(snapshotRows.reduce((sum, s) => sum + (s.outlier_count || 0), 0) / snapshotRows.length * 10) / 10
        : null;

      setData({
        firstSession: false,
        latestAccuracy,
        accuracyDelta,
        sessionOutliers,
        avgOutliers,
        sessionCount: accuracyRows.length,
      });
    } catch (err) {
      // Graceful degradation — just don't show the block
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;
  if (!data) return null;

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={{ fontSize: 18 }}>📈</span>
        <span style={styles.headerTitle}>DIT TEAMS FREMGANG</span>
      </div>

      <div style={styles.box}>
        {data.firstSession ? (
          <div style={styles.firstSession}>
            Dette er jeres første session — data samles nu 📊
          </div>
        ) : (
          <>
            {/* Accuracy trend */}
            {data.latestAccuracy != null && (
              <div style={styles.statRow}>
                <span style={styles.statLabel}>Estimation accuracy:</span>
                <span style={{
                  ...styles.statValue,
                  color: data.accuracyDelta > 0 ? 'var(--jade)' : data.accuracyDelta < 0 ? 'var(--danger)' : 'var(--gold)',
                }}>
                  {data.accuracyDelta != null && data.accuracyDelta !== 0
                    ? `${data.accuracyDelta > 0 ? '↑' : '↓'} ${Math.abs(data.accuracyDelta)}% siden start`
                    : '—'
                  }
                  {' '}(nu: {Math.round(data.latestAccuracy)}%)
                </span>
              </div>
            )}

            {/* Session outliers vs average */}
            {data.sessionOutliers != null && (
              <div style={styles.statRow}>
                <span style={styles.statLabel}>Denne session:</span>
                <span style={{
                  ...styles.statValue,
                  color: data.avgOutliers != null && data.sessionOutliers > data.avgOutliers
                    ? 'var(--warn)'
                    : 'var(--jade)',
                }}>
                  {data.sessionOutliers} outlier{data.sessionOutliers !== 1 ? 's' : ''} fanget
                  {data.avgOutliers != null && (
                    <span style={{ color: data.sessionOutliers <= data.avgOutliers ? 'var(--jade)' : 'var(--warn)' }}>
                      {' '}— {data.sessionOutliers <= data.avgOutliers ? 'under' : 'over'} jeres snit{' '}
                      {data.sessionOutliers <= data.avgOutliers ? '✅' : '⚠️'}
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Session count */}
            {data.sessionCount > 1 && (
              <div style={styles.statRow}>
                <span style={styles.statLabel}>Baseret på:</span>
                <span style={styles.statValue}>{data.sessionCount} sessioner</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMedian(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getIQR(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = getMedian(sorted.slice(0, Math.floor(sorted.length / 2)));
  const q3 = getMedian(sorted.slice(Math.ceil(sorted.length / 2)));
  return q3 - q1;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  wrapper: {
    marginTop: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: PF,
    fontSize: 8,
    color: 'var(--gold)',
    letterSpacing: 1,
  },
  box: {
    background: 'rgba(255,200,0,0.04)',
    border: '1px solid rgba(255,200,0,0.15)',
    borderRadius: 8,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  firstSession: {
    fontFamily: VT,
    fontSize: 17,
    color: 'var(--text3)',
    textAlign: 'center',
    padding: '4px 0',
  },
  statRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  statLabel: {
    fontFamily: VT,
    fontSize: 15,
    color: 'var(--text3)',
  },
  statValue: {
    fontFamily: VT,
    fontSize: 17,
    color: 'var(--text2)',
  },
};
