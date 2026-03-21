import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { C, PF, BF } from '../shared/constants';
import JiraOnboardingWizard from '../components/onboarding/JiraOnboardingWizard';
import { handleError } from '../lib/errorHandler';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function edgeFn(fnName, body = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Edge function error');
  }
  return res.json();
}

// ── Step Components ───────────────────────────────────────────────────────────

function StepWelcome({ onNext }) {
  const [tick, setTick] = useState(true);
  useEffect(() => { const t = setInterval(() => setTick(v => !v), 530); return () => clearInterval(t); }, []);

  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>⚔️</div>
      <div style={{ fontFamily: PF, fontSize: 28, color: C.grn, textShadow: `0 0 12px ${C.grn}`, letterSpacing: 4, marginBottom: 16 }}>
        REVEAL
        <span style={{ fontFamily: PF, fontSize: 24, color: C.grn }}>{tick ? '█' : ' '}</span>
      </div>
      <p style={{ fontFamily: BF, fontSize: 16, color: C.dim, marginBottom: 40, lineHeight: 1.6 }}>
        Gør usikkerhed synlig. Tidligere.
      </p>
      <button onClick={onNext} style={primaryBtnStyle}>
        KOM I GANG →
      </button>
    </div>
  );
}

function StepOrganization({ data, onChange, onNext }) {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🏰</div>
        <h2 style={headingStyle}>OPRET ORGANISATION</h2>
        <p style={subStyle}>Dit team, dit slot.</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Organisationsnavn</label>
        <input
          style={inputStyle}
          value={data.orgName}
          onChange={e => onChange({ orgName: e.target.value })}
          placeholder="Fx 'NetIP Development'"
          autoFocus
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Team størrelse</label>
        <select
          style={inputStyle}
          value={data.teamSize}
          onChange={e => onChange({ teamSize: e.target.value })}
        >
          <option value="">Vælg...</option>
          <option value="1-5">1-5 personer</option>
          <option value="6-15">6-15 personer</option>
          <option value="16-50">16-50 personer</option>
          <option value="50+">50+ personer</option>
        </select>
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={labelStyle}>Primær brug</label>
        <select
          style={inputStyle}
          value={data.primaryUse}
          onChange={e => onChange({ primaryUse: e.target.value })}
        >
          <option value="">Vælg...</option>
          <option value="planning_poker">Planning Poker</option>
          <option value="sprint_planning">Sprint Planning</option>
          <option value="retrospectives">Retrospectives</option>
          <option value="all">Alt det ovenstående</option>
        </select>
      </div>

      <button
        onClick={onNext}
        disabled={!data.orgName?.trim()}
        style={{ ...primaryBtnStyle, opacity: data.orgName?.trim() ? 1 : 0.5 }}
      >
        FORTSÆT →
      </button>
    </div>
  );
}

function StepInvite({ emails, setEmails, onNext, onSkip, sending }) {
  const addEmail = () => setEmails(prev => [...prev, '']);
  const updateEmail = (i, val) => setEmails(prev => prev.map((e, idx) => idx === i ? val : e));
  const removeEmail = (i) => setEmails(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
        <h2 style={headingStyle}>INVITÉR TEAMET</h2>
        <p style={subStyle}>Invitér dine kollegaer — minimum 2 for at spille</p>
      </div>

      {emails.map((email, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            type="email"
            value={email}
            onChange={e => updateEmail(i, e.target.value)}
            placeholder={`Email ${i + 1}`}
          />
          {emails.length > 2 && (
            <button onClick={() => removeEmail(i)} style={{ ...btnOutline, padding: '8px 12px', fontSize: 14, color: 'var(--danger)' }}>×</button>
          )}
        </div>
      ))}

      <button onClick={addEmail} style={{ ...btnOutline, marginBottom: 24, fontSize: 12 }}>
        + Tilføj mere
      </button>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onNext}
          disabled={sending || emails.filter(e => e.trim()).length === 0}
          style={{ ...primaryBtnStyle, flex: 1, opacity: sending ? 0.6 : 1 }}
        >
          {sending ? 'SENDER...' : 'SEND INVITATIONER'}
        </button>
        <button onClick={onSkip} style={{ ...btnOutline, flex: 0 }}>
          Spring over →
        </button>
      </div>
    </div>
  );
}

