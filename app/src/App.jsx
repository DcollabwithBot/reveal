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
const BluffPokerScreen = lazy(() => import("./screens/BluffPoker/index.jsx"));
const NestingScopeScreen = lazy(() => import("./screens/NestingScope/index.jsx"));
const SpeedScopeScreen = lazy(() => import("./screens/SpeedScope/index.jsx"));
const Overworld = lazy(() => import("./screens/Overworld.jsx"));
const Session = lazy(() => import("./screens/Session.jsx"));
const TimelogScreen = lazy(() => import("./screens/TimelogScreen.jsx"));
const WorkspaceSettings = lazy(() => import("./screens/WorkspaceSettings.jsx"));
const TeamKanban = lazy(() => import("./screens/TeamKanban.jsx"));
const RetroScreen = lazy(() => import("./screens/RetroScreen.jsx"));
const ProjectWorkspace = lazy(() => import("./screens/ProjectWorkspace.jsx"));
const SprintDraftScreen = lazy(() => import("./screens/SprintDraft/index.jsx"));
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
const DocsScreen = lazy(() => import("./screens/DocsScreen.jsx"));

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState("landing"); // landing | login | lobby | dashboard | timelog | settings | teamkanban | game
  const [organizationId, setOrganizationId] = useState(null);
  const [screen, setScreen] = useState("avatar"); // avatar → worlds → map → session
  const [timelogProjectId, setTimelogProjectId] = useState(null);
  const [workspaceProjectId, setWorkspaceProjectId] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentSessionMode, setCurrentSessionMode] = useState(null);
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
    } else if (screen === 'docs') {
      window.history.pushState({}, '', '/docs');
      setAuthScreen('docs');
    } else if (screen === 'welcome') {
      window.history.pushState({}, '', '/welcome');
      setAuthScreen('welcome');
    } else {
      setAuthScreen(screen);
    }
  }

  const slugToMode = {
    'planning-poker': 'planning_poker',
    'boss-battle-retro': 'boss_battle_retro',
    'spec-wars': 'spec_wars',
    'perspective-poker': 'perspective_poker',
    'bluff-poker': 'bluff_poker',
    'nesting-scope': 'nesting_scope',
    'speed-scope': 'speed_scope',
    'truth-serum': 'truth_serum',
    'flow-poker': 'flow_poker',
    'risk-poker': 'risk_poker',
    'assumption-slayer': 'assumption_slayer',
    'refinement-roulette': 'refinement_roulette',
    'dependency-mapper': 'dependency_mapper',
    'draft': 'sprint_draft',
  };

  function syncAuthScreenFromPath(pathname, hasUser) {
    if (pathname === '/demo') { setAuthScreen('demo'); return; }
    if (!hasUser) return;
    if (pathname === '/dashboard') { setAuthScreen('dashboard'); return; }
    if (pathname === '/settings') { setAuthScreen('settings'); return; }
    if (pathname === '/analytics') { setAuthScreen('analytics'); return; }
    if (pathname === '/quest-log') { setAuthScreen('quest_log'); return; }
    if (pathname === '/welcome') { setAuthScreen('welcome'); return; }
    if (pathname === '/docs' || pathname === '/help') { setAuthScreen('docs'); return; }

    // Unified session route: /sessions/:id/:slug
    const sessionMatch = pathname.match(/^\/sessions\/([^/]+)\/([^/]+)$/);
    if (sessionMatch) {
      const [, id, slug] = sessionMatch;
      const mode = slugToMode[slug];
      if (mode) {
        setCurrentSessionId(id);
        setCurrentSessionMode(mode);
        setAuthScreen('session_active');
        return;
      }
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

  if (user && authScreen === "docs") {
    return (
      <GameModeProvider organizationId={organizationId}>
        {searchModalEl}
        <AppShell
          user={user}
          activeScreen="docs"
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
            <DocsScreen
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

  if (user && authScreen === "session_active" && currentSessionId && currentSessionMode) {
    const backToDashboard = () => {
      window.history.pushState({}, '', '/dashboard');
      setAuthScreen('dashboard');
    };

    const renderSessionScreen = () => {
      switch (currentSessionMode) {
        case 'planning_poker':
        case 'boss_battle_retro': {
          const nodeType = currentSessionMode === 'boss_battle_retro' ? 'b' : 'p';
          const modeName = currentSessionMode === 'boss_battle_retro' ? 'Boss Battle Retro' : 'Planning Poker';
          return (
            <Session
              avatar={avatar}
              node={{ id: currentSessionId, tp: nodeType, name: modeName, sessionId: currentSessionId }}
              project={{ id: 'direct', name: modeName, nodes: [], paths: [] }}
              onBack={backToDashboard}
              onComplete={backToDashboard}
              sound={sound}
            />
          );
        }
        case 'truth_serum':
          return <TruthSerumScreen sessionId={currentSessionId} userId={user?.id} isGm={true} organizationId={organizationId} onBack={backToDashboard} />;
        case 'flow_poker':
          return <FlowPokerScreen sessionId={currentSessionId} user={user} onBack={backToDashboard} />;
        case 'risk_poker':
          return <RiskPokerScreen sessionId={currentSessionId} user={user} onBack={backToDashboard} />;
        case 'assumption_slayer':
          return <AssumptionSlayerScreen sessionId={currentSessionId} user={user} onBack={backToDashboard} />;
        case 'refinement_roulette':
          return <RefinementRouletteScreen sessionId={currentSessionId} user={user} onBack={backToDashboard} />;
        case 'dependency_mapper':
          return <DependencyMapperScreen sessionId={currentSessionId} user={user} onBack={backToDashboard} />;
        case 'sprint_draft':
          return <SprintDraftScreen sessionId={currentSessionId} user={user} onBack={backToDashboard} />;
        case 'spec_wars':
          return <SpecWarsScreen sessionId={currentSessionId} user={user} onBack={backToDashboard} />;
        case 'perspective_poker':
          return <PerspectivePokerScreen sessionId={currentSessionId} user={user} avatar={avatar} onBack={backToDashboard} />;
        case 'bluff_poker':
          return <BluffPokerScreen sessionId={currentSessionId} user={user} avatar={avatar} onBack={backToDashboard} />;
        case 'nesting_scope':
          return <NestingScopeScreen sessionId={currentSessionId} user={user} avatar={avatar} onBack={backToDashboard} />;
        case 'speed_scope':
          return <SpeedScopeScreen sessionId={currentSessionId} user={user} avatar={avatar} onBack={backToDashboard} />;
        default:
          return null;
      }
    };

    return (
      <GameModeProvider organizationId={organizationId}>
        <XPBadgeNotifier userId={user.id} organizationId={organizationId} />
        <Suspense fallback={<LoadingScreen label="LOADING SESSION..." />}>
          {renderSessionScreen()}
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
            onSelectMode={(mode, selectedItems = []) => {
              const modeId = mode.id;
              const modeRouteSlugs = {
                planning_poker: 'planning-poker',
                boss_battle_retro: 'boss-battle-retro',
                spec_wars: 'spec-wars',
                perspective_poker: 'perspective-poker',
                bluff_poker: 'bluff-poker',
                nesting_scope: 'nesting-scope',
                speed_scope: 'speed-scope',
                truth_serum: 'truth-serum',
                flow_poker: 'flow-poker',
                risk_poker: 'risk-poker',
                assumption_slayer: 'assumption-slayer',
                refinement_roulette: 'refinement-roulette',
                dependency_mapper: 'dependency-mapper',
                sprint_draft: 'draft',
              };
              const slug = modeRouteSlugs[modeId];
              if (slug) {
                // Create a session and navigate to the game screen
                import("./lib/supabase.js").then(({ supabase: sb }) => {
                  sb.from("sessions")
                    .insert({
                      game_mode: modeId,
                      organization_id: organizationId,
                      status: "active",
                      created_by: user?.id,
                      ...(selectedItems?.length ? { items_covered: selectedItems } : {}),
                    })
                    .select("id")
                    .single()
                    .then(({ data, error }) => {
                      if (error || !data?.id) {
                        console.error("Failed to create session for mode", modeId, error);
                        return;
                      }
                      setCurrentSessionId(data.id);
                      setCurrentSessionMode(modeId);
                      window.history.pushState({}, '', `/sessions/${data.id}/${slug}`);
                      setAuthScreen('session_active');
                    });
                });
              } else {
                // Unknown mode: use legacy world flow via overworld
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
            userId={user?.id}
            organizationId={organizationId}
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
