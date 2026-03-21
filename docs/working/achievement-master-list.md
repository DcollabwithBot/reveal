# Reveal — Achievement Master List

**Last updated:** Sprint D (2026-03-21)  
**Source:** supabase/migrations/sprint_b1_mission_engine.sql, sprint_c_game_modes.sql, sprint_d_achievements.sql

---

## Sprint B Achievements (sprint_b1_mission_engine.sql)

| Key | Name | XP | Mode | Icon | Description |
|-----|------|----|------|------|-------------|
| sniper_shot | Sniper Shot | 15 | estimation | 🎯 | Estimation within 15% of actual hours |
| oracle | Oracle | 20 | confidence | 🔮 | Confidence vote matched final outcome |
| risk_prophet | Risk Prophet | 25 | risk | ⚡ | Risk card prediction confirmed correct |
| spec_machine | Spec Machine | 20 | spec_wars | 📝 | Wrote winning acceptance criteria in Spec Wars |
| perspective_master | Perspective Master | 25 | perspective_poker | 🌐 | Closed a gap ≥3 in Perspektiv-Poker |

**Total Sprint B XP pool:** 105 XP across 5 achievements

---

## Sprint C Achievements (sprint_c_game_modes.sql)

| Key | Name | XP | Mode | Icon | Description |
|-----|------|----|------|------|-------------|
| master_bluffer | Master Bluffer | 50 | bluff_poker | 🃏 | Survived as bluffer 3 times without being caught |
| detective | Detective | 40 | bluff_poker | 🔍 | Correctly guessed the bluffer 5 times |
| poker_face | Poker Face | 30 | bluff_poker | 😐 | Estimated within ±1 of consensus while bluffing |
| archaeologist | Archaeologist | 45 | nesting_scope | ⛏️ | Found 3+ sub-items nobody else found |
| scope_slayer | Scope Slayer | 40 | nesting_scope | 🗡️ | Breakdown reduced total estimate by 20%+ |
| the_decomposer | The Decomposer | 60 | nesting_scope | 🧬 | Participated in 5 nesting scope sessions |
| speed_demon | Speed Demon | 35 | speed_scope | ⚡ | Estimated all items before timeout in speed round |
| hidden_complexity_hunter | Hidden Complexity Hunter | 40 | speed_scope | 🕵️ | Flagged 3+ items with large speed vs discussed delta |
| calibrated | Calibrated | 50 | speed_scope | 🎯 | Speed estimates matched discussed within ±1 for all |

**Total Sprint C XP pool:** 390 XP across 9 achievements

---

## Sprint D Achievements — NEW (sprint_d_achievements.sql)

| Key | Name | XP | Mode | Icon | Description |
|-----|------|----|------|------|-------------|
| perfect_fill | Perfect Fill | 50 | sprint_draft | 🎯 | Completed a sprint draft at exactly 100% capacity |
| retrospective_veteran | Retrospective Veteran | 75 | retro | 📋 | Participated in 10+ retrospectives (10+ notes) |

**Total Sprint D XP pool:** 125 XP across 2 achievements

---

## Grand Total

| Metric | Value |
|--------|-------|
| Total achievements | 16 |
| Total XP possible | 620 XP |
| Average XP per achievement | ~39 XP |
| Modes covered | 9 |

---

## Coverage by Mode

| Mode | Achievement Count | Max XP | Notes |
|------|-------------------|--------|-------|
| spec_wars | 1 | 20 | Under-represented |
| perspective_poker | 1 | 25 | Under-represented |
| bluff_poker | 3 | 120 | Well covered |
| nesting_scope | 3 | 145 | Well covered |
| speed_scope | 3 | 125 | Well covered |
| sprint_draft | 1 | 50 | New in Sprint D |
| retro | 1 | 75 | New in Sprint D |
| estimation | 1 | 15 | Under-represented |
| confidence/risk | 2 | 45 | Shared mode |

---

## Balance Analysis

### ⚠️ Potential Issues

1. **XP spread too wide** — Sniper Shot (15 XP) vs Retrospective Veteran (75 XP) is a 5× gap. Recommend bumping Sniper Shot to 25 XP in Sprint E.

2. **Icon collision** — `calibrated` and `perfect_fill` both use 🎯. Different keys/names so no technical conflict, but visually similar in achievement feed. Consider changing `perfect_fill` to 🏆.

3. **Icon collision** — `speed_demon` and `risk_prophet` both use ⚡. Minor visual collision in feeds.

4. **spec_wars and perspective_poker under-served** — only 1 achievement each vs 3 for bluff/nesting/speed modes. Sprint E should add 2+ achievements for each.

5. **estimation mode (Sniper Shot) requires external data** — needs actual tracked hours to compute. May be hard to trigger in practice. Consider adding easier estimation achievements.

### ✅ No Issues Found

- No duplicate keys
- All keys follow `snake_case` convention
- All modes have at least 1 achievement
- XP values are all multiples of 5

---

## DB Seeding Status

| Migration File | Status | Notes |
|----------------|--------|-------|
| sprint_b1_mission_engine.sql | ✅ Seeded | Uses `game_profiles` join pattern |
| sprint_c_game_modes.sql | ✅ Seeded | Uses `gen_random_uuid()` pattern |
| sprint_d_achievements.sql | ✅ Created | Uses `gen_random_uuid()` pattern — apply to DB |

> **Note:** `sprint_d_achievements.sql` was created in Sprint D and must be applied to the production database. The migration uses `ON CONFLICT (key) DO NOTHING` for safe re-runs.
