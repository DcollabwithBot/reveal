# Reveal — Sprint Plan: Game↔PM Integration, Import, Daily Missions & New Game Modes

**Version:** 1.0  
**Dato:** 2026-03-20  
**Forfatter:** James (Senior PM / Arkitekt)  
**Status:** PLAN — klar til review

---

## TL;DR

3 sprints der bygger Reveal fra "standalone estimation tool" til "komplet gamificeret PM-platform":

- **Sprint A:** Data ind (import, unplanned work tracking) + Daily Missions foundation
- **Sprint B:** Missions live + Spec Wars + Perspektiv-Poker (PM-tæt koblede modes)
- **Sprint C:** Bluff Poker + Russian Nesting Scope + Speed Scope (standalone modes)

Alle game modes følger ét princip: **PM-data er source of truth. Game-layer er advisory. Write-back kun via PM approval.**

---

## Del 1: Integration-design (Game ↔ PM)

For hver game mode — startpunkt, data ind, resultater ud, write-back.

---

### 1.1 Planning Poker (eksisterende ✅)

```
Startpunkt:     ProjectWorkspace → Sprint header → "⚔ Estimer sprint" (bulk select)
                ELLER: Dashboard → Quick Actions → "Start Estimation"
GM konfigurerer: Voting mode (Fibonacci/T-shirt), items at estimere, auto_apply toggle

PM-data IND:    session_items (titel, beskrivelse, eksisterende estimate)
                sprint context (navn, mål, velocity)
Vises til spil:  Item-kort med titel+beskrivelse, voting cards

Resultater UD:  final_estimate per item, confidence scores, outlier flags
Write-back:     session_items.final_estimate + session_items.estimated_hours
                Via: Direkte (auto_apply=true) ELLER approval request
Felter:         final_estimate, estimated_hours, estimate_source='planning_poker'
```

**PM-kobling:** Tæt. Estimater er kernedata i PM-systemet.

---

### 1.2 Scope Roulette (eksisterende ✅)

```
Startpunkt:     Session → efter estimation complete → "Spin the Wheel"
                ELLER: Dashboard → aktiv sprint → "Add Challenge"
GM konfigurerer: Challenge pool (auto fra DB / custom), difficulty level

PM-data IND:    sprint items (for kontekst), team velocity, sprint progress
Vises til spil:  Challenge cards, boss HP modifier, team composition

Resultater UD:  Valgt challenge, boss HP modifier, team spirit metric
Write-back:     INGEN direkte PM write-back
                Indirekte: challenge context gemmes i session metadata
Felter:         sessions.metadata (challenge_id, challenge_outcome)
```

**PM-kobling:** Løs. Standalone game moment. Påvirker session-flow, ikke PM-data.

---

### 1.3 Boss Battle Retro (eksisterende ✅)

```
Startpunkt:     Dashboard → afsluttet sprint → "Start Retrospective"
                ELLER: Sprint header → "⚔ Sprint Retro"
GM konfigurerer: Sprint at retrospere, retro event selection

PM-data IND:    sprint items (done/not done), velocity, burndown data
                estimation accuracy (predicted vs actual)
Vises til spil:  Boss HP (sprint health), retro events, root cause voting

Resultater UD:  Root causes, action items, oracle insights, boss outcome
Write-back:     retro_actions → promote til session_items via approval
                Via: PM approval flow (promote-retro-action Edge Function)
Felter:         Ny session_item (title, description, source_type='retro',
                source_session_id, sprint_id=næste sprint)
```

**PM-kobling:** Medium-tæt. Retro actions bliver PM tasks via approval.

---

### 1.4 Sprint Draft (eksisterende ✅, Sprint 10)

```
Startpunkt:     ProjectWorkspace → Sprint header → "🎯 Start Sprint Draft"
                ELLER: Dashboard → Quick Actions → "Plan Next Sprint"
GM konfigurerer: Projekt + target sprint, capacity (auto/manual),
                estimation mode (quick/strict/pre_estimate), backlog items

PM-data IND:    Alle backlog items (uallokerede), sprint velocity historik,
                item estimates, item priorities, team capacity
Vises til spil:  Card deck (items), Capacity Gauge, priority tokens

Resultater UD:  Draft picks (drafted/skipped/parked/stretch), priority scores,
                confidence vote, capacity fill %
Write-back:     session_items.sprint_id → target sprint
                session_items.is_stretch flag
                sprints.velocity_planned
                Quick estimates → session_items.final_estimate
                Via: PM approval (finalize-draft Edge Function)
Felter:         sprint_id, is_stretch, final_estimate, estimate_source,
                velocity_planned, capacity_points
```

**PM-kobling:** Meget tæt. Sprint Draft DEFINERER hvad der er i et sprint.

---

### 1.5 Spec Wars (NY — Sprint B)

