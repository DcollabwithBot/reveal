# Reveal V7 — UX Direction Reset

Date: 2026-03-19
Owner: James / Reveal product direction
Status: Direction draft for next mockup pass

## 1) Problem statement

Den nuværende mockup er blevet bedre, men den er stadig ikke der, hvor Reveal føles som et produkt folk aktivt ville foretrække i hverdagen.

Det egentlige problem er ikke farver, cards eller spacing alene.
Det er, at UX’en stadig prøver at være tre ting på samme tid:
- professionelt PM-værktøj
- dashboard med mange moduler
- gamificeret oplevelse

Resultatet bliver for fladt og for samtidigt.
Der mangler et tydeligt svar på:
- Hvad er den primære handling på skærmen?
- Hvornår er brugeren i “arbejds-mode”?
- Hvornår er brugeren i “game-mode”?
- Hvordan flyder man mellem de to uden at tabe tillid eller momentum?

## 2) Reveal’s kerne UX-tese

Reveal skal ikke være “et PM-tool med gamer-skin”.
Og det skal heller ikke være “et spil som tilfældigvis tracker projekter”.

Reveal skal være:

**Et professionelt execution-system, hvor game-laget øger momentum, tydelighed og fremdrift — uden at kompromittere PM-data eller professionel troværdighed.**

Kort sagt:
- PM-data = source of truth
- Professionel UX = default arbejdsoverflade
- Game-layer = motivations- og signal-lag
- Overlay = advisory / optional / kontekststyret

Det betyder:
- Når man planlægger, prioriterer, estimerer og følger op → UI skal føles som et stærkt B2B SaaS-produkt
- Når man eksekverer, beslutter og lukker ting → game-signaler må gerne forstærke energi og fokus
- Når man er i session/game flow → oplevelsen må gerne være mere spillet, men stadig bundet til rigtige events/data

## 3) Designprincip: boring by default, meaningful by overlay

Det vigtigste nye princip:

**Reveal skal være kedelig nok til at blive stolet på — og spændende nok til at blive brugt.**

Det betyder i praksis:

### Standard-mode (default)
- Rolig, professionel, moderne B2B SaaS
- Klar hierarki
- Få dominante elementer
- Ingen støjende gamification i basislaget
- Fokus på beslutning, status, ansvar, risici, fremdrift

### Overlay-mode (optional / context triggered)
- XP, pressure, boss-state, achievements, momentum-signaler
- Vises som sekundært lag
- Må aldrig stjæle primary action
- Må aldrig ændre PM-data direkte
- Må gerne trigges i execution mode, sprint close, challenge moments

### Session/game-mode
- Her må Reveal være langt mere levende og spillet
- Men der skal stadig være tydelig relation tilbage til det professionelle domæne
- “This boss = this sprint / this blocker cluster / this planning challenge”

## 4) UX-model: 3 parallelle lag

Reveal skal designes som 3 UX-lag — ikke én blandet flade.

### Lag A — System of Work
Formål:
- planlægning
- status
- ejerskab
- governance
- dependencies
- risks

Dette lag skal ligne noget mellem Linear, Height, Jira Product Discovery, Asana og et moderne ops-dashboard.

Kendetegn:
- stærk IA
- tydelig primær CTA
- tæt men rolig data-præsentation
- filters / tabs / actions med høj signalværdi
- høj tillid

### Lag B — System of Momentum
Formål:
- gøre fremdrift mærkbar
- vise pressure, momentum, risk, confidence og unlocks
- give teamet energi uden at forvride data

Kendetegn:
- overlays, side-panels, momentum badges, subtle animations
- “delivery pressure”, streaks, boss-health, XP, achievements
- synligt, men sekundært
- aldrig primary content

### Lag C — System of Play
Formål:
- sessions, planning poker, challenge modes, retrospectives, boss fights

Kendetegn:
- langt mere game-heavy UX
- stærkere visuelle effekter
- mere karakter og tone
- men stadig koblet til canonical PM events

## 5) Den vigtigste UX-fejl vi skal undgå

Den nuværende mockup falder i denne fælde:
- sidebar + KPI + topbar + chips + tabs + cards + overlay prøver alle at være vigtige samtidig

Det bryder en central UX-regel:

**Hierarchy is the product.**

I næste pass skal hver skærm have en helt tydelig prioritering:
- #1 hvad er hovedbeslutningen?
- #2 hvad støtter beslutningen?
- #3 hvad er god sekundær kontekst?

Hvis ikke det er tydeligt på 3 sekunder, så er designet ikke godt nok.

## 6) Ny informationsarkitektur

Vi skal ikke starte med “hele systemet”.
Vi skal starte med 3 hero-flader og gøre dem rigtige.

## Screen 1 — Dashboard
Formål:
- forstå situationen
- finde hvad der kræver opmærksomhed nu
- gå videre til næste handling

