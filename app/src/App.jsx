import { Suspense, lazy, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { provisionUser } from "./lib/api";
import { useSound } from "./shared/useSound.js";
import Landing from "./screens/Landing.jsx";
import Login from "./screens/Login.jsx";
import Lobby from "./screens/Lobby.jsx";
import AppShell from "./components/AppShell.jsx";
import { GameModeProvider } from "./shared/GameModeContext.jsx";
import "./shared/animations.css";

const Dashboard = lazy(() => import("./screens/Dashboard.jsx"));
const AvatarCreator = lazy(() => import("./screens/AvatarCreator.jsx"));
const WorldSelect = lazy(() => import("./screens/WorldSelect.jsx"));
const Overworld = lazy(() => import("./screens/Overworld.jsx"));
const Session = lazy(() => import("./screens/Session.jsx"));
const TimelogScreen = lazy(() => import("./screens/TimelogScreen.jsx"));
const WorkspaceSettings = lazy(() => import("./screens/WorkspaceSettings.jsx"));
const TeamKanban = lazy(() => import("./screens/TeamKanban.jsx"));
const ProjectWorkspace = lazy(() => import("./screens/ProjectWorkspace.jsx"));

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState("landing"); // landing | login | lobby | dashboard | timelog | settings | teamkanban | game
  const [organizationId, setOrganizationId] = useState(null);
  const [screen, setScreen] = useState("avatar"); // avatar → worlds → map → session
  const [timelogProjectId, setTimelogProjectId] = useState(null);
  const [workspaceProjectId, setWorkspaceProjectId] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [world, setWorld] = useState(null);
  const [node, setNode] = useState(null);
  const [isLight, setIsLight] = useState(false);
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
    } else {
      // teamkanban, retro, etc.
      setAuthScreen(screen);
    }
  }

  function syncAuthScreenFromPath(pathname, hasUser) {
    if (!hasUser) return;
    if (pathname === '/dashboard') {
      setAuthScreen('dashboard');
      return;
    }
    if (pathname === '/settings') {
      setAuthScreen('settings');
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
      }
      // Sæt loading false første gang vi får et svar
      setLoading(false);
    });

    // Initialiser session fra storage (håndterer refresh + eksisterende session)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        syncAuthScreenFromPath(window.location.pathname, true);
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
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    const onPopState = () => {
      syncAuthScreenFromPath(window.location.pathname, true);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (window.location.pathname === '/auth/callback' && user) {
      window.history.replaceState({}, document.title, '/');
      setAuthScreen('lobby');
    }
  }, [user]);

  if (loading) {
    return <LoadingScreen />;
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
        <AppShell
          user={user}
          activeScreen="dashboard"
          onNavigate={handleShellNavigate}
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
            />
          </Suspense>
        </AppShell>
      </GameModeProvider>
    );
  }

  if (user && authScreen === "settings") {
    return (
      <GameModeProvider organizationId={organizationId}>
        <AppShell
          user={user}
          activeScreen="settings"
          onNavigate={handleShellNavigate}
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
        <AppShell
          user={user}
          activeScreen="timelog"
          onNavigate={handleShellNavigate}
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
        <AppShell user={user} activeScreen="workspace" onNavigate={handleShellNavigate} isLight={isLight} toggleTheme={toggleTheme}>
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
        <AppShell
          user={user}
          activeScreen="teamkanban"
          onNavigate={handleShellNavigate}
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
            sound={sound}
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