function StepProject({ data, onChange, onNext, onImportJira, onImportExcel }) {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <h2 style={headingStyle}>FØRSTE PROJEKT</h2>
        <p style={subStyle}>Hvad arbejder I på?</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Projektnavn</label>
        <input
          style={inputStyle}
          value={data.projectName}
          onChange={e => onChange({ projectName: e.target.value })}
          placeholder="Fx 'Kombit WiFi Sprint 13'"
          autoFocus
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        <button onClick={onImportJira} style={featureBtnStyle}>
          <span style={{ fontSize: 20 }}>🔗</span>
          <span style={{ fontSize: 11 }}>Importer fra Jira</span>
        </button>
        <button onClick={onImportExcel} style={featureBtnStyle}>
          <span style={{ fontSize: 20 }}>📊</span>
          <span style={{ fontSize: 11 }}>Start med Excel</span>
        </button>
        <button
          onClick={onNext}
          disabled={!data.projectName?.trim()}
          style={{ ...featureBtnStyle, borderColor: data.projectName?.trim() ? C.grn : 'var(--border)' }}
        >
          <span style={{ fontSize: 20 }}>✨</span>
          <span style={{ fontSize: 11 }}>Start tomt</span>
        </button>
      </div>
    </div>
  );
}

function StepComplete({ onFinish }) {
  const [confetti, setConfetti] = useState([]);

  useEffect(() => {
    const particles = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      color: ['#00c896', '#FFD700', '#a78bfa', '#FF6B6B', '#4ECDC4'][Math.floor(Math.random() * 5)],
      size: 6 + Math.random() * 8,
    }));
    setConfetti(particles);
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '40px 0', position: 'relative', overflow: 'hidden' }}>
      {/* Confetti */}
      {confetti.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.left}%`,
          top: -20,
          width: p.size,
          height: p.size,
          background: p.color,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          animation: `confetti-fall 3s ease-in ${p.delay}s forwards`,
          opacity: 0.9,
        }} />
      ))}

      <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
      <h2 style={{ ...headingStyle, fontSize: 18 }}>I ER KLAR!</h2>
      <p style={{ ...subStyle, marginBottom: 8 }}>I er klar til at afsløre usikkerhed 🎉</p>
      <p style={{ fontFamily: BF, fontSize: 13, color: C.dim, marginBottom: 40 }}>
        Næste anbefaling: Start med en Planning Poker session
      </p>

      <button onClick={onFinish} style={primaryBtnStyle}>
        ÅBN DASHBOARD →
      </button>

      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(80vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: 32, height: 4, borderRadius: 2,
          background: i <= step ? C.grn : 'var(--bg3)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );
}

// ── Main Onboarding ───────────────────────────────────────────────────────────

export default function Onboarding({ user, onComplete }) {
  const [step, setStep] = useState(0);
  const [orgData, setOrgData] = useState({ orgName: '', teamSize: '', primaryUse: '' });
  const [emails, setEmails] = useState(['', '']);
  const [projectData, setProjectData] = useState({ projectName: '' });
  const [sending, setSending] = useState(false);
  const [createdOrgId, setCreatedOrgId] = useState(null);
  const [error, setError] = useState('');
  const [showJiraWizard, setShowJiraWizard] = useState(false);

  const handleCreateOrg = async () => {
    if (!orgData.orgName?.trim()) return;
    try {
      // The provision edge function already creates an org — we just need to update it
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember?.organization_id) {
        // Update existing org with user's chosen name
        await supabase
          .from('organizations')
          .update({
            name: orgData.orgName.trim(),
            metadata: { team_size: orgData.teamSize, primary_use: orgData.primaryUse },
          })
          .eq('id', existingMember.organization_id);
        setCreatedOrgId(existingMember.organization_id);
      } else {
        // Create new org
        const slug = `org-${Date.now().toString(36)}`;
        const { data: org, error: orgErr } = await supabase
          .from('organizations')
          .insert({
            name: orgData.orgName.trim(),
            slug,
            plan: 'free',
            language: 'da',
            metadata: { team_size: orgData.teamSize, primary_use: orgData.primaryUse },
          })
          .select()
          .single();
        if (orgErr) throw new Error(orgErr.message);

        await supabase.from('organization_members').insert({
          organization_id: org.id,
          user_id: user.id,
          role: 'owner',
        });

        const { data: team } = await supabase
          .from('teams')
          .insert({ organization_id: org.id, name: 'Default Team', created_by: user.id })
          .select()
          .single();

        if (team) {
          await supabase.from('team_members').insert({ team_id: team.id, user_id: user.id, role: 'admin' });
        }

        setCreatedOrgId(org.id);
      }
      setStep(2);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSendInvites = async () => {
    const validEmails = emails.filter(e => e.trim() && e.includes('@'));
    if (!validEmails.length) return;
    setSending(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
      const inviterName = profile?.display_name || user.email || 'A teammate';

      await edgeFn('send-email', {
        to: validEmails,
        org_id: createdOrgId,
        template: 'onboarding_invite',
        template_data: {
          org_name: orgData.orgName,
          inviter_name: inviterName,
        },
      });
      setStep(3);
    } catch (e) {
      setError(e.message);
    }
    setSending(false);
  };

  const handleCreateProject = async () => {
    if (!projectData.projectName?.trim() || !createdOrgId) {
      setStep(4);
      return;
    }
    try {
      const { error: projErr } = await supabase
        .from('projects')
        .insert({
          organization_id: createdOrgId,
          name: projectData.projectName.trim(),
          status: 'active',
          created_by: user.id,
        });
      if (projErr) throw new Error(projErr.message);
      setStep(4);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleFinish = async () => {
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (createdOrgId) {
        await supabase
          .from('organizations')
          .update({ onboarding_completed_at: new Date().toISOString() })
          .eq('id', createdOrgId);
      }

      onComplete();
    } catch (e) {
      handleError(e, 'onboarding-complete');
      onComplete(); // Even if update fails, proceed
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.wht,
      fontFamily: BF, position: 'relative', overflow: 'hidden',
    }}>
      {/* Scanlines */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto', padding: '40px 24px' }}>
        {step > 0 && step < 4 && <ProgressBar step={step} total={5} />}

        {error && (
          <div style={{
            background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)',
            borderRadius: 8, padding: '10px 16px', marginBottom: 16,
            fontSize: 12, color: '#ff5050',
          }}>
            {error}
            <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: '#ff5050', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {step === 0 && <StepWelcome onNext={() => setStep(1)} />}
        {step === 1 && <StepOrganization data={orgData} onChange={d => setOrgData(prev => ({ ...prev, ...d }))} onNext={handleCreateOrg} />}
        {step === 2 && <StepInvite emails={emails} setEmails={setEmails} onNext={handleSendInvites} onSkip={() => setStep(3)} sending={sending} />}
        {step === 3 && !showJiraWizard && (
          <StepProject
            data={projectData}
            onChange={d => setProjectData(prev => ({ ...prev, ...d }))}
            onNext={handleCreateProject}
            onImportJira={() => setShowJiraWizard(true)}
            onImportExcel={() => { handleCreateProject(); }}
          />
        )}
        {step === 3 && showJiraWizard && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: PF, fontSize: 10, color: C.grn, letterSpacing: 2 }}>BACKLOG IMPORT</div>
            </div>
            <JiraOnboardingWizard
              userId={user?.id}
              onComplete={() => { setShowJiraWizard(false); handleCreateProject(); }}
              onManual={() => { setShowJiraWizard(false); handleCreateProject(); }}
              onExcel={() => { setShowJiraWizard(false); handleCreateProject(); }}
              onNavigateToSettings={() => { setShowJiraWizard(false); handleCreateProject(); }}
            />
          </div>
        )}
        {step === 4 && <StepComplete onFinish={handleFinish} />}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const headingStyle = {
  fontFamily: PF, fontSize: 14, color: C.grn,
  textShadow: `0 0 8px ${C.grn}`, letterSpacing: 2,
  margin: '0 0 8px',
};

const subStyle = {
  fontFamily: BF, fontSize: 14, color: C.dim, margin: 0, lineHeight: 1.6,
};

const labelStyle = {
  fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6,
  fontFamily: PF, letterSpacing: 1,
};

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: C.bg, border: `2px solid ${C.brd}`,
  color: C.wht, fontFamily: BF, fontSize: 15,
  padding: '12px 14px', outline: 'none',
};

const primaryBtnStyle = {
  padding: '14px 28px',
  background: C.grn,
  border: '3px solid #000',
  boxShadow: '4px 4px 0 #000',
  color: '#000',
  fontFamily: PF, fontSize: 9,
  cursor: 'pointer',
  letterSpacing: 1,
  transition: 'transform 0.08s, box-shadow 0.08s',
};

const btnOutline = {
  padding: '10px 16px',
  background: 'transparent',
  border: `2px solid ${C.brd}`,
  color: C.dim,
  fontFamily: PF, fontSize: 8,
  cursor: 'pointer',
  letterSpacing: 1,
};

const featureBtnStyle = {
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  gap: 8, padding: '16px 8px',
  background: C.bgC, border: `2px solid ${C.brd}`,
  color: C.wht, cursor: 'pointer',
  fontFamily: BF, transition: 'border-color 0.2s',
};
