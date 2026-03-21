# Kerneværdi-audit — Reveal v3.1
**Dato:** 2026-03-21  
**Auditor:** James (subagent)  
**Scope:** Alle 7 game-screens auditeret mod Reveal's DNA

---

## DNA-reference
> "Reveal er ikke et spil. Det er et beslutningsværktøj forklædt som et."  
> "Spilmekanikker som metode — ikke som underholdning."

**5 kerneværdier:**
1. Gør usikkerhed synlig
2. Alle stemmer tæller
3. Feedback loop over tid
4. PM-data er source of truth
5. Beslutningstransparens

---

## Planning Poker (Session.jsx)

- **Formål klar:** ✅ Session-chrome viser "REVEAL!" ved kortvendt. Voting-flow er veldefineret med trin.
- **Usikkerhed synlig:** ✅ Spread-analyse vises ved reveal. Boss-HP-mekanik reflekterer estimeringskonflikt. Re-vote-flow eksisterer.
- **PM-kobling:** 🟡 Sync-status-indikatoren (synkroniseret/venter på godkendelse/konflikt) er tilstede — men vises som teknisk streng uden forklaring til brugeren. En ny bruger forstår ikke hvad "Synkroniseret med PM" betyder eller hvad PM er.
- **Alle aktive:** ✅ Timer + NPC-animationer + "ALLE KORT VENDES..." blokerer passiv observation.
- **Feedback loop:** 🟡 Combo + XP track individual performance, men der er ingen post-session "hvad lærte teamet?" opsummering. Ingen historisk tendens vises.
- **Kritiske findings:**
  - Sync-status mangler tooltipforklaring — hvad er "PM"? Hvad sker der med data?
  - Ingen eksplicit onboarding-tekst om formålet (men erfarne brugere ved godt hvad Planning Poker er)
- **Anbefalinger:**
  - Tilføj tooltip/forklaringstekst på sync-statusbaren: "Dine estimater sendes til projektets backlog efter GM-godkendelse"
  - Post-session: vis "Bedste estimator i dag: X" med historisk sammenligning

---

## Spec Wars (SpecWarsScreen.jsx)

- **Formål klar:** 🟡 Titlen "SPEC WARS" og "ITEM TO SPEC" er synlig i Step 1. Men *hvorfor* spillet eksisterer — at afdække spec-divergens — forklares ikke. Lobby har ingen intro-tekst om formål.
- **Usikkerhed synlig:** ✅ Anonymiserede submissions + stemmefase avslører divergens i forståelse. Excellent kerneværdi-alignment.
- **PM-kobling:** ❌ Ingen reference til hvad der sker med den vindende spec. Den "godkendes af GM" men brugeren ser ikke at den lagres i projektet eller sendes nogen steder.
- **Alle aktive:** ✅ Alle skriver acceptance criteria (3 min timer). Ingen kan sidde passivt.
- **Feedback loop:** 🟡 XP + loot givet, men ingen "hvad lærte vi om vores spec-divergens?" afsluttende analyse.
- **Kritiske findings:**
  - **KRITISK:** Lobby mangler formålstekst. Bruger forstår ikke hvad spillet løser.
  - **KRITISK:** Ingen PM-kobling synlig — "vindende spec" forsvinder ud i ingenting visuelt set.
- **Anbefalinger:**
  - Tilføj lobby-intro: "Spec Wars afslører hvem der forstår kravet forskelligt. Skriv acceptance criteria — den bedste spec vinder og gemmes til projektet."
  - Efter GM-godkendelse: vis "✅ Spec gemt til projekt" besked

---

## Perspective Poker (PerspectivePokerScreen.jsx)

