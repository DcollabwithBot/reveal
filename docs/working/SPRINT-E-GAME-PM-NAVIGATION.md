# Reveal — Sprint D: Game ↔ PM Navigation & Discoverability

**Dato:** 2026-03-21
**Status:** Spec — klar til implementation efter Sprint B+C
**Forfatter:** Danny + James

---

## Kerneproblemet

Reveal har game modes og PM board — men brugeren ved ikke:
- Hvilke spil er tilgængelige fra World Map?
- Hvornår giver hvert spil mening at starte?
- Hvordan starter man et spil fra PM-boardet?
- Kan man skifte spil mens man er i gang?
- Hvad sker der med estimater/data når et sprint/projekt/task oprettes?

Sprint D løser navigation og kontekstklarhed.

---

## Leverancer

### D1. World Map — Game Availability State

**Problem:** World Map viser altid alle spil. Der er ingen indikation af:
- Om spillet er tilgængeligt (kræver aktiv sprint? aktive items?)
- Om spillet er relevant nu (fx Retro er kun relevant efter sprint close)
- Om spillet allerede er spillet denne sprint

**Løsning:**
- Hvert game node på World Map har en availability state:
  - `available` — grøn, klar til at starte
  - `recommended` — pulserende glow, kontekstuelt anbefalet (fx "Sprint slutter fredag")
  - `locked` — grå med lock icon + tooltip: "Kræver aktiv sprint med estimerede items"
  - `completed` — checkmark, allerede kørt denne sprint/periode
- Availability beregnes runtime ud fra:
  - Er der en aktiv sprint? (Planning Poker, Spec Wars, Perspektiv-Poker)
  - Er sprintet lukket? (Boss Battle Retro)
  - Er der items uden acceptance criteria? (Spec Wars)
  - Er der items med store estimate-gaps? (Perspektiv-Poker)

**UI:**
- Tooltip ved hover: "Anbefalet fordi: 3 items mangler estimate" / "Låst: Ingen aktiv sprint"
- Completed badge: "Sidst spillet: mandag" med lille trophy icon

---

### D2. Start Spil fra PM Board

**Problem:** Man skal navigere til World Map for at starte et spil. Der er ingen kontekstuelt link fra PM-boardet.

**Løsning — entry points fra PM board:**

**Sprint header (ProjectWorkspace):**
```
[⚔ Estimer sprint]  [🎭 Spec Wars]  [📊 Perspektiv-Poker]  [▼ Alle spil]
```
- Primære CTA'er: de mest relevante spil for konteksten
- "▼ Alle spil" dropdown: viser alle game modes med availability state

**Item context menu (højreklik / ⋮ menu):**
```
├── Estimer dette item (Planning Poker)
├── Skriv spec (Spec Wars)
├── Perspektiv-check
└── Tilføj til session...
```

**Dashboard — Sprint card:**
```
Sprint: "Kombit WiFi Sprint 13"
[⚔ Start session]  [📋 Se backlog]
Status: 3 items uden estimate — [Estimer nu →]
```

---

### D3. Skift Spil Undervejs

**Problem:** Hvis man starter Planning Poker og finder ud af man vil have Perspektiv-Poker i stedet, er der ingen graceful exit.

**Løsning:**
- "Skift spil" knap i session header (vises efter lobby, før items er estimeret)
- Confirmation: "Afbryd denne session? Data fra lobby gemmes."
- Redirect til World Map med pre-selected items

**Regler:**
- Kan kun skifte FØR første item er estimeret (revealeret)
- Efter første reveal: "Du har estimater i gang — afslut eller gem som kladde"
- Draft session: gemmes som `status='draft'` i sessions tabel

---

### D4. Game Context ved Oprettelse

**Problem:** Når man opretter sprint/task/projekt er der ingen kobling til game. Brugeren ved ikke hvilke game modes der aktiveres, eller hvilke felter der er nødvendige.