```
Startpunkt:     ProjectWorkspace → item context menu → "⚔ Start Spec Wars"
                ELLER: Sprint header → "Spec Wars" (bulk: items med kort description)
GM konfigurerer: Items at spec'e (auto-filter: description < 100 chars ELLER
                mangler acceptance criteria), tidslimit per item (default 5 min),
                voting rounds (default 2)

PM-data IND:    session_items (titel, description, eksisterende acceptance criteria)
                project context (for domæneforståelse)
Vises til spil:  Item titel + nuværende description, skrive-felt per deltager,
                anonymiserede submissions, voting interface

Game flow:
  1. Item vises — alle skriver acceptance criteria individuelt (3 min)
  2. Submissions anonymiseres og vises
  3. Alle voter på de bedste (star-rating 1-5 per submission)
  4. Top-rated samles til "winning spec"
  5. GM reviewer og godkender final version
  6. Næste item

Resultater UD:  Acceptance criteria per item, kvalitetsscore,
                contributor credit (hvem skrev den vindende spec)
Write-back:     session_items.description (opdateret/udvidet)
                session_items.acceptance_criteria (NYT felt)
                Via: PM approval flow
Felter:         description, acceptance_criteria, spec_quality_score (metadata)
```

**PM-kobling:** Tæt. Output er direkte PM-data (specs/acceptance criteria).

---

### 1.6 Perspektiv-Poker (NY — Sprint B)

```
Startpunkt:     ProjectWorkspace → sprint header → "🎭 Perspektiv-Poker"
                ELLER: Session lobby → "Add Perspective Round"
GM konfigurerer: Items at estimere, perspektiver (default: Kunde, Support,
                Drift, Udvikler — custom muligt), reveal mode (anonymous/named)

PM-data IND:    session_items (titel, description, eksisterende estimates)
Vises til spil:  Item-kort, skjult rolle-kort (perspektiv), voting cards

Game flow:
  1. Hver deltager trækker et skjult perspektiv-kort (kunde/support/drift/dev)
  2. Alle estimerer itemmet FRA DET PERSPEKTIV (ikke deres eget)
  3. Votes afsløres med perspektiv-label synligt
  4. Gap-analyse: "Kunden ser 13 SP, Drift ser 3 SP — hvad sker der?"
  5. Diskussion (2 min) → re-vote med eget perspektiv
  6. Final estimate = median af re-votes

Resultater UD:  Final estimate, perspektiv-gap analyse (max-min spread),
                risk notes baseret på store gaps, diskussionspunkter
Write-back:     session_items.final_estimate (via approval)
                session_items.risk_notes (NYT felt — perspektiv-gaps)
                Via: PM approval flow
Felter:         final_estimate, risk_notes, perspective_gap_score (metadata)
```

**PM-kobling:** Tæt. Giver estimater + risiko-indsigt til PM.

---

### 1.7 Bluff Poker (NY — Sprint C)

```
Startpunkt:     Session lobby → Game Mode selector → "🃏 Bluff Poker"
                ELLER: Dashboard → Quick Actions → "Fun Session"
GM konfigurerer: Items at estimere, antal bluffere (default 1),
                reveal mode, discussion timer

PM-data IND:    session_items (titel, description)
Vises til spil:  Item-kort, voting cards, "bluffer" rolle (skjult til 1 person)

Game flow:
  1. Én tilfældig deltager får "Bluffer" rollen (skjult)
  2. Alle estimerer — blufferen SKAL estimere bevidst forkert
  3. Votes afsløres
  4. Gruppen diskuterer: "Hvem bluffer?" (2 min)
  5. Alle voter på hvem de tror bluffer
  6. Bluffer afsløres!
  7. Scoring: +10 XP hvis du fangede blufferen, +15 XP hvis blufferen
     overlevede uopdaget
  8. Re-vote UDEN bluff → final estimate

Resultater UD:  Final estimate (re-vote), discussion_points (hvad
                diskussionen afslørede), bluff-detection score
Write-back:     session_items.final_estimate (via approval)
                session_items.discussion_notes (hvad gruppen opdagede)
                Via: PM approval flow
Felter:         final_estimate, discussion_notes
```

**PM-kobling:** Medium. Primært en engagement-mekanik med estimation som biprodukt.

---

### 1.8 Russian Nesting Scope (NY — Sprint C)

```
Startpunkt:     ProjectWorkspace → item context menu → "🪆 Break Down Item"
                ELLER: Backlog → items med estimated_hours > 40 → auto-suggest
GM konfigurerer: Item at nedbryde, max sub-items (default 8),
                estimation mode for sub-items (T-shirt/Fibonacci)

PM-data IND:    session_items (det store item: titel, description, estimate)
                project context, sprint context
Vises til spil:  Det store item som "outer doll", tom sub-item liste

Game flow:
  1. Stort item vises centralt — "This item is TOO BIG. Break it down!"
  2. Alle skriver sub-items individuelt (3 min, max 5 per person)
  3. Sub-items samles, dedupliseres (GM merger lignende)
  4. For hvert unikt sub-item: hurtig T-shirt estimate (15 sek)
  5. Sum af sub-estimates vises vs. original estimate
  6. Gap-analyse: "Original: 40h, Sub-sum: 62h — scope was hidden!"
  7. GM godkender final sub-item liste

Resultater UD:  Sub-items med estimater, scope gap analyse,
                original item → parent_id reference
Write-back:     NYE session_items (sub-items) med parent_item_id
                Original item: estimated_hours opdateret til sub-sum
                Via: PM approval flow
Felter:         Nye items: title, description, final_estimate, parent_item_id,
                sprint_id (arvet), estimate_source='nesting_scope'
                Original item: estimated_hours=sub-sum, item_status='decomposed'
```

