# Reveal — Sprint D: Game Soul Polish + Review

**Dato:** 2026-03-21
**Status:** Spec — klar til implementation efter Sprint C
**Forfatter:** Danny + James

---

## Formål

Sprint D har to opgaver:

1. **Review** — gennemgang og kvalitetssikring af Sprint B+C game modes
2. **Game soul polish** — SprintDraftScreen + RetroScreen får samme levende game feel som resten

---

## D1. Review — Sprint B+C Game Modes

Kør systematisk gennemgang af alle modes bygget i Sprint B og C:
- SpecWarsScreen.jsx
- PerspectivePokerScreen.jsx
- BluffPokerScreen.jsx
- NestingScopeScreen.jsx
- SpeedScopeScreen.jsx

**Tjekliste per mode:**

| Element | Tjek |
|---|---|
| Scene-wrapper (animeret baggrund) | ✓/✗ |
| Pixel art avatarer (Sprite + cls data) | ✓/✗ |
| NPC_TEAM synlige som sprites | ✓/✗ |
| XP-bar med level-badge i header | ✓/✗ |
| DmgNum på key moments | ✓/✗ |
| LootDrops ved XP-gain | ✓/✗ |
| ComboDisplay (hvor relevant) | ✓/✗ |
| Web Audio på alle key moments | ✓/✗ |
| SoundToggle 🔊/🔇 | ✓/✗ |
| screenShake + flash på dramatiske events | ✓/✗ |
| Achievement popup (XPBadgeNotifier) | ✓/✗ |
| Press Start 2P + VT323 fonte | ✓/✗ |
| CSS keyframes kun (ingen biblioteker) | ✓/✗ |
| PM approval pattern (ingen direkte writes) | ✓/✗ |
| Build grøn | ✓/✗ |

Fix alle ✗ der findes.

---

## D2. SprintDraftScreen — Game Soul Upgrade

SprintDraftScreen.jsx (1008 linjer) er "The Draft" — sprint planning med priority tokens og kapacitetsmåler. Den har mystery cards og reveal-animationer men mangler det fulde game-feel.

**Hvad tilføjes:**
- Scene-wrapper med passende baggrundsfarve (gul/gold for "draft day")
- Deltager-avatarer (Sprite) i lobby-steget — hele teamet samlet
- XP-bar + level-badge i header
- SoundToggle
- DmgNum når items draftes ("+1 item drafted!" / capacity warning)
- screenShake + rød flash når kapacitet overskrides
- Grøn flash + confetti når draft er complete og kapacitet er 100%
- Achievement: "Perfect Fill 🎯" (100% kapacitet) — allerede defineret i BADGES, kobl den på
- LootDrops ved draft completion

**Tone:** The Draft er ikke et kampmøde — det er ceremonielt, højtideligt. Lyder skal være mere "fanfare" end "angreb".

---

## D3. RetroScreen — Minimal Game Soul

RetroScreen.jsx (504 linjer) er standard retro board (noter, ikke Boss Battle). Den er PM-tool — game soul skal være subtil, ikke dominerende.

**Hvad tilføjes (lyst touch):**
- XP-bar + level-badge i header (konsistens på tværs)
- SoundToggle
- Lille pixel art avatar ved siden af brugerens noter (viser hvem der wrote hvad)
- Subtil achievement: "Retrospective Veteran 📋" ved 10+ retro-deltagelser
- INGEN Scene-wrapper her — det er PM-tool, ikke game. Baggrunden forbliver normal.
- INGEN screenShake / DmgNum — det ville være forkert i denne kontekst

**Tone:** Rolig og professionel. Game-elementerne er subtile badges og avatar — ikke slagmark.

---

## D4. Unified Sound System Audit

Sprint C bygger `useSound` hook + `SoundToggle`. Sprint D sikrer:
- Alle lyde er konsistente på tværs af modes (samme tonation, ikke kaos)
- Lyd-hierarki dokumenteret: hvad er "impact" lyd vs. "ambient" vs. "achievement"
- Session.jsx's eksisterende lyde er mappet ind i useSound hook (ikke to systemer)
- Test: lyd-toggle virker i ALLE modes inkl. Session.jsx og SprintDraftScreen

---

## D5. Cross-Mode Achievement Audit

Gennemgang af alle achievements på tværs af alle modes:
- Er de korrekt seeded i `achievement_definitions` tabel?
- Er XP-beløbene balancerede (ingen mode giver 10x mere XP end andre)?
- Er achievement-navne konsistente i tone og stil?
- Er der achievements der overlapper / duplikerer?

Lav en master-liste i `docs/working/achievement-master-list.md`

---

## Prioritering

| Leverance | Impact | Effort | Prioritet |
|---|---|---|---|
| D1: Review B+C modes | Høj | Medium | 🔴 P1 |
| D2: SprintDraft game soul | Høj | Medium | 🔴 P1 |
| D4: Sound system audit | Medium | Lav | 🟡 P2 |
| D3: RetroScreen minimal | Medium | Lav | 🟡 P2 |
| D5: Achievement audit | Medium | Medium | 🟡 P2 |

---

## Definition of Done

- Alle 5 game modes (B+C) passerer tjeklisten i D1
- SprintDraftScreen føles levende og ceremonielt
- RetroScreen har konsistent XP/avatar-header
- Ét unified sound system på tværs af alt
- Achievement master-list dokumenteret og DB-seedet