**Løsning — "Game readiness" hints ved oprettelse:**

**Sprint oprettelse:**
- Tjekker: har items estimater? → "Planning Poker anbefales inden sprint start"
- Tjekker: har items acceptance criteria? → "Spec Wars kan hjælpe med kravspecifikation"
- Vises som ikke-blokerende hints (grøn info-box, kan ignoreres)

**Task/item oprettelse:**
- Mini-checklist under description-feltet:
  - `[ ] Acceptance criteria` — "Kræves af Spec Wars"
  - `[ ] Estimate` — "Kan sættes via Planning Poker"
  - `[ ] Assigned to` — "Kræves for Perspektiv-Poker perspektiv-tildeling"
- Felterne er valgfrie — hintet er vejledende, ikke blokerende

**Projekt oprettelse:**
- "Game mode preset" valg (valgfrit):
  - Standard: Planning Poker + Boss Battle Retro
  - Full game: alle modes aktiverede
  - Lean: kun Planning Poker
- Preset gemmes på projektet, præ-fylder World Map availability

---

### D5. Game ↔ PM Data Flow Visibility

**Problem:** Brugeren ved ikke hvad der sker med data efter et spil. Går estimater automatisk ind i PM? Hvad kræver approval?

**Løsning — "What happens after?" info-panel:**

Vises i session setup (step 1 - GM konfigurerer):
```
📊 Data fra denne session
┌─────────────────────────────────────┐
│ Estimater → session_items           │
│ Kræver godkendelse: Ja / Nej        │
│ Acceptance criteria → items         │
│ Kræver godkendelse: Ja              │
└─────────────────────────────────────┘
```

**Approval flow transparency:**
- Efter session: "2 resultater afventer godkendelse" — link til approval queue
- Approval queue i Dashboard: samlet oversigt over hvad der venter
- GM kan bulk-approve fra ét sted

---

## SQL (nyt)

```sql
-- Game availability cache (refreshes ved session/sprint events)
CREATE TABLE game_availability (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  sprint_id       uuid REFERENCES sprints(id),
  session_type    text NOT NULL,
  state           text NOT NULL CHECK (state IN ('available','recommended','locked','completed')),
  reason          text,
  last_played_at  timestamptz,
  updated_at      timestamptz DEFAULT now()
);

-- Session draft (til "skift spil" flow)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS draft_config jsonb;
  
-- Project game preset
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS game_preset text DEFAULT 'standard'
    CHECK (game_preset IN ('standard','full_game','lean'));
```

---

## Prioritering

| Leverance | Impact | Effort | Prioritet |
|-----------|--------|--------|-----------|
| D2: Start fra PM | Høj | Lav | 🔴 P1 |
| D1: World Map states | Høj | Medium | 🔴 P1 |
| D4: Context ved oprettelse | Medium | Lav | 🟡 P2 |
| D5: Data flow visibility | Medium | Medium | 🟡 P2 |
| D3: Skift spil | Lav | Medium | 🟢 P3 |

**Anbefaling:** Start med D2 + D1 — de løser den største friktion.

---

---

### D6. Privat/Hemmelig Projektstatus (Mission Shield)

**Problem:** Ikke alle projekter må dukke op i Daily Missions eller Side Quests. Fortrolige projekter, interne HR-sager, compliance-arbejde — dem vil man ikke have blinkende på World Map.

**Løsning:**
- Projekt-flag: `visibility` på projects tabel
  - `public` (default) — vises i missions, side quests, leaderboard
  - `private` — skjult fra alle game surfaces. Kun PM-board. Ingen missions, ingen quests, ingen achievements baseret på dette projekt
  - `restricted` — vises for teammedlemmer men ikke i org-wide leaderboard/missions

- Sprint-flag: samme `visibility` felt på sprints (arver fra projekt, kan overrides)

