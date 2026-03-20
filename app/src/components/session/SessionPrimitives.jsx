import { useEffect, useState } from 'react';
import { C, PF, CLASSES } from '../../shared/constants.js';
import { dk } from '../../shared/utils.js';

export function Scene({ children, mc = C.acc }) {
  const [t, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT((v) => v + 1), 50); return () => clearInterval(i); }, []);
  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', background: `linear-gradient(${180 + Math.sin(t * 0.003) * 2}deg,${C.skyL},${C.sky})` }} />
      <div style={{ position: 'absolute', top: `${7 + Math.sin(t * 0.005) * 2}%`, right: '10%', width: '36px', height: '36px', borderRadius: '50%', background: '#ffe477', boxShadow: `0 0 ${25 + Math.sin(t * 0.02) * 10}px #ffe47744, 0 0 ${50 + Math.sin(t * 0.02) * 20}px #ffe47722` }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%', background: `linear-gradient(180deg,${C.grs},${C.grsD})` }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '8%', background: `linear-gradient(180deg,${C.drt},${C.drtD})` }} />
      <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '50%', height: '30%', background: `radial-gradient(ellipse,${mc}${(10 + Math.round(Math.sin(t * 0.02) * 5)).toString(16).padStart(2, '0')} 0%,transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  );
}

export function Sprite({ m, size = 1, anim, attacking, hit, idle = true }) {
  const [t, setT] = useState(0);
  useEffect(() => { if (!idle) return; const i = setInterval(() => setT((v) => v + 1), 80); return () => clearInterval(i); }, [idle]);
  const s = size, w = Math.round(16 * s), cl = m.cls || CLASSES[0];
  const br = idle ? Math.sin(t * 0.25) * s * 0.4 : 0, blink = idle && t % 35 < 2;
  const look = idle ? Math.sin(t * 0.08) > 0.7 ? 'r' : Math.sin(t * 0.08) < -0.7 ? 'l' : 'c' : 'c';
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      {attacking && <div style={{ position: 'absolute', top: `${-15 * s}px`, left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none' }}><div style={{ fontSize: `${8 * s}px`, animation: 'spellFly 0.7s ease-out forwards', filter: `drop-shadow(0 0 ${4 * s}px ${cl.trail})` }}>{cl.proj}</div></div>}
      {hit && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: C.red, opacity: 0.4, animation: 'flashOut 0.2s ease-out forwards', zIndex: 5 }} />}
      <div style={{ position: 'relative', width: `${w * 1.4}px`, animation: anim || 'none' }}>
        <div style={{ position: 'absolute', bottom: `${-2 * s}px`, left: '50%', transform: 'translateX(-50%)', width: `${w * 1.4}px`, height: `${3 * s}px`, background: 'rgba(0,0,0,0.2)', borderRadius: '50%' }} />
        <div style={{ width: `${w}px`, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', fontSize: `${4 * s}px`, marginBottom: `${-0.5 * s}px`, opacity: 0.6, animation: idle ? 'float 2s ease-in-out infinite' : 'none' }}>{cl.icon}</div>
          <div style={{ width: `${w * 1.1}px`, height: `${4 * s}px`, background: m.hat || cl.color, margin: '0 auto' }} />
          <div style={{ width: `${w * 0.9}px`, height: `${3 * s}px`, background: dk(m.hat || cl.color), margin: '-1px auto 0' }} />
          <div style={{ width: `${w * 0.8}px`, height: `${(8 + br * 0.15) * s}px`, background: m.skin || '#fdd', margin: '0 auto', position: 'relative', transition: 'height 0.2s' }}>
            {!blink && <><div style={{ position: 'absolute', top: `${3 * s}px`, left: `${(look === 'l' ? 1 : look === 'r' ? 3 : 2) * s}px`, width: `${2 * s}px`, height: `${2 * s}px`, background: C.bg, transition: 'left 0.2s' }} /><div style={{ position: 'absolute', top: `${3 * s}px`, right: `${(look === 'r' ? 1 : look === 'l' ? 3 : 2) * s}px`, width: `${2 * s}px`, height: `${2 * s}px`, background: C.bg, transition: 'right 0.2s' }} /></>}
          </div>
          <div style={{ width: `${w}px`, height: `${(10 + br * 0.2) * s}px`, background: m.body || m.hat || cl.color, margin: '0 auto', position: 'relative', transition: 'height 0.2s' }} />
        </div>
      </div>
      <div style={{ fontFamily: PF, fontSize: `${Math.max(5, 2.8 * s)}px`, color: C.wht, marginTop: `${2 * s}px`, textShadow: `0 0 3px ${C.bg}`, background: C.bg + 'cc', padding: '1px 4px' }}>{m.name}</div>
      <div style={{ fontFamily: PF, fontSize: `${Math.max(4, 2 * s)}px`, color: C.gld, background: C.bg + '88', padding: '0 3px' }}>{cl.icon} LV{m.lv || 3}</div>
      {m.isP && <div style={{ fontFamily: PF, fontSize: `${Math.max(3, 1.8 * s)}px`, color: C.acc, marginTop: '1px', animation: 'pulse 1.5s infinite' }}>▼ DIG</div>}
    </div>
  );
}

export function Boss({ hp, maxHp, name, hit, defeated }) {
  const showHp = hp != null && maxHp != null;
  const pct = showHp ? Math.max(0, (hp / maxHp) * 100) : 100;
  const hpColor = pct > 60 ? C.grn : pct > 30 ? C.yel : C.red;
  return (
    <div style={{ textAlign: 'center', animation: hit ? 'bossHit 0.3s' : 'none' }}>
      <div style={{ fontFamily: PF, fontSize: '8px', color: C.acc, letterSpacing: '2px', marginBottom: '4px', textShadow: `0 0 8px ${C.acc}44` }}>{name}</div>
      {showHp && (
        <div style={{ width: '220px', margin: '0 auto', position: 'relative' }}>
          <div style={{ height: '14px', background: C.bg, border: `3px solid ${C.brd}`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${hpColor},${dk(hpColor, -30)})`, transition: 'width 0.5s ease-out', boxShadow: `0 0 8px ${hpColor}44` }} />
          </div>
          <div style={{ fontFamily: PF, fontSize: '6px', color: hpColor, marginTop: '2px' }}>{Math.round(hp)}/{maxHp} HP</div>
        </div>
      )}
      <div style={{ fontSize: defeated ? '40px' : '50px', marginTop: '8px', filter: hit ? 'brightness(2)' : 'none', transition: 'all 0.2s', animation: defeated ? 'bossDeath 1s ease-out forwards' : pct < 30 ? 'bossRage 0.5s ease-in-out infinite' : 'bossIdle 2s ease-in-out infinite' }}>👾</div>
    </div>
  );
}

