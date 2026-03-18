import { useState, useEffect } from "react";
import { C, PF, BF, CLASSES, HELMETS, ARMORS, BOOTS, WEAPONS, AMULETS, SKINS, NPC_TEAM } from "../shared/constants.js";
import { dk } from "../shared/utils.js";

function Hero({ cls, skin, helm, armor, boots, weapon, amulet, size = 1, anim, atk, idle = true }) {
  const [t, setT] = useState(0);
  useEffect(() => { if (!idle) return; const i = setInterval(() => setT(v => v + 1), 80); return () => clearInterval(i); }, [idle]);
  const s = size, w = Math.round(18 * s), cl = cls || CLASSES[0];
  const br = idle ? Math.sin(t * 0.22) * s * 0.3 : 0, blink = idle && t % 35 < 2, leg = idle ? Math.sin(t * 0.18) * s * 0.3 : 0;
  const hc = helm?.pv || cl.color, bc = armor?.pv || cl.color, btc = boots?.pv || dk(cl.color, 60);
  const wi = weapon?.pv || cl.icon, ag = amulet?.glow;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
      {atk && <div style={{ position: "absolute", top: `${-15 * s}px`, left: "50%", transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none" }}>
        <div style={{ fontSize: `${8 * s}px`, animation: "atkFly 0.7s ease-out forwards", filter: `drop-shadow(0 0 ${4 * s}px ${cl.trail})` }}>{cl.proj}</div>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ position: "absolute", left: "50%", top: `${8 + i * 5}px`, width: `${(4 - i) * s}px`, height: `${(4 - i) * s}px`, background: cl.trail, borderRadius: "50%", opacity: 0.5, animation: `trailFade 0.3s ease-out ${i * 0.04}s forwards` }} />)}
      </div>}
      {ag && <div style={{ position: "absolute", top: "35%", left: "50%", transform: "translate(-50%,-50%)", width: `${w * 2}px`, height: `${w * 2}px`, borderRadius: "50%", background: `radial-gradient(circle,${ag}15,transparent 70%)`, animation: "amuPulse 2s ease-in-out infinite", pointerEvents: "none" }} />}
      <div style={{ position: "relative", width: `${w * 1.5}px`, animation: anim || "none" }}>
        <div style={{ position: "absolute", bottom: `${-2 * s}px`, left: "50%", transform: "translateX(-50%)", width: `${w * 1.4}px`, height: `${3 * s}px`, background: "rgba(0,0,0,0.2)", borderRadius: "50%" }} />
        <div style={{ width: `${w}px`, margin: "0 auto" }}>
          {helm?.pv
            ? <><div style={{ width: `${w * 1.2}px`, height: `${5 * s}px`, background: hc, margin: "0 auto", borderRadius: `${2 * s}px ${2 * s}px 0 0`, boxShadow: `0 0 ${3 * s}px ${hc}44` }} /><div style={{ width: `${w}px`, height: `${3 * s}px`, background: dk(hc), margin: "-1px auto 0" }} /></>
            : <><div style={{ width: `${w * 1.1}px`, height: `${4 * s}px`, background: hc, margin: "0 auto" }} /><div style={{ width: `${w * 0.9}px`, height: `${3 * s}px`, background: dk(hc), margin: "-1px auto 0" }} /></>}
          <div style={{ width: `${w * 0.8}px`, height: `${(8 + br * 0.12) * s}px`, background: skin || "#fdd", margin: "0 auto", position: "relative" }}>
            {!blink && <><div style={{ position: "absolute", top: `${3 * s}px`, left: `${2 * s}px`, width: `${2 * s}px`, height: `${2 * s}px`, background: C.bg }} /><div style={{ position: "absolute", top: `${3 * s}px`, right: `${2 * s}px`, width: `${2 * s}px`, height: `${2 * s}px`, background: C.bg }} /></>}
            {blink && <div style={{ position: "absolute", top: `${4 * s}px`, left: `${1.5 * s}px`, right: `${1.5 * s}px`, height: `${s}px`, background: C.bg }} />}
            {amulet?.glow && <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", fontSize: `${2.5 * s}px` }}>{amulet.icon}</div>}
          </div>
          <div style={{ width: `${w}px`, height: `${(11 + br * 0.15) * s}px`, background: bc, margin: "0 auto", position: "relative", boxShadow: armor?.pv ? `inset 0 0 ${3 * s}px ${dk(bc, -20)}33` : "none" }}>
            {armor?.pv && <div style={{ position: "absolute", top: `${2 * s}px`, left: "50%", transform: "translateX(-50%)", width: `${w * 0.4}px`, height: `${4 * s}px`, background: dk(bc, -20), opacity: 0.35 }} />}
            <div style={{ position: "absolute", right: `${-5 * s}px`, top: `${1 * s}px`, fontSize: `${5 * s}px`, transform: `rotate(${-25 + (idle ? Math.sin(t * 0.1) * 6 : 0)}deg)`, opacity: 0.85, filter: weapon?.pv ? `drop-shadow(0 0 ${2 * s}px ${weapon.color}44)` : "none" }}>{typeof wi === "string" && wi.length > 2 ? wi : cl.icon}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: `${2 * s}px` }}>
            <div style={{ width: `${5 * s}px`, height: `${(5 + leg) * s}px`, background: btc, boxShadow: boots?.pv ? `0 ${s}px ${2 * s}px ${btc}44` : "none" }} />
            <div style={{ width: `${5 * s}px`, height: `${(5 - leg) * s}px`, background: btc, boxShadow: boots?.pv ? `0 ${s}px ${2 * s}px ${btc}44` : "none" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniNpc({ m, size = 1 }) {
  const [t, setT] = useState(Math.floor(Math.random() * 100));
  useEffect(() => { const i = setInterval(() => setT(v => v + 1), 90); return () => clearInterval(i); }, []);
  const s = size, w = Math.round(12 * s), cl = m.cls || CLASSES[0], blink = t % 30 < 2;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: `${w}px`, margin: "0 auto" }}>
        <div style={{ textAlign: "center", fontSize: `${3 * s}px`, opacity: 0.5 }}>{cl.icon}</div>
        <div style={{ width: `${w}px`, height: `${3 * s}px`, background: m.hat || cl.color, margin: "0 auto" }} />
        <div style={{ width: `${w * 0.75}px`, height: `${5 * s}px`, background: m.skin || "#fdd", margin: "0 auto", position: "relative" }}>
          {!blink && <><div style={{ position: "absolute", top: `${2 * s}px`, left: `${1 * s}px`, width: `${1.5 * s}px`, height: `${1.5 * s}px`, background: C.bg }} /><div style={{ position: "absolute", top: `${2 * s}px`, right: `${1 * s}px`, width: `${1.5 * s}px`, height: `${1.5 * s}px`, background: C.bg }} /></>}
        </div>
        <div style={{ width: `${w * 0.85}px`, height: `${6 * s}px`, background: m.body || m.hat, margin: "0 auto" }} />
        <div style={{ display: "flex", justifyContent: "center", gap: `${1 * s}px` }}>
          <div style={{ width: `${3 * s}px`, height: `${3 * s}px`, background: dk(m.body || m.hat, 60) }} />
          <div style={{ width: `${3 * s}px`, height: `${3 * s}px`, background: dk(m.body || m.hat, 60) }} />
        </div>
      </div>
      <div style={{ fontFamily: PF, fontSize: `${Math.max(3, 2 * s)}px`, color: C.txt, marginTop: `${1 * s}px`, background: C.bg + "aa", padding: "0 2px" }}>{m.name}</div>
    </div>
  );
}

