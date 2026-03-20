# 🎯 Sprint Planning Game Mode — "The Draft"

> Game design dokument for Reveal's fjerde game-mode.
> Status: DESIGN — ikke implementeret.
> Dato: 2026-03-20

---

## TL;DR

Sprint Planning bliver et **draft-spil** med budgetmekanik. Teamet har et "velocity budget" (baseret på forrige sprints velocity) og skal "købe" backlog items ind i sprintet. Ikke-estimerede items er **mystery cards** — de skal quick-estimeres før de kan draftes. Sessionen slutter med en PM-godkendelse inden sprintet låses.

Navn: **Sprint Draft**

---

## 1. Game-mekanik: Budget Draft

### Kernekoncept

Tænk fantasy football draft møder auktion:

1. **Budgettet** er teamets velocity (story points/timer fra forrige sprint). Det er "pengene" teamet har at gøre godt med.
2. **Backlog items** er "spillere" der skal draftes ind.
3. **Hvert item koster sin estimate** (story points). Teamet kan ikke købe for mere end budgettet.
4. **Win-condition:** Fyld sprintet til ≥80% kapacitet med items teamet er enige om. Under 80% = "Underpacked Sprint" (svag). Over 100% = umuligt (hard cap).

### Hvorfor IKKE auktion?

Auktion kræver konkurrerende bud. I sprint planning arbejder teamet SAMMEN — de konkurrerer ikke. En draft med fælles budget er mere naturlig: teamet bestemmer kollektivt hvad der "købes."

### Boss-mekanik: Sprint Capacity Monster

Sprint capacity er et **Capacity Gauge** (progress bar / boss HP-bar, bare inverteret):

- Starter tom (0%)
- Hvert drafted item fylder gaugen
- 80-100% = **green zone** (sprint er sundt)
- 60-80% = **yellow zone** (underpacked — er I sikre?)
- >100% = **red zone / overflow** (kan ikke tilføjes, item bouncer)

Det er ikke en boss der slås ihjel. Det er et mål der fyldes. Visuelt bruger vi en "tank" / shield / container-metafor.

---

## 2. Ikke-estimerede items: Mystery Cards

### Problemet

Sprint planning kræver at man kender størrelsen på items. Men mange backlog items er uestimererede.

### Løsning: Tre-lagsmekanik

**Lag 1: Pre-Draft Estimation (valgfri)**
- Før draft-fasen kan GM vælge "Estimate First" — starter en rapid-fire Planning Poker mini-session for unestimererede items.
- Bruger eksisterende estimation session_type, men med en speed-modus: 30 sek timer per item, færre diskussionsrunder.
- Allerede estimerede items skippes.
- Dette er EN SEPARAT SESSION (type = `estimation`) der startes fra Sprint Draft setup, men bruger eksisterende Planning Poker flow.

**Lag 2: Mystery Cards (in-draft)**
- Unestimererede items vises som **mystery cards** (bagside op, "?" i stedet for point-cost).
- Et mystery card KAN draftes — men teamet skal først flippe det ved at lave en **Quick Estimate**: 
  - Alle deltagere vælger T-shirt størrelse (S/M/L/XL) — 15 sekunder.
  - Majority wins. Konverteres til story points via mapping (S=2, M=5, L=8, XL=13).
  - Kortet flippes, viser cost, og teamet beslutter om de vil tilføje det.
- Mystery cards har en **risk modifier**: +20% usikkerhed visuelt (pulserende kant, "⚠️ rough estimate" label).

**Lag 3: Locked (strict mode)**
- GM kan slå "Strict Estimation" til i setup.
- Unestimererede items er **låst** — kan slet ikke draftes.
- Tvinger teamet til at estimere først (via Lag 1).

**Anbefaling:** Lag 2 (Mystery Cards) som default. Det balancerer flow med nøjagtighed.

---

## 3. Session Flow: Step-by-step

### Pre-session (GM Setup)

