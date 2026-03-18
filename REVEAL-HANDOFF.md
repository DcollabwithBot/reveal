# REVEAL — Claude Code Handoff Brief

## Hvad er Reveal?
En gamificeret team-estimeringsplatform. Planning Poker, Scope Roulette og Sprint Retrospectives pakket ind i RPG-mekanik med klasser, spells, boss battles, achievements og loot.

## Hvad du får
Fire standalone JSX prototyper der hver demonstrerer én skærm. De virker individuelt som React-komponenter, men deler IKKE state — det er din opgave at koble dem sammen.

### Filerne
1. `reveal-1-avatar.jsx` — Avatar Creator (klasse + equipment system)
2. `reveal-2-worlds.jsx` — World Select / Tavern Hub
3. `reveal-3-overworld.jsx` — Overworld Map
4. `reveal-session.jsx` — Game Session (boss battle)

---

## ARKITEKTUR — Sådan skal de kobles

### App Flow
```
Avatar Creator → World Select → Overworld Map → Game Session → (tilbage til Overworld)
```

### Shared State (løftes op til App-niveau)
```typescript
// Avatar/player data — skabes i Avatar Creator, bruges overalt
interface Avatar {
  cls: Class;           // Valgt klasse (warrior/mage/archer/healer/rogue/berserker/necro)
  skin: string;         // Hex hudfarve
  helmet: Equipment;    // Udstyrsslots
  armor: Equipment;
  boots: Equipment;
  weapon: Equipment;
  amulet: Equipment;
}

interface Class {
  id: string;           // "warrior" | "mage" | "archer" etc.
  name: string;         // "WARRIOR"
  icon: string;         // "⚔️"
  color: string;        // "#f04f78"
  proj: string;         // Projektil-emoji for spell "⚔️"
  trail: string;        // Trail-farve "#f04f78"
  spellName: string;    // "BLADE STORM"
}

interface Equipment {
  id: string;           // "h0" (ingen), "h1" (Iron Helm) etc.
  name: string;
  icon: string;
  color: string;
  pv: string | null;    // Preview-farve for sprite (null = ingen)
  glow?: string | null; // Kun for amulets
}

// Valgt verden — sættes i World Select, bruges i Overworld
interface World {
  id: string;
  name: string;
  sprint: string;
  icon: string;
  color: string;
  prog: number;
  tot: number;
  lv: string;
  boss: string;
  nodes: Node[];
  paths: [number, number][];
  theme: { sky: string; grs: string; drt: string };
}

// Valgt node — sættes i Overworld, bruges i Session
interface Node {
  id: number;
  type: "p" | "r" | "b" | "q" | "c" | "s";  // poker/roulette/boss/quest/checkpoint/start
  label: string;
  icon: string;
  cur?: boolean;
  dn?: boolean;         // done/completed
}
```

### App Router (pseudokode)
```jsx
function App() {
  const [screen, setScreen] = useState("avatar"); // avatar → worlds → map → session
  const [avatar, setAvatar] = useState(null);
  const [world, setWorld] = useState(null);
  const [node, setNode] = useState(null);
  const sound = useSound();

  return (
    <>
      {screen === "avatar" && <AvatarCreator onDone={(av) => { setAvatar(av); setScreen("worlds"); }} sound={sound} />}
      {screen === "worlds" && <WorldSelect avatar={avatar} onSelect={(w) => { setWorld(w); setScreen("map"); }} sound={sound} />}
      {screen === "map" && <Overworld project={world} avatar={avatar} onBack={() => setScreen("worlds")} onNode={(n) => { setNode(n); setScreen("session"); }} sound={sound} />}
      {screen === "session" && <Session avatar={avatar} node={node} project={world} onBack={() => setScreen("map")} onComplete={() => { setNode(null); setScreen("map"); }} sound={sound} />}
    </>
  );
}
```

---

## HVAD SKAL ÆNDRES I HVER FIL

### reveal-1-avatar.jsx (Avatar Creator)
**Nu:** Standalone med `export default function AvatarCreator()` — laver sin egen sound.
**Skal:** Acceptere props `{ onDone, sound }`. Kalde `onDone(avatarObject)` når brugeren klikker "Klar til kamp" — avatarObject skal indeholde alle valg (cls, skin, helmet, armor, boots, weapon, amulet).

### reveal-2-worlds.jsx (World Select / Tavern)
**Nu:** Standalone med hardcoded avatar.
**Skal:** Acceptere props `{ avatar, onSelect, sound }`. Vise avatarens klasse-ikon og equipment i spillerkortet. Kalde `onSelect(world)` når brugeren klikker en verden-portal.

### reveal-3-overworld.jsx (Overworld Map)
**Nu:** Standalone med hardcoded projekt og avatar-farver.
**Skal:** Acceptere props `{ project, avatar, onBack, onNode, sound }`. Tegne spillerens karakter med avatarens farver. Kalde `onNode(node)` når brugeren klikker en node og bekræfter. Kalde `onBack()` for at gå tilbage til World Select.

### reveal-session.jsx (Game Session)
**Nu:** Standalone med hardcoded `TEAM` og `export default function Session()`.
**Skal:** Acceptere props `{ avatar, node, project, onBack, onComplete, sound }`. Oprette team dynamisk fra avatar (spillerens klasse + 4 hardcoded NPCs). Bruge `node.type` til at bestemme om det er poker ("p"), roulette ("r"), eller boss ("b"). Kalde `onComplete()` når sessionen er færdig.

---

## SHARED INFRASTRUCTURE (skal deles mellem alle filer)

