# Reveal Template ID Registry

> **Purpose:** Prevent seed overlap between templates. Every template must claim a unique ID prefix here before use. No two templates may share a prefix.

---

## Registry

| Prefix | Range | Template Key | Template File | Description |
|--------|-------|-------------|---------------|-------------|
| `KB-WIFI7-` | KB-WIFI7-001 → KB-WIFI7-999 | `kombit-wifi7-default` | `kombit-wifi7-template.backlog.json` | Enterprise WiFi 7 rollout (Kombit) |
| `NS-` | NS-001 → NS-999 | `nyscan-default` | `nyscan-template.backlog.json` | IT asset scanning & inventory |

---

## Rules

1. **Claim before use.** Add your prefix to this registry *before* creating the template — not after.
2. **Prefix must be unique.** No two templates may use the same prefix. If in doubt, pick a longer prefix.
3. **Range is reserved.** Even if only NS-001–NS-013 exist today, the full `NS-001 → NS-999` range belongs to Nyscan. Do not use `NS-` in other templates.
4. **No numeric-only IDs.** Prefixes must be alphabetic or alphanumeric — never just numbers. This avoids cross-template collision in imports.
5. **Seed files must match.** Every `id` field in a `*.backlog.json` must start with the registered prefix for that `templateKey`.
6. **Breaking changes require registry update.** If you rename a prefix (migration), update this table and add a deprecation note below.

---

## Prefix Naming Convention

```
<SHORT-PROJECT-CODE>-[SUBTYPE-]NNN
```

Examples:
- `KB-WIFI7-001` = Kombit / WiFi7 project / item 1
- `NS-001`       = Nyscan / item 1
- `PROJ-ALPHA-001` = Hypothetical project "Alpha"

Recommended prefix length: **2–10 chars** before the numeric suffix. Short = readable. Long = unambiguous.

---

## Prefix Availability Check

Before registering a new prefix, verify no collision exists:

```bash
# Search all template backlogs for a prefix
grep -r '"id": "YOURPREFIX-' /path/to/templates/
```

If nothing matches: prefix is free. Add it here.

---

## Deprecation Log

_No deprecated prefixes yet._

---

## Version

| Field | Value |
|-------|-------|
| Registry version | 1.0.0 |
| Created | 2026-03-21 |
| Last updated | 2026-03-21 |
| Maintained by | Reveal core team |