- UI i projekt-indstillinger:
  ```
  🔒 Projektsynlighed
  ○ Åben — vises i missions og leaderboard
  ● Privat — skjult fra game surfaces
  ○ Begrænset — kun for teammedlemmer
  ```

- Game engine: evaluate-mission Edge Function checker visibility FØR den tæller progress
- Side quest generator: filtrerer private projekter fra

**SQL:**
```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public'
    CHECK (visibility IN ('public', 'private', 'restricted'));

ALTER TABLE sprints
  ADD COLUMN IF NOT EXISTS visibility text -- NULL = arv fra projekt
    CHECK (visibility IN ('public', 'private', 'restricted'));
```

---

### D7. Audit Log — Hvem gjorde hvad

**Problem:** Der er ingen sporbarhed. Hvem spillede hvad? Hvem godkendte hvilke estimater? Hvem ændrede et felt? Compliance og governance kræver dette — især i enterprise.

**Løsning — Reveal Audit Trail:**

**Hvad logges:**
- Session events: start, join, vote, reveal, complete
- Approval events: request, approve, reject (med hvem + tidspunkt)
- PM write-backs: hvad blev skrevet, af hvilken session, godkendt af hvem
- Field changes: old value → new value, source (game/manual/import)
- Mission/quest completions: hvem, hvornår, hvilken session
- Visibility changes: hvem ændrede projektet til privat

**Ny tabel:**
```sql
CREATE TABLE audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  actor_id        uuid REFERENCES profiles(id), -- NULL = system
  session_id      uuid REFERENCES sessions(id),
  entity_type     text NOT NULL, -- 'session', 'item', 'sprint', 'project', 'approval', 'mission'
  entity_id       uuid NOT NULL,
  action          text NOT NULL, -- 'created', 'voted', 'approved', 'rejected', 'field_updated', 'game_completed'
  metadata        jsonb,         -- { field: 'final_estimate', old: 5, new: 8, source: 'planning_poker' }
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_org ON audit_log(organization_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_session ON audit_log(session_id);
```

**UI — Audit view:**
- Dashboard → "Aktivitetslog" tab (kun admin/GM)
- Filter: per bruger / per session-type / per projekt / dato-range
- Export: CSV (compliance)
- Timeline view: kronologisk feed med ikoner per action-type

**Session audit sidebar:**
- I session-resultater: "Hvem stemte hvad" (anonymiseret under session, fuld efter reveal)
- GM-only: se individuelle votes + tidspunkter

---

### D8. Governance — Permissions & Approval Chain

**Problem:** Nuværende approval er binær (GM godkender/afviser). Enterprise vil have approval chains, delegation og audit trail på approvals specifikt.

**Løsning:**
- Approval chain på projekt-niveau:
  - `single` (default): GM godkender direkte
  - `chain`: GM → Product Owner → evt. Stakeholder
- Delegation: GM kan delegere approval til specifik person
- Timeout policy: "Ingen svar i 48t → auto-approve / auto-reject / eskalér"
- Approval history: fuld trail på hvert approval-objekt

**SQL:**
```sql
ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS chain_step    int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chain_total   int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS delegated_to  uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS timeout_hours int DEFAULT 72,
  ADD COLUMN IF NOT EXISTS timeout_action text DEFAULT 'escalate'
    CHECK (timeout_action IN ('auto_approve', 'auto_reject', 'escalate'));
```

---

## Prioritering (opdateret)

| Leverance | Impact | Effort | Prioritet |
|-----------|--------|--------|-----------|
| D2: Start fra PM | Høj | Lav | 🔴 P1 |
| D1: World Map states | Høj | Medium | 🔴 P1 |
| D6: Privat projekt (Mission Shield) | Høj | Lav | 🔴 P1 |
| D7: Audit Log | Høj | Medium | 🔴 P1 |
| D4: Context ved oprettelse | Medium | Lav | 🟡 P2 |
| D5: Data flow visibility | Medium | Medium | 🟡 P2 |
| D8: Governance/approval chain | Medium | Høj | 🟡 P2 |
| D12: Bidirektionel sync verifikation | Høj | Medium | 🔴 P1 |
| D3: Skift spil | Lav | Medium | 🟢 P3 |