### Farve-palette
Alle fire filer bruger samme farvekonstanter — flyt dem til en shared fil:
```js
const C = {
  bg:"#0e1019", bgC:"#171b2d", bgL:"#222842",
  acc:"#f04f78", accD:"#b83058", blu:"#3b7dd8", bluL:"#5fcde4",
  grn:"#38b764", grnD:"#257953", grnL:"#6abe30",
  yel:"#feae34", yelD:"#d77643", pur:"#b55088",
  org:"#d77643", red:"#e04040", wht:"#f4f4f4",
  txt:"#c8c8c8", dim:"#555570", gld:"#feae34", xp:"#5fcde4", brd:"#2a2e48"
};
```

### Sound Engine
Alle filer har en `useSound()` hook — brug sessionens version (den mest komplette) og del den:
```
Lyde: click, select, attack, hit, spell, reveal, countdown, countgo, boom, victory, achieve, loot, powerup, warning, combo, heartbeat, enter, coin, equip, door, npc, dice, chest
```

### Klasse-definitioner
```js
const CLASSES = [
  { id:"warrior", name:"WARRIOR", icon:"⚔️", color:"#f04f78", proj:"⚔️", trail:"#f04f78", spellName:"BLADE STORM" },
  { id:"mage", name:"MAGE", icon:"🧙", color:"#b55088", proj:"🔥", trail:"#ff6030", spellName:"FIREBALL" },
  { id:"archer", name:"ARCHER", icon:"🏹", color:"#feae34", proj:"🏹", trail:"#feae34", spellName:"ARROW RAIN" },
  { id:"healer", name:"HEALER", icon:"🛡️", color:"#5fcde4", proj:"✨", trail:"#5fcde4", spellName:"HOLY LIGHT" },
  { id:"rogue", name:"ROGUE", icon:"🗡️", color:"#38b764", proj:"🗡️", trail:"#38b764", spellName:"SHADOW STRIKE" },
  { id:"berserker", name:"BERSERKER", icon:"🪓", color:"#d77643", proj:"💥", trail:"#d77643", spellName:"GROUND POUND" },
  { id:"necro", name:"NECROMANCER", icon:"💀", color:"#8855aa", proj:"💀", trail:"#8855aa", spellName:"DARK PULSE" },
];
```

### NPC Team (altid de samme 4)
```js
const NPC_TEAM = [
  { id:2, name:"Mia", lv:5, cls:CLASSES[1], hat:"#b55088", body:"#b55088", skin:"#fed" },
  { id:3, name:"Jonas", lv:2, cls:CLASSES[4], hat:"#38b764", body:"#257953", skin:"#edc" },
  { id:4, name:"Sara", lv:4, cls:CLASSES[3], hat:"#5fcde4", body:"#3b7dd8", skin:"#ffe" },
  { id:5, name:"Emil", lv:3, cls:CLASSES[2], hat:"#feae34", body:"#d77643", skin:"#fec" },
];
```

### Equipment Items
Se reveal-1-avatar.jsx for komplette lister af HELMETS, ARMORS, BOOTS, WEAPONS, AMULETS.

### CSS Animations
Mange animations deles — flyt dem til en global stylesheet:
```
fadeIn, slideUp, pop, float, charBounce, pulse, bounce, blink, flashOut,
atkFly, trailFade, atkLunge, spellFlash, screenShake, dmgFloat,
bossIdle, bossRage, bossHit, bossDeath, achieveIn, comboPop, comboPulse,
lootDrop, lootBounce, cardFloat, cardDrop, particle, victoryPulse, revealBurst,
amuPulse, chestOpen, lootFloat, portalPulse, charWalk, barSweep, diceRoll
```

---

## PRIORITET VED SAMMENKOBLING

1. **Fælles infrastruktur** — Flyt farver, klasser, NPC team, equipment, sound engine, animations til shared filer
2. **Props-interface** — Gør hver komponent til en ren funktion der modtager props (se ovenfor)
3. **App Router** — Simpel state machine der skifter mellem screens
4. **Avatar → Session flow** — Sørg for at avatarens klasse, farver og equipment bruges i sessionen (spillerens sprite skal vise det udstyrt armor/helmet/weapon)
5. **Session → Map flow** — Når sessionen er færdig, gå tilbage til kortet og markér noden som completed

---

## DESIGN-PRINCIPPER (behold disse)

- **Pixel art æstetik** — Press Start 2P font, pixel sprites, retro farvepalette
- **Alt lever** — Ingen statiske elementer. Græs vajer, fakler flakker, karakterer puster, partikler svæver
- **Lyd på alt** — Hvert klik, hover, equip, attack har sin lyd via Web Audio API
- **RPG-mekanik** — Klasser med unikke spells, equipment der ændrer udseende, XP/leveling, achievements
- **Boss battle session** — Opgaven er bossen. Estimater er angreb. Damage numbers, HP-bar, screen shake
- **Tavern hub** — World select er en pixel art-tavern med fakler, NPCs og sten-portaler
- **Overworld kort** — SVG-baseret ø med vand, skyer, træer, fugle. Noder er locations på kortet

---

## TEKNISK STACK I PROTOTYPERNE

- React (hooks: useState, useEffect, useCallback, useRef)
- Web Audio API til lyd (ingen eksterne filer)
- SVG til overworld kort
- CSS animations (keyframes inline i `<style>` tags)
- Google Fonts: Press Start 2P + VT323
- Ingen externe dependencies udover React

---

## NOTER

- Alle fire filer er verificeret: brackets balanceret, ingen `return<Tag>` fejl, én export default per fil
- Session-filen (reveal-session.jsx) er den mest komplekse (570 linjer) og bør ændres mindst muligt
- Avatar-filen har det mest omfattende equipment-system — sørg for at equipment-valg bæres videre til session
- World Select bruger en tavern-baggrund med fakler — dette er en bevidst designbeslutning, ikke en fejl
- Overworld har NPC speech bubbles, dice roll system, og node detail popup — behold disse features
