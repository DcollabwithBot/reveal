/**
 * Tour steps — 9 steps der guider brugeren gennem Reveal
 * Matcher spec i docs/GUIDED-TOUR.md
 * Alle tooltips er på dansk.
 */

export const TOUR_STEPS = [
  {
    target: '[data-tour="dashboard-kpi"]',
    title: "Velkommen til Reveal! 🎮",
    content: "Her er dit PM-overblik — projekter, velocity, risici og pending approvals. Alt på ét sted, realtime.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="dashboard-projects"]',
    title: "Dine projekter",
    content: "Hvert projekt er en verden. Klik på et projekt for at dykke ind i sprints, backlog og teamet. Startér sessioner direkte herfra.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="world-portals"]',
    title: "World Map 🗺️",
    content: "Hvert projekt er en portal på kortet. NPC-teammedlemmer vandrer foran. Klik på en portal for at åbne projektets Overworld.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="overworld-nodes"]',
    title: "Sprint-items er nodes",
    content: "Grå nodes er uafsluttede backlog-items. Grønne er estimerede. Røde har høj risiko. Klik på en node for at starte en session på det item.",
    placement: "right",
    disableBeacon: true,
  },
  {
    target: '[data-tour="overworld-boss"]',
    title: "Bossen er din deadline 👾",
    content: "Boss HP-baren tæller ned mod sprint-deadline. Jo tættere på 0, desto mere haster det. Nedkald bossen ved at estimere og lukke items.",
    placement: "left",
    disableBeacon: true,
  },
  {
    target: '[data-tour="session-launch-items"]',
    title: "Vælg items til session",
    content: "Vælg hvilke backlog-items I vil estimere. Kan vælge én eller flere ad gangen. Active missions vises her — fuldend dem for bonus XP.",
    placement: "top",
    disableBeacon: true,
  },
  {
    target: '[data-tour="session-poker-cards"]',
    title: "Stem med Fibonacci-kort 🃏",
    content: "Alle vælger et kort simultant — ingen ser andres estimat inden afstemning. Eliminerer anchoring-bias. Bossen tager skade ved konsensus!",
    placement: "top",
    disableBeacon: true,
  },
  {
    target: '[data-tour="workspace-approvals"]',
    title: "GM godkender estimater ✅",
    content: "Votes fra sessionen lander her som 'pending'. GM (dig) approver → de skrives til backloggen. Spillet skriver ALDRIG direkte til PM-data.",
    placement: "right",
    disableBeacon: true,
  },
  {
    target: '[data-tour="leaderboard-table"]',
    title: "Leaderboard 🏆",
    content: "Se hvem der er mest aktiv. XP optjenes ved estimerings-sessions, achievements og daily missions. Nu er det din tur — prøv selv! →",
    placement: "top",
    disableBeacon: true,
  },
];

/**
 * Tæller steps (brugt i progress indicator)
 */
export const TOUR_TOTAL_STEPS = TOUR_STEPS.length;
