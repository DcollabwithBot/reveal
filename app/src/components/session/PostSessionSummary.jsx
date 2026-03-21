/**
 * PostSessionSummary — Delt komponent der vises ved ALLE session-afslutninger.
 *
 * Viser PM-kobling tydeligt: hvad sker der med data efter spillet?
 * Inkluderer HistoricalContext som sub-sektion.
 *
 * Props:
 *  sessionType        — string ('planning_poker' | 'spec_wars' | 'bluff_poker' | etc.)
 *  results            — object { estimate, acceptance_criteria, risk_notes, discussion_notes, etc. }
 *  approvalPending    — bool
 *  approvalItems      — array of strings (hvad afventer godkendelse)
 *  projectName        — string (navn på sprint/projekt)
 *  onViewApproval     — function (klik på "Se approval queue")
 *  onBack             — function (klik på "Tilbage til PM")
 *  sessionId          — string (til HistoricalContext)
 *  teamId             — string (til HistoricalContext)
 */
import HistoricalContext from './HistoricalContext.jsx';

const SESSION_LABELS = {
  planning_poker: 'Planning Poker',
  spec_wars: 'Spec Wars',
  perspective_poker: 'Perspektiv-Poker',
  bluff_poker: 'Bluff Poker',
  nesting_scope: 'Nesting Scope',
  speed_scope: 'Speed Scope',
  truth_serum: 'Truth Serum',
  flow_poker: 'Flow Poker',
  risk_poker: 'Risk Poker',
  assumption_slayer: 'Assumption Slayer',
  refinement_roulette: 'Refinement Roulette',
  dependency_mapper: 'Dependency Mapper',
};

const SESSION_ICONS = {
  planning_poker: '🃏',
  spec_wars: '⚔️',
  perspective_poker: '🌐',
  bluff_poker: '🎭',
  nesting_scope: '🪆',
  speed_scope: '⚡',
  truth_serum: '🔮',
  flow_poker: '🌊',
  risk_poker: '🎲',
  assumption_slayer: '⚔️',
  refinement_roulette: '🎰',
  dependency_mapper: '🕸️',
};