function Btn({ children, onClick, color = C.acc, large, style: s }) {
  const [p, setP] = useState(false);
  return (
    <button onClick={onClick} onMouseDown={() => setP(true)} onMouseUp={() => setP(false)} onMouseLeave={() => setP(false)}
      style={{ fontFamily: PF, fontSize: large ? "10px" : "7px", color: C.wht, background: color, border: `3px solid ${color}`, borderBottom: p ? `3px solid ${color}` : `5px solid ${C.bg}`, borderRight: p ? `3px solid ${color}` : `5px solid ${C.bg}`, padding: large ? "12px 20px" : "8px 14px", cursor: "pointer", transform: p ? "translate(2px,2px)" : "none", transition: "transform 0.05s", letterSpacing: "1px", display: "inline-flex", alignItems: "center", gap: "8px", ...s }}>
      {children}
    </button>
  );
}

function Slot({ item, slot, active, onClick }) {
  const empty = !item || item.id.endsWith("0");
  return (
    <div onClick={onClick} style={{ width: "40px", height: "40px", background: active ? `${item?.color || C.dim}22` : C.bgL, border: `3px solid ${active ? item?.color || C.acc : C.brd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", cursor: "pointer", boxShadow: active ? `0 0 8px ${item?.color || C.acc}44` : "none", transform: active ? "scale(1.1)" : "scale(1)", transition: "all 0.15s", position: "relative" }}>
      {empty ? "·" : item.icon}
      <div style={{ position: "absolute", bottom: "-9px", fontFamily: PF, fontSize: "3px", color: active ? item?.color || C.acc : C.dim, whiteSpace: "nowrap" }}>{slot}</div>
    </div>
  );
}

function Scene({ children }) {
  const [t, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT(v => v + 1), 50); return () => clearInterval(i); }, []);
  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "44%", background: `linear-gradient(${180 + Math.sin(t * 0.003) * 2}deg,${C.skyL},${C.sky})` }} />
      <div style={{ position: "absolute", top: `${7 + Math.sin(t * 0.005) * 2}%`, right: "10%", width: "32px", height: "32px", borderRadius: "50%", background: "#ffe477", boxShadow: `0 0 ${20 + Math.sin(t * 0.02) * 8}px #ffe47744` }} />
      {[{ l: 5, tp: 8, w: 85 }, { l: 38, tp: 4, w: 60 }, { l: 68, tp: 12, w: 75 }, { l: 90, tp: 6, w: 50 }].map((c, i) =>
        <div key={i} style={{ position: "absolute", left: `${(c.l + t * 0.015) % 115}%`, top: `${c.tp}%`, opacity: 0.4 }}><div style={{ width: `${c.w}px`, height: `${c.w * 0.3}px`, background: "#fff" }} /></div>)}
      {[{ x: 15, y: 10 }, { x: 60, y: 7 }].map((bd, i) =>
        <div key={`b${i}`} style={{ position: "absolute", left: `${(bd.x + t * 0.04) % 110}%`, top: `${bd.y + Math.sin(t * 0.06 + i * 3) * 1.5}%`, fontSize: "8px" }}>🐦</div>)}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "58%", background: `linear-gradient(180deg,${C.grs},${C.grsD})` }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "8%", background: `linear-gradient(180deg,${C.drt},${C.drtD})` }} />
      {Array.from({ length: 20 }).map((_, i) =>
        <div key={`g${i}`} style={{ position: "absolute", bottom: `${44 + Math.sin(i * 1.1) * 4}%`, left: `${1 + i * 5}%`, width: "3px", height: `${5 + Math.sin(t * 0.05 + i * 0.7) * 2}px`, background: C.grsL, opacity: 0.3, transform: `rotate(${Math.sin(t * 0.04 + i) * 10}deg)`, transformOrigin: "bottom" }} />)}
      {[{ l: "3%", b: "48%" }, { l: "95%", b: "46%" }].map((tr, i) =>
        <div key={`t${i}`} style={{ position: "absolute", left: tr.l, bottom: tr.b, transform: `rotate(${Math.sin(t * 0.015 + i * 2) * 1.5}deg)`, transformOrigin: "bottom" }}>
          <div style={{ width: "6px", height: "14px", background: C.drtD, margin: "0 auto" }} />
          <div style={{ width: "20px", height: "16px", background: C.grsD, marginTop: "-3px", marginLeft: "-7px" }} />
        </div>)}
      {Array.from({ length: 6 }).map((_, i) =>
        <div key={`p${i}`} style={{ position: "absolute", left: `${(i * 16 + t * 0.02 * (i % 3 + 1)) % 105}%`, top: `${18 + Math.sin(t * 0.015 + i * 1.5) * 25}%`, width: "3px", height: "3px", borderRadius: "50%", background: [C.gld, C.acc, C.xp][i % 3], opacity: 0.1 }} />)}
      {[{ x: 30, y: 35 }, { x: 70, y: 28 }].map((bf, i) =>
        <div key={`bf${i}`} style={{ position: "absolute", left: `${bf.x + Math.sin(t * 0.02 + i * 5) * 8}%`, top: `${bf.y + Math.cos(t * 0.025 + i * 3) * 5}%`, fontSize: "9px" }}>🦋</div>)}
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}