**PM-kobling:** Meget tæt. Opretter nye PM-items direkte.

---

### 1.9 Speed Scope (NY — Sprint C)

```
Startpunkt:     Session lobby → Game Mode selector → "⚡ Speed Scope"
                ELLER: Sprint header → "Quick Estimates"
GM konfigurerer: Items at estimere, speed-round timer (default 10 sek),
                discussion timer (default 2 min)

PM-data IND:    session_items (titel, description)
Vises til spil:  Item-kort, countdown timer, voting cards

Game flow:
  1. RUNDE 1 — SPEED: Items vises rapid-fire
     - 10 sekunder per item, INGEN diskussion
     - Alle voter simultant
     - Næste item automatisk
  2. RUNDE 2 — DISCUSS: Samme items, men nu med 2 min diskussion per item
     - Alle voter igen
     - Estimates sammenlignes med Runde 1
  3. Resultat-skærm: "Discussion changed estimates on 7/12 items"
     - Viser delta per item
     - Highlights: items hvor diskussion ændrede >50% = "Hidden Complexity"

Resultater UD:  Speed estimates, discussed estimates, delta-analyse,
                "hidden complexity" flags
Write-back:     INGEN direkte write-back (learning mode)
                Valgfrit: GM kan vælge "Apply discussed estimates" → approval
Felter:         Ingen obligatoriske. Opt-in: final_estimate fra runde 2
```

**PM-kobling:** Løs. Primært et lærings- og team-kalibreringsværktøj.

---

### Oversigt: PM-kobling per mode

| Mode | PM-kobling | Write-back | Approval required |
|------|-----------|------------|-------------------|
| Planning Poker | Tæt | final_estimate | Valgfri (auto_apply) |
| Scope Roulette | Løs | Ingen | Nej |
| Boss Battle Retro | Medium | Nye tasks (promote) | Ja |
| Sprint Draft | Meget tæt | sprint_id, estimates | Ja |
| Spec Wars | Tæt | description, acceptance_criteria | Ja |
| Perspektiv-Poker | Tæt | final_estimate, risk_notes | Ja |
| Bluff Poker | Medium | final_estimate, discussion_notes | Ja |
| Russian Nesting Scope | Meget tæt | Nye sub-items | Ja |
| Speed Scope | Løs | Ingen (opt-in) | Nej |

---

## Del 2: Sprint Plan

---

### Sprint A: Import + Unplanned Work + Daily Missions Foundation

**Sprint mål:** Få data ind i Reveal (import flows) + gør projekttilstand målbar (missions foundation).

**Varighed:** 2 uger (10 arbejdsdage)

**Dependencies:** Ingen — dette er fundament for Sprint B og C.

#### A1. Jira OAuth Import Flow (4 dage)

**Hvad bygges:**
- Settings → Integrations → "Connect Jira" knap
- OAuth 2.0 flow: Jira App oprettelse, consent screen, token exchange
- Preview-skærm: viser Jira projekter/boards → bruger vælger hvad der importeres
- Import engine: Jira issues → session_items med mapping (title, description, priority, story_points → final_estimate, status → item_status)
- Duplicate detection: matcher på external_id (Jira issue key)
- Progress indicator under import

**Teknisk:**
- Edge Function: `supabase/functions/jira-import/index.ts`
  - OAuth token exchange + refresh
  - Jira REST API v3: `/rest/api/3/search` (JQL)
  - Batch insert til session_items med external_id + external_source='jira'
- Frontend: `app/src/screens/Settings/IntegrationsTab.jsx`
- Bruger eksisterende `oauth_credentials` tabel fra next-phase-architecture

#### A2. Excel/CSV Import — Forbedret (2 dage)

**Hvad bygges:**
- Drag-drop zone (udover eksisterende paste)
- Smart kolonne-genkendelse: auto-mapper kolonnenavne til Reveal-felter
  - "Title"/"Titel"/"Name" → title
  - "Description"/"Beskrivelse" → description
  - "Points"/"Story Points"/"Estimate" → final_estimate
  - "Priority"/"Prioritet" → priority
  - "Status" → item_status
- Preview med editerbar mapping (dropdown per kolonne)
- Duplicate detection: matcher på title + description hash
- Fejlrapport: viser skippede/fejlede rækker

**Teknisk:**
- Frontend: Udvid eksisterende `ExcelOnboarding.jsx` med drag-drop + auto-mapping
- Parser: `papaparse` (CSV) + `xlsx` (Excel) — begge client-side
- Duplicate check: hash(title+description) mod eksisterende items i projekt

#### A3. Unplanned Work Tracking (1.5 dage)

**Hvad bygges:**
- `is_unplanned` flag på session_items
- ⚡ badge på kanban-kort for unplanned items
- "Add Unplanned Item" knap i sprint-view (auto-sætter flaget)
- Sprint metrics: unplanned rate (% unplanned af total items)
- Scope change log: tracker items tilføjet/fjernet efter sprint start