export default function PostSessionSummary({
  sessionType,
  results = {},
  approvalPending = false,
  approvalItems = [],
  projectName,
  onViewApproval,
  onBack,
  sessionId,
  teamId,
}) {
  const label = SESSION_LABELS[sessionType] || sessionType || 'Session';
  const icon = SESSION_ICONS[sessionType] || '📊';

  const resultRows = buildResultRows(sessionType, results);

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>📊</span>
        <span style={styles.headerTitle}>HVAD SKER DER NU?</span>
      </div>

      {/* Results box */}
      <div style={styles.resultsBox}>
        {resultRows.map((row, i) => (
          <div key={i} style={styles.resultRow}>
            <span style={styles.rowIcon}>{row.icon}</span>
            <div style={styles.rowContent}>
              <span style={styles.rowLabel}>{row.label}</span>
              {row.value && (
                <span style={{ ...styles.rowValue, color: row.valueColor || 'var(--text2)' }}>
                  {row.value}
                </span>
              )}
              {row.sub && (
                <span style={styles.rowSub}>{row.sub}</span>
              )}
            </div>
          </div>
        ))}

        {/* Approval pending indicator */}
        {approvalPending && approvalItems.length > 0 && (
          <div style={styles.approvalBox}>
            <div style={styles.approvalHeader}>⏳ Afventer GM-godkendelse:</div>
            {approvalItems.map((item, i) => (
              <div key={i} style={styles.approvalItem}>· {item}</div>
            ))}
          </div>
        )}

        {/* Project link */}
        {projectName && (
          <div style={styles.resultRow}>
            <span style={styles.rowIcon}>🔗</span>
            <div style={styles.rowContent}>
              <span style={styles.rowLabel}>Gemmes til:</span>
              <span style={{ ...styles.rowValue, color: 'var(--jade)' }}>&quot;{projectName}&quot;</span>
            </div>
          </div>
        )}
      </div>

      {/* Historical context */}
      {(sessionId || teamId) && (
        <HistoricalContext sessionId={sessionId} teamId={teamId} sessionType={sessionType} />
      )}

      {/* Actions */}
      <div style={styles.actions}>
        {approvalPending && onViewApproval && (
          <button onClick={onViewApproval} style={styles.secondaryBtn}>
            Se approval queue →
          </button>
        )}
        {onBack && (
          <button onClick={onBack} style={styles.primaryBtn}>
            ← Tilbage til PM
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Bygger result-rows baseret på sessionType + results-data.
 */
function buildResultRows(sessionType, results) {
  const rows = [];

  switch (sessionType) {
    case 'planning_poker': {
      if (results.estimate != null) {
        rows.push({
          icon: '✅',
          label: 'Final estimate:',
          value: `${results.estimate} points`,
          valueColor: 'var(--gold)',
        });
      }
      if (results.acceptance_criteria) {
        rows.push({
          icon: '📝',
          label: 'Acceptance criteria:',
          value: results.acceptance_criteria,
        });
      } else {
        rows.push({
          icon: '📝',
          label: 'Acceptance criteria:',
          value: 'Afventer godkendelse',
          sub: '(klik på approval queue for at se)',
          valueColor: 'var(--warn)',
        });
      }
      break;
    }

    case 'spec_wars': {
      rows.push({
        icon: '✅',
        label: 'Vindende spec:',
        value: results.winning_spec ? 'Godkendt og gemt' : 'Afventer GM-godkendelse',
        valueColor: results.winning_spec ? 'var(--jade)' : 'var(--warn)',
      });
      if (results.acceptance_criteria) {
        rows.push({
          icon: '📋',
          label: 'Spec-tekst:',
          value: results.acceptance_criteria,
        });
      }
      break;
    }

    case 'perspective_poker': {
      if (results.estimate != null) {
        rows.push({
          icon: '✅',
          label: 'Final estimate:',
          value: `${results.estimate} points`,
          valueColor: 'var(--gold)',
        });
      }
      if (results.risk_notes) {
        rows.push({
          icon: '⚠️',
          label: 'Risiko-noter:',
          value: results.risk_notes,
          valueColor: 'var(--danger)',
        });
      }
      rows.push({
        icon: '📊',
        label: 'Perspektiv-data:',
        value: 'Gemt til projektets historik',
        valueColor: 'var(--jade)',
      });
      break;
    }

    case 'bluff_poker': {
      if (results.estimate != null) {
        rows.push({
          icon: '✅',
          label: 'Final estimate:',
          value: `${results.estimate} points`,
          valueColor: 'var(--gold)',
        });
      }
      if (results.discussion_notes) {
        rows.push({
          icon: '💬',
          label: 'Discussion notes:',
          value: `Gemt til ${results.item_title || 'item'}`,
          valueColor: 'var(--jade)',
        });
      }
      if (results.rationality_winner) {
        rows.push({
          icon: '🏆',
          label: 'Mest rationel estimator:',
          value: results.rationality_winner,
          valueColor: 'var(--gold)',
        });
      }
      rows.push({
        icon: '📈',
        label: 'Estimeringsmønster:',
        value: 'Gemt til KPI Dashboard',
        valueColor: 'var(--jade)',
        sub: 'Se dit mønster over tid →',
      });
      break;
    }

    case 'nesting_scope': {
      if (results.subtask_count != null) {
        rows.push({
          icon: '✅',
          label: 'Sub-tasks opdaget:',
          value: `${results.subtask_count} opgaver`,
          valueColor: 'var(--gold)',
        });
      }
      if (results.total_estimate != null) {
        rows.push({
          icon: '📊',
          label: 'Total estimat:',
          value: `${results.total_estimate} points`,
        });
      }
      rows.push({
        icon: '🔗',
        label: 'Sub-tasks:',
        value: 'Tilføjet til projektet ✅',
        valueColor: 'var(--jade)',
      });
      break;
    }

    case 'speed_scope': {
      if (results.hidden_complexity_count != null) {
        rows.push({
          icon: '⚠️',
          label: 'Hidden Complexity items:',
          value: `${results.hidden_complexity_count} items flagret`,
          valueColor: results.hidden_complexity_count > 0 ? 'var(--warn)' : 'var(--jade)',
        });
      }
      rows.push({
        icon: '📊',
        label: 'Delta-analyse:',
        value: 'Sendt til PM for review',
        valueColor: 'var(--jade)',
      });
      if (results.velocity != null) {
        rows.push({
          icon: '⚡',
          label: 'Velocity:',
          value: `${results.velocity} items/min`,
        });
      }
      break;
    }

    case 'truth_serum': {
      rows.push({
        icon: '🔮',
        label: 'Bias-rapport:',
        value: 'Gemt til teamets historik',
        valueColor: 'var(--jade)',
      });
      if (results.highest_bias_user) {
        rows.push({
          icon: '📊',
          label: 'Mest bias:',
          value: results.highest_bias_user,
        });
      }
      rows.push({
        icon: '📈',
        label: 'Trend over tid:',
        value: 'Se KPI Dashboard for mønster →',
        valueColor: 'var(--text3)',
      });
      break;
    }

    case 'flow_poker': {
      if (results.median_days != null) {
        rows.push({ icon: '⏱️', label: 'Median cycle time:', value: `${results.median_days} dage`, valueColor: 'var(--gold)' });
      }
      if (results.flow_health) {
        rows.push({ icon: '🌊', label: 'Flow Health:', value: results.flow_health, valueColor: results.flow_health === 'EXCELLENT' || results.flow_health === 'GOOD' ? 'var(--jade)' : 'var(--warn)' });
      }
      if (results.blocker_count != null) {
        rows.push({ icon: '⚠️', label: 'Flow blockers:', value: `${results.blocker_count} items`, valueColor: results.blocker_count > 0 ? 'var(--danger)' : 'var(--jade)' });
      }
      rows.push({ icon: '📊', label: 'PM write-back:', value: `${results.items_estimated || 0} items gemt med cycle time`, valueColor: 'var(--jade)' });
      break;
    }

    case 'risk_poker': {
      if (results.hot_spot_count != null) {
        rows.push({ icon: '🔥', label: 'Hot spots:', value: `${results.hot_spot_count} kritiske risici`, valueColor: results.hot_spot_count > 0 ? 'var(--danger)' : 'var(--jade)' });
      }
      if (results.risks_logged != null) {
        rows.push({ icon: '📋', label: 'Risici logget:', value: `${results.risks_logged} risici godkendt`, valueColor: 'var(--jade)' });
      }
      rows.push({ icon: '🗺️', label: 'Risk matrix:', value: 'Gemt til projektets risikolog', valueColor: 'var(--jade)' });
      break;
    }

    case 'assumption_slayer': {
      if (results.assumption_count != null) {
        rows.push({ icon: '📜', label: 'Assumptions afsløret:', value: `${results.assumption_count} stk.`, valueColor: 'var(--gold)' });
      }
      if (results.max_danger != null) {
        rows.push({ icon: '☠️', label: 'Mest farlig antagelse:', value: `Farescore: ${results.max_danger}/5`, valueColor: results.max_danger >= 4 ? 'var(--danger)' : 'var(--warn)' });
      }
      rows.push({ icon: '📝', label: 'Top-3 assumptions:', value: 'Gemt som projekt-kommentarer', valueColor: 'var(--jade)' });
      break;
    }

    case 'refinement_roulette': {
      rows.push({ icon: '🌿', label: 'Item groomed:', value: results.item_title || 'Backlog item', valueColor: 'var(--jade)' });
      if (results.misalignment_score != null) {
        rows.push({ icon: '⚡', label: 'Misalignment score:', value: `${results.misalignment_score}%`, valueColor: results.misalignment_score > 50 ? 'var(--danger)' : 'var(--jade)' });
      }
      rows.push({ icon: '📋', label: 'Definition of Done:', value: 'Gemt som acceptance criteria', valueColor: 'var(--jade)', sub: '(afventer GM-godkendelse)' });
      rows.push({ icon: '📝', label: 'Clarification:', value: 'Tilføjet til item description', valueColor: 'var(--jade)', sub: '(afventer GM-godkendelse)' });
      break;
    }

    case 'dependency_mapper': {
      if (results.deps_confirmed != null) {
        rows.push({ icon: '🔗', label: 'Dependencies bekræftet:', value: `${results.deps_confirmed} stk.`, valueColor: 'var(--jade)' });
      }
      if (results.circular_count != null) {
        rows.push({ icon: '🔄', label: 'Cirkulære dependencies:', value: `${results.circular_count} fundet og afvist`, valueColor: results.circular_count > 0 ? 'var(--danger)' : 'var(--jade)' });
      }
      rows.push({ icon: '🕸️', label: 'Dependency map:', value: 'Gemt til item_dependencies', valueColor: 'var(--jade)' });
      break;
    }

    default: {
      if (results.estimate != null) {
        rows.push({
          icon: '✅',
          label: 'Resultat:',
          value: `${results.estimate} points`,
          valueColor: 'var(--gold)',
        });
      }
      rows.push({
        icon: '🔗',
        label: 'Data:',
        value: 'Gemt til projektet',
        valueColor: 'var(--jade)',
      });
    }
  }

  return rows;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const PF = '"Press Start 2P", monospace';
const VT = '"VT323", monospace';

const styles = {
  wrapper: {
    margin: '24px auto',
    maxWidth: 480,
    padding: '0 16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontFamily: PF,
    fontSize: 9,
    color: 'var(--jade)',
    letterSpacing: 1,
  },
  resultsBox: {
    background: 'rgba(0,255,136,0.04)',
    border: '1px solid rgba(0,255,136,0.2)',
    borderRadius: 8,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  resultRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowIcon: {
    fontSize: 16,
    lineHeight: '22px',
    flexShrink: 0,
  },
  rowContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  rowLabel: {
    fontFamily: VT,
    fontSize: 16,
    color: 'var(--text3)',
  },
  rowValue: {
    fontFamily: VT,
    fontSize: 18,
    color: 'var(--text2)',
  },
  rowSub: {
    fontFamily: VT,
    fontSize: 14,
    color: 'var(--text3)',
    fontStyle: 'italic',
  },
  approvalBox: {
    background: 'rgba(255,200,0,0.06)',
    border: '1px solid rgba(255,200,0,0.2)',
    borderRadius: 6,
    padding: '8px 12px',
    marginTop: 4,
  },
  approvalHeader: {
    fontFamily: VT,
    fontSize: 16,
    color: 'var(--warn)',
    marginBottom: 4,
  },
  approvalItem: {
    fontFamily: VT,
    fontSize: 15,
    color: 'var(--text3)',
  },
  actions: {
    display: 'flex',
    gap: 12,
    marginTop: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    fontFamily: PF,
    fontSize: 7,
    padding: '10px 16px',
    background: 'rgba(0,255,136,0.1)',
    border: '2px solid var(--jade)',
    color: 'var(--jade)',
    cursor: 'pointer',
    borderRadius: 4,
  },
  secondaryBtn: {
    fontFamily: PF,
    fontSize: 7,
    padding: '10px 16px',
    background: 'rgba(255,200,0,0.08)',
    border: '2px solid var(--warn)',
    color: 'var(--warn)',
    cursor: 'pointer',
    borderRadius: 4,
  },
};
