import { useState } from "react";
import { useSound } from "./shared/useSound.js";
import AvatarCreator from "./screens/AvatarCreator.jsx";
import WorldSelect from "./screens/WorldSelect.jsx";
import Overworld from "./screens/Overworld.jsx";
import Session from "./screens/Session.jsx";
import "./shared/animations.css";

export default function App() {
  const [screen, setScreen] = useState("avatar"); // avatar → worlds → map → session
  const [avatar, setAvatar] = useState(null);
  const [world, setWorld] = useState(null);
  const [node, setNode] = useState(null);
  const sound = useSound();

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