**Teknisk:**
- DB: `ALTER TABLE session_items ADD COLUMN is_unplanned boolean DEFAULT false;`
- DB: `ALTER TABLE session_items ADD COLUMN added_to_sprint_at timestamptz;`
- Sprint scope change = items hvor `added_to_sprint_at > sprint.start_date`
- Frontend: Badge component + metric i sprint header

#### A4. Daily Missions — Database + Engine (2.5 dage)

**Hvad bygges:**

**Tabeller:**
```sql
CREATE TABLE missions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  emoji           text NOT NULL,
  description     text NOT NULL,
  category        text NOT NULL CHECK (category IN ('solo','team')),
  trigger_condition jsonb NOT NULL,  -- { type: 'items_without_sprint', threshold: 5 }
  xp_reward       int NOT NULL DEFAULT 10,
  badge_slug      text,              -- achievement badge ved completion
  cooldown_hours  int DEFAULT 24,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE user_missions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mission_id      uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id),
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','expired','skipped')),
  progress        int DEFAULT 0,
  target          int NOT NULL DEFAULT 1,
  assigned_at     timestamptz DEFAULT now(),
  completed_at    timestamptz,
  expires_at      timestamptz,
  UNIQUE(user_id, mission_id, assigned_at::date)
);

CREATE TABLE estimation_accuracy_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id),
  session_item_id uuid NOT NULL REFERENCES session_items(id),
  estimated_value numeric(8,2),
  actual_value    numeric(8,2),
  accuracy_pct    numeric(5,2),       -- 100 = perfect, 85 = 15% off
  logged_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_user_missions_active ON user_missions(user_id, status, assigned_at);
CREATE INDEX idx_estimation_accuracy ON estimation_accuracy_log(user_id, logged_at);
```

**Seed data — 10 missions:**

| Slug | Navn | Emoji | Kategori | Trigger |
|------|------|-------|----------|---------|
| spec-detective | Spec Detective | 🔍 | solo | projekt med items uden breakdown (< 3 sub-items) |
| orphan-hunter | Orphan Hunter | 👻 | solo | items uden sprint_id > 5 |
| estimate-this | Estimate This | 🎯 | solo | items uden final_estimate > 3 |
| scope-check | Scope Check | ✂️ | solo | items med estimated_hours > 40 |
| spec-sprint | Spec Sprint | 🏃 | team | projekt med > 10 items uden acceptance_criteria |
| streak-keeper | Streak Keeper | 🔥 | solo | bruger har estimeret i 3+ sessions denne uge |
| review-hero | Review Hero | 🦸 | solo | approval requests pending > 2 |
| backlog-gardener | Backlog Gardener | 🌱 | solo | items med status 'backlog' > 20 |
| sprint-closer | Sprint Closer | 🏁 | team | sprint med < 3 dage tilbage og > 30% items 'in_progress' |
| velocity-check | Velocity Check | 📊 | solo | sprint afsluttet uden velocity_actual udfyldt |

**Kontekst-mission engine:**
- Edge Function: `supabase/functions/generate-missions/index.ts`
- Evaluerer projekt/sprint/item tilstand per bruger
- Returnerer 2 solo + 1 team mission (dagens missions)
- Kører on-demand ved dashboard load (caching: 1 time)

**Frontend:** "Today's Missions" komponent i Dashboard
- 3 mission-kort med emoji, navn, progress bar, XP reward
- Klik → navigér til relevant kontekst (backlog, sprint, etc.)

**Bonus-mekanikker (tracking foundation):**
- Estimation Accuracy: logges i `estimation_accuracy_log` ved sprint close (actual vs estimated)
- Badges: achievements tabel eksisterer allerede — tilføj nye badge definitions

---

### Sprint B: Daily Missions Live + Spec Wars + Perspektiv-Poker

**Sprint mål:** Missions som levende, trackende system + 2 nye game modes tæt koblet til PM-data.

**Varighed:** 2 uger (10 arbejdsdage)

**Dependencies:** Sprint A (missions tabeller, import flow for test-data)

#### B1. Mission Tracking Engine (2 dage)

**Hvad bygges:**
- Supabase DB trigger: ved `session_items` INSERT/UPDATE → evaluer aktive missions
  - Item får sprint_id → orphan-hunter mission progress++
  - Item får final_estimate → estimate-this mission progress++
  - Item gets acceptance_criteria → spec-detective progress++
- Edge Function: `supabase/functions/evaluate-mission/index.ts`
  - Kaldes af DB trigger via pg_net
  - Checker om mission target er nået → status='completed'
  - Tildeler XP + badge ved completion
- Mission expiry: cron (pg_cron) kører dagligt, markerer expired missions

**Teknisk:**
```sql
-- Trigger function
CREATE OR REPLACE FUNCTION notify_mission_progress()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/evaluate-mission',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := jsonb_build_object(
      'item_id', NEW.id,
      'user_id', NEW.assigned_to,
      'organization_id', NEW.organization_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mission_progress
  AFTER INSERT OR UPDATE ON session_items
  FOR EACH ROW EXECUTE FUNCTION notify_mission_progress();
```

#### B2. Sprint Report Card (1.5 dage)