```
1. GM vælger "Sprint Draft" som session type
2. GM vælger projekt + target sprint (ny eller eksisterende)
3. GM sætter Sprint Capacity:
   - Auto-suggest: gennemsnit af sidste 3 sprints velocity
   - Manuel override mulig
4. GM vælger items fra backlog (drag fra backlog → draft pool)
   - Eller: "Add all unassigned backlog items"
5. GM vælger estimation mode for mystery cards:
   - "Quick Estimate" (default) — T-shirt in-draft
   - "Estimate First" — starter Planning Poker session først
   - "Strict" — kun pre-estimerede items kan draftes
6. GM starter sessionen → join code genereres
```

### Fase 1: Lobby & Briefing (30 sek)

```
- Spillere joiner via kode
- Sprint Goal vises (GM har skrevet det i setup)
- Capacity Gauge vises: "Budget: 40 SP" (eller hvad velocity er)
- Backlog items vises som et "card deck" — estimerede items med point synlige, mystery cards med "?"
- Kort animation: kortene dealer ud på bordet
```

### Fase 2: Priority Vote (2-3 min)

```
- ALLE items vises som kort
- Hver spiller får 5 "priority tokens" (⭐) de fordeler på items de synes er vigtigst
- 60 sek til at fordele tokens
- Resultat: items sorteres efter priority score (flest tokens øverst)
- Konsensus-belønning: items hvor >70% af spillere gav token → "🔥 High Priority" badge
- Dissens-flag: items hvor præcis 1 person gav alle 5 tokens → "🏴 Champion Pick" (nogen brænder for den)
```

### Fase 3: The Draft (hovedfasen, 5-15 min)

```
- Items vises sorteret efter priority (fra Fase 2)
- Capacity Gauge er synlig hele tiden
- For hvert item (top-down):
  1. Item vises (titel, beskrivelse, estimate/mystery)
  2. Hvis mystery card → Quick Estimate sub-flow (15 sek, T-shirt)
  3. Team voter: "Draft" ✅ eller "Skip" ⏭️
     - Simpelt majority (>50%) = drafted
     - GM har veto (kan force-skip eller force-draft med "PM Override" label)
  4. Drafted item → flyver ind i Capacity Gauge med animation
  5. Capacity Gauge opdateres
  6. Hvis Gauge > 95% → "Almost full!" warning
  7. Hvis næste item ville overfylde → "Won't fit!" overlay, men teamet kan stadig prøve (splittes? scope ned?)

- Special actions under draft:
  - "Split Item" — GM kan splitte et for-stort item i 2 mindre (ny estimate kræves)
  - "Scope Down" — reducer estimate med justification (f.eks. "kun backend, ikke frontend")
  - "Park" — flyt item til "maybe" pile (kan tilføjes hvis der er plads til sidst)
```

### Fase 4: Stretch Goals (valgfri, 2 min)

```
- Hvis capacity < 100%:
  - "Parked" items + lavprioritets-items vises
  - Hurtig ja/nej vote per item
  - Stretch goals markeres visuelt anderledes (stiplet kant, "stretch" label)
```

### Fase 5: Sprint Summary & Approval (1 min)

```
- Oversigt: alle drafted items, total SP, capacity %
- Sprint Goal gentages
- Hvert teammedlem giver "Confidence Vote": 👍 eller 👎
  - >75% 👍 = "Team is confident!" celebration
  - <50% 👍 = "Team has concerns" — GM kan adressere eller godkende anyway
- GM klikker "Finalize Sprint" → approval flow triggers
```

### Post-session: PM Write-back

```
- Drafted items → sprint_id sættes til target sprint
- Stretch items → sprint_id sættes + markeres som stretch (via metadata)
- Skipped items → forbliver i backlog (uændret)
- Sprint status → sættes til "upcoming" eller "active" (GM vælger)
- Quick estimates → skrives som final_estimate på session_items (med source: "quick_estimate")

VIGTIGT: Alt dette sker via Reveal's eksisterende approval flow.
- Sprint Draft resultatet opretter en APPROVAL REQUEST
- PM (eller GM med PM-rolle) godkender
- Først ved godkendelse skrives data til PM-tabellerne
- Dette respekterer "PM-data er source-of-truth" beslutningen
```

