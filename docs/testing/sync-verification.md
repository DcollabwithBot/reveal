# Reveal — Bidirektionel Sync Verifikation (Sprint E12)

**Dato:** 2026-03-21  
**Status:** Implementeret

---

## Arkitektur

```
PM Board (ProjectWorkspace) ←→ Game Sessions ←→ Supabase
                ↕                     ↕
         approval_requests      Realtime channels
                ↕                     ↕
           session_items          audit_log
```

## Write-back paths (Game → PM)

Alle writes fra game til PM sker via approval pattern — ingen direkte skrivning.

| Game Mode         | Felt              | Approval krævet | Edge Function         |
|-------------------|--------------------|-----------------|----------------------|
| Planning Poker    | final_estimate     | Ja (konfig.)    | approve-mutation      |
| Spec Wars         | acceptance_criteria| Ja              | finalize-spec-wars    |
| Perspektiv-Poker  | risk_notes         | Ja              | finalize-perspective  |
| Boss Battle Retro | retro_actions      | Valgfri         | promote-retro-action  |

### Verifikation: Planning Poker write-back

```bash
# Test flow:
# 1. Start estimation session for sprint
# 2. Vote + reveal
# 3. Submit to approval queue
# 4. Approve via Dashboard
# 5. Verify: session_items.final_estimate updated
```

**Smoke test (manuel):**
```sql
-- Check at final_estimate er sat efter godkendelse
SELECT id, title, final_estimate, estimated_hours
FROM session_items
WHERE sprint_id = '<sprint_id>'
  AND final_estimate IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
```

### Verifikation: Spec Wars write-back

```bash
# Test flow:
# 1. Start spec wars session
# 2. Submit spec
# 3. Approve via approval queue
# 4. Verify: session_items.acceptance_criteria updated
```

**Smoke test:**
```sql
SELECT id, title, acceptance_criteria
FROM session_items
WHERE acceptance_criteria IS NOT NULL
ORDER BY updated_at DESC LIMIT 5;
```

---

## Read paths (PM → Game)

### Supabase Realtime subscriptions (Session.jsx)

Implementeret i Sprint E — `Session.jsx` subscriberer på:

1. `session_items` (filter: sprint_id) — opdaterer sync status til `conflict` hvis PM ændrer et item under aktiv session
2. `approval_requests` — opdaterer sync status til `pending_approval` / `synced`

### Sync status indikator

```
🟢 Synkroniseret med PM
🟡 Venter på godkendelse (X)
🔴 Sync-konflikt — PM opdaterede item under session
```

Vises i session header (SessionChrome area).

---

## field_sync_state tabel

Tracks sync state per felt. Opdateres ved:
- Game write-back (approve-mutation edge function)
- PM direkte opdatering (via updateItem i api.js)

```sql
-- Tjek sync state
SELECT entity_type, entity_id, field_name, sync_status, last_game_write, last_pm_write
FROM field_sync_state
WHERE sync_status != 'synced'
ORDER BY updated_at DESC;
```

---

## Kendte begrænsninger (Sprint E)

- Realtime subscription i Session.jsx bruger `sprint_id` filter — kræver at sessions har `sprint_id` sat
- field_sync_state opdateres ikke automatisk endnu — kræver trigger eller explicit update i edge functions
- Conflict detection er advisory — blokerer ikke session flow

---

## Næste skridt

- [ ] Tilføj DB trigger der opdaterer `field_sync_state` ved `session_items` UPDATE
- [ ] Kobl `approve-mutation` edge function til at opdatere `field_sync_state.sync_status = 'synced'`  
- [ ] Automated integration test suite (Playwright)