- **Formål klar:** 🟡 Perspektiv-kortene (Customer/Support/Ops/Developer/Security/Business) er visuelt klare med ikoner og beskrivelser. Men *hvorfor* perspektivskift hjælper estimering — formålet — er ikke forklaret i lobby.
- **Usikkerhed synlig:** ✅ Gap-analyse (spread-diagram) er kernen i spillet og afdækker præcis perspektiv-drevne antagelser.
- **PM-kobling:** ❌ Re-vote → final estimate → GM approve. Men ingen besked om hvad der sker med estimaterne bagefter.
- **Alle aktive:** ✅ Alle tildeles perspektiv-kort og skal estimere. Ingen passive roller.
- **Feedback loop:** 🟡 Crown til winning perspective, men ingen historisk "hvilke perspektiver divergerer mest i vores team?"
- **Kritiske findings:**
  - Lobby mangler formålsforklaring
  - PM-kobling fraværende
- **Anbefalinger:**
  - Lobby-intro: "Du estimerer fra et bestemt perspektiv. Når alle reveals — ser vi hvor antagelserne divergerer."
  - Post-approve: "Estimat + perspektiv-data gemt til projektets historik"

---

## Bluff Poker (BluffPokerScreen.jsx)

- **Formål klar:** ❌ "BLUFF POKER" + lobbyen viser kun spillere og item. Ingen forklaring på *hvad spillet afslører* (at én spiller bevidst estimerer forkert, og teamet skal identificere hvem — dvs. øvelse i at kende hinandens estimeringsmønstre).
- **Usikkerhed synlig:** 🟡 Blufferen afsløres dramatisk, men koblingen til "hvad fortæller dette om vores estimeringsadfærd?" mangler.
- **PM-kobling:** ❌ Ingen reference til PM-data overhovedet. Estimaterne bruges til at finde blufferen — men ingen af data lagres eller refereres til PM.
- **Alle aktive:** ✅ Alle estimerer + alle gætter blufferen. Fuldt engagement.
- **Feedback loop:** ❌ Ingen. Spillet slutter med afsløringen — ingen analyse, ingen historik, ingen læring om teamets estimeringsmønstre.
- **Kritiske findings:**
  - **KRITISK:** Formål fuldstændig fraværende i UI. Ny bruger forstår ikke hvad de lærer.
  - **KRITISK:** Nul PM-kobling — data forsvinder i et vakuum.
  - **KRITISK:** Ingen feedback loop — spillet er underholdning uden læringsoutput.
- **Anbefalinger:**
  - Lobby-intro: "En spiller estimerer bevidst forkert. Find blufferen — og lær at kende dit teams estimeringsmønstre."
  - Post-game: vis estimeringsafvigelse for alle spillere + gem til historik
  - Overvej om BluffPoker er for underholdning-tung til Reveal's DNA

---

## Nesting Scope (NestingScopeScreen.jsx)

- **Formål klar:** 🟡 "What hides inside this scope?" er poetisk men ikke præcist. Matrjosjka-metaforen er stærk visuelt. Formålet (at afdække skjulte sub-tasks) forstås nok intuitivt af PM-folk.
- **Usikkerhed synlig:** ✅ Breakdown-fasen tvinger alle til at navngive hvad de *tror* er inde i scopet — afdækker antagelses-divergens effektivt.
- **PM-kobling:** 🟡 GM-merge-step eksisterer, men ingen eksplicit besked om at sub-tasks sendes til projektet.
- **Alle aktive:** ✅ Alle bryder ned (3 min timer). Submitted-count vises.
- **Feedback loop:** 🟡 Quick estimate + sum reveal giver feedback, men ingen historisk "vi undervurderer altid X-type stories".
- **Kritiske findings:**
  - Formålet er implicit — "What hides inside this scope?" er ikke nok for en første-gangs bruger
  - GM-merge mangler "data gemt" bekræftelse
- **Anbefalinger:**
  - Tilføj subtitle under "RUSSIAN NESTING SCOPE": "Find de skjulte opgaver alle har overset"
  - Efter GM-merge: "Sub-tasks tilføjet til projektet ✅"

---

## Speed Scope (SpeedScopeScreen.jsx)