export function DmgNum({ value, color = C.acc, x = 50, critical }) {
  return <div style={{ position: 'absolute', left: `${x}%`, top: '30%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 20, animation: 'dmgFloat 1s ease-out forwards' }}><div style={{ fontFamily: PF, fontSize: critical ? '18px' : '13px', color, textShadow: `0 0 8px ${color}, 2px 2px 0 ${C.bg}`, fontWeight: 'bold' }}>{critical && '💥 '}{value}{critical && ' !'}</div></div>;
}

export function AchievePopup({ achieve, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return <div style={{ position: 'fixed', top: '12%', left: '50%', transform: 'translateX(-50%)', zIndex: 120, animation: 'achieveIn 0.5s ease-out' }}><div style={{ background: `linear-gradient(135deg,${C.bgC},${C.bgL})`, border: `3px solid ${C.gld}`, boxShadow: `0 0 25px ${C.gld}44, 0 0 50px ${C.gld}22`, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ fontSize: '28px', animation: 'pop 0.4s' }}>{achieve.icon}</span><div><div style={{ fontFamily: PF, fontSize: '7px', color: C.gld, letterSpacing: '2px' }}>ACHIEVEMENT!</div><div style={{ fontFamily: PF, fontSize: '9px', color: C.wht, marginTop: '2px' }}>{achieve.name}</div><div style={{ fontFamily: 'Bitcount Grid Single, monospace', fontSize: '14px', color: C.dim }}>{achieve.desc}</div></div></div></div>;
}

export function ComboDisplay({ count }) {
  if (count < 2) return null;
  return <div style={{ position: 'fixed', top: '20%', right: '8%', zIndex: 100, animation: 'comboPop 0.4s ease-out' }}><div style={{ fontFamily: PF, fontSize: '14px', color: C.gld, textShadow: `0 0 15px ${C.gld}`, letterSpacing: '2px', animation: 'comboPulse 0.8s ease-in-out infinite' }}>{count}x</div><div style={{ fontFamily: PF, fontSize: '7px', color: C.org, textAlign: 'center' }}>COMBO!</div></div>;
}

export function LootDrops({ items, active }) {
  if (!active || !items.length) return null;
  return <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', margin: '10px 0' }}>{items.map((item, i) => <div key={i} style={{ animation: `lootDrop 0.5s ease-out ${i * 0.15}s both` }}><div style={{ width: '48px', height: '48px', background: `linear-gradient(135deg,${C.bgL},${C.bgC})`, border: `3px solid ${item.color || C.gld}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: `0 0 10px ${(item.color || C.gld)}44`, animation: `lootBounce 0.6s ease-out ${0.5 + i * 0.15}s both` }}>{item.icon}</div><div style={{ fontFamily: PF, fontSize: '5px', color: item.color || C.gld, textAlign: 'center', marginTop: '3px' }}>{item.label}</div></div>)}</div>;
}

export function FlipCard({ value, member, revealed, delay = 0, mc = C.acc }) {
  return <div style={{ perspective: '400px', width: '44px', height: '62px' }}><div style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', transition: `transform 0.6s ease ${delay}s`, transform: revealed ? 'rotateY(180deg)' : 'rotateY(0)' }}><div style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', background: `repeating-linear-gradient(45deg,${mc}22,${mc}22 3px,${C.bgC} 3px,${C.bgC} 6px)`, border: `3px solid ${mc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 6px ${mc}33` }}><span style={{ fontFamily: PF, fontSize: '11px', color: mc, animation: 'pulse 1s infinite' }}>?</span></div><div style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: `linear-gradient(145deg,${C.bgL},${C.bgC})`, border: `3px solid ${member?.hat || C.acc}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 3px 10px ${(member?.hat || C.acc)}44` }}><span style={{ fontFamily: PF, fontSize: '12px', color: member?.hat || C.txt }}>{value}</span><span style={{ fontFamily: PF, fontSize: '3px', color: C.dim }}>PTS</span></div></div></div>;
}

export function Btn({ children, onClick, color = C.acc, disabled, large, style: s }) {
  const [p, setP] = useState(false);
  return <button onClick={onClick} disabled={disabled} onMouseDown={() => setP(true)} onMouseUp={() => setP(false)} onMouseLeave={() => setP(false)} style={{ fontFamily: PF, fontSize: large ? '10px' : '8px', color: C.wht, background: disabled ? C.dim : color, border: `3px solid ${disabled ? C.dim : color}`, borderBottom: p ? `3px solid ${color}` : `5px solid ${C.bg}`, borderRight: p ? `3px solid ${color}` : `5px solid ${C.bg}`, padding: large ? '12px 20px' : '8px 14px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transform: p ? 'translate(2px,2px)' : 'none', transition: 'transform 0.05s', letterSpacing: '1px', display: 'inline-flex', alignItems: 'center', gap: '8px', ...s }}>{children}</button>;
}

export function Box({ children, color = C.brd, glow, style: s }) {
  return <div style={{ border: `3px solid ${color}`, boxShadow: glow ? `0 0 12px ${glow}` : `3px 3px 0 ${C.bg}`, background: C.bgC + 'e8', ...s }}>{children}</div>;
}