**Hvad bygges:**
- Animeret score-skærm ved sprint close
- Metrics: velocity, accuracy, unplanned rate, scope changes, mission completions
- Per-person highlights: "Most Accurate Estimator", "Spec Machine", etc.
- XP summary: total XP earned i sprintet
- Share-link (eksisterende pattern fra session results)

**Frontend:** `app/src/components/sprint/SprintReportCard.jsx`
- Triggered fra sprint close flow
- Staggered reveal animation (metric by metric)

#### B3. XP/Badge System Live (1 dag)

**Hvad bygges:**
- XP tildeling ved mission completion (allerede i evaluate-mission)
- Badge unlock notification (toast + achievement popup)
- Bonus-mekanikker:
  - Estimation Accuracy Hit (±15%): +15 XP + "Sniper Shot 🎯" achievement
  - Confidence Prediction Hit: +20 XP + "Oracle 🔮" badge
  - Risk Card Prediction Hit: +25 XP + "Risk Prophet ⚡" badge
- Dashboard: XP total + badge collection i profil-dropdown

**Teknisk:**
- Udnytter eksisterende `achievement_definitions` + `game_profiles` tabeller
- Nye achievement definitions seeded
- XP tracking i `game_profiles.xp_total` (eksisterer)

#### B4. Spec Wars Game Mode (3 dage)

**Hvad bygges:**
- Ny session_type: `spec_wars`
- `SprecWarsScreen.jsx`: fuld game-flow
  1. Item vises — alle skriver acceptance criteria (timer: 3 min)
  2. Submissions anonymiseres
  3. Alle voter (star-rating 1-5)
  4. Top-rated vises som "winning spec"
  5. GM godkender → næste item
- Realtime: Supabase channel per session for submissions + votes
- Write-back: acceptance_criteria felt via approval

**Nye tabeller:**
```sql
CREATE TABLE spec_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES profiles(id),
  content         text NOT NULL,
  score           numeric(3,1) DEFAULT 0,
  vote_count      int DEFAULT 0,
  is_winner       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(session_id, session_item_id, author_id)
);

CREATE TABLE spec_votes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES spec_submissions(id) ON DELETE CASCADE,
  voter_id        uuid NOT NULL REFERENCES profiles(id),
  rating          int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(submission_id, voter_id)
);

-- Acceptance criteria felt på items
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS acceptance_criteria text;
```

**Edge Function:** `supabase/functions/finalize-spec-wars/index.ts`
- Beregner winning spec per item
- Opretter approval request for description + acceptance_criteria update

#### B5. Perspektiv-Poker Game Mode (2.5 dage)

**Hvad bygges:**
- Ny session_type: `perspective_poker`
- `PerspectivePokerScreen.jsx`: fuld game-flow
  1. Perspektiv-kort uddeles (skjult): Kunde, Support, Drift, Udvikler
  2. Alle estimerer fra DERES PERSPEKTIV
  3. Reveal: votes vises med perspektiv-label
  4. Gap-analyse: visuelt spread-diagram
  5. Diskussion (2 min timer)
  6. Re-vote med eget perspektiv → final estimate
- Perspective gap score beregning (max-min spread)
- Risk notes auto-generering ved store gaps

**Nye tabeller:**
```sql
CREATE TABLE perspective_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id),
  perspective     text NOT NULL CHECK (perspective IN
    ('customer','support','ops','developer','security','business')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(session_id, session_item_id, user_id)
);

-- Risk notes felt på items
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS risk_notes text;
```

**Edge Function:** `supabase/functions/finalize-perspective/index.ts`
- Beregner final estimate (median af re-votes)
- Genererer risk_notes fra perspektiv-gaps
- Opretter approval request

---

### Sprint C: Bluff Poker + Russian Nesting Scope + Speed Scope

**Sprint mål:** De resterende 3 game modes — fra engagement (Bluff) til nedbrydning (Nesting) til kalibrering (Speed).

**Varighed:** 2 uger (10 arbejdsdage)

**Dependencies:** Sprint A (basis tabeller), Sprint B (session_type pattern)

#### C1. Bluff Poker Game Mode (3 dage)

**Hvad bygges:**
- Ny session_type: `bluff_poker`
- `BluffPokerScreen.jsx`: fuld game-flow
  1. Bluffer-rolle tildeles tilfældigt (1 person, skjult)
  2. Alle estimerer — blufferen SKAL estimere bevidst forkert
  3. Reveal: votes vises
  4. "Hvem bluffer?" — alle voter på en person (2 min)
  5. Bluffer afsløres med animation
  6. Scoring: +10 XP fanger bluffer, +15 XP bluffer overlever
  7. Re-vote uden bluff → final estimate
- Discussion notes capture: tekst-felt under diskussion

**Nye tabeller:**
```sql
CREATE TABLE bluff_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  bluffer_id      uuid NOT NULL REFERENCES profiles(id),
  detected_by     uuid[] DEFAULT '{}',    -- hvem gættede rigtigt
  bluff_survived  boolean,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE bluff_guesses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  guesser_id      uuid NOT NULL REFERENCES profiles(id),
  guessed_id      uuid NOT NULL REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(session_id, session_item_id, guesser_id)
);

-- Discussion notes felt
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS discussion_notes text;
```

**Edge Function:** `supabase/functions/finalize-bluff/index.ts`
- Evaluerer bluff detection, tildeler XP
- Opretter approval for final_estimate + discussion_notes

