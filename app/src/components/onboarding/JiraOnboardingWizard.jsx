/**
 * JiraOnboardingWizard — guided backlog import when creating first project.
 * Step 1: Do you have Jira/Azure?
 * Step 2a (Yes): OAuth connect + preview
 * Step 2b (No): Manual or Excel import
 */
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { handleError } from "../../lib/errorHandler";

export default function JiraOnboardingWizard({ userId, onComplete, onManual, onExcel, onNavigateToSettings }) {
  const [step, setStep] = useState('question'); // question | connect | manual | done
  const [saving, setSaving] = useState(false);

  async function markOnboardingComplete() {
    setSaving(true);
    try {
      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', userId);
    } catch (e) {
      handleError(e, "onboarding-complete");
      // best-effort
    }
    setSaving(false);
    if (onComplete) onComplete();
  }

  if (step === 'done') {
    return (
      <WizardShell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Du er klar!
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
            Reveal er sat op og klar til brug. Du kan altid importere fra Jira later via Indstillinger.
          </p>
          <button
            onClick={markOnboardingComplete}
            disabled={saving}
            style={primaryBtn(saving)}
          >
            {saving ? 'Gemmer...' : 'Kom i gang →'}
          </button>
        </div>
      </WizardShell>
    );
  }

  if (step === 'connect') {
    return (
      <WizardShell>
        <StepIndicator current={2} total={2} />
        <h2 style={titleStyle}>Forbind til Jira</h2>
        <p style={subStyle}>
          Reveal importerer din backlog i read-only tilstand. Ingen ændringer sker i Jira.
        </p>

        {/* Preview of what will be imported */}
        <div style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 8 }}>
            Hvad vi henter
          </div>
          {[
            { icon: '📋', label: 'Issues fra din aktive sprint' },
            { icon: '📁', label: 'Project metadata og labels' },
            { icon: '👤', label: 'Assignee info (read-only)' },
            { icon: '🔢', label: 'Story points / estimater' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, color: 'var(--text2)' }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => {
              if (onNavigateToSettings) onNavigateToSettings();
              else setStep('done');
            }}
            style={primaryBtn()}
          >
            🔗 Forbind til Jira via Indstillinger
          </button>
          <button
            onClick={() => setStep('done')}
            style={ghostBtn()}
          >
            Spring over — konfigurer senere
          </button>
        </div>
      </WizardShell>
    );
  }

  if (step === 'manual') {
    return (
      <WizardShell>
        <StepIndicator current={2} total={2} />
        <h2 style={titleStyle}>Opret manuelt</h2>
        <p style={subStyle}>
          Du kan enten oprette items manuelt, eller indsætte en liste fra Excel.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => {
              setStep('done');
              if (onManual) onManual();
            }}
            style={primaryBtn()}
          >
            ✍️ Opret items manuelt
          </button>
          <button
            onClick={() => {
              setStep('done');
              if (onExcel) onExcel();
            }}
            style={secondaryBtn()}
          >
            📊 Indsæt fra Excel
            <span style={{ display: 'block', fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
              Tab-separeret · Titel, Timer, Prioritet
            </span>
          </button>
          <button onClick={() => setStep('question')} style={ghostBtn()}>
            ← Tilbage
          </button>
        </div>
      </WizardShell>
    );
  }

  // Default: question
  return (
    <WizardShell>
      <StepIndicator current={1} total={2} />
      <h2 style={titleStyle}>Har du en eksisterende backlog?</h2>
      <p style={subStyle}>
        Reveal kan importere din Jira eller Azure DevOps backlog direkte, så du slipper for at oprette alt manuelt.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        <ChoiceCard
          icon="🔗"
          title="Ja — Jira eller Azure DevOps"
          desc="Importer din sprint-backlog automatisk (read-only)"
          onClick={() => setStep('connect')}
          highlight
        />
        <ChoiceCard
          icon="✍️"
          title="Nej — jeg starter fra bunden"
          desc="Opret items manuelt eller indsæt fra Excel"
          onClick={() => setStep('manual')}
        />
      </div>
    </WizardShell>
  );
}

function WizardShell({ children }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '24px 28px',
      maxWidth: 440, margin: '0 auto',
    }}>
      {children}
    </div>
  );
}

function StepIndicator({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          height: 3, flex: 1, borderRadius: 2,
          background: i < current ? 'var(--jade)' : 'var(--border)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );
}

function ChoiceCard({ icon, title, desc, onClick, highlight }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
        background: hover || highlight ? 'rgba(0,200,150,0.06)' : 'var(--bg)',
        border: `1px solid ${hover || highlight ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.15s', width: '100%',
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>{desc}</div>
      </div>
      <span style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--text3)', alignSelf: 'center', flexShrink: 0 }}>→</span>
    </button>
  );
}

const titleStyle = { fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8, marginTop: 0 };
const subStyle = { fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20, marginTop: 0 };

function primaryBtn(disabled) {
  return {
    display: 'block', width: '100%', padding: '11px 20px',
    background: disabled ? 'var(--bg3)' : 'var(--jade)', color: disabled ? 'var(--text3)' : '#fff',
    border: 'none', borderRadius: 'var(--radius)', cursor: disabled ? 'default' : 'pointer',
    fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
  };
}

function secondaryBtn() {
  return {
    display: 'block', width: '100%', padding: '11px 20px',
    background: 'var(--bg3)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, textAlign: 'left',
  };
}

function ghostBtn() {
  return {
    display: 'block', width: '100%', padding: '8px 16px',
    background: 'transparent', color: 'var(--text3)',
    border: 'none', cursor: 'pointer',
    fontSize: 12, textAlign: 'center',
  };
}