---

## 4. Sammenhæng med eksisterende game-modes

### Det er en FJERDE standalone session_type: `sprint_draft`

**Hvorfor ikke en udvidelse af estimation?**
- Estimation handler om at finde det rigtige tal for ét item ad gangen. Deep focus.
- Sprint Draft handler om prioritering og budget-allokering for mange items. Bred overblik.
- Mekanikken er fundamentalt anderledes (budget-draft vs. card-reveal voting).

**Men med naturlig bridge til estimation:**
- Sprint Draft setup kan starte en estimation-session som pre-step (Lag 1).
- Items estimeret i Planning Poker beholder deres estimates i Sprint Draft.
- Flow: Planning Poker (estimate) → Sprint Draft (prioritér + allokér) → Sprint starter → Scope Roulette (challenges) → Boss Battle Retro (slut).

### Full Sprint Lifecycle i Reveal:

```
📊 Planning Poker  →  🎯 Sprint Draft  →  🎰 Scope Roulette  →  ⚔️ Boss Battle Retro
   (estimate)          (plan sprint)       (under sprint)         (slut på sprint)
```

Det er en komplet game-ificeret sprint-cyklus. Sprint Draft udfylder hullet mellem estimation og execution.

---

## 5. Sjove øjeblikke (Game Feel) — Top 3

### Moment 1: "Consensus Flash" ⚡

**Hvornår:** Under Priority Vote (Fase 2), når >80% af teamet giver tokens til samme item.
**Hvad sker:** 
- Kortet lyser op med gylden glow
- Kort particle burst (confetti-agtigt, men subtilt)
- Sound: kort "ding" + team-cheer lyd
- Label: "UNANIMOUS PRIORITY" 
- Følelse: "Vi er enige! Det er fedt!"

**Hvorfor det virker:** Sprint planning DRÆBES af uenighed. At belønne enighed visuelt motiverer konsensus og synliggør hvad teamet virkelig vil.

### Moment 2: "Capacity Lock" 🔒

**Hvornår:** Capacity Gauge rammer 90%+.
**Hvad sker:**
- Gauge skifter fra grøn → amber → rød med smooth gradient
- Ved 95%: gauge begynder at pulse/vibrere
- Ved 100%: SLAM-animation — gauge "låser" med en hængelås-ikon
- Nye items der forsøges drafted → bouncer af med "OVERFLOW" tekst + shake animation
- Sound: metallic lock-klik ved 100%
- Følelse: "Sprintet er fuldt! Vi nåede det!"

**Hvorfor det virker:** Det abstrakte koncept "vi har ikke plads" bliver fysisk og følt. Det stopper scope creep visuelt i stedet for at PM skal sige nej.

### Moment 3: "Mystery Reveal" 🃏

**Hvornår:** Team flipper et mystery card via Quick Estimate.
**Hvad sker:**
- Kortet roterer 3D (card-flip animation)
- Bagsiden er mørk med "?" og pulserende glow
- Under flip: kort suspense-pause (0.5 sek)
- Forsiden viser estimate + item detaljer
- Hvis estimate er lille (S/M, ≤5 SP): grøn flash + "Nice! Small one!" 
- Hvis estimate er stor (XL, ≥13 SP): rød flash + camera shake + "Whoa, that's a big one!"
- Følelse: "Hvad gemmer der sig? ... Åh nej / åh fedt!"

**Hvorfor det virker:** Usikkerhed → reveal er en af de stærkeste dopamin-loops i spildesign. Det gør estimering fra "kedeligt tal-gætteri" til "hvad er bag kortet?".

### Bonus-moments:

- **"Sprint Ready" celebration:** Når GM klikker Finalize og confidence er >75% → fuld-skærm animation med sprint-logo + "SPRINT [X] IS LOCKED AND LOADED" + team avatars i formation.
- **"Champion Pick" spotlight:** Når ét teammedlem sætter alle priority tokens på ét item → spotlight animation på dem + "Sarah is championing [item name]!" — giver folk der brænder for noget en stemme.
- **"Perfect Fit" easter egg:** Hvis drafted items summer til PRÆCIS 100% capacity → special animation + achievement unlock: "🎯 Tetris Master — Perfect Sprint Fill"