#### C2. Russian Nesting Scope Game Mode (4 dage)

**Hvad bygges:**
- Ny session_type: `nesting_scope`
- `NestingScopeScreen.jsx`: fuld game-flow
  1. Stort item vises centralt — "Matryoshka doll" visuelt
  2. Alle skriver sub-items individuelt (3 min, max 5 per person)
  3. Submissions samles — GM merger/deduplicerer live
  4. Quick estimate per sub-item (T-shirt, 15 sek)
  5. Sum-analyse: sub-sum vs. original estimate
  6. Gap-visualisering: "Scope was X% larger than estimated"
  7. GM godkender final sub-item liste

**Nye tabeller:**
```sql
-- Parent-child relationship på items
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS parent_item_id uuid REFERENCES session_items(id);

CREATE INDEX idx_items_parent ON session_items(parent_item_id)
  WHERE parent_item_id IS NOT NULL;

-- Scope breakdown submissions
CREATE TABLE scope_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  parent_item_id  uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES profiles(id),
  title           text NOT NULL,
  description     text,
  merged_into     uuid REFERENCES scope_submissions(id),  -- dedup reference
  created_at      timestamptz DEFAULT now()
);
```

**Edge Function:** `supabase/functions/finalize-nesting/index.ts`
- Opretter nye session_items (sub-items) med parent_item_id
- Sætter original item status='decomposed'
- Opdaterer estimated_hours til sub-sum
- Alt via PM approval

#### C3. Speed Scope Game Mode (2 dage)

**Hvad bygges:**
- Ny session_type: `speed_scope`
- `SpeedScopeScreen.jsx`: fuld game-flow
  1. RUNDE 1 — SPEED: 10 sek per item, ingen diskussion, simultant vote
  2. RUNDE 2 — DISCUSS: 2 min per item, diskussion + re-vote
  3. Resultat: delta-analyse, "Hidden Complexity" flags
- Velocity measurement: items/minut i speed-runde

**Nye tabeller:**
```sql
CREATE TABLE speed_estimates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id),
  round           int NOT NULL CHECK (round IN (1, 2)),  -- 1=speed, 2=discussed
  estimate        text NOT NULL,  -- Fibonacci/T-shirt value
  created_at      timestamptz DEFAULT now(),
  UNIQUE(session_id, session_item_id, user_id, round)
);
```

**Ingen Edge Function nødvendig** — Speed Scope er learning mode, ingen obligatorisk write-back.
Valgfri: "Apply discussed estimates" knap der genbruger eksisterende estimation approval.

#### C4. Sprint C Polish (1 dag)

- Unified game mode selector i session lobby
- Game mode preview cards (beskrivelse + "best for..." label)
- Session type routing i App.jsx for alle nye modes
- Shared game utilities: timer component, voting component, reveal animation

---

## Del 3: Tekniske Specifikationer per Sprint

---

### Sprint A — Tekniske Specifikationer

**Nye tabeller/kolonner:**

```sql
-- A3: Unplanned work
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS is_unplanned boolean DEFAULT false;
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS added_to_sprint_at timestamptz;

-- A4: Missions
CREATE TABLE missions (...);           -- se A4 ovenfor
CREATE TABLE user_missions (...);      -- se A4 ovenfor
CREATE TABLE estimation_accuracy_log (...);  -- se A4 ovenfor
```

**Nye Edge Functions:**
- `supabase/functions/jira-import/index.ts` — OAuth + Jira REST → session_items
- `supabase/functions/generate-missions/index.ts` — evaluér projekttilstand → dagens missions

**Frontend komponenter:**
- `app/src/screens/Settings/IntegrationsTab.jsx` — Jira OAuth connect
- `app/src/components/import/JiraImportPreview.jsx` — preview + mapping
- `app/src/components/import/ExcelDragDrop.jsx` — drag-drop + auto-mapping
- `app/src/components/dashboard/TodaysMissions.jsx` — 3 mission-kort
- `app/src/components/kanban/UnplannedBadge.jsx` — ⚡ badge

**API-udvidelser (api.js):**
```js
// Nye funktioner i api.js
export const connectJira = (orgId, authCode) => edgeFn('jira-import', { orgId, authCode, action: 'connect' });
export const importFromJira = (orgId, config) => edgeFn('jira-import', { orgId, ...config, action: 'import' });
export const getTodaysMissions = (orgId) => edgeFn('generate-missions', { orgId });
export const completeMission = (missionId) => edgeFn('generate-missions', { missionId, action: 'complete' });
```

**Supabase Realtime:** Ingen nye subscriptions i Sprint A.

---

### Sprint B — Tekniske Specifikationer

**Nye tabeller/kolonner:**

```sql
-- B4: Spec Wars
CREATE TABLE spec_submissions (...);   -- se B4
CREATE TABLE spec_votes (...);         -- se B4
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS acceptance_criteria text;

-- B5: Perspektiv-Poker
CREATE TABLE perspective_assignments (...);  -- se B5
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS risk_notes text;
```