- **Formål klar:** ✅ Lobby-tekst er Reveal's bedste: "Estimate fast. Reflect slow. Find hidden complexity." — præcis, formålsbeskrivende, klar.
- **Usikkerhed synlig:** ✅ Delta-analyse (speed vs. discussed) flagrer "Hidden Complexity" — direkte alignment med kerneværdi 1.
- **PM-kobling:** ❌ Ingen reference til PM-data i UI. Delta-analysen er intern — intet sendes til projektet.
- **Alle aktive:** ✅ 10-sek timer tvinger alle til at estimere. Ingen kan sidde passivt.
- **Feedback loop:** ✅ Velocity stats + leaderboard + delta-analyse giver meningsfuld session-feedback.
- **Kritiske findings:**
  - PM-kobling mangler — delta-data (hvilke items har hidden complexity) burde kobles til PM
- **Anbefalinger:**
  - Post-stats: "Items med Hidden Complexity-flag sendt til PM for review"

---

## Truth Serum (TruthSerumScreen.jsx)

- **Formål klar:** 🟡 Setup-tekst "ALLE ESTIMERER HEMMELIGT — INGEN SER DE ANDRES SVAR" forklarer *mekanikken* men ikke *formålet*. Bias-rapport-konceptet er stærkt men introduceres ikke i setup.
- **Usikkerhed synlig:** ✅ Bias-analysen (hvem estimerer systematisk højere/lavere end medianen) er præcis kerneværdi 1 i praksis.
- **PM-kobling:** ❌ Bias-rapporten vises og... forsvinder. Ingen reference til at data lagres eller kan bruges til PM-kalibrering.
- **Alle aktive:** ✅ Alle estimerer hemmeligt. Ingen passive.
- **Feedback loop:** 🟡 Bias-rapporten er god feedback — men kun for én session. Ingen historisk trend.
- **Kritiske findings:**
  - Setup mangler formålsforklaring
  - Bias-rapport ikke koblet til PM/historik
- **Anbefalinger:**
  - Setup-intro: "Truth Serum afslører systematisk bias — hvem estimerer altid for lavt eller for højt?"
  - Post-rapport: "Bias-data gemt til teamets historik"

---

## Samlet scorecard

| Spil | Formål | Usikkerhed | PM-kobling | Alle aktive | Feedback |
|---|---|---|---|---|---|
| Planning Poker | ✅ | ✅ | 🟡 | ✅ | 🟡 |
| Spec Wars | 🟡 | ✅ | ❌ | ✅ | 🟡 |
| Perspective Poker | 🟡 | ✅ | ❌ | ✅ | 🟡 |
| Bluff Poker | ❌ | 🟡 | ❌ | ✅ | ❌ |
| Nesting Scope | 🟡 | ✅ | 🟡 | ✅ | 🟡 |
| Speed Scope | ✅ | ✅ | ❌ | ✅ | ✅ |
| Truth Serum | 🟡 | ✅ | ❌ | ✅ | 🟡 |

---

## Top-3 kritiske fund (valgt til fix)

1. **Bluff Poker lobby mangler formålstekst** — ❌ på det vigtigste parameter. Ny bruger forstår nul.
2. **Spec Wars lobby mangler formålstekst + PM-kobling** — brugt i workshops, skal være selvforklarende.
3. **Truth Serum setup mangler formålsforklaring** — bias-rapport er Reveal's stærkeste feature. Den skal annonceres.

---

## Fixes implementeret (se kode)

1. `BluffPokerScreen.jsx` — Tilføjet formålsbanner i StepLobby
2. `SpecWarsScreen.jsx` — Tilføjet purpose-intro i lobby + "spec gemt" besked ved GM-godkendelse
3. `TruthSerumScreen.jsx` — Tilføjet formålsforklaring i SetupPhase

**Commit:** `audit(reveal): core value alignment — clarity + purpose fixes`
