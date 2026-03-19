import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { useSound } from "./shared/useSound.js";
import Landing from "./screens/Landing.jsx";
import Login from "./screens/Login.jsx";
import Lobby from "./screens/Lobby.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import AvatarCreator from "./screens/AvatarCreator.jsx";
import WorldSelect from "./screens/WorldSelect.jsx";
import Overworld from "./screens/Overworld.jsx";
import Session from "./screens/Session.jsx";
import "./shared/animations.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState("landing"); // landing | login | lobby | dashboard | game
  const [screen, setScreen] = useState("avatar"); // avatar → worlds → map → session
  const [avatar, setAvatar] = useState(null);
  const [world, setWorld] = useState(null);
  const [node, setNode] = useState(null);
  const sound = useSound();

  function syncAuthScreenFromPath(pathname, hasUser) {
    if (!hasUser) return;
    if (pathname === '/dashboard') {
      setAuthScreen('dashboard');
      return;
    }
    if (pathname === '/' || pathname === '/login' || pathname === '/auth/callback') {
      setAuthScreen('lobby');
    }
  }

  // Handle Supabase OAuth callback (hash-based token exchange)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token') || hash.includes('error'))) {
      // Supabase JS auto-handles hash exchange; just clear the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const nextUser = data?.user ?? null;
      setUser(nextUser);
      if (nextUser) syncAuthScreenFromPath(window.location.pathname, true);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        syncAuthScreenFromPath(window.location.pathname, true);
      } else {
        setAuthScreen("landing");
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Provision org+team for new users
  useEffect(() => {
    if (!user) return;
    fetch('/api/auth/provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        display_name: user.user_metadata?.full_name || user.email
      })
    }).catch(() => {}); // fire-and-forget
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;

    const onPopState = () => {
      syncAuthScreenFromPath(window.location.pathname, true);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={loadingStyles.container}>
        <div style={loadingStyles.scanlines} />
        <div style={loadingStyles.content}>
          <p style={loadingStyles.title}>⚔️ REVEAL</p>
          <p style={loadingStyles.dots}>LOADING...</p>
          <div style={loadingStyles.bar}>
            <div style={loadingStyles.fill} />
          </div>
        </div>
      </div>
    );
  }

  // Auth callback path — Supabase hash is handled above, redirect to lobby
  if (window.location.pathname === '/auth/callback') {
    window.history.replaceState({}, document.title, '/');
    if (user) setAuthScreen("lobby");
    return null;
  }

  // Not logged in → landing (default) or login (if coming from /game path or "Start Playing")
  if (!user && authScreen !== "game") {
    // Show login if explicitly navigated there or via /game path
    if (authScreen === "login" || window.location.pathname.startsWith('/game')) {
      return (
        <Login
          onGuestPlay={(session) => {
            // Guest joined a session by code — go straight to game
            setAuthScreen("game");
          }}
        />
      );
    }
    // Default: show landing page
    return (
      <Landing
        onStartPlaying={() => setAuthScreen("login")}
        onJoinSession={(session) => setAuthScreen("game")}
      />
    );
  }

  // Logged in, show lobby first
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
          // Play as guest (logged in but skip personalization)
          setAuthScreen("game");
        }}
      />
    );
  }

  if (user && authScreen === "dashboard") {
    return (
      <Dashboard
        user={user}
        onBackToLobby={() => {
          window.history.pushState({}, document.title, '/');
          setAuthScreen("lobby");
        }}
        onContinue={() => setAuthScreen("game")}
      />
    );
  }

  // Game screens
  return (
    <>
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
    </>
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