**DB Triggers:**
```sql
-- B1: Mission progress trigger
CREATE TRIGGER trg_mission_progress
  AFTER INSERT OR UPDATE ON session_items
  FOR EACH ROW EXECUTE FUNCTION notify_mission_progress();
```

**Nye Edge Functions:**
- `supabase/functions/evaluate-mission/index.ts` — mission progress check + completion
- `supabase/functions/finalize-spec-wars/index.ts` — winning spec → approval
- `supabase/functions/finalize-perspective/index.ts` — median estimate → approval

**Frontend komponenter:**
- `app/src/screens/SprecWarsScreen.jsx` — fuld Spec Wars game
- `app/src/screens/PerspectivePokerScreen.jsx` — fuld Perspektiv-Poker game
- `app/src/components/sprint/SprintReportCard.jsx` — animeret score-skærm
- `app/src/components/dashboard/XpBadgeDisplay.jsx` — XP + badge visning
- `app/src/components/session/PerspectiveGapChart.jsx` — spread-diagram

**API-udvidelser (api.js):**
```js
export const submitSpec = (sessionId, itemId, content) =>
  edgeFn('finalize-spec-wars', { sessionId, itemId, content, action: 'submit' });
export const voteSpec = (submissionId, rating) =>
  edgeFn('finalize-spec-wars', { submissionId, rating, action: 'vote' });
export const finalizeSpecWars = (sessionId) =>
  edgeFn('finalize-spec-wars', { sessionId, action: 'finalize' });
export const assignPerspective = (sessionId, itemId) =>
  edgeFn('finalize-perspective', { sessionId, itemId, action: 'assign' });
export const finalizePerspective = (sessionId) =>
  edgeFn('finalize-perspective', { sessionId, action: 'finalize' });
```

**Supabase Realtime subscriptions:**
- Spec Wars: `spec_submissions` channel (nye submissions live)
- Spec Wars: `spec_votes` channel (vote counts live)
- Perspektiv-Poker: `votes` channel (eksisterende, genbruges)

---

### Sprint C — Tekniske Specifikationer

**Nye tabeller/kolonner:**

```sql
-- C1: Bluff Poker
CREATE TABLE bluff_assignments (...);  -- se C1
CREATE TABLE bluff_guesses (...);      -- se C1
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS discussion_notes text;

-- C2: Russian Nesting Scope
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS parent_item_id uuid
  REFERENCES session_items(id);
CREATE TABLE scope_submissions (...);  -- se C2

-- C3: Speed Scope
CREATE TABLE speed_estimates (...);    -- se C3
```

**Nye Edge Functions:**
- `supabase/functions/finalize-bluff/index.ts` — bluff eval + XP + approval
- `supabase/functions/finalize-nesting/index.ts` — sub-items creation + approval

**Frontend komponenter:**
- `app/src/screens/BluffPokerScreen.jsx` — fuld Bluff Poker game
- `app/src/screens/NestingScopeScreen.jsx` — fuld Russian Nesting Scope game
- `app/src/screens/SpeedScopeScreen.jsx` — fuld Speed Scope game
- `app/src/components/session/GameModeSelector.jsx` — unified mode picker
- `app/src/components/session/GameModeCard.jsx` — preview-kort per mode
- `app/src/components/session/BluffReveal.jsx` — bluffer reveal animation
- `app/src/components/session/NestingDoll.jsx` — matryoshka breakdown visual
- `app/src/components/session/SpeedTimer.jsx` — countdown per item

**API-udvidelser (api.js):**
```js
export const assignBluffer = (sessionId, itemId) =>
  edgeFn('finalize-bluff', { sessionId, itemId, action: 'assign' });
export const submitBluffGuess = (sessionId, itemId, guessedId) =>
  edgeFn('finalize-bluff', { sessionId, itemId, guessedId, action: 'guess' });
export const finalizeBluff = (sessionId) =>
  edgeFn('finalize-bluff', { sessionId, action: 'finalize' });
export const submitScopeBreakdown = (sessionId, parentItemId, subItems) =>
  edgeFn('finalize-nesting', { sessionId, parentItemId, subItems, action: 'submit' });
export const finalizeNesting = (sessionId) =>
  edgeFn('finalize-nesting', { sessionId, action: 'finalize' });
```

**Supabase Realtime subscriptions:**
- Bluff Poker: `bluff_guesses` channel (live guess tracking)
- Nesting Scope: `scope_submissions` channel (sub-items live)
- Speed Scope: `speed_estimates` channel (live votes begge runder)

---

