# Sprint 4 Summary — Reveal

> Genereret: 2026-03-18  
> Agent: Subagent (senior SaaS-arkitekt)

---

## TL;DR
Sprint 4 er ambitiøs men realistisk struktureret. MVP-definitionen er klar: GM opretter session → team joiner → realtime Planning Poker → resultater. Det absolutte minimum for "rigtig multiplayer" er ca. 60% af planens indhold. Resten er nice-to-have der hører til Sprint 5.

---

## MVP Scope — Hvad bygges i Sprint 4

### Absolut minimum for "rigtig multiplayer":
1. **Auth** — Google OAuth + magic link → profil oprettes automatisk i `profiles`
2. **Session oprettelse** — GM opretter session med navn + items → `sessions` table
3. **Join flow** — Spiller joiner via `join_code` → `session_participants` insert
4. **Realtime sync** — Supabase Realtime channel `session:{id}` → presence + state events
5. **Vote flow** — Spiller stemmer → `votes` insert → GM ser live fordeling
6. **Reveal** — GM revealer → alle ser stemmer → GM sætter `final_estimate`
7. **Session summary** — Status → `completed` → liste over items + estimater

### Skæres til realistisk v1 (gøres simpelt):
- Ét org automatisk ved signup (ingen wizard i Sprint 4)
- Ét team per org ved start (ingen team-management UI)
- Ingen roles enforcement i UI (kun DB + RLS)
- Ingen XP/achievements i Sprint 4 (DB er klar, logik venter)
- Ingen overworld/nodes i Sprint 4

---

## 3 Vigtigste Beslutninger FØR Kode

### 1. Multi-tenant fra dag 1 eller later?
**Anbefaling: Minimal multi-tenancy fra dag 1.**
DB-schema er multi-tenant (organizations → teams → sessions). Men onboarding i Sprint 4 = auto-opret 1 org + 1 team ved første login. Ingen org-management UI. Reducerer kompleksitet massivt.

### 2. Realtime: Supabase Realtime vs. Socket.io?
**Anbefaling: Supabase Realtime + polling fallback.**
Supabase Realtime er built-in, ingen extra infra. Polling fallback (3s) som safety net. Ikke Socket.io — kræver persistent server som cPanel ikke understøtter godt.

### 3. Server-side eller client-side auth checks?
**Anbefaling: Supabase RLS + service_role i server.**
Client bruger `ANON_KEY` + JWT. Server bruger `SERVICE_ROLE_KEY` til admin-operationer (reveal votes, session state). RLS håndterer row-level sikkerhed automatisk.

---

## Hvad der er OVERAMBITIOUS i Sprint 4

| Feature | Problem | Anbefaling |
|---------|---------|------------|
| Org onboarding wizard (4 trin) | For kompleks til Sprint 4 | Auto-opret org ved signup |
| Custom challenges UI | Ingen brugere endnu | Sprint 5 |
| Session templates | For tidligt | Sprint 6 |
| Co-GM fallback logik | Edge case | Sprint 5 |
| Observer/viewer rolle | Nice-to-have | Sprint 5 |
| Realtime disconnect UI (detailed) | Kan simplificeres | Simpel "reconnecting..." i Sprint 4 |
| Session crash recovery | Vigtig men kompleks | Simpel `state_snapshot` i Sprint 4, fuld recovery i Sprint 5 |
| XP + achievements logik | DB er klar | Logik i Sprint 5 |
| Overworld node completion | For meget | Sprint 5 |
| Velocity tracking | Ingen historik endnu | Sprint 5 |
| CSV export | Valgfrit | Sprint 4 low priority |
| GDPR data export UI | Post-MVP | Post-MVP |

---

## Sprint 5+ Backlog

**Sprint 5 (Persistence & Polish):**
- XP-beregning ved session-afslutning
- Achievement unlock + display
- Overworld node-completion
- Team velocity tracking
- Custom challenges UI (org-level)
- Co-GM / session takeover logik
- Observer rolle (join via `observer_join_code`)

**Sprint 6:**
- Session templates (gem + genbruge setup)
- Slack/Teams webhook skeleton
- Onboarding wizard (proper)
- Admin dashboard (org-level)

**Sprint 10+:**
- Jira / Azure DevOps import
- Billing/Stripe integration

**Post-MVP:**
- AI lifelines (item-formulering, duplikat-detektion)
- SSO (Enterprise)
- GDPR data export UI

---

## Database Migration Status

✅ **Alle MVP-tabeller oprettet** på Supabase projekt `swyfcathwcdpgkirwihh` (reveal.ai)

| Tabel | Status | Kolonner |
|-------|--------|----------|
| `organizations` | ✅ OK | 12 |
| `organization_members` | ✅ OK | 6 |
| `profiles` | ✅ OK | 14 |
| `teams` | ✅ OK | 9 |
| `team_members` | ✅ OK | 5 |
| `sessions` | ✅ OK | 21 |
| `session_participants` | ✅ OK | 7 |
| `session_items` | ✅ OK | 11 |
| `votes` | ✅ OK | 8 |

**RLS:** Aktiveret på alle tabeller. Policies oprettet.

**Ikke migreret (sprint 5+):**
- `achievements`, `user_achievements`
- `worlds`, `world_nodes`, `node_completions`
- `custom_challenges`, `custom_events`
- `session_templates`
- `audit_log`
- `rooms`

---

## Backend Status

✅ `server/app.js` oprettet — Express + Supabase skeleton  
✅ `server/package.json` med express + @supabase/supabase-js  
✅ Synced til Nordicway: `~/reveal.blichert.net/`

**Mangler (næste skridt):**
- `npm install` på Nordicway
- `.env` fil med prod-credentials på serveren
- cPanel Node.js app konfiguration (peger på `app.js`, env vars sat)
- Frontend build pipeline (`npm run build` i `/app/`)

---

## Næste Konkrete Skridt (prioriteret)

1. **Google OAuth opsætning** i Supabase Dashboard → Authorized redirect URIs
2. **Frontend auth integration** — Supabase client i React app med session-handling
3. **`npm install`** på Nordicway + cPanel Node.js app restart
4. **Realtime PoC** — to browsere, én kanal, bevis det virker
5. **Session oprettelse flow** — minimal UI: navn + items → generer join_code
6. **Join flow** — `/play/:code` → session_participants insert + presence
7. **Vote + reveal** — core gameplay loop
