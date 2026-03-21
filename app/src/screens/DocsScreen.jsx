import { useState, useRef, useEffect } from "react";
import { useTour } from "../tour/useTour.js";

// ─────────────────────────────────────────────────────────────────────────────
// DocsScreen — In-app dokumentation & hjælpecenter
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "kom-i-gang",       label: "Kom i gang",            icon: "🚀" },
  { id: "game-modes",       label: "Game Modes",             icon: "🎮" },
  { id: "pm-dashboard",     label: "PM Dashboard",           icon: "📊" },
  { id: "world-map",        label: "World Map & Overworld",  icon: "🗺️" },
  { id: "api",              label: "API & Integrationer",    icon: "🔌" },
  { id: "roller",           label: "Roller & Rettigheder",   icon: "👥" },
  { id: "faq",              label: "FAQ",                    icon: "❓" },
];

const GAME_MODES = [
  {
    id: "planning_poker",
    name: "Planning Poker",
    icon: "⚔️",
    tagline: "Fibonacci-estimering med holdet.",
    description: "Det klassiske estimeringsritual. Holdet afslører estimater simultant — ingen bias, ingen anchor-effekt.",
    when: "Når du skal estimere nyt arbejde inden sprint-planlægning.",
    how: [
      "Game Master vælger backlog-items der skal estimeres",
      "Alle vælger kort (1, 2, 3, 5, 8, 13, 21, 34, ∞) uden at vise dem",
      "Kort afsløres simultant — ingen ser hvad andre har valgt",
      "Outliers diskuterer deres ræsonnement",
      "Ny runde hvis konsensus mangler — fortsæt til enighed",
    ],
    output: "votes → consensus_value → session_items.estimate (kræver GM approval)",
    outputLabel: "Estimat på hvert item (story points)",
  },
  {
    id: "boss_battle_retro",
    name: "Boss Battle Retro",
    icon: "👾",
    tagline: "Sprint-retrospektiv som boss fight.",
    description: "Retroen omdannes til en boss-kamp. Teamet finder root causes og slår sprintets problemer ned — eller taber HP.",
    when: "Ved afslutning af hvert sprint som fast retrospektiv-ritual.",
    how: [
      "Boss-HP afspejler sprintets uløste problemer",
      "Holdet nominerer hvad der gik galt (boss-angreb)",
      "Stemmer om root causes for hvert problem",
      "Action items beslutter I fællesskab — disse nedkalder bossen",
      "Bossen er defeated når alle action items er tildelt ejere",
    ],
    output: "Retro-findings + action items → oprettes som tasks i næste sprints backlog (kræver GM approval)",
    outputLabel: "Action items til næste sprint",
  },
  {
    id: "perspective_poker",
    name: "Perspective Poker",
    icon: "🎭",
    tagline: "Afdæk team-alignment på features og prioriteter.",
    description: "Holdet scorer items fra different perspektiver (bruger, tech, business). Lav alignment = høj risiko.",
    when: "Inden sprint-planlægning for at finde items med skjult uenighed.",
    how: [
      "Hvert item scores fra 3 perspektiver: bruger, teknisk, forretning",
      "Alle scorer uafhængigt (1-10 per perspektiv)",
      "Alignment-score beregnes: høj spredning = lav alignment",
      "Items med lav alignment flagges til diskussion",
      "Resultat: en aftalt prioritering med forklaret rationale",
    ],
    output: "alignment_score per item → note på item: 'Lav alignment — diskuter'",
    outputLabel: "Alignment-noter på backlog-items",
  },
  {
    id: "bluff_poker",
    name: "Bluff Poker",
    icon: "🃏",
    tagline: "Find de skjulte antagelser i jeres stories.",
    description: "Spillere skriver antagelser ned der gemmer sig i et item. Derefter afsløres og scores de — hvem bluffer?",
    when: "Når stories virker klare men føles usikre. God til nye features med mange ukendte.",
    how: [
      "Hvert item præsenteres — spillere skriver én skjult antagelse ned",
      "Antagelser afsløres simultant",
      "Holdet vurderer hvor farlig/sandsynlig hver antagelse er",
      "Farlige antagelser markeres og kobles til item",
      "PM ser hvilke items der har uvaliderede antagelser",
    ],
    output: "Afslørede antagelser → note på item: 'Fundet antagelser: X, Y, Z'",
    outputLabel: "Antagelsesliste per item",
  },
  {
    id: "nesting_scope",
    name: "Russian Nesting Scope",
    icon: "🪆",
    tagline: "Bryd store opgaver ned i håndterbare dele.",
    description: "Items pakkes op lag for lag — som russiske dukker. Hvert lag afslører sub-tasks der gemte sig.",
    when: "Når en user story er for stor til at estimere direkte. Brug det til at splitte epics.",
    how: [
      "Vælg et item der føles for stort (>13 story points)",
      "Holdet identificerer det første 'lag': hvilke dele kan isoleres?",
      "Hvert identificeret sub-item beskrives og estimeres",
      "Gentag for hvert lag indtil alle dele er estimerbare",
      "Resultat: parent-item med child-items i backloggen",
    ],
    output: "Child-items identificeret → oprettes i backlog under parent-item (kræver GM approval)",
    outputLabel: "Nye child-items i backlog",
  },
  {
    id: "speed_scope",
    name: "Speed Scope",
    icon: "⚡",
    tagline: "Hurtig estimering under tidspres.",
    description: "To lynhurtige estimeringsrunder. Holdet scorer intuitivt — delta mellem runder afsløres kompleksitet.",
    when: "Standup-friendly estimering. Bruges når holdet kender arbejdet og tid er en mangelvare.",
    how: [
      "Runde 1: alle estimerer på 10 sekunder per item (magefornemmelse)",
      "Runde 2: estimér igen — nu med runde 1 synlig",
      "Delta beregnes: stor forskel = mulig skjult kompleksitet",
      "GM gennemgår items med høj delta",
      "Output markeres som 'speed estimate' i PM",
    ],
    output: "Quick-estimater → session_items.estimate markeret 'speed' (kræver GM approval)",
    outputLabel: "Hurtigestimater med delta-analyse",
  },
  {
    id: "risk_poker",
    name: "Risk Poker",
    icon: "🎲",
    tagline: "Score risiko på hvert backlog-item.",
    description: "Holdet vurderer risiko-niveau (lav/mellem/høj) per item baseret på teknisk usikkerhed, afhængigheder og forretningseffekt.",
    when: "Sprint-planlægning: inden du committer til et sprint, forstå din risikoprofil.",
    how: [
      "Hvert item vurderes på 3 akser: teknisk usikkerhed, afhængigheder, forretningseffekt",
      "Spillere vælger risiko-kort: 🟢 Lav / 🟡 Mellem / 🔴 Høj",
      "Afsløres simultant — spredning diskuteres",
      "Konsensus-risikoscore besluttes for hvert item",
      "Risiko-score gemmes og vises som badge i workspace",
    ],
    output: "risk_score per item → session_items.risk_score + synlig badge i workspace",
    outputLabel: "Risiko-badge på alle items",
  },
  {
    id: "spec_wars",
    name: "Spec Wars",
    icon: "📜",
    tagline: "Battle om spec-kvalitet — er acceptancekriterierne gode nok?",
    description: "Holdet kæmper om at forbedre specifikationerne. Dårlige ACs identificeres og opdateres live.",
    when: "Refinement: inden en story trækkes ind i sprint. Sørg for at ACs er klare og testbare.",
    how: [
      "En story præsenteres med dens nuværende acceptancekriterier",
      "Spillere stemmer: Er hvert AC klart, testbart og komplet?",
      "Svage ACs markeres og reskrives i fællesskab",
      "Forbedrede ACs godkendes af holdet",
      "Story markeres som 'refinement-completed' i PM",
    ],
    output: "Refinement-noter per item → note på item om AC-kvalitet",
    outputLabel: "Refinement-noter og forbedrede ACs",
  },
  {
    id: "assumption_slayer",
    name: "Assumption Slayer",
    icon: "🗡️",
    tagline: "Dokumentér og score de farligste antagelser.",
    description: "En struktureret session til at nedlægge uvaliderede antagelser. Høj danger-score = høj prioritet at validere.",
    when: "Tidligt i et projekt eller feature-development. Brug det til at kortlægge risikolandskabet.",
    how: [
      "Alle skriver antagelser ned på individuelt kort",
      "Antagelser præsenteres og categoriseres: teknisk, bruger, forretning, data",
      "Hvert kort scores: Sandsynlighed × Konsekvens = Danger Score",
      "Top-N antagelser med høj danger-score prioriteres til validering",
      "Antagelsesliste med scores gemmes på item",
    ],
    output: "Dokumenterede antagelser + danger-scores → note på item + assumptions-liste",
    outputLabel: "Antagelsesliste med danger-scores",
  },
  {
    id: "flow_poker",
    name: "Flow Poker",
    icon: "🌊",
    tagline: "Analysér cycle time og find flaskehalse.",
    description: "Holdet kortlægger faktisk tid brugt per fase — og identificerer hvor arbejdet stagnerer.",
    when: "Retrospektiv eller sprint-analyse. Bruges når velocity ikke stemmer med estimater.",
    how: [
      "Gennemgå de afsluttede items fra sprintet",
      "Holdet estimerer faktisk tid i hver fase: To Do / In Progress / Review / Done",
      "Afvigelse fra estimat beregnes per item",
      "Faser med konsistent overskridelse markeres som flaskehalse",
      "Sprint-metrics opdateres med cycle time-analyse",
    ],
    output: "Cycle time analyse + flaskehalse → sprint-metrics: 'Gennemsnitlig cycle time: X dage'",
    outputLabel: "Cycle time-metrics per sprint",
  },
  {
    id: "refinement_roulette",
    name: "Refinement Roulette",
    icon: "🎰",
    tagline: "Refinement med tilfældige challenges — hold holdet på tæerne.",
    description: "Rouletten lander på et tilfældigt refinement-challenge per story. Tvinger holdet til at tænke fra nye vinkler.",
    when: "Ugentlige refinement-sessioner. God til at bryde rutinen og fange blinde vinkler.",
    how: [
      "Vælg items der skal refineres",
      "For hvert item spinnes rouletten → challenge afsløres (fx 'Beskriv det fra brugerens perspektiv')",
      "Holdet skal besvare challengen inden de estimerer",
      "Svar dokumenteres som refinement-note",
      "Items med mangelfulde svar returneres til backlog til videre specifikation",
    ],
    output: "Refinement-noter per item → note på item",
    outputLabel: "Refinement-noter og challenge-svar",
  },
  {
    id: "dependency_mapper",
    name: "Dependency Mapper",
    icon: "🗺️",
    tagline: "Kortlæg afhængigheder mellem backlog-items.",
    description: "Holdet identificerer hvilke items der blokerer andre — og hvad der blokeres. Synliggør kritisk sti.",
    when: "Sprint-planlægning: inden du bestemmer rækkefølge. Særligt vigtigt for integrationer og API-arbejde.",
    how: [
      "Alle sprint-items præsenteres på 'brættet'",
      "Holdet diskuterer: 'Hvad kan ikke starte inden X er færdig?'",
      "Afhængigheder markeres: blokkeret af / blokerer",
      "Kritisk sti identificeres — den længste kæde af afhængigheder",
      "Sprint-plan justeres så blokkere løses tidligt",
    ],
    output: "item_dependencies-relationer → synlige som links i project workspace",
    outputLabel: "Dependency-graf i workspace",
  },
  {
    id: "sprint_draft",
    name: "Sprint Draft",
    icon: "📋",
    tagline: "Sprint-planlægning som fantasy-draft.",
    description: "Teammedlemmer picker items til sprintet i tur — som et sports-draft. Skaber engagement og ejerskab.",
    when: "Sprint planning: lad teamet vælge deres eget arbejde fremfor at få det tildelt.",
    how: [
      "Backlog-items med estimater præsenteres som 'draft pool'",
      "Teammedlemmer pitcher tur efter tur: 'Jeg tager denne task'",
      "Kapaciteten per person overvåges live (estimater vs. tilgængelig tid)",
      "Draften fortsætter til sprint-kapacitet er fyldt",
      "Foreslået sprint-composition sendes til PM approval",
    ],
    output: "Foreslåede items til næste sprint → sprint-forslag til PM approval",
    outputLabel: "Sprint-composition forslag",
  },
  {
    id: "truth_serum",
    name: "Truth Serum",
    icon: "💉",
    tagline: "Anonym team survey — hvad tænker holdet egentlig?",
    description: "Anonyme spørgsmål om sprintprocessen, samarbejdet og teknisk gæld. Resultater vises som heatmap.",
    when: "Kvartalsvis eller ved tegn på frustration i holdet. Skaber psykologisk tryghed.",
    how: [
      "GM vælger survey-spørgsmål (foruddefinerede eller egne)",
      "Alle besvarer anonymt — ingen kan se hvem der svarede hvad",
      "Resultater aggregeres til heatmap: emner × sentiment",
      "GM præsenterer heatmap for holdet uden individuelle svar",
      "Identificerede mønstre omdannes til action items",
    ],
    output: "Anonym survey-resultater → heatmap synlig i project analytics",
    outputLabel: "Sentiment-heatmap i analytics",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function DocsScreen({ onBack }) {
  const { startTour } = useTour();
  const [activeSection, setActiveSection] = useState("kom-i-gang");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const contentRef = useRef(null);

  const scrollToSection = (id) => {
    setActiveSection(id);
    const el = document.getElementById(`docs-${id}`);
    if (el && contentRef.current) {
      contentRef.current.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
    }
  };

  // Update active section based on scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const onScroll = () => {
      for (const section of [...SECTIONS].reverse()) {
        const el = document.getElementById(`docs-${section.id}`);
        if (el && el.offsetTop - 80 <= container.scrollTop) {
          setActiveSection(section.id);
          break;
        }
      }
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <aside style={{ ...styles.sidebar, width: sidebarOpen ? 220 : 0, overflow: "hidden" }}>
        <div style={styles.sidebarInner}>
          <div style={styles.sidebarHeader}>
            <span style={styles.sidebarTitle}>📚 Dokumentation</span>
            <button
              onClick={() => setSidebarOpen(false)}
              style={styles.iconBtn}
              title="Luk sidebar"
            >
              ✕
            </button>
          </div>
          <nav>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                style={{
                  ...styles.navBtn,
                  background: activeSection === s.id ? "var(--jade-dim)" : "none",
                  color: activeSection === s.id ? "var(--jade)" : "var(--text2)",
                  fontWeight: activeSection === s.id ? 500 : 400,
                }}
              >
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </nav>

          <div style={styles.sidebarFooter}>
            <div style={styles.badge}>v0.8</div>
            <span style={styles.footerText}>Reveal Documentation</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div style={styles.content} ref={contentRef}>
        {/* Topbar */}
        <div style={styles.topbar}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} style={styles.iconBtn} title="Åbn sidebar">
              ☰
            </button>
          )}
          <div style={styles.breadcrumb}>
            <span style={styles.breadcrumbRoot}>Dokumentation</span>
            <span style={styles.breadcrumbSep}>/</span>
            <span style={styles.breadcrumbCurrent}>
              {SECTIONS.find((s) => s.id === activeSection)?.label}
            </span>
          </div>
          {onBack && (
            <button onClick={onBack} style={styles.backBtn}>
              ← Tilbage
            </button>
          )}
        </div>

        {/* Sections */}
        <div style={styles.body}>

          {/* ── 🎮 Interaktiv Guide ──────────────────────────────────────── */}
          <section style={{ ...styles.section, background: 'var(--jade-dim)', border: '1px solid var(--jade)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', marginBottom: 32 }}>
            <h2 style={{ ...styles.h2, color: 'var(--jade)', marginTop: 0 }}>🎮 Interaktiv Guide</h2>
            <p style={{ ...styles.p, marginBottom: 16 }}>
              Ny til Reveal? Start den interaktive guided tour og oplev platformen live — vi viser dig hvert element og forklarer det undervejs.
            </p>
            <button
              onClick={() => startTour('explore', {
                onComplete: () => {},
                onSkip: () => {},
              })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '12px 24px',
                background: 'var(--jade)', border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: 13, fontWeight: 700,
                color: '#0c0c0f', cursor: 'pointer',
                boxShadow: '0 0 20px rgba(0,200,150,0.35)',
                transition: 'all 0.2s',
              }}
            >
              🗺️ Start guided tour
            </button>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
              9 trin · ~2 minutter · Kan springes over til enhver tid
            </div>
          </section>

          {/* ── 1. Kom i gang ──────────────────────────────────────────────── */}
          <section id="docs-kom-i-gang" style={styles.section}>
            <h1 style={styles.h1}>🚀 Kom i gang</h1>
            <p style={styles.lead}>
              Velkommen til Reveal — et gamificeret platform til PM-estimering og sprint-planlægning.
              Her er de første trin til at komme i gang.
            </p>

            <div style={styles.stepsGrid}>
              <StepCard number="1" title="Opret din organisation">
                <p>Log ind og gå til <strong>Settings → Organisation</strong>. Udfyld navn og vælg en avatar-klasse for din org. Organisationen er dit overordnede workspace — alle projekter og teammedlemmer tilhører den.</p>
              </StepCard>

              <StepCard number="2" title="Invitér teammedlemmer">
                <p>Gå til <strong>Settings → Team</strong> og klik <strong>+ Invitér</strong>. Indsæt e-mail-adresser — de modtager et invitationslink. Du kan tildele roller allerede ved invitation: Player, Game Master eller Viewer.</p>
              </StepCard>

              <StepCard number="3" title="Opret dit første projekt">
                <p>Fra <strong>Portfolio-dashboardet</strong>, klik <strong>+ Nyt projekt</strong>. Giv det et navn, en beskrivelse og vælg et ikon. Projektet oprettes med en tom backlog og vises på dit World Map som en ny verden.</p>
              </StepCard>

              <StepCard number="4" title="Kør din første session (Planning Poker)">
                <p>Åbn World Map og klik ind i din projekt-verden. Vælg <strong>Planning Poker</strong> som mode og start en session. Invitér teammedlemmer via session-koden. Estimer dine første backlog-items i fællesskab.</p>
              </StepCard>

              <StepCard number="5" title="Forstå XP, levels og leaderboard">
                <p>Hvert gennemført spil giver XP til alle deltagere. XP akkumuleres på din profil og afspejles i org-leaderboardet. Levels er en visuel motivation — de påvirker ikke PM-data. Se leaderboardet under <strong>Portfolio → Team</strong>.</p>
              </StepCard>
            </div>

            <InfoBox type="tip">
              <strong>Tip:</strong> Kør din første session med rigtige backlog-items — ikke dummy-data. Reveal er mest værdifuldt når PM-data og game-layer er synkroniseret fra dag 1.
            </InfoBox>
          </section>

          {/* ── 2. Game Modes ──────────────────────────────────────────────── */}
          <section id="docs-game-modes" style={styles.section}>
            <h1 style={styles.h1}>🎮 Game Modes</h1>
            <p style={styles.lead}>
              Reveal har 14 game modes — hvert designet til et specifikt PM-ritual. Alle modes producerer output der skrives
              tilbage til PM-systemet via Game Master approval.
            </p>

            <InfoBox type="info">
              <strong>Kontrakten:</strong> Game-laget kan aldrig skrive direkte til PM-data. Alle estimater, scores og action items kræver GM approval inden de skrives til backlog, items eller sprint.
            </InfoBox>

            <div style={styles.modesGrid}>
              {GAME_MODES.map((mode) => (
                <GameModeCard key={mode.id} mode={mode} />
              ))}
            </div>
          </section>

          {/* ── 3. PM Dashboard ────────────────────────────────────────────── */}
          <section id="docs-pm-dashboard" style={styles.section}>
            <h1 style={styles.h1}>📊 PM Dashboard</h1>
            <p style={styles.lead}>
              PM Dashboard er hjertet af Reveal på PM-siden. Her ser du overblik over hele organisationens projekter,
              KPI og risici — uden game-elementerne.
            </p>

            <h2 style={styles.h2}>Dashboard overblik</h2>
            <p style={styles.p}>
              Portfolio-dashboardet viser alle aktive projekter med deres nuværende sprint-status. KPI-bjælkerne giver øjeblikkeligt overblik:
            </p>
            <ul style={styles.ul}>
              <li><strong>Aktive projekter</strong> — antal projekter med igangværende sprints</li>
              <li><strong>Sprint velocity</strong> — gennemsnitlig velocity over de seneste 3 sprints</li>
              <li><strong>Estimater pending</strong> — antal items der venter GM approval fra seneste sessions</li>
              <li><strong>Åbne risici</strong> — items med risk_score = høj der ikke er addresseret</li>
              <li><strong>Sessions denne uge</strong> — antal gennemførte game sessions</li>
            </ul>

            <h2 style={styles.h2}>Projekt Workspace</h2>
            <p style={styles.p}>
              Klik på et projekt for at åbne dets workspace. Her finder du:
            </p>
            <ul style={styles.ul}>
              <li><strong>Backlog</strong> — alle items sorteret efter prioritet, med estimater og status</li>
              <li><strong>Sprints</strong> — aktive og historiske sprints med burndown</li>
              <li><strong>Sessions</strong> — log over alle gennemførte game sessions med summary</li>
              <li><strong>GM Approval</strong> — pending updates fra sessions der venter din godkendelse</li>
              <li><strong>Dependencies</strong> — dependency-graf fra Dependency Mapper sessions</li>
            </ul>

            <InfoBox type="warning">
              <strong>GM Approval-flowet:</strong> Estimater fra Planning Poker og risiko-scores fra Risk Poker skrives ikke automatisk til backlog-items. De vises som "pending" under Workspace → Sessions → GM Approval. Du skal aktivt godkende dem.
            </InfoBox>

            <h2 style={styles.h2}>Timelog</h2>
            <p style={styles.p}>
              Tidsregistrering er integreret direkte i Workspace. Teammedlemmer logger tid per item — data samles
              automatisk per sprint og projekt.
            </p>
            <ul style={styles.ul}>
              <li>Registrér tid via <strong>Workspace → Timelog</strong></li>
              <li>Bulk-import fra Excel (kolonner: Dato, Beskrivelse, Minutter, Item-ID)</li>
              <li>Timelog-data er tilgængeligt via API til PowerBI og andre værktøjer</li>
              <li>Filtrer på projekt, sprint eller medarbejder</li>
            </ul>

            <h2 style={styles.h2}>Team Kanban</h2>
            <p style={styles.p}>
              Team Kanban viser alle aktive items på tværs af projekter — et samlet billede af hvad hele teamet arbejder på.
              Kolonner: Backlog / To Do / In Progress / Review / Done.
            </p>

            <h2 style={styles.h2}>Sprint Charts & Burndown</h2>
            <p style={styles.p}>
              Åbn et sprint for at se burndown-chart i realtid. Velocity-grafen viser historisk sprint-performance.
              Analytics-dashboardet (KPI) giver dybere projektion og trendanalyse.
            </p>
          </section>

          {/* ── 4. World Map & Overworld ────────────────────────────────────── */}
          <section id="docs-world-map" style={styles.section}>
            <h1 style={styles.h1}>🗺️ World Map & Overworld</h1>
            <p style={styles.lead}>
              World Map er game-lagets indgang til PM-data. Hvert projekt er en verden — og inde i verdenen
              lever dit sprint som et kortspil med rigtige items og teammedlemmer.
            </p>

            <h2 style={styles.h2}>Hvordan World Map virker</h2>
            <p style={styles.p}>
              World Map viser alle projekter i din organisation som portaler. Projekter er sorteret efter aktivitet —
              dem med igangværende sprints vises øverst. Klikker du ind i en portal, åbner projektets Overworld.
            </p>
            <ul style={styles.ul}>
              <li>Portaler hentes direkte fra Supabase — nye projekter vises automatisk</li>
              <li>Hvert projekt har et roterende visuelt tema (pixel-art)</li>
              <li><strong>Free Road</strong> er en fast verden i bunden — her finder du daily missions og side quests uden projekttilknytning</li>
            </ul>

            <h2 style={styles.h2}>Overworld navigation</h2>
            <p style={styles.p}>
              Inde i en projektverden er Overworld populeret med rigtige data fra Supabase:
            </p>
            <ul style={styles.ul}>
              <li><strong>Nodes = sprint-items</strong> — hvert item i det aktive sprint er en node på kortet</li>
              <li>Grå node = uestimeret, grøn = estimeret, rød = høj risiko</li>
              <li><strong>Karakterer = teammedlemmer</strong> — rigtige profiler fra organization_members</li>
              <li>Klik på en node for at vælge mode og starte en session</li>
            </ul>

            <h2 style={styles.h2}>Boss = sprint-deadline</h2>
            <p style={styles.p}>
              Hvert projekt har en <strong>Final Boss</strong> — det er sprint-deadlinen visualiseret som en boss
              med HP-bar. Bossens HP tæller ned proportionalt med dage tilbage i sprintet.
            </p>
            <ul style={styles.ul}>
              <li>Fuld HP = sprint start</li>
              <li>Lav HP = deadline nærmer sig</li>
              <li>Boss defeated = sprint afsluttet med success</li>
              <li>Ny sprint = ny boss med fuld HP</li>
            </ul>

            <h2 style={styles.h2}>Free Road — daily missions og side quests</h2>
            <p style={styles.p}>
              Free Road genererer missions automatisk baseret på PM-data der mangler opmærksomhed:
            </p>
            <ul style={styles.ul}>
              <li>Items uden sprint → <em>"Planlæg sprint"</em> mission</li>
              <li>Items uden estimat → <em>"Estimér items"</em> mission (→ Planning Poker)</li>
              <li>Items uden assignee → <em>"Tildel opgaver"</em> mission</li>
              <li>Ingen session i over 7 dage → <em>"Kør et ritual"</em> mission</li>
            </ul>
            <p style={styles.p}>
              <strong>Items med <code>is_private: true</code></strong> genererer ikke missions og er usynlige i game-laget.
            </p>
          </section>

          {/* ── 5. API & Integrationer ──────────────────────────────────────── */}
          <section id="docs-api" style={styles.section}>
            <h1 style={styles.h1}>🔌 API & Integrationer</h1>
            <p style={styles.lead}>
              Reveal eksponerer en REST API til ekstern adgang. Designet til PowerBI, Zapier, Make og custom integrationer.
            </p>

            <h2 style={styles.h2}>Generér API-nøgle (trin-for-trin)</h2>
            <ol style={styles.ol}>
              <li>Gå til <strong>Settings → API-nøgler</strong></li>
              <li>Klik <strong>+ Ny nøgle</strong></li>
              <li>Vælg et beskrivende navn (fx "PowerBI rapport")</li>
              <li>Vælg de nødvendige scopes (se tabel nedenfor)</li>
              <li>Sæt evt. en udløbsdato for midlertidige integrationer</li>
              <li>Klik <strong>Opret</strong> — nøglen vises <em>kun én gang</em></li>
              <li>Kopiér og gem nøglen sikkert (fx i en password manager)</li>
            </ol>

            <InfoBox type="warning">
              API-nøgler gemmes som SHA-256 hash — Reveal kan ikke gengive en mistet nøgle. Tilbagekald den og opret en ny.
            </InfoBox>

            <h2 style={styles.h2}>Scopes oversigt</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Scope</th>
                  <th style={styles.th}>Adgang til</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["read:projects", "Projekter i organisationen"],
                  ["read:sprints", "Sprints per projekt"],
                  ["read:items", "Backlog-items og estimater"],
                  ["read:time", "Tidsregistreringer"],
                  ["read:sessions", "Game sessions og historik"],
                  ["read:team", "Teammedlemmer og leaderboard"],
                ].map(([scope, desc]) => (
                  <tr key={scope}>
                    <td style={styles.td}><code style={styles.code}>{scope}</code></td>
                    <td style={styles.td}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 style={styles.h2}>Endpoints oversigt</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Endpoint</th>
                  <th style={styles.th}>Scope</th>
                  <th style={styles.th}>Beskrivelse</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["GET /projects", "read:projects", "Alle projekter"],
                  ["GET /projects/:id/sprints", "read:projects + read:sprints", "Sprints for projekt"],
                  ["GET /sprints/:id/items", "read:sprints + read:items", "Items i sprint"],
                  ["GET /items", "read:items", "Alle items (filtrerbart)"],
                  ["GET /time-entries", "read:time", "Tidsregistreringer"],
                  ["GET /sessions", "read:sessions", "Game sessions"],
                  ["GET /leaderboard", "read:team", "XP-leaderboard"],
                  ["GET /members", "read:team", "Teammedlemmer"],
                ].map(([ep, scope, desc]) => (
                  <tr key={ep}>
                    <td style={styles.td}><code style={styles.code}>{ep}</code></td>
                    <td style={styles.td}><code style={{ ...styles.code, fontSize: 11 }}>{scope}</code></td>
                    <td style={styles.td}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 style={styles.h2}>PowerBI opsætning</h2>
            <ol style={styles.ol}>
              <li>Åbn Power BI Desktop → <strong>Hent data → Web → Avanceret</strong></li>
              <li>Indsæt URL: <code style={styles.codeInline}>https://&lt;supabase-url&gt;/functions/v1/reveal-api/projects</code></li>
              <li>Tilføj HTTP-header: <code style={styles.codeInline}>Authorization: Bearer rvl_&lt;din-nøgle&gt;</code></li>
              <li>Udvid <code style={styles.codeInline}>data</code>-feltet i Power Query Editor</li>
              <li>Gentag for de endpoints du har brug for (sprints, items, time-entries)</li>
              <li>Sæt scheduled refresh i Power BI Service</li>
            </ol>
            <CodeBlock>{`// PowerBI Power Query — hent items
let
    ApiKey = "rvl_<din-nøgle>",
    BaseUrl = "https://<supabase-url>/functions/v1/reveal-api",
    Source = Json.Document(Web.Contents(BaseUrl & "/items", [
        Headers = [Authorization = "Bearer " & ApiKey]
    ])),
    Data = Source[data],
    Table = Table.FromList(Data, Splitter.SplitByNothing()),
    Expanded = Table.ExpandRecordColumn(Table, "Column1",
        {"id", "sprint_id", "title", "estimate", "status", "priority"})
in
    Expanded`}</CodeBlock>

            <h2 style={styles.h2}>Jira integration (connected mode)</h2>
            <p style={styles.p}>
              Reveal understøtter Jira read-only shadow sync i <strong>Connected Mode</strong>. I connected mode hentes items
              og sprints fra Jira og afspejles i Reveal — Jira er source of truth for fælles felter.
            </p>
            <ul style={styles.ul}>
              <li>Gå til <strong>Settings → Integrationer → Jira</strong></li>
              <li>Indsæt Jira-domæne, e-mail og API token</li>
              <li>Vælg de projekter der skal synkroniseres</li>
              <li>Reveal importerer items og sprints — write-back til Jira er kun aktivt efter gateway-validering (INT-G1/G2/G3)</li>
            </ul>

            <InfoBox type="info">
              <strong>Connected Mode:</strong> I connected mode ejes fælles work-fields (titel, status, assignee) af Jira. Reveal kan tilføje estimater og risiko-scores som custom fields — men skriver aldrig over Jira-data uden eksplicit godkendelse.
            </InfoBox>

            <h2 style={styles.h2}>Webhooks</h2>
            <p style={styles.p}>
              Konfigurér webhooks til at modtage events når sessioner afsluttes eller GM approver estimater.
              Gå til <strong>Settings → Webhooks → + Ny webhook</strong>.
            </p>
            <CodeBlock>{`// Webhook payload — session completed
{
  "event": "session.completed",
  "session_id": "uuid",
  "project_id": "uuid",
  "game_mode": "planning_poker",
  "items_covered": ["uuid1", "uuid2"],
  "participants": 4,
  "completed_at": "2026-03-21T14:30:00Z"
}`}</CodeBlock>
          </section>

          {/* ── 6. Roller & Rettigheder ─────────────────────────────────────── */}
          <section id="docs-roller" style={styles.section}>
            <h1 style={styles.h1}>👥 Roller & Rettigheder</h1>
            <p style={styles.lead}>
              Reveal har fire roller. Roller tildeles per organisation og gælder på tværs af alle projekter.
            </p>

            <div style={styles.rolesGrid}>
              <RoleCard
                role="Admin / Owner"
                icon="👑"
                color="var(--gold)"
                permissions={[
                  "Fuld adgang til alle projekter og sprints",
                  "Kan oprette og slette projekter",
                  "Kan invitere og fjerne teammedlemmer",
                  "Kan tildele og ændre roller",
                  "Kan generere og tilbagekalde API-nøgler",
                  "Kan konfigurere Jira og webhook-integrationer",
                  "Har alle GM-rettigheder",
                ]}
              />
              <RoleCard
                role="Game Master (GM)"
                icon="⚔️"
                color="var(--jade)"
                permissions={[
                  "Kan starte og afslutte game sessions",
                  "Kan approves estimater og scores fra sessions → skriver til PM-data",
                  "Kan oprette og redigere backlog-items",
                  "Kan oprette og redigere sprints",
                  "Kan se alle session-logs og GM approval-queue",
                  "Kan tildele items til teammedlemmer",
                  "Kan ikke ændre organisationsindstillinger",
                ]}
              />
              <RoleCard
                role="Player"
                icon="🎮"
                color="#7B9FFF"
                permissions={[
                  "Kan deltage i aktive game sessions",
                  "Kan stemme og estimere i alle modes",
                  "Kan se egne projekter og sprints",
                  "Kan logge tid på items",
                  "Kan se eget XP-niveau og achievements",
                  "Kan ikke approve estimater eller starte sessioner",
                  "Kan ikke redigere backlog-items",
                ]}
              />
              <RoleCard
                role="Viewer"
                icon="👁️"
                color="var(--text2)"
                permissions={[
                  "Kan se projekter, sprints og backlog (read-only)",
                  "Kan se session-historik og summaries",
                  "Kan se KPI-dashboard og analytics",
                  "Kan se leaderboard",
                  "Kan ikke deltage i sessions",
                  "Kan ikke logge tid",
                  "Typisk brugt til stakeholders og kunder",
                ]}
              />
            </div>
          </section>

          {/* ── 7. FAQ ──────────────────────────────────────────────────────── */}
          <section id="docs-faq" style={styles.section}>
            <h1 style={styles.h1}>❓ FAQ</h1>
            <p style={styles.lead}>
              De mest stillede spørgsmål om Reveal.
            </p>

            <div style={styles.faqList}>
              <FaqItem q="Hvordan inviterer jeg teammedlemmer?">
                Gå til <strong>Settings → Team</strong> og klik <strong>+ Invitér</strong>. Indsæt
                e-mail-adressen og vælg rolle (Player, GM eller Viewer). Invitation-linket er gyldigt i 7 dage.
                Alternativt kan du sende et direkte sign-up link med din organisations invite-kode.
              </FaqItem>

              <FaqItem q="Hvad sker der med mine estimater efter et spil?">
                Estimater fra et spil gemmes som <em>votes</em> i Supabase og vises som "pending" under
                Workspace → GM Approval. De skrives <strong>ikke</strong> automatisk til backlog-items.
                Game Master skal aktivt approves dem. Når approved: <code style={styles.codeInline}>session_items.estimate</code> opdateres
                og estimatet vises i backloggen.
              </FaqItem>

              <FaqItem q="Kan jeg bruge Reveal uden game-laget?">
                Ja. Du kan bruge PM Dashboard, ProjectWorkspace, Timelog og Team Kanban fuldt ud uden at
                åbne World Map eller game sessions. PM-siden er designet som en selvstændig execution platform.
                Game-laget er advisory og motiverende — ikke obligatorisk.
              </FaqItem>

              <FaqItem q="Hvordan forbinder jeg til Jira?">
                Gå til <strong>Settings → Integrationer → Jira</strong>. Du skal bruge dit Jira-domæne
                (fx <code style={styles.codeInline}>ditfirma.atlassian.net</code>), din Jira-email og et
                Jira API-token (generes på id.atlassian.com → Security → API tokens).
                Reveal synkroniserer projekter og items i read-only mode som standard.
              </FaqItem>

              <FaqItem q="Er mine data sikre?">
                Ja. Reveal bruger Supabase med Row Level Security (RLS) aktiveret på alle tabeller — alle
                queries filtreres automatisk på <code style={styles.codeInline}>organization_id</code>.
                Du kan aldrig tilgå en anden organisations data. API-nøgler gemmes som SHA-256 hash — råteksten
                gemmes aldrig. Al kommunikation krypteres via HTTPS/TLS. Supabase-instansen kører med
                enterprise-grade sikkerhedsindstillinger.
              </FaqItem>

              <FaqItem q="Hvad betyder XP og levels?">
                XP (experience points) optjenes ved at gennemføre game sessions. De er en motivationsmekanisme
                og påvirker <strong>ikke</strong> PM-data. Levels og leaderboard er synlige for alle i organisationen.
                XP er persisteret i <code style={styles.codeInline}>profiles.xp</code> og reflekteres i
                org-leaderboardet via en auto-opdateret database-view.
              </FaqItem>

              <FaqItem q="Hvad er forskellen på Planning Poker og Speed Scope?">
                Planning Poker er grundig — holdet diskuterer outliers og kører multiple runder til konsensus.
                Speed Scope er lynhurtig — to 10-sekunders runder per item, ideel til standup og quick-check.
                Begge skriver til <code style={styles.codeInline}>session_items.estimate</code> via GM approval,
                men Speed Scope-estimater markeres med en "speed"-flag i PM.
              </FaqItem>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StepCard({ number, title, children }) {
  return (
    <div style={styles.stepCard}>
      <div style={styles.stepNumber}>{number}</div>
      <div>
        <div style={styles.stepTitle}>{title}</div>
        <div style={styles.stepBody}>{children}</div>
      </div>
    </div>
  );
}

function GameModeCard({ mode }) {
  return (
    <div style={styles.modeCard}>
      <div style={styles.modeHeader}>
        <span style={styles.modeIcon}>{mode.icon}</span>
        <div>
          <div style={styles.modeName}>{mode.name}</div>
          <div style={styles.modeTagline}>{mode.tagline}</div>
        </div>
      </div>
      <p style={styles.modeDesc}>{mode.description}</p>

      <div style={styles.modeMeta}>
        <span style={styles.modeMetaLabel}>Hvornår:</span>
        <span style={styles.modeMetaText}>{mode.when}</span>
      </div>

      <div style={styles.modeSection}>
        <div style={styles.modeSectionLabel}>Sådan virker det</div>
        <ul style={styles.modeList}>
          {mode.how.map((step, i) => (
            <li key={i} style={styles.modeListItem}>
              <span style={styles.modeListDot}>▸</span>
              {step}
            </li>
          ))}
        </ul>
      </div>

      <div style={styles.modeOutput}>
        <span style={styles.modeOutputLabel}>PM Output →</span>
        <span style={styles.modeOutputValue}>{mode.outputLabel}</span>
        <div style={styles.modeOutputCode}>{mode.output}</div>
      </div>
    </div>
  );
}

function RoleCard({ role, icon, color, permissions }) {
  return (
    <div style={{ ...styles.roleCard, borderTop: `3px solid ${color}` }}>
      <div style={styles.roleHeader}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ ...styles.roleName, color }}>{role}</span>
      </div>
      <ul style={styles.roleList}>
        {permissions.map((p, i) => (
          <li key={i} style={styles.roleItem}>
            <span style={{ color, fontSize: 11, marginRight: 6 }}>✓</span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FaqItem({ q, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={styles.faqItem}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={styles.faqQ}
      >
        <span>{q}</span>
        <span style={{ fontSize: 16, color: "var(--text3)", transition: "transform 0.2s", transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </button>
      {open && (
        <div style={styles.faqA}>
          {children}
        </div>
      )}
    </div>
  );
}

function InfoBox({ type = "info", children }) {
  const colors = {
    tip: { bg: "var(--jade-dim)", border: "var(--jade)", icon: "💡" },
    info: { bg: "rgba(123,159,255,0.08)", border: "#7B9FFF", icon: "ℹ️" },
    warning: { bg: "var(--gold-dim)", border: "var(--gold)", icon: "⚠️" },
  };
  const c = colors[type];
  return (
    <div style={{
      ...styles.infoBox,
      background: c.bg,
      borderLeft: `3px solid ${c.border}`,
    }}>
      <span style={{ flexShrink: 0 }}>{c.icon}</span>
      <div style={styles.infoText}>{children}</div>
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <pre style={styles.codeBlock}>
      <code>{children}</code>
    </pre>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  root: {
    display: "flex",
    height: "100%",
    minHeight: "100vh",
    background: "var(--bg)",
    color: "var(--text)",
    fontFamily: "var(--sans)",
  },
  sidebar: {
    flexShrink: 0,
    background: "var(--bg2)",
    borderRight: "1px solid var(--border)",
    transition: "width 0.25s",
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
  },
  sidebarInner: {
    width: 220,
    padding: "24px 0 16px",
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px 16px",
    borderBottom: "1px solid var(--border)",
    marginBottom: 8,
  },
  sidebarTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "-0.01em",
  },
  navBtn: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "7px 14px",
    borderRadius: "var(--radius)",
    fontSize: 13,
    border: "none",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    transition: "background 0.12s, color 0.12s",
    margin: "1px 0",
  },
  sidebarFooter: {
    marginTop: "auto",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderTop: "1px solid var(--border)",
  },
  badge: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: "var(--text3)",
    background: "var(--border)",
    padding: "2px 6px",
    borderRadius: 4,
  },
  footerText: {
    fontSize: 11,
    color: "var(--text3)",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
  },
  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "rgba(12,12,15,0.93)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid var(--border)",
    padding: "12px 32px",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flex: 1,
    fontSize: 13,
  },
  breadcrumbRoot: {
    color: "var(--text2)",
  },
  breadcrumbSep: {
    color: "var(--text3)",
  },
  breadcrumbCurrent: {
    color: "var(--text)",
    fontWeight: 500,
  },
  backBtn: {
    background: "var(--bg3)",
    border: "1px solid var(--border2)",
    borderRadius: "var(--radius)",
    color: "var(--text2)",
    cursor: "pointer",
    fontSize: 12,
    padding: "5px 12px",
  },
  iconBtn: {
    background: "none",
    border: "none",
    color: "var(--text3)",
    cursor: "pointer",
    fontSize: 13,
    padding: "4px 6px",
    borderRadius: 4,
    lineHeight: 1,
  },
  body: {
    maxWidth: 860,
    margin: "0 auto",
    padding: "0 32px 80px",
  },
  section: {
    paddingTop: 48,
    paddingBottom: 24,
    borderBottom: "1px solid var(--border)",
  },
  h1: {
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: "-0.025em",
    color: "var(--text)",
    margin: "0 0 12px",
    fontFamily: "var(--serif)",
  },
  h2: {
    fontSize: 17,
    fontWeight: 600,
    color: "var(--text)",
    margin: "28px 0 10px",
    letterSpacing: "-0.015em",
  },
  lead: {
    fontSize: 15,
    color: "var(--text2)",
    lineHeight: 1.6,
    margin: "0 0 24px",
  },
  p: {
    fontSize: 14,
    color: "var(--text2)",
    lineHeight: 1.65,
    margin: "0 0 12px",
  },
  ul: {
    fontSize: 14,
    color: "var(--text2)",
    lineHeight: 1.65,
    paddingLeft: 20,
    margin: "0 0 16px",
  },
  ol: {
    fontSize: 14,
    color: "var(--text2)",
    lineHeight: 1.65,
    paddingLeft: 20,
    margin: "0 0 16px",
  },
  stepsGrid: {
    display: "grid",
    gap: 12,
    marginBottom: 20,
  },
  stepCard: {
    display: "flex",
    gap: 16,
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "16px 20px",
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "var(--jade-dim)",
    border: "1px solid var(--jade)",
    color: "var(--jade)",
    fontSize: 13,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 6,
  },
  stepBody: {
    fontSize: 13,
    color: "var(--text2)",
    lineHeight: 1.55,
  },
  modesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
    gap: 16,
    marginTop: 20,
  },
  modeCard: {
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  modeHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },
  modeIcon: {
    fontSize: 24,
    flexShrink: 0,
    lineHeight: 1,
    marginTop: 2,
  },
  modeName: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "-0.015em",
  },
  modeTagline: {
    fontSize: 12,
    color: "var(--text3)",
    marginTop: 2,
  },
  modeDesc: {
    fontSize: 13,
    color: "var(--text2)",
    lineHeight: 1.55,
    margin: 0,
  },
  modeMeta: {
    display: "flex",
    gap: 6,
    fontSize: 12,
    background: "var(--bg3)",
    border: "1px solid var(--border2)",
    borderRadius: 6,
    padding: "6px 10px",
  },
  modeMetaLabel: {
    color: "var(--text3)",
    fontWeight: 600,
    flexShrink: 0,
  },
  modeMetaText: {
    color: "var(--text2)",
  },
  modeSection: {
    marginTop: 2,
  },
  modeSectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text3)",
    marginBottom: 6,
  },
  modeList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  modeListItem: {
    fontSize: 12,
    color: "var(--text2)",
    lineHeight: 1.5,
    display: "flex",
    gap: 6,
  },
  modeListDot: {
    color: "var(--jade)",
    flexShrink: 0,
    fontSize: 10,
    marginTop: 2,
  },
  modeOutput: {
    marginTop: 4,
    padding: "8px 10px",
    background: "var(--jade-dim)",
    border: "1px solid rgba(0,200,150,0.2)",
    borderRadius: 6,
  },
  modeOutputLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "var(--jade)",
    marginRight: 6,
  },
  modeOutputValue: {
    fontSize: 12,
    color: "var(--text)",
    fontWeight: 500,
  },
  modeOutputCode: {
    fontSize: 10,
    color: "var(--text3)",
    fontFamily: "var(--mono)",
    marginTop: 4,
  },
  rolesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
    marginTop: 20,
  },
  roleCard: {
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "18px 20px",
  },
  roleHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  roleName: {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  roleList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  roleItem: {
    fontSize: 12,
    color: "var(--text2)",
    lineHeight: 1.45,
    display: "flex",
    alignItems: "flex-start",
  },
  faqList: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginTop: 20,
  },
  faqItem: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    overflow: "hidden",
  },
  faqQ: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    padding: "14px 18px",
    background: "var(--bg2)",
    border: "none",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    gap: 16,
  },
  faqA: {
    padding: "14px 18px",
    background: "var(--bg)",
    fontSize: 13,
    color: "var(--text2)",
    lineHeight: 1.6,
    borderTop: "1px solid var(--border)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    marginBottom: 20,
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    overflow: "hidden",
  },
  th: {
    padding: "10px 14px",
    background: "var(--bg3)",
    color: "var(--text2)",
    fontWeight: 600,
    fontSize: 12,
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
    letterSpacing: "0.03em",
  },
  td: {
    padding: "9px 14px",
    color: "var(--text2)",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
  },
  infoBox: {
    display: "flex",
    gap: 10,
    padding: "12px 16px",
    borderRadius: "var(--radius)",
    marginBottom: 16,
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.55,
  },
  infoText: {
    color: "var(--text2)",
  },
  codeBlock: {
    background: "var(--bg3)",
    border: "1px solid var(--border2)",
    borderRadius: "var(--radius)",
    padding: "16px 20px",
    overflow: "auto",
    fontSize: 12,
    lineHeight: 1.6,
    color: "var(--text2)",
    fontFamily: "var(--mono, monospace)",
    marginBottom: 16,
  },
  code: {
    background: "var(--bg3)",
    border: "1px solid var(--border2)",
    borderRadius: 4,
    padding: "2px 6px",
    fontSize: 11,
    fontFamily: "var(--mono, monospace)",
    color: "var(--jade)",
  },
  codeInline: {
    background: "var(--bg3)",
    border: "1px solid var(--border2)",
    borderRadius: 4,
    padding: "1px 5px",
    fontSize: 12,
    fontFamily: "var(--mono, monospace)",
    color: "var(--jade)",
  },
};