## Del 4: Arkitektur-diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PM-PLATFORMEN (Frontend)                       │
│                                                                   │
│  Dashboard          ProjectWorkspace        Sprint View           │
│  ├─ Today's         ├─ Kanban (items)       ├─ Burndown          │
│  │  Missions        ├─ Sprint header        ├─ Scope changes     │
│  ├─ Quick Actions   ├─ Import (Jira/CSV)    └─ Report Card       │
│  └─ GameStatsBar    └─ Backlog                                    │
│                                                                   │
│         │ start game          ▲ write-back via approval           │
│         ▼                     │                                   │
├─────────────────────────────────────────────────────────────────┤
│                    GAME MODES LAYER                               │
│                                                                   │
│  PM-TÆTTE (write-back):           STANDALONE (no write-back):    │
│  ├─ Planning Poker (estimates)    ├─ Scope Roulette (challenges) │
│  ├─ Sprint Draft (sprint plan)    ├─ Speed Scope (learning)      │
│  ├─ Spec Wars (acceptance crit)   └─ Boss Battle Retro*          │
│  ├─ Perspektiv-Poker (risk)          (* promotes tasks via       │
│  ├─ Bluff Poker (estimates)            separate approval)        │
│  └─ Russian Nesting (sub-items)                                  │
│                                                                   │
│         ↕ Supabase Realtime (presence, votes, submissions)       │
├─────────────────────────────────────────────────────────────────┤
│                    SUPABASE (Single Source of Truth)               │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │
│  │ PM Data  │  │ Game Data│  │ Missions │  │ Edge Functions│     │
│  │──────────│  │──────────│  │──────────│  │──────────────│     │
│  │projects  │  │sessions  │  │missions  │  │jira-import   │     │
│  │sprints   │  │votes     │  │user_miss.│  │generate-miss.│     │
│  │session_  │  │spec_sub. │  │est_acc.  │  │evaluate-miss.│     │
│  │ items    │  │perspect. │  │          │  │finalize-*    │     │
│  │approval_ │  │bluff_*   │  │          │  │approve-mut.  │     │
│  │ requests │  │speed_est.│  │          │  │              │     │
│  │item_deps │  │scope_sub.│  │          │  │              │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘     │
│                                                                   │
│  RLS Policies    Realtime Channels    DB Triggers (pg_net)       │
└─────────────────────────────────────────────────────────────────┘
```

### Sync vs. Async flows

| Flow | Type | Beskrivelse |
|------|------|-------------|
| Vote submission | **Sync** | Spiller voter → INSERT votes → Realtime broadcast til alle |
| Spec submission | **Sync** | Spiller skriver spec → INSERT spec_submissions → Realtime |
| Bluff guess | **Sync** | Spiller gætter → INSERT bluff_guesses → Realtime |
| Mission progress | **Async** | Item ændring → DB trigger → pg_net → evaluate-mission Edge Fn |
| Write-back (approval) | **Async** | GM finalizerer → approval request → PM reviewer → approve → apply |
| Jira import | **Async** | OAuth → Edge Function → batch insert → progress callback |
| Sprint Report Card | **Async** | Sprint close → beregn metrics → generer report |
| Mission generation | **Async** | Dashboard load → Edge Function → evaluér tilstand → cache 1t |

### Data flow principper

1. **PM-data → Game:** Altid READ. Game modes læser items, sprints, estimates. Aldrig direkte mutation.
2. **Game → PM-data:** Altid via APPROVAL. Game producerer resultater → approval_request → PM godkender → apply pipeline muterer PM-data.
3. **Game ↔ Game:** SYNC via Realtime. Votes, submissions, guesses synces live via Supabase Realtime channels.
4. **Missions:** ASYNC evaluation. DB triggers → Edge Functions. Dashboard polling med 1-time cache.
5. **Import:** ASYNC batch. Jira/CSV → Edge Function → bulk INSERT med progress tracking.

---

## Effort-estimat

| Sprint | Dage | Highlights |
|--------|------|-----------|
| Sprint A | 10 | Jira import (4d), Excel forbedret (2d), Unplanned (1.5d), Missions DB+engine (2.5d) |
| Sprint B | 10 | Mission tracking (2d), Report Card (1.5d), XP/badges (1d), Spec Wars (3d), Perspektiv-Poker (2.5d) |
| Sprint C | 10 | Bluff Poker (3d), Russian Nesting (4d), Speed Scope (2d), Polish (1d) |
| **Total** | **30 dage** | ~6 uger med 1 dev, ~3 uger med 2 devs + AI-assist |

---

## Dependencies og rækkefølge

```
Sprint A ──────────────────────────┐
  A1 Jira Import ─────────────┐   │
  A2 Excel Import ─────────┐  │   │
  A3 Unplanned Work ────┐  │  │   │
  A4 Missions DB ────────┼──┼──┼───┤
                         │  │  │   │
Sprint B ────────────────┼──┼──┼───┤
  B1 Mission Tracking ◄─┘  │  │   │  (kræver A4)
  B2 Report Card ◄─────────┘  │   │  (kræver A3 unplanned metrics)
  B3 XP/Badges ◄───────────┐  │   │
  B4 Spec Wars ─────────────┼──┘   │  (bruger import-data til test)
  B5 Perspektiv-Poker ──────┘      │
                                   │
Sprint C ──────────────────────────┘
  C1 Bluff Poker                      (uafhængig)
  C2 Russian Nesting ◄── A4           (kræver parent_item_id mønster)
  C3 Speed Scope                      (uafhængig)
  C4 Polish                           (kræver C1-C3)
```

**Kritisk path:** A4 (Missions DB) → B1 (Mission Tracking) → B3 (XP/Badges)

**Paralleliserbare:** A1+A2 (import), A3 (unplanned), B4+B5 (nye game modes), C1+C2+C3 (alle nye modes)

---

*Dokumentet er klar til Danny review. Alle tekniske specifikationer er konkrete nok til at en coding agent kan implementere direkte fra dette dokument.*