---

## 6. Schema-ændringer

### 6a. Udvidelse af `sprints` tabel

```sql
-- Sprint capacity og velocity tracking
ALTER TABLE sprints
  ADD COLUMN IF NOT EXISTS capacity_points numeric(8,2),       -- max story points for dette sprint
  ADD COLUMN IF NOT EXISTS velocity_planned numeric(8,2),       -- planlagt velocity (hvad teamet committer til)
  ADD COLUMN IF NOT EXISTS velocity_actual numeric(8,2);        -- faktisk velocity (udfyldes ved sprint close)
```

### 6b. Udvidelse af `sessions` tabel — ny session_type

```sql
-- Tillad sprint_draft som session type
-- (Afhænger af om der er CHECK constraint — nuværende schema har ingen explicit CHECK på session_type)

-- Sprint Draft-specifik config
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS draft_config jsonb NOT NULL DEFAULT '{}'::jsonb;
  -- Indeholder: { estimation_mode: "quick"|"strict"|"pre_estimate", capacity_source: "auto"|"manual", ... }
```

### 6c. `normalizeSessionType` opdatering i server/app.js

```javascript
// Tilføj til normalizeSessionType():
if (['draft', 'sprint_draft', 'sprint_planning'].includes(val)) {
  return 'sprint_draft';
}
```

### 6d. Ny tabel: `sprint_draft_picks`

```sql
CREATE TABLE IF NOT EXISTS sprint_draft_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  pick_order int NOT NULL,                                     -- rækkefølge drafted i
  priority_score numeric(5,2) DEFAULT 0,                       -- score fra priority vote
  decision text NOT NULL CHECK (decision IN ('drafted', 'skipped', 'parked', 'stretch')),
  estimate_at_draft numeric(8,2),                              -- estimate da den blev drafted (snapshot)
  estimate_source text DEFAULT 'existing'                      -- 'existing' | 'quick_estimate' | 'planning_poker'
    CHECK (estimate_source IN ('existing', 'quick_estimate', 'planning_poker')),
  voted_in boolean NOT NULL DEFAULT false,                     -- majority vote resultat
  pm_override boolean NOT NULL DEFAULT false,                  -- GM brugte veto?
  created_at timestamptz DEFAULT now(),
  
  UNIQUE (session_id, session_item_id)
);

CREATE INDEX IF NOT EXISTS idx_draft_picks_session ON sprint_draft_picks(session_id, pick_order);
CREATE INDEX IF NOT EXISTS idx_draft_picks_decision ON sprint_draft_picks(session_id, decision);
```

### 6e. Ny tabel: `sprint_draft_priority_votes`

```sql
CREATE TABLE IF NOT EXISTS sprint_draft_priority_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tokens int NOT NULL DEFAULT 0 CHECK (tokens BETWEEN 0 AND 5),
  created_at timestamptz DEFAULT now(),
  
  UNIQUE (session_id, session_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_priority_votes_session ON sprint_draft_priority_votes(session_id, session_item_id);
```

### 6f. Udvidelse af `session_items` — stretch flag

```sql
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS is_stretch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimate_source text DEFAULT 'planning_poker'
    CHECK (estimate_source IN ('planning_poker', 'quick_estimate', 'imported', 'manual'));
```

### 6g. Velocity view (computed, ikke stored)

```sql
-- View til at beregne velocity for afsluttede sprints
CREATE OR REPLACE VIEW sprint_velocity AS
SELECT 
  s.id AS sprint_id,
  s.project_id,
  s.organization_id,
  s.name AS sprint_name,
  COALESCE(SUM(si.final_estimate), 0) AS total_estimated,
  COUNT(si.id) FILTER (WHERE si.item_status = 'done') AS items_completed,
  COUNT(si.id) AS items_total,
  COALESCE(SUM(si.final_estimate) FILTER (WHERE si.item_status = 'done'), 0) AS velocity_actual
FROM sprints s
LEFT JOIN session_items si ON si.sprint_id = s.id
WHERE s.status = 'completed'
GROUP BY s.id, s.project_id, s.organization_id, s.name;
```

