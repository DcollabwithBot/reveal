import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { useSound } from "./shared/useSound.js";
import AvatarCreator from "./screens/AvatarCreator.jsx";
import WorldSelect from "./screens/WorldSelect.jsx";
import Overworld from "./screens/Overworld.jsx";
import Session from "./screens/Session.jsx";
import SessionLobby from "./screens/SessionLobby.jsx";
import ActiveSession from "./screens/ActiveSession.jsx";
import AuthScreen from "./screens/AuthScreen.jsx";
import "./shared/animations.css";

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [avatar, setAvatar] = useState(null);
  const [world, setWorld] = useState(null);
  const [node, setNode] = useState(null);
  const [user, setUser] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const sound = useSound();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data?.session?.user || null;
      setUser(u);
      setScreen(u ? "lobby" : "auth");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) {
        setScreen("lobby");
      } else {
        setActiveSessionId(null);
        setScreen("auth");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Loading
  if (screen === "loading") {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a1a",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "14px", color: "#f0c040" }}>
          ⚙️ LOADING...
        </div>
      </div>
    );
  }

  // Not logged in → auth screen
  if (!user) {
    return <AuthScreen />;
  }

  // Logged in, in a session
  if (activeSessionId) {
    return (
      <ActiveSession
        sessionId={activeSessionId}
        onBack={() => setActiveSessionId(null)}
      />
    );
  }

  // Logged in, session lobby
  return (
    <SessionLobby
      onJoin={(id) => setActiveSessionId(id)}
      onCreate={(id) => setActiveSessionId(id)}
    />
  );
}