export default function AvatarCreator({ onDone, sound }) {
  const [cls, setCls] = useState(CLASSES[0]);
  const [skin, setSkin] = useState("#fdd");
  const [helm, setHelm] = useState(HELMETS[0]);
  const [armor, setArmor] = useState(ARMORS[0]);
  const [boots, setBoots] = useState(BOOTS[0]);
  const [weapon, setWeapon] = useState(WEAPONS[0]);
  const [amulet, setAmulet] = useState(AMULETS[0]);
  const [show, setShow] = useState(false);
  const [atk, setAtk] = useState(false);
  const [slot, setSlot] = useState("class");
  const [flash, setFlash] = useState(null);
  const [spTxt, setSpTxt] = useState(null);

  useEffect(() => { setTimeout(() => setShow(true), 300); }, []);
  useEffect(() => {
    setAtk(true); sound("spell"); setSpTxt(cls.spellName);
    const t = setTimeout(() => { setSpTxt(null); setAtk(false); }, 700);
    return () => clearTimeout(t);
  }, [cls]);

  function eq(setter, item) { setter(item); sound("equip"); setFlash(item.color); setTimeout(() => setFlash(null), 200); }

  const pw = (helm?.id !== "h0" ? 5 : 0) + (armor?.id !== "a0" ? 8 : 0) + (boots?.id !== "b0" ? 3 : 0) + (weapon?.id !== "w0" ? 10 : 0) + (amulet?.id !== "m0" ? 6 : 0);
  const labels = { class: "KLASSE", helmet: "HJELM", armor: "RUSTNING", boots: "STØVLER", weapon: "VÅBEN", amulet: "AMULET", skin: "HUD" };

  function handleDone() {
    sound("victory");
    onDone({ cls, skin, helmet: helm, armor, boots, weapon, amulet });
  }

  return (
    <Scene>
      {flash && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: flash, opacity: 0.15, pointerEvents: "none", zIndex: 200, animation: "flashOut 0.2s ease-out forwards" }} />}
      {spTxt && <div style={{ position: "fixed", top: "28%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 100, pointerEvents: "none", animation: "spellFlash 0.7s ease-out forwards" }}>
        <div style={{ fontFamily: PF, fontSize: "13px", color: C.wht, textShadow: `0 0 20px ${cls.trail}, 0 0 40px ${cls.trail}88`, letterSpacing: "3px" }}>{spTxt}!</div>
      </div>}
      <div style={{ padding: "10px", maxWidth: "680px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "6px", animation: "slideUp 0.4s" }}>
          <h1 style={{ fontFamily: PF, fontSize: "14px", color: C.wht, textShadow: `3px 3px 0 ${C.accD}, 0 0 15px ${C.acc}66`, letterSpacing: "3px", margin: 0 }}>SKAB DIN HELT</h1>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          {/* LEFT */}
          <div style={{ flex: "0 0 210px", textAlign: "center" }}>
            <div style={{ marginBottom: "6px", opacity: show ? 1 : 0, animation: show ? "pop 0.5s" : "none", minHeight: "150px", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <Hero cls={cls} skin={skin} helm={helm} armor={armor} boots={boots} weapon={weapon} amulet={amulet} size={3.8} anim={atk ? "atkLunge 0.4s ease-out" : "charBounce 1.5s ease-in-out infinite"} atk={atk} />
            </div>
            <div style={{ fontFamily: PF, fontSize: "6px", color: cls.color, textShadow: `0 0 6px ${cls.trail}66` }}>{cls.icon} {cls.name}</div>
            <div style={{ fontFamily: PF, fontSize: "5px", color: C.gld, marginTop: "2px" }}>⚡ POWER: {pw}</div>
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
              <div style={{ display: "flex", gap: "3px" }}>
                <Slot item={helm} slot="HJELM" active={slot === "helmet"} onClick={() => { setSlot("helmet"); sound("click"); }} />
                <Slot item={amulet} slot="AMULET" active={slot === "amulet"} onClick={() => { setSlot("amulet"); sound("click"); }} />
              </div>
              <div style={{ display: "flex", gap: "3px" }}>
                <Slot item={weapon} slot="VÅBEN" active={slot === "weapon"} onClick={() => { setSlot("weapon"); sound("click"); }} />
                <Slot item={armor} slot="RUSTNING" active={slot === "armor"} onClick={() => { setSlot("armor"); sound("click"); }} />
                <Slot item={boots} slot="STØVLER" active={slot === "boots"} onClick={() => { setSlot("boots"); sound("click"); }} />
              </div>
            </div>
            <div style={{ marginTop: "10px", display: "flex", gap: "4px", justifyContent: "center" }}>
              {NPC_TEAM.map((m, i) => (
                <div key={m.name} style={{ opacity: 0.5, animation: `slideUp 0.3s ${0.3 + i * 0.1}s both` }}>
                  <MiniNpc m={m} size={1.2} />
                </div>
              ))}
            </div>
          </div>
          {/* RIGHT */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: "2px", marginBottom: "6px", flexWrap: "wrap" }}>
              {["class", "helmet", "armor", "boots", "weapon", "amulet", "skin"].map(s => (
                <div key={s} onClick={() => { setSlot(s); sound("click"); }} style={{ fontFamily: PF, fontSize: "3.5px", color: slot === s ? C.gld : C.dim, padding: "3px 6px", background: slot === s ? C.bgL : C.bg + "88", border: `2px solid ${slot === s ? C.gld : C.brd}`, cursor: "pointer" }}>
                  {labels[s]}
                </div>
              ))}
            </div>
            <div style={{ background: C.bgC + "e8", border: `3px solid ${C.brd}`, boxShadow: `3px 3px 0 ${C.bg}`, padding: "8px", minHeight: "180px" }}>
              <div style={{ fontFamily: PF, fontSize: "4px", color: C.gld, letterSpacing: "2px", marginBottom: "6px" }}>◈ {labels[slot]} ◈</div>
              {slot === "class" && <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                {CLASSES.map((c, ci) => (
                  <div key={c.id} onClick={() => { setCls(c); sound("select"); }} style={{ padding: "4px 6px", background: cls.id === c.id ? c.color + "33" : C.bgL, border: `3px solid ${cls.id === c.id ? c.color : C.brd}`, cursor: "pointer", boxShadow: cls.id === c.id ? `0 0 8px ${c.color}66` : "none", transform: cls.id === c.id ? "scale(1.05)" : "scale(1)", transition: "all 0.15s", display: "flex", alignItems: "center", gap: "3px", animation: `slideUp 0.2s ${ci * 0.03}s both` }}>
                    <span style={{ fontSize: "11px" }}>{c.icon}</span>
                    <div><div style={{ fontFamily: PF, fontSize: "3.5px", color: cls.id === c.id ? c.color : C.txt }}>{c.name}</div><div style={{ fontFamily: PF, fontSize: "2.5px", color: C.dim }}>{c.spellName}</div></div>
                  </div>
                ))}
              </div>}
              {slot === "skin" && <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                {SKINS.map((c, i) => (<div key={i} onClick={() => { setSkin(c); sound("click"); }} style={{ width: "24px", height: "24px", background: c, border: `3px solid ${skin === c ? C.wht : C.brd}`, cursor: "pointer", boxShadow: skin === c ? `0 0 6px ${c}88` : "none", transform: skin === c ? "scale(1.2)" : "scale(1)", transition: "all 0.15s" }} />))}
              </div>}
              {slot === "helmet" && <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                {HELMETS.map((h, i) => (<div key={h.id} onClick={() => eq(setHelm, h)} style={{ padding: "4px 6px", background: helm.id === h.id ? h.color + "22" : C.bgL, border: `3px solid ${helm.id === h.id ? h.color : C.brd}`, cursor: "pointer", boxShadow: helm.id === h.id ? `0 0 6px ${h.color}44` : "none", display: "flex", alignItems: "center", gap: "3px", animation: `slideUp 0.2s ${i * 0.03}s both` }}><span style={{ fontSize: "13px" }}>{h.icon}</span><span style={{ fontFamily: PF, fontSize: "3.5px", color: helm.id === h.id ? h.color : C.txt }}>{h.name}</span></div>))}
              </div>}
              {slot === "armor" && <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                {ARMORS.map((a, i) => (<div key={a.id} onClick={() => eq(setArmor, a)} style={{ padding: "4px 6px", background: armor.id === a.id ? a.color + "22" : C.bgL, border: `3px solid ${armor.id === a.id ? a.color : C.brd}`, cursor: "pointer", boxShadow: armor.id === a.id ? `0 0 6px ${a.color}44` : "none", display: "flex", alignItems: "center", gap: "3px", animation: `slideUp 0.2s ${i * 0.03}s both` }}><span style={{ fontSize: "13px" }}>{a.icon}</span><span style={{ fontFamily: PF, fontSize: "3.5px", color: armor.id === a.id ? a.color : C.txt }}>{a.name}</span></div>))}
              </div>}
              {slot === "boots" && <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                {BOOTS.map((bo, i) => (<div key={bo.id} onClick={() => eq(setBoots, bo)} style={{ padding: "4px 6px", background: boots.id === bo.id ? bo.color + "22" : C.bgL, border: `3px solid ${boots.id === bo.id ? bo.color : C.brd}`, cursor: "pointer", boxShadow: boots.id === bo.id ? `0 0 6px ${bo.color}44` : "none", display: "flex", alignItems: "center", gap: "3px", animation: `slideUp 0.2s ${i * 0.03}s both` }}><span style={{ fontSize: "13px" }}>{bo.icon}</span><span style={{ fontFamily: PF, fontSize: "3.5px", color: boots.id === bo.id ? bo.color : C.txt }}>{bo.name}</span></div>))}
              </div>}
              {slot === "weapon" && <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                {WEAPONS.map((w, i) => (<div key={w.id} onClick={() => eq(setWeapon, w)} style={{ padding: "4px 6px", background: weapon.id === w.id ? w.color + "22" : C.bgL, border: `3px solid ${weapon.id === w.id ? w.color : C.brd}`, cursor: "pointer", boxShadow: weapon.id === w.id ? `0 0 6px ${w.color}44` : "none", display: "flex", alignItems: "center", gap: "3px", animation: `slideUp 0.2s ${i * 0.03}s both` }}><span style={{ fontSize: "13px" }}>{w.icon}</span><span style={{ fontFamily: PF, fontSize: "3.5px", color: weapon.id === w.id ? w.color : C.txt }}>{w.name}</span></div>))}
              </div>}
              {slot === "amulet" && <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                {AMULETS.map((am, i) => (<div key={am.id} onClick={() => eq(setAmulet, am)} style={{ padding: "4px 6px", background: amulet.id === am.id ? am.color + "22" : C.bgL, border: `3px solid ${amulet.id === am.id ? am.color : C.brd}`, cursor: "pointer", boxShadow: amulet.id === am.id ? `0 0 6px ${am.color}44` : "none", display: "flex", alignItems: "center", gap: "3px", animation: `slideUp 0.2s ${i * 0.03}s both` }}><span style={{ fontSize: "13px" }}>{am.icon}</span><span style={{ fontFamily: PF, fontSize: "3.5px", color: amulet.id === am.id ? am.color : C.txt }}>{am.name}</span></div>))}
              </div>}
            </div>
            <div style={{ marginTop: "10px", textAlign: "center" }}>
              <Btn large color={C.grn} onClick={handleDone} style={{ fontSize: "9px", animation: "pulse 2s ease-in-out infinite" }}>⚔️ KLAR TIL KAMP!</Btn>
            </div>
          </div>
        </div>
      </div>
    </Scene>
  );
}