### Schema-opsummering

| Ændring | Type | Formål |
|---------|------|--------|
| `sprints.capacity_points` | ALTER | Sprint capacity target |
| `sprints.velocity_planned` | ALTER | Planlagt velocity |
| `sprints.velocity_actual` | ALTER | Faktisk velocity |
| `sessions.draft_config` | ALTER | Draft-session config |
| `sprint_draft_picks` | CREATE | Track draft-beslutninger |
| `sprint_draft_priority_votes` | CREATE | Priority token votes |
| `session_items.is_stretch` | ALTER | Stretch goal markering |
| `session_items.estimate_source` | ALTER | Hvordan estimate blev lavet |
| `sprint_velocity` VIEW | CREATE | Auto-beregn velocity |
| `normalizeSessionType` | CODE | Ny session type |

---

## 7. Anbefaling: Ny session_type

**Sprint Draft SKAL være en ny `session_type = 'sprint_draft'`**, ikke en udvidelse.

### Argumenter:

1. **Fundamentalt anderledes mekanik.** Estimation = find det rigtige tal. Draft = allokér budget. Forskellige UI, flow, og data.
2. **Respekterer eksisterende arkitektur.** `normalizeSessionType()` skelner allerede mellem estimation/roulette/retro. Sprint Draft passer perfekt som fjerde type.
3. **Selvstændig UI.** Draft-skærmen (capacity gauge, card deck, priority tokens) er helt anderledes end estimation-skærmen (card reveal, voting).
4. **Men med bridge.** Setup-flowet kan starte en estimation-session som pre-step — det er session composition, ikke session extension.
5. **Komplet sprint lifecycle.** Estimation → Draft → Roulette → Retro giver en naturlig bue fra "vi planlægger" til "vi eksekverer" til "vi reflekterer."

### Implementeringsfaser

**Fase 1 — MVP (2-3 sprints):**
- Schema migration (6a-6g)
- Sprint Draft session setup (GM UI)
- Priority Vote (Fase 2)
- Simple Draft (Fase 3, uden mystery cards)
- Capacity Gauge UI
- PM approval integration
- Write-back til sprint/session_items

**Fase 2 — Mystery Cards (1-2 sprints):**
- Quick Estimate in-draft flow
- Mystery card flip animation
- "Estimate First" pre-step bridge til Planning Poker
- Strict mode

**Fase 3 — Game Feel Polish (1 sprint):**
- Consensus Flash animation
- Capacity Lock animation
- Mystery Reveal animation
- Sprint Ready celebration
- Champion Pick spotlight
- Tetris Master achievement

---

## 8. Risici & Open Questions

| Risiko | Mitigering |
|--------|-----------|
| Session for lang (>30 min) | Timer per fase. Skip-to-draft for erfarne teams. |
| Quick estimates upræcise | Markér altid som "rough" — PM kan revidere. Encourage Planning Poker for vigtige items. |
| Teamet vil ikke prioritere | Priority Vote er soft — GM kan skippe og gå direkte til draft med egen prioritering. |
| Complexity creep | MVP er simpelt: priority vote + draft + capacity gauge. Mystery cards og animations er Fase 2-3. |
| Integration med Connected Mode | Draft picks respekterer approval pipeline. Connected mode sync sker via eksisterende governance flow. |

### Open questions til Danny:

1. **Token-antal i Priority Vote:** 5 tokens per person — for mange? For få? Bør det skalere med antal items?
2. **Capacity auto-detect:** Skal vi bruge gennemsnit af sidste 3 sprints, eller weighted average (nyeste tæller mest)?
3. **GM veto-synlighed:** Skal GM override være synligt for teamet ("PM Override" label) eller stille?
4. **Stretch goals:** Er stretch-konceptet vigtigt nok til MVP, eller Fase 2?

---

*Designet af: James (game design session, 2026-03-20)*
*Næste step: Danny review → skema-migration → UI prototyping*
