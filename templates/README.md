# Reveal Templates — Import Guide (Spec Phase)

Denne mappe indeholder seed-ready template artifacts til Reveal.

## Files
- `KOMBIT-WIFI7-TEMPLATE.md` — human-readable canonical template
- `kombit-wifi7-template.project.json` — project-level seed payload
- `kombit-wifi7-template.backlog.json` — backlog/session item seed payload

## Intended load flow (når implementation starter)
1. Opret projekt i Reveal med payload fra `*.project.json`
2. Opret/seed sprints fra `project.sprints`
3. Importér backlog items fra `*.backlog.json`
4. Map felter til Reveal datamodel:
   - `assigneeId`, `deadline`, `estimatePoints`, `status`, `priority`, `labels`
   - `riskTags`, `riskLevel`, `blocked*`
   - gamificationfelter: `xpValue`, `achievementTags`, `pressureContribution`
5. Kør post-import validering:
   - alle dependencies peger på eksisterende task IDs
   - sprint IDs matcher oprettede sprints
   - status/enum values matcher Reveal allowed values

## Notes
- Dette er spec/template artifacts, ikke runtime-kode.
- Justér datoer, assignees og budgetparametre før kundespecifik seed.
