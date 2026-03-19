# KOMBIT – Nyt WiFi (WiFi 7) Canonical Reveal Template

Status: Template/spec artifact (ikke runtime-implementering)
Type: Enterprise PM + gamified execution template
Owner: Reveal Product Team

## 1) Project brief

KOMBIT ønsker et nyt, stabilt og fremtidssikret trådløst netværk på tværs af 2 bygninger og 7 etager. Løsningen skal håndtere høj klienttæthed, glaspartitioner/støjende RF-miljø og levere enterprise driftsegenskaber (monitorering, segmentering, sikkerhed, failover og dokumenteret acceptance).

Template-formål i Reveal:
- Give en standardiseret, genbrugelig projektstruktur
- Oversætte teknisk rollout til sprint-bar backlog + risikostyring
- Koble klassisk PM-tracking med gamification (XP, boss pressure, achievements)

## 2) Assumptions / constraints

Hard constraints (godkendt use-case):
- Budget: under 300.000 DKK (CAPEX + planlagte implementation services)
- Scope: 2 bygninger, samlet 7 etager
- RF-forhold: glasflader + støj/interferens forventes
- Vendor preference: Fortigate/Fortinet foretrækkes
- Teknologi: WiFi 7 AP’er + PoE++ switching

Planning assumptions:
- Eksisterende kabling kan genbruges delvist, men valideres i survey-fasen
- Change windows uden for peak-drift forventes tilgængelige
- IT + facilities kan allokere nødvendige stakeholders til beslutninger
- Security baseline (VLAN/NAC/firewall policy) afklares før pilot go-live

Out of scope (for denne template):
- Endelig hardware-procurementkontrakt
- Driftsaftale/SLA-forhandling med eksterne leverandører
- Runtime integration i Reveal app (dette er kun seed/spec artifacts)

## 3) Phased work breakdown

## Phase 0 — Discovery & baseline (Sprint 0)
Mål: Etablere fakta, scope og succeskriterier.
- Stakeholder kickoff + kravworkshop
- Site walkthrough (2 bygninger / 7 etager)
- Baseline målinger: coverage, throughput, roaming, client density
- Foreløbig risikoidentifikation + governance setup

Deliverables:
- Baseline report
- Kravkatalog v1
- Initial risk register

## Phase 1 — RF survey & low-level design (Sprint 1)
Mål: Design, kapacitetsplan og teknisk blueprint.
- Predictive RF design + on-site validation målinger
- AP placement forslag pr. etage
- PoE++ budgetering + switch uplink kapacitet
- Segmentering/VLAN/NAC model (inkl. guest/IoT/corp)

Deliverables:
- HLD/LLD netværksdesign
- AP/BOM draft
- Cutover principles

## Phase 2 — Pilot implementation (Sprint 2)
Mål: Verificere design i kontrolleret scope.
- Pilot zone deployment (repræsentativ etage + glastunge områder)
- Fortigate policy og WLAN profiles
- Roaming + QoS + client onboarding tests
- Driftsovervågning og issue triage

Deliverables:
- Pilot test report
- Design corrections (delta-list)
- Go/No-go beslutningsnotat

## Phase 3 — Full rollout (Sprint 3–4)
Mål: Trinvis production rollout med minimal driftsforstyrrelse.
- Etagevis deployment plan
- Change windows + rollback playbooks
- Post-cutover verifikation pr. område
- Brugerkommunikation + hypercare setup

Deliverables:
- Etagevis as-built dokumentation
- Rollout sign-off per building
- Hypercare backlog

## Phase 4 — Stabilization & handover (Sprint 5)
Mål: Dokumenteret stabil drift + overdragelse.
- Performance soak tests
- Security validation / policy hardening
- Operations runbook + ownership mapping
- Endelig acceptance + projektluk

Deliverables:
- Runbook + as-built pack
- Acceptance sign-off
- Lessons learned / retro output

## 4) Risk register

Nedenstående inkluderer kendte bruger-risici + supplerende standardrisici:

1. Budgetoverskridelse pga. skjulte infrastrukturbehov  
   - Sandsynlighed: Medium, Impact: High  
   - Mitigation: tidlig kabel/switch audit, contingency-buffer, stage-gates før fuld indkøb

2. RF performance degradation (glas/interferens/støj)  
   - Sandsynlighed: High, Impact: High  
   - Mitigation: grundig survey + pilot i worst-case zoner, tuning iterationer

3. PoE++ kapacitetsmangel i eksisterende switching  
   - Sandsynlighed: Medium, Impact: High  
   - Mitigation: power budget validering pr. switchstack, phased replacement plan

4. Leveranceforsinkelser på WiFi 7 hardware  
   - Sandsynlighed: Medium, Impact: Medium/High  
   - Mitigation: alternativ BOM, tidlig ordreplacering, buffer i rollout-plan

5. Fortigate policy complexity skaber forsinkelse  
   - Sandsynlighed: Medium, Impact: Medium  
   - Mitigation: pre-approved policy templates, security sign-off checkpoint

6. Utilstrækkelige change windows / driftsforstyrrelser  
   - Sandsynlighed: Medium, Impact: High  
   - Mitigation: fast change-kalender, rollback rehearsal, hypercare bemanding

7. Stakeholder alignment glider mellem IT/facilities/business  
   - Sandsynlighed: Medium, Impact: Medium  
   - Mitigation: ugentligt steering ritual, tydelig RACI, beslutningslog

8. Underestimeret klienttæthed / roaming-krav  
   - Sandsynlighed: Medium, Impact: High  
   - Mitigation: capacity tests ved peak, acceptance thresholds på concurrency

9. Security compliance gap (segmentering/NAC/logning)  
   - Sandsynlighed: Low/Medium, Impact: High  
   - Mitigation: security checklist som DoD-gate før close

