# Reveal — Næste Features (fra ARCHITECTURE.md gap)

**Oprettet:** 2026-03-21
**Status:** Klar til implementering — tech debt er ryddet

---

## 1. SessionLaunchModal item-selektion (HØJESTE PRIORITET)

**Problem:** Spillet starter uden PM-kontekst. Ingen items valgt → output kan ikke kobles til konkrete backlog items.

**Fil:** `app/src/components/discovery/SessionLaunchModal.jsx`

**Hvad der skal bygges:**
- Vis aktiv sprint + backlog-items fra det valgte projekt
- Bruger vælger 1-N items til sessionen (checkboxes/multi-select)
- Valgte items sendes med når session oprettes i DB
- I spillet: items køres igennem én ad gangen

**DB:** `sessions` har allerede `project_id`. Items kobles via `session_items.session_id`.

---

## 2. GM Approval-flow UI

**Problem:** DB-logik for approval eksisterer (approval_requests, approve-mutation Edge Function). UI mangler.

**Fil:** `app/src/screens/ProjectWorkspace.jsx` (ny sektion/tab)

**Hvad der skal bygges:**
- "Pending Approvals" sektion i ProjectWorkspace
- Viser: session output (estimater, risk scores, action items) der venter på GM godkendelse
- Per item: "Godkend" / "Afvis" knapper
- Ved godkendelse: `session_items.estimate` opdateres (via approve-mutation Edge Function)
- Badge/notification når der er pending approvals

**DB:** `approval_requests` tabel + `approve-mutation` Edge Function eksisterer allerede.

---

## 3. Session-log i ProjectWorkspace

**Problem:** Ingen synlig historik over sessions kørt på et projekt.

**Fil:** `app/src/screens/ProjectWorkspace.jsx` (ny "Sessions" tab)

**Hvad der skal bygges:**
- "Sessions" tab i ProjectWorkspace
- Tabel/liste med: dato, mode, hvem deltog, antal items, summary
- Klik på session → detaljer (votes, estimater, achievements)
- Filtrering på mode, dato, deltager

**DB:** `sessions` tabel har allerede: project_id, game_mode, created_by, status, completed_at, items_covered, participants, summary.

---

## Implementeringsplan

- **Agent 1:** Item-selektion → SessionLaunchModal.jsx (separat fil, ingen konflikter)
- **Agent 2:** GM approval + Session-log → ProjectWorkspace.jsx (begge rører samme fil, én agent)

Kan køres parallelt — forskellige filer.

---

## Også relevant (lavere prioritet)

- Sprint velocity i KPI Dashboard (efter session → opdatér metrics)
- Projekt-fetch fix (WorldSelect "Ingen projekter" hvis org_id mismatch)