Primary action:
- Gå til det projekt/sprint/problem der kræver handling nu

UI-prioritet:
1. Attention / what needs action now
2. Project health / blockers / approvals / conflicts
3. Secondary portfolio context

Skal føles som:
- rolig
- beslutsom
- ledelsesegnet
- ikke “cockpit for cockpit’ets skyld”

Game-layer her:
- kun et subtilt momentum-lag
- fx pressure trend, team XP, streak, boss pressure as secondary diagnostics
- aldrig hovedindhold

## Screen 2 — Project Workspace
Formål:
- drive et projekt effektivt
- skifte mellem backlog, board, timeline, people, reports
- holde sammenhæng mellem PM-styring og momentum

Primary action:
- prioritere og flytte arbejdet frem

UI-prioritet:
1. Current focus / sprint objective / what blocks delivery
2. Core working surface (board/backlog/timeline)
3. Secondary insights (people load, risk, momentum)

Game-layer her:
- mere synlig end dashboard, men stadig tydeligt sekundær
- fx “Delivery Pressure”, “Momentum”, “Boss state”, “Challenge available”
- skal være koblet til rigtige PM-events

## Screen 3 — Sprint Execution / Session
Formål:
- gennemføre planlægning eller execution med høj energi
- gøre beslutningsøjeblikke mere tydelige og engagerende

Primary action:
- luk opgaven / tag beslutningen / resolve konflikten / færdiggør sessionen

UI-prioritet:
1. Det konkrete arbejde / den konkrete beslutning
2. Team signaler og estimater
3. Game feedback

Game-layer her:
- må være en integreret del af oplevelsen
- fordi dette ER der, hvor Reveal må føles specielt

## 7) Relation mellem kedeligt og sjovt

Dette er kernen i Reveal og skal være synligt i næste mockup-pass:

### Kedeligt arbejde
- backlog grooming
- project health
- ownership
- blockers
- sprint board
- timelines
- risk / approvals / conflict handling

### Sjovt arbejde
- planning poker
- boss battles
- achievements
- progress feedback
- momentum / pressure / unlocks
- challenge events

### Reveal’s unikke værdi
Reveal binder dem sammen sådan her:
- kedelige PM-events skaber game-signaler
- game-signaler skaber energi og klarhed
- PM-owner godkender stadig den virkelige write-back
- overlay kan tændes/slukkes alt efter situation

Det er **ikke** to separate produkter.
Det er ét system med to oplevelseslag.

## 8) Designregler for næste mockup-pass

### Regel 1 — Én primær handling per skærm
Hvis vi ikke kan pege på den primære CTA på 2 sekunder, er designet forkert.

### Regel 2 — Overlay må aldrig konkurrere med arbejdsfladen
Overlay skal støtte, ikke dominere.

### Regel 3 — Ingen “border soup”
Mindre kortstøj, færre lige-vigtige bokse, mere spacing og rolige overflader.

### Regel 4 — Portfolio er ikke execution
Dashboard må ikke ligne et board. Board må ikke ligne portfolio. Session må ikke ligne rapport.

### Regel 5 — Design til states
Vi skal vise:
- empty
- loading
- error
- no projects
- no blockers
- pending approvals
- conflict exists
- overlay on/off

### Regel 6 — Professional by default
Den professionelle troværdighed skal være intakt, også hvis gamification slås helt fra.

### Regel 7 — Gamification skal føles earned
Ikke pynt. Kun noget der er meningsfuldt fordi det er bundet til faktisk fremdrift, pres eller læring.

## 9) Konkret næste mockup-opgave

Næste pass skal IKKE være “iterér på den eksisterende index.html”.

Det skal være en ny retning med 3 fokuserede mockups:

1. `dashboard-v7`
- ledelsesblik + what needs action now
- meget stærk hierarki
- meget lidt game-støj

2. `workspace-v7`
- professionel execution-flade
- board/backlog/timeline med stærk primary workflow
- momentum layer som sekundær sidepanel eller inline summary

3. `session-v7`
- her må Reveal være mest spillet
- men stadig læsbart og bundet til real work

## 10) Hvad næste designer/mockup-pass skal levere

Leverancen skal indeholde:
- Design brief
- Information architecture
- Hierarchy map (#1/#2/#3 per screen)
- Component inventory
- State matrix
- Mockup for 3 hero screens
- Beskrivelse af hvordan overlay toggles og opfører sig
- Regler for hvordan PM-events bliver til game-signaler

## 11) Kort dom over nuværende mockup

Det nuværende mockup er ikke spildt arbejde.
Det har hjulpet med at afklare struktur og problemrum.

Men:
- det er ikke det rigtige endelige formsprog
- det er for bredt og for fladt
- det blander system of work og system of play for tidligt

Næste version skal være mere kompromisløs.

## 12) North star sentence

**Reveal should feel like a serious execution platform with a game soul — not a game wearing a PM costume.**