10. Dokumentation/overdragelse ikke komplet  
   - Sandsynlighed: Medium, Impact: Medium  
   - Mitigation: as-built template mandatory pr. etage + runbook review gate

## 5) Acceptance criteria + Definition of Done

## Acceptance criteria (project-level)
- Coverage: Stabil dækning på alle aftalte områder i 2 bygninger / 7 etager
- Performance: Throughput/latency/roaming opfylder aftalte KPI-grænser
- Capacity: WiFi 7 setup håndterer aftalt samtidige klienter uden kritiske drops
- Power/network: PoE++ + uplink kapacitet dokumenteret tilstrækkelig
- Security: Segmentering, policy enforcement og logging valideret
- Operations: Runbook + as-built + ownership godkendt af drift
- Business: Go-live uden kritiske P1/P2 åbne defects

## Definition of Done (for tasks/session items)
En item er Done når:
1. Acceptance criteria på task-niveau er opfyldt og testet
2. Assignee + reviewer har sign-off
3. Relevante labels/risk tags/status er opdateret i Reveal
4. Dokumentation er opdateret (design/as-built/runbook hvor relevant)
5. Eventuelle blockers er lukket eller formelt overdraget med owner+deadline

## 6) Gamification mapping (Reveal)

## Boss HP (Delivery Pressure)
- Boss: “Legacy RF Chaos”
- Baseline HP: 1000
- HP reduceres ved:
  - Lukkede High/Critical tasks med verificeret outcome
  - Nedbringelse af blocker-age
  - Opnåede sprint commitments
- HP øges ved:
  - Nye blocker events uden owner
  - Missede deadlines på Critical path
  - Reopened defects efter rollout

## XP mapping
- Standard task XP:
  - Low: 20 XP
  - Medium: 35 XP
  - High: 60 XP
  - Critical: 90 XP
- Bonus XP:
  - Risk retired (High): +40 XP
  - Zero-defect handover-pakke: +75 XP
  - Sprint commitment >= 90% achieved: +100 XP team bonus

## Achievement mapping (enterprise tone)
- “RF Pathfinder” — Survey + design validated uden major redesign
- “Power Guardian” — PoE++ budget valideret på alle switch-domæner
- “Change Window Samurai” — 3 cutovers i træk uden rollback
- “Zero-Reopen Shield” — Ingen reopened Critical tasks i en sprint
- “Handover Complete” — As-built + runbook + ownership fully signed off

## 7) Canonical template usage notes

- Denne template er default eksempel i Reveal V6 mockup docs.
- Kan seeds som project + backlog JSON payloads.
- Skal bruges som baseline og justeres per kunde (lokation, budget, compliance).


## 8) V2 technical risks and decision gates

Tilføjet i v2 (baseret på felt-input):

Nye tekniske risici
- SFP/SFP+ kompatibilitet (vendor/firmware/DOM).
- Fiber-type mismatch (single-mode vs multi-mode).
- Forkert optics distance/wavelength (SR/LR/BiDi).
- Uplink kapacitet (1G vs 10G/25G) og oversubscription.
- L3 redesign: routing i core vs firewall (asymmetrisk routing-risiko).
- DHCP migration (Windows 2016 -> NGFW) inkl. reservations/options/failover.
- DNS-afhængigheder ved DHCP-flyt.

Obligatoriske decision gates
1. L3 placement decision (før procurement).
2. DHCP ownership decision (før pilot).
3. Optics BOM validation (før PO).
4. Uplink baseline validation (før AP count freeze).

Udvidet DoD (v2)
- Optics matrix valideret og dokumenteret.
- Routing-path valideret (incl. policy og traceroute test).
- DHCP-migration testet i pilot-VLAN med rollback-plan.
- Gate-beslutninger logget med owner + dato.


## 9) V2.1 PM↔Game integration contract (praktisk drift)

Version: 1.2.0 (KOMBIT canonical)

Princip
- PM-data er source-of-truth.
- Game-engine læser PM-events og beregner XP, boss HP og pressure.
- Game skriver ikke direkte i PM-felter; den skriver kun signaler/anbefalinger.

Dataflow (praktisk)
1. PM opdaterer task (status, assignee, deadline, estimate, risk).
2. System emitter event (`task.completed`, `risk.closed`, `deadline.missed`, `blocker.opened`).
3. Game-regler evalueres og producerer game-state (XP, HP, achievements, pressure).
4. Hvis game foreslår ændring (fx rebalance sprint), oprettes en PM-anbefaling som kræver godkendelse.
5. Ved PM-godkendelse oprettes/ændres PM-objekter kontrolleret (audit trail).

Eksempel (Kombit)
- Task “PoE++ budget validering” sættes Done med DoD=true -> +60 XP, Boss HP -18.
- Ny blocker uden owner -> Boss HP +20 og Pressure +8.
- Risk “fiber-type mismatch” lukkes -> +40 XP, Boss HP -25, badge “Risk Slayer”.

Spille-regler knyttet til use-case
- Profile: `infra-rollout-boss-v1`
- Boss: `Legacy RF Chaos`
- Overlay default: OFF (PM-first), kan toggles ON i execution/sprint views.
- PM kan altid se game-signaler, men de er advisory indtil godkendelse.

Krav til felter (minimum)
- `status`, `priority`, `riskLevel`, `assignee`, `deadline`, `estimatePoints`, `blocked`

Succeskriterie for v2.1
- Ingen divergens mellem PM-boards og game-state (samme underliggende events).
- PM-team kan ignorere overlay og stadig køre projektet fuldt.
- Team der bruger gamification får højere fremdrifts-signal uden datatab.