---

---

### D12. Bidirektionel Sync — PM ↔ Game verifikation

**Problem:** Data flyder fra game → PM via approval. Men hvad med den anden retning? Hvis nogen opdaterer et estimate direkte i PM-boardet, ved game-laget det? Og omvendt — ved PM-laget hvad game har gjort?

**Hvad der skal verificeres og fixes:**

**PM → Game (manglende i dag):**
- Hvis `session_items.final_estimate` opdateres manuelt i PM → skal eksisterende session-cards refreshe
- Hvis item slettes i PM midt i en session → graceful handling (ikke crash)
- Hvis sprint lukkes i PM mens session kører → session skal notificeres

**Game → PM (eksisterer, men skal audites):**
- Planning Poker write-back via approval → verificér at `final_estimate` + `estimated_hours` faktisk lander
- Spec Wars write-back af `acceptance_criteria` → verificér
- Perspektiv-Poker write-back af `risk_notes` → verificér
- Retro write-back af action items → verificér kæden (retro_actions → approval → PM task)

**Implementering:**
- Supabase Realtime subscription i game-screens på relevante tabeller (session_items, sessions, sprints)
- Game opdaterer live ved PM-ændringer uden reload
- Conflict detection: hvis PM og game har forskellig version af samme felt → vis conflict banner i session

**Ny sync-status indikator i session header:**
```
🟢 Synkroniseret med PM  |  🟡 Venter på godkendelse (2)  |  🔴 Sync-konflikt
```

**SQL:**
```sql
-- Track sync state per felt
CREATE TABLE field_sync_state (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  field_name      text NOT NULL,
  game_value      jsonb,
  pm_value        jsonb,
  sync_status     text DEFAULT 'synced'
    CHECK (sync_status IN ('synced', 'pending_approval', 'conflict', 'game_ahead', 'pm_ahead')),
  last_game_write timestamptz,
  last_pm_write   timestamptz,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(entity_type, entity_id, field_name)
);
```

**Test-suite:**
- Automated smoke tests for alle write-back paths (kørbar fra CLI)
- Dokumenteret i `docs/testing/sync-verification.md`

---

## James' egne tilføjelser til Sprint D

Ting der ikke er nævnt men som naturligt hører hjemme her:

**D9. Game History per bruger**
Ingen kan i dag se "alle sessions jeg har deltaget i" eller "min personlige game statistik over tid". En `/profile/history` side med session-liste, XP-kurve, win rate og achievement timeline ville lukke en åbenlys loop.

**D10. World Map kontekstualisering per sprint**
World Map er statisk. Den burde vide hvilken sprint du er i, og fremhæve spil der er relevante *nu*. "Sprint slutter om 3 dage → Boss Battle Retro anbefales." Dette hænger sammen med D1 men er en selvstændig feature.

**D11. Notifikationer ved game-events**
Ingen notifikationer ved: "Din session er klar", "Nogen har stemt", "Din spec vandt Spec Wars", "Mission completed". In-app notification bell eksisterer (sprint 8) — men game-events trigger den ikke. Koble dem.

---

## Åbne spørgsmål til Danny

1. Skal "Skift spil" (D3) gemme draft-session, eller bare smide data?
2. Er "Game readiness hints" (D4) velkomne i oprettelsesflow, eller for meget støj?
3. Skal World Map vise "Sidst spillet: X dage siden" — eller holder det for meget PM-track?
4. Audit log: skal individuelle votes være synlige for GM live under session, eller kun efter reveal?
5. Privat projekt: skal det også skjule projektet fra andre teammedlemmers PM-board, eller kun fra game surfaces?
6. Approval chain (D8): er dette relevant nu, eller er det enterprise-feature der kan vente til pilot-feedback?
