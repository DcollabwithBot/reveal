import { Suspense, lazy, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { provisionUser } from "./lib/api";
import { useSound } from "./shared/useSound.js";
import Landing from "./screens/Landing.jsx";
import DemoScreen from "./screens/DemoScreen.jsx";
import Login from "./screens/Login.jsx";
import Lobby from "./screens/Lobby.jsx";
import AppShell from "./components/AppShell.jsx";
import { GameModeProvider } from "./shared/GameModeContext.jsx";
import SearchModal from "./components/SearchModal.jsx";
import XPBadgeNotifier from "./components/XPBadgeNotifier.jsx";
import "./shared/animations.css";

const Dashboard = lazy(() => import("./screens/Dashboard.jsx"));
const AvatarCreator = lazy(() => import("./screens/AvatarCreator.jsx"));
const WorldSelect = lazy(() => import("./screens/WorldSelect.jsx"));
const SpecWarsScreen = lazy(() => import("./screens/SpecWarsScreen.jsx"));
const PerspectivePokerScreen = lazy(() => import("./screens/PerspectivePokerScreen.jsx"));
const BluffPokerScreen = lazy(() => import("./screens/BluffPokerScreen.jsx"));
const NestingScopeScreen = lazy(() => import("./screens/NestingScopeScreen.jsx"));
const SpeedScopeScreen = lazy(() => import("./screens/SpeedScopeScreen.jsx"));
const Overworld = lazy(() => import("./screens/Overworld.jsx"));
const Session = lazy(() => import("./screens/Session.jsx"));
const TimelogScreen = lazy(() => import("./screens/TimelogScreen.jsx"));
const WorkspaceSettings = lazy(() => import("./screens/WorkspaceSettings.jsx"));
const TeamKanban = lazy(() => import("./screens/TeamKanban.jsx"));
const RetroScreen = lazy(() => import("./screens/RetroScreen.jsx"));
const ProjectWorkspace = lazy(() => import("./screens/ProjectWorkspace.jsx"));
const SprintDraftScreen = lazy(() => import("./screens/SprintDraftScreen.jsx"));
const Onboarding = lazy(() => import("./screens/Onboarding.jsx"));
const KpiDashboard = lazy(() => import("./screens/KpiDashboard.jsx"));
const TruthSerumScreen = lazy(() => import("./screens/TruthSerumScreen.jsx"));
const FlowPokerScreen = lazy(() => import("./screens/FlowPokerScreen.jsx"));
const RiskPokerScreen = lazy(() => import("./screens/RiskPokerScreen.jsx"));
const AssumptionSlayerScreen = lazy(() => import("./screens/AssumptionSlayerScreen.jsx"));
const RefinementRouletteScreen = lazy(() => import("./screens/RefinementRouletteScreen.jsx"));
const DependencyMapperScreen = lazy(() => import("./screens/DependencyMapperScreen.jsx"));
const QuestLogScreen = lazy(() => import("./screens/QuestLogScreen.jsx"));
const OnboardingWalkthrough = lazy(() => import("./screens/OnboardingWalkthrough.jsx"));

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState("landing"); // landing | login | lobby | dashboard | timelog | settings | teamkanban | game
  const [organizationId, setOrganizationId] = useState(null);
  const [screen, setScreen] = useState("avatar"); // avatar → worlds → map → session
  const [timelogProjectId, setTimelogProjectId] = useState(null);
  const [workspaceProjectId, setWorkspaceProjectId] = useState(null);
  const [draftSessionId, setDraftSessionId] = useState(null);
  const [specWarsSessionId, setSpecWarsSessionId] = useState(null);
  const [perspectiveSessionId, setPerspectiveSessionId] = useState(null);
  const [bluffPokerSessionId, setBluffPokerSessionId] = useState(null);
  const [nestingScopeSessionId, setNestingScopeSessionId] = useState(null);
  const [speedScopeSessionId, setSpeedScopeSessionId] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [truthSerumSessionId, setTruthSerumSessionId] = useState(null);
  const [flowPokerSessionId, setFlowPokerSessionId] = useState(null);
  const [riskPokerSessionId, setRiskPokerSessionId] = useState(null);
  const [assumptionSlayerSessionId, setAssumptionSlayerSessionId] = useState(null);
  const [refinementRouletteSessionId, setRefinementRouletteSessionId] = useState(null);
  const [dependencyMapperSessionId, setDependencyMapperSessionId] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [world, setWorld] = useState(null);
  const [node, setNode] = useState(null);
  const [isLight, setIsLight] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const sound = useSound();

  function toggleTheme() {
    setIsLight(prev => {
      const next = !prev;
      document.body.classList.toggle('light', next);
      return next;
    });
  }

  function handleShellNavigate(screen) {
    if (screen === 'settings') {
      window.history.pushState({}, '', '/settings');
      setAuthScreen('settings');
    } else if (screen === 'game') {
      setAuthScreen('game');
    } else if (screen === 'dashboard') {
      window.history.pushState({}, '', '/dashboard');
      setAuthScreen('dashboard');
    } else if (screen === 'retro') {
      window.history.pushState({}, '', '/retro');
      setAuthScreen('retro');
    } else if (screen === 'analytics') {
      window.history.pushState({}, '', '/analytics');
      setAuthScreen('analytics');
    } else if (screen === 'quest_log') {
      window.history.pushState({}, '', '/quest-log');
      setAuthScreen('quest_log');
    } else if (screen === 'welcome') {
      window.history.pushState({}, '', '/welcome');
      setAuthScreen('welcome');
    } else {
      setAuthScreen(screen);
    }
  }

  function syncAuthScreenFromPath(pathname, hasUser) {
    if (pathname === '/demo') { setAuthScreen('demo'); return; }
    if (!hasUser) return;
    if (pathname === '/dashboard') {
      setAuthScreen('dashboard');
      return;
    }
    if (pathname === '/settings') {
      setAuthScreen('settings');
      return;
    }
    if (pathname === '/analytics') {
      setAuthScreen('analytics');
      return;
    }
    const truthSerumMatch = pathname.match(/^\/sessions\/([^/]+)\/truth-serum$/);
    if (truthSerumMatch) {
      setTruthSerumSessionId(truthSerumMatch[1]);
      setAuthScreen('truth_serum');
      return;
    }
    const flowPokerMatch = pathname.match(/^\/sessions\/([^/]+)\/flow-poker$/);
    if (flowPokerMatch) {
      setFlowPokerSessionId(flowPokerMatch[1]);
      setAuthScreen('flow_poker');
      return;
    }
    const riskPokerMatch = pathname.match(/^\/sessions\/([^/]+)\/risk-poker$/);
    if (riskPokerMatch) {
      setRiskPokerSessionId(riskPokerMatch[1]);
      setAuthScreen('risk_poker');
      return;
    }
    const assumptionSlayerMatch = pathname.match(/^\/sessions\/([^/]+)\/assumption-slayer$/);
    if (assumptionSlayerMatch) {
      setAssumptionSlayerSessionId(assumptionSlayerMatch[1]);
      setAuthScreen('assumption_slayer');
      return;
    }
    const refinementRouletteMatch = pathname.match(/^\/sessions\/([^/]+)\/refinement-roulette$/);
    if (refinementRouletteMatch) {
      setRefinementRouletteSessionId(refinementRouletteMatch[1]);
      setAuthScreen('refinement_roulette');
      return;
    }
    const dependencyMapperMatch = pathname.match(/^\/sessions\/([^/]+)\/dependency-mapper$/);
    if (dependencyMapperMatch) {
      setDependencyMapperSessionId(dependencyMapperMatch[1]);
      setAuthScreen('dependency_mapper');
      return;
    }
    const draftMatch = pathname.match(/^\/sessions\/([^/]+)\/draft$/);
    if (draftMatch) {
      setDraftSessionId(draftMatch[1]);
      setAuthScreen('sprint_draft');
      return;
    }
    const specWarsMatch = pathname.match(/^\/sessions\/([^/]+)\/spec-wars$/);
    if (specWarsMatch) {
      setSpecWarsSessionId(specWarsMatch[1]);
      setAuthScreen('spec_wars');
      return;
    }
    const perspMatch = pathname.match(/^\/sessions\/([^/]+)\/perspective-poker$/);
    if (perspMatch) {
      setPerspectiveSessionId(perspMatch[1]);
      setAuthScreen('perspective_poker');
      return;
    }
    const bluffMatch = pathname.match(/^\/sessions\/([^/]+)\/bluff-poker$/);
    if (bluffMatch) {
      setBluffPokerSessionId(bluffMatch[1]);
      setAuthScreen('bluff_poker');
      return;
    }
    const nestingMatch = pathname.match(/^\/sessions\/([^/]+)\/nesting-scope$/);
    if (nestingMatch) {
      setNestingScopeSessionId(nestingMatch[1]);
      setAuthScreen('nesting_scope');
      return;
    }
    const speedMatch = pathname.match(/^\/sessions\/([^/]+)\/speed-scope$/);
    if (speedMatch) {
      setSpeedScopeSessionId(speedMatch[1]);
      setAuthScreen('speed_scope');
      return;
    }
    const timelogMatch = pathname.match(/^\/projects\/([^/]+)\/timelog$/);
    if (timelogMatch) {
      setTimelogProjectId(timelogMatch[1]);
      setAuthScreen('timelog');
      return;
    }
    const workspaceMatch = pathname.match(/^\/projects\/([^/]+)$/);
    if (workspaceMatch) {
      setWorkspaceProjectId(workspaceMatch[1]);
      setAuthScreen('workspace');
      return;
    }
    if (pathname === '/quest-log') {
      setAuthScreen('quest_log');
      return;
    }
    if (pathname === '/welcome') {
      setAuthScreen('welcome');
      return;
    }
    if (pathname === '/demo') {
      setAuthScreen('demo');
      return;
    }
    if (pathname === '/' || pathname === '/login' || pathname === '/auth/callback') {
      setAuthScreen('lobby');
    }
  }

  // Hash cleanup sker automatisk af Supabase — vi fjerner ikke mere

  useEffect(() => {
    // Lad onAuthStateChange håndtere alt — inkl. OAuth-callback hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        syncAuthScreenFromPath(window.location.pathname, true);
      } else if (event === 'SIGNED_OUT') {
        setAuthScreen("landing");
      } else if (!u && window.location.pathname === '/demo') {
        setAuthScreen('demo');
      }
      // Sæt loading false første gang vi får et svar
      setLoading(false);
    });

    // Initialiser session fra storage (håndterer refresh + eksisterende session)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        syncAuthScreenFromPath(window.location.pathname, true);
      } else if (window.location.pathname === '/demo') {
        setAuthScreen('demo');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    provisionUser(user.id, user.user_metadata?.full_name || user.email)
      .then((data) => { if (data?.organization_id) setOrganizationId(data.organization_id); })
      .catch(() => {});
    // Check onboarding status
    supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.onboarding_completed === false) {
          setNeedsOnboarding(true);
        }
      })
      .catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    const onPopState = () => {
      syncAuthScreenFromPath(window.location.pathname, true);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global Cmd+K / Ctrl+K search shortcut
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (user) setSearchOpen(s => !s);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [user]);

  useEffect(() => {
    if (window.location.pathname === '/auth/callback' && user) {
      window.history.replaceState({}, document.title, '/');
      setAuthScreen('lobby');
    }
  }, [user]);

  if (loading) {
    return <LoadingScreen />;
  }

  const searchModalEl = user && searchOpen ? (
    <SearchModal
      onClose={() => setSearchOpen(false)}
      onNavigate={(projectId) => {
        setWorkspaceProjectId(projectId);
        window.history.pushState({}, '', `/projects/${projectId}`);
        setAuthScreen('workspace');
        setSearchOpen(false);
      }}
    />
  ) : null;

  if (authScreen === "demo") {
    return <DemoScreen />;
  }

  if (!user && authScreen !== "game") {
    if (authScreen === "login" || window.location.pathname.startsWith('/game')) {
      return (
        <Login
          onGuestPlay={() => setAuthScreen("game")}
          onNavigate={(screen) => {
            if (screen === 'dashboard') {
              window.history.pushState({}, document.title, '/dashboard');
              setAuthScreen('dashboard');
            }
          }}
        />
      );
    }
    return (
      <Landing
        onStartPlaying={() => setAuthScreen("login")}
        onJoinSession={() => setAuthScreen("game")}
      />
    );
  }

  if (user && needsOnboarding) {
    return (
      <Suspense fallback={<LoadingScreen label="LOADING..." />}>
        <Onboarding
          user={user}
          onComplete={() => {
            setNeedsOnboarding(false);
            window.history.pushState({}, document.title, '/dashboard');
            setAuthScreen('dashboard');
          }}
        />
      </Suspense>
    );
  }

  if (user && authScreen === "lobby") {
    return (
      <Lobby
        user={user}
        onContinue={() => setAuthScreen("game")}
        onDashboard={() => {
          window.history.pushState({}, document.title, '/dashboard');
          setAuthScreen("dashboard");
        }}
        onGuest={() => {
          setAuthScreen("game");
        }}
      />
    );
  }

  if (user && authScreen === "dashboard") {
    return (
      <GameModeProvider organizationId={organizationId}>
        {searchModalEl}
        <AppShell
          user={user}
          activeScreen="dashboard"
          activeProjectId={workspaceProjectId}
          onNavigate={handleShellNavigate}
          onWorkspaceNavigate={(projectId) => {
            setWorkspaceProjectId(projectId);
            window.history.pushState({}, '', `/projects/${projectId}`);
            setAuthScreen('workspace');
          }}
          isLight={isLight}
          toggleTheme={toggleTheme}
        >
          <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading...</div>}>
            <Dashboard
              user={user}
              onBackToLobby={() => {
                window.history.pushState({}, document.title, '/');
                setAuthScreen("lobby");
              }}
              onContinue={() => setAuthScreen("game")}
              onTimelog={(projectId) => {
                window.history.pushState({}, document.title, `/projects/${projectId}/timelog`);
                setTimelogProjectId(projectId);
                setAuthScreen("timelog");
              }}
              onWorkspace={(projectId) => {
                setWorkspaceProjectId(projectId);
                window.history.pushState({}, '', `/projects/${projectId}`);
                setAuthScreen('workspace');
              }}
              onAnalytics={() => {
                window.history.pushState({}, '', '/analytics');
                setAuthScreen('analytics');
              }}
              onQuestLog={() => {
                window.history.pushState({}, '', '/quest-log');
                setAuthScreen('quest_log');
              }}
              onWelcome={() => {
                window.history.pushState({}, '', '/welcome');
                setAuthScreen('welcome');
              }}
            />
          </Suspense>
        </AppShell>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "quest_log") {
    return (
      <GameModeProvider organizationId={organizationId}>
        <Suspense fallback={<div style={{ padding: 32 }}>Loading...</div>}>
          <QuestLogScreen
            organizationId={organizationId}
            onBack={() => { window.history.pushState({}, '', '/dashboard'); setAuthScreen('dashboard'); }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "welcome") {
    return (
      <GameModeProvider organizationId={organizationId}>
        <Suspense fallback={<div style={{ padding: 32 }}>Loading...</div>}>
          <OnboardingWalkthrough
            user={user}
            organizationId={organizationId}
            onDone={() => { window.history.pushState({}, '', '/dashboard'); setAuthScreen('dashboard'); }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "settings") {
    return (
      <GameModeProvider organizationId={organizationId}>
        {searchModalEl}
        <AppShell
          user={user}
          activeScreen="settings"
          activeProjectId={workspaceProjectId}
          onNavigate={handleShellNavigate}
          onWorkspaceNavigate={(projectId) => {
            setWorkspaceProjectId(projectId);
            window.history.pushState({}, '', `/projects/${projectId}`);
            setAuthScreen('workspace');
          }}
          isLight={isLight}
          toggleTheme={toggleTheme}
        >
          <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading...</div>}>
            <WorkspaceSettings
              onBack={() => {
                window.history.pushState({}, document.title, '/dashboard');
                setAuthScreen("dashboard");
              }}
            />
          </Suspense>
        </AppShell>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "timelog" && timelogProjectId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        {searchModalEl}
        <AppShell
          user={user}
          activeScreen="timelog"
          activeProjectId={workspaceProjectId}
          onNavigate={handleShellNavigate}
          onWorkspaceNavigate={(projectId) => {
            setWorkspaceProjectId(projectId);
            window.history.pushState({}, '', `/projects/${projectId}`);
            setAuthScreen('workspace');
          }}
          isLight={isLight}
          toggleTheme={toggleTheme}
        >
          <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading...</div>}>
            <TimelogScreen
              projectId={timelogProjectId}
              onBack={() => {
                window.history.pushState({}, document.title, '/dashboard');
                setAuthScreen("dashboard");
              }}
            />
          </Suspense>
        </AppShell>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "workspace" && workspaceProjectId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        {searchModalEl}
        <AppShell user={user} activeScreen="workspace" activeProjectId={workspaceProjectId} onNavigate={handleShellNavigate} onWorkspaceNavigate={(projectId) => { setWorkspaceProjectId(projectId); window.history.pushState({}, '', `/projects/${projectId}`); setAuthScreen('workspace'); }} isLight={isLight} toggleTheme={toggleTheme}>
          <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading...</div>}>
            <ProjectWorkspace
              projectId={workspaceProjectId}
              organizationId={organizationId}
              onBack={() => {
                window.history.pushState({}, '', '/dashboard');
                setAuthScreen('dashboard');
              }}
              onTimelog={(id) => {
                window.history.pushState({}, '', `/projects/${id}/timelog`);
                setTimelogProjectId(id);
                setAuthScreen('timelog');
              }}
            />
          </Suspense>
        </AppShell>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "teamkanban") {
    return (
      <GameModeProvider organizationId={organizationId}>
        {searchModalEl}
        <AppShell
          user={user}
          activeScreen="teamkanban"
          activeProjectId={workspaceProjectId}
          onNavigate={handleShellNavigate}
          onWorkspaceNavigate={(projectId) => {
            setWorkspaceProjectId(projectId);
            window.history.pushState({}, '', `/projects/${projectId}`);
            setAuthScreen('workspace');
          }}
          isLight={isLight}
          toggleTheme={toggleTheme}
        >
          <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading...</div>}>
            <TeamKanban />
          </Suspense>
        </AppShell>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "retro") {
    return (
      <GameModeProvider organizationId={organizationId}>
        {searchModalEl}
        <AppShell
          user={user}
          activeScreen="retro"
          activeProjectId={workspaceProjectId}
          onNavigate={handleShellNavigate}
          onWorkspaceNavigate={(projectId) => {
            setWorkspaceProjectId(projectId);
            window.history.pushState({}, '', `/projects/${projectId}`);
            setAuthScreen('workspace');
          }}
          isLight={isLight}
          toggleTheme={toggleTheme}
        >
          <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading...</div>}>
            <RetroScreen onNavigate={handleShellNavigate} />
          </Suspense>
        </AppShell>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "analytics") {
    return (
      <GameModeProvider organizationId={organizationId}>
        {searchModalEl}
        <AppShell
          user={user}
          activeScreen="analytics"
          activeProjectId={workspaceProjectId}
          onNavigate={handleShellNavigate}
          onWorkspaceNavigate={(projectId) => {
            setWorkspaceProjectId(projectId);
            window.history.pushState({}, '', `/projects/${projectId}`);
            setAuthScreen('workspace');
          }}
          isLight={isLight}
          toggleTheme={toggleTheme}
        >
          <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading Analytics...</div>}>
            <KpiDashboard
              organizationId={organizationId}
              onBack={() => {
                window.history.pushState({}, document.title, '/dashboard');
                setAuthScreen('dashboard');
              }}
            />
          </Suspense>
        </AppShell>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "truth_serum" && truthSerumSessionId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        <XPBadgeNotifier userId={user.id} organizationId={organizationId} />
        <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading Truth Serum...</div>}>
          <TruthSerumScreen
            sessionId={truthSerumSessionId}
            userId={user?.id}
            isGm={true}
            organizationId={organizationId}
            onBack={() => {
              window.history.pushState({}, '', '/dashboard');
              setAuthScreen('dashboard');
            }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "flow_poker" && flowPokerSessionId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        <XPBadgeNotifier userId={user.id} organizationId={organizationId} />
        <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading Flow Poker...</div>}>
          <FlowPokerScreen
            sessionId={flowPokerSessionId}
            user={user}
            onBack={() => {
              window.history.pushState({}, '', '/dashboard');
              setAuthScreen('dashboard');
            }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "risk_poker" && riskPokerSessionId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        <XPBadgeNotifier userId={user.id} organizationId={organizationId} />
        <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading Risk Poker...</div>}>
          <RiskPokerScreen
            sessionId={riskPokerSessionId}
            user={user}
            onBack={() => {
              window.history.pushState({}, '', '/dashboard');
              setAuthScreen('dashboard');
            }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "assumption_slayer" && assumptionSlayerSessionId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        <XPBadgeNotifier userId={user.id} organizationId={organizationId} />
        <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading Assumption Slayer...</div>}>
          <AssumptionSlayerScreen
            sessionId={assumptionSlayerSessionId}
            user={user}
            onBack={() => {
              window.history.pushState({}, '', '/dashboard');
              setAuthScreen('dashboard');
            }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "refinement_roulette" && refinementRouletteSessionId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        <XPBadgeNotifier userId={user.id} organizationId={organizationId} />
        <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading Refinement Roulette...</div>}>
          <RefinementRouletteScreen
            sessionId={refinementRouletteSessionId}
            user={user}
            onBack={() => {
              window.history.pushState({}, '', '/dashboard');
              setAuthScreen('dashboard');
            }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "dependency_mapper" && dependencyMapperSessionId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        <XPBadgeNotifier userId={user.id} organizationId={organizationId} />
        <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading Dependency Mapper...</div>}>
          <DependencyMapperScreen
            sessionId={dependencyMapperSessionId}
            user={user}
            onBack={() => {
              window.history.pushState({}, '', '/dashboard');
              setAuthScreen('dashboard');
            }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "sprint_draft" && draftSessionId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        {searchModalEl}
        <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading...</div>}>
          <SprintDraftScreen
            sessionId={draftSessionId}
            user={user}
            onBack={() => {
              window.history.pushState({}, '', '/dashboard');
              setAuthScreen('dashboard');
            }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "spec_wars" && specWarsSessionId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        <XPBadgeNotifier userId={user.id} organizationId={organizationId} />
        <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading Spec Wars...</div>}>
          <SpecWarsScreen
            sessionId={specWarsSessionId}
            user={user}
            onBack={() => {
              window.history.pushState({}, '', '/dashboard');
              setAuthScreen('dashboard');
            }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "perspective_poker" && perspectiveSessionId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        <XPBadgeNotifier userId={user.id} organizationId={organizationId} />
        <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading Perspektiv-Poker...</div>}>
          <PerspectivePokerScreen
            sessionId={perspectiveSessionId}
            user={user}
            avatar={avatar}
            onBack={() => {
              window.history.pushState({}, '', '/dashboard');
              setAuthScreen('dashboard');
            }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "bluff_poker" && bluffPokerSessionId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        <XPBadgeNotifier userId={user.id} organizationId={organizationId} />
        <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading Bluff Poker...</div>}>
          <BluffPokerScreen
            sessionId={bluffPokerSessionId}
            user={user}
            avatar={avatar}
            onBack={() => {
              window.history.pushState({}, '', '/dashboard');
              setAuthScreen('dashboard');
            }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "nesting_scope" && nestingScopeSessionId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        <XPBadgeNotifier userId={user.id} organizationId={organizationId} />
        <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading Russian Nesting Scope...</div>}>
          <NestingScopeScreen
            sessionId={nestingScopeSessionId}
            user={user}
            avatar={avatar}
            onBack={() => {
              window.history.pushState({}, '', '/dashboard');
              setAuthScreen('dashboard');
            }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "speed_scope" && speedScopeSessionId) {
    return (
      <GameModeProvider organizationId={organizationId}>
        <XPBadgeNotifier userId={user.id} organizationId={organizationId} />
        <Suspense fallback={<div style={{ padding: 32, color: 'var(--text2)' }}>Loading Speed Scope...</div>}>
          <SpeedScopeScreen
            sessionId={speedScopeSessionId}
            user={user}
            avatar={avatar}
            onBack={() => {
              window.history.pushState({}, '', '/dashboard');
              setAuthScreen('dashboard');
            }}
          />
        </Suspense>
      </GameModeProvider>
    );
  }

  return (
    <GameModeProvider organizationId={organizationId}>
      <Suspense fallback={<LoadingScreen label="LOADING GAME..." />}>
        {screen === "avatar" && (
          <AvatarCreator
            onDone={(av) => { setAvatar(av); setScreen("worlds"); }}
            sound={sound}
          />
        )}
        {screen === "worlds" && (
          <WorldSelect
            avatar={avatar}
            onSelect={(w) => { setWorld(w); setScreen("map"); }}
            onSelectMode={(mode) => {
              // Route to the correct game screen based on mode id
              const modeRoutes = {
                planning_poker: null, // uses default session flow via world select
                boss_battle_retro: null, // uses default session flow via world select
                sprint_draft: (id) => { setDraftSessionId(id); setAuthScreen('sprint_draft'); },
                spec_wars: (id) => { setSpecWarsSessionId(id); setAuthScreen('spec_wars'); },
                perspective_poker: (id) => { setPerspectiveSessionId(id); setAuthScreen('perspective_poker'); },
                bluff_poker: (id) => { setBluffPokerSessionId(id); setAuthScreen('bluff_poker'); },
                nesting_scope: (id) => { setNestingScopeSessionId(id); setAuthScreen('nesting_scope'); },
                speed_scope: (id) => { setSpeedScopeSessionId(id); setAuthScreen('speed_scope'); },
                truth_serum: (id) => { setTruthSerumSessionId(id); setAuthScreen('truth_serum'); },
                flow_poker: (id) => { setFlowPokerSessionId(id); setAuthScreen('flow_poker'); },
                risk_poker: (id) => { setRiskPokerSessionId(id); setAuthScreen('risk_poker'); },
                assumption_slayer: (id) => { setAssumptionSlayerSessionId(id); setAuthScreen('assumption_slayer'); },
                refinement_roulette: (id) => { setRefinementRouletteSessionId(id); setAuthScreen('refinement_roulette'); },
                dependency_mapper: (id) => { setDependencyMapperSessionId(id); setAuthScreen('dependency_mapper'); },
              };
              const modeId = mode.id;
              const routeFn = modeRoutes[modeId];
              if (routeFn) {
                // Create a session and navigate to the game screen
                import("./lib/supabase.js").then(({ supabase: sb }) => {
                  sb.from("sessions")
                    .insert({
                      game_mode: modeId,
                      organization_id: organizationId,
                      status: "active",
                      created_by: user?.id,
                    })
                    .select("id")
                    .single()
                    .then(({ data, error }) => {
                      if (error || !data?.id) {
                        console.error("Failed to create session for mode", modeId, error);
                        return;
                      }
                      const slug = modeId.replace(/_/g, '-');
                      window.history.pushState({}, '', `/sessions/${data.id}/${slug}`);
                      routeFn(data.id);
                    });
                });
              } else {
                // planning_poker or unknown: use legacy world flow
                setWorld(mode);
                setScreen("map");
              }
            }}
            sound={sound}
            organizationId={organizationId}
          />
        )}
        {screen === "map" && (
          <Overworld
            project={world}
            avatar={avatar}
            onBack={() => setScreen("worlds")}
            onNode={(n) => { setNode(n); setScreen("session"); }}
            sound={sound}
          />
        )}
        {screen === "session" && (
          <Session
            avatar={avatar}
            node={node}
            project={world}
            onBack={() => setScreen("map")}
            onComplete={(nodeId) => {
              if (nodeId) {
                setWorld(w => w ? {
                  ...w,
                  nodes: w.nodes.map(n => n.id === nodeId ? { ...n, dn: true } : n)
                } : w);
              }
              setNode(null);
              setScreen("map");
            }}
            sound={sound}
          />
        )}
      </Suspense>
    </GameModeProvider>
  );
}

function LoadingScreen({ label = "LOADING..." }) {
  return (
    <div style={loadingStyles.container}>
      <div style={loadingStyles.scanlines} />
      <div style={loadingStyles.content}>
        <p style={loadingStyles.title}>⚔️ REVEAL</p>
        <p style={loadingStyles.dots}>{label}</p>
        <div style={loadingStyles.bar}>
          <div style={loadingStyles.fill} />
        </div>
      </div>
    </div>
  );
}

const loadingStyles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0e1019',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace",
    position: 'relative',
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
    pointerEvents: 'none',
  },
  content: {
    position: 'relative',
    textAlign: 'center',
  },
  title: {
    margin: '0 0 16px',
    fontSize: '24px',
    color: '#a78bfa',
    textShadow: '0 0 10px rgba(167,139,250,0.8)',
    letterSpacing: '4px',
  },
  dots: {
    margin: '0 0 20px',
    fontSize: '10px',
    color: '#6b7280',
    letterSpacing: '2px',
    animation: 'blink 1s step-end infinite',
  },
  bar: {
    width: '200px',
    height: '8px',
    background: '#1a1c2e',
    border: '1px solid #374151',
    margin: '0 auto',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    width: '60%',
    background: 'linear-gradient(90deg, #4c1d95, #7c3aed)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
};
