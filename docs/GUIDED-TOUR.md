# Reveal — Interaktiv Guided Tour

**Oprettet:** 2026-03-21
**Status:** Klar til implementering

---

## Koncept

Interaktiv step-by-step tour der guider brugeren gennem Reveal. Bruger rigtige UI-komponenter (ikke screenshots) med tooltip-overlay der highlighter og forklarer hvert element.

Inspireret af: CIPP tutorials (https://docs.cipp.app/demos/tutorials), Storylane-stil interaktive guider.

## Tre kontekster — samme tour-engine

### 1. Demo (`/demo`)
- Ingen login krævet
- Pre-seedet demo-data (Acme Development org, 2 projekter, sprints, items, team)
- Fuld guided tour kører automatisk
- CTA til signup ved afslutning
- **Link fra Landing page + markedsføring**

### 2. Onboarding (efter første signup)
- Kører automatisk for nye brugere (kan skippes/fravælges)
- Bruger brugerens egne data (eller demo-data hvis tom org)
- Markeres som completed i `profiles.onboarding_completed`
- Kan genstartes fra Settings

### 3. Udforsk (`/docs` → "Interaktiv Guide" sektion)
- Tilgængelig fra docs-siden
- Bruger kan vælge hvilken del af platformen de vil udforske
- Delt op i mini-tours per feature-område

## Tour-flow (9 steps)

| Step | Screen | Hvad brugeren ser | Hvad tooltip siger |
|---|---|---|---|
| 1 | Dashboard | KPI cards, projekter | "Velkommen! Her er dit overblik — projekter, velocity, risici" |
| 2 | World Map | Projekt-portaler | "Hvert projekt er en verden. Klik på en for at dykke ind" |
| 3 | Overworld | Nodes, boss, team | "Sprint-items er nodes på kortet. Bossen er din deadline" |
| 4 | SessionLaunchModal | Mode-valg, items | "Vælg en game mode og de items du vil estimere" |
| 5 | Planning Poker | Fibonacci kort, boss HP | "Stem med Fibonacci-kort. Bossen tager skade!" |
| 6 | Results | Konsensus, XP | "Konsensus opnået! Du har optjent XP" |
| 7 | ProjectWorkspace | Godkendelser tab | "GM godkender estimater → de lander i backloggen" |
| 8 | Sessions tab | Session-historik | "Al session-historik er synlig her" |
| 9 | Leaderboard | XP ranking | "Se hvem der er mest aktiv. Prøv selv! →" |

## Teknisk

### Bibliotek: `react-joyride`
- ~12KB gzipped
- Step-baseret med tooltips, spotlight, callbacks
- Keyboard navigation + mobile support
- Custom styling via props

### Tour-konfiguration
```
app/src/
  tour/
    tourSteps.js        → alle steps som config-array
    tourData.js          → demo seed data (Acme Development)
    TourProvider.jsx     → context der styrer tour-state
    useTour.js           → hook: startTour(), skipTour(), currentStep
```

### Demo data (tourData.js)
```js
export const DEMO_ORG = {
  name: "Acme Development",
  projects: [
    { name: "Kundeportal v2", icon: "🏰", sprint: "Sprint 7", items: 8 },
    { name: "API Modernisering", icon: "⚔️", sprint: "Sprint 3", items: 12 },
  ],
  team: [
    { name: "Anna K.", class: "mage", level: 7, xp: 2340 },
    { name: "Thomas H.", class: "warrior", level: 5, xp: 1820 },
    { name: "Sara M.", class: "healer", level: 4, xp: 1250 },
    { name: "Emil R.", class: "archer", level: 3, xp: 890 },
  ],
};
```

### Ajourføring ved ændringer
- Tour steps refererer til CSS selectors / data-tour attributes
- Når UI ændres: tilføj `data-tour="step-name"` til nye elementer
- Tour-config er ét sted (tourSteps.js) — ét sted at opdatere
- **Regel for agenter:** Når en screen ændres der er del af touren, opdatér `data-tour` attributes og tourSteps.js

### Onboarding integration
```js
// I App.jsx efter login:
if (!user.onboarding_completed && !user.tour_skipped) {
  startTour('onboarding');
}
```

### DB
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tour_skipped BOOLEAN DEFAULT FALSE;
```

## Krav
- Dansk tekst i alle tooltips
- Skal virke på mobil (responsive tooltips)
- Skip-knap altid synlig
- Progress indicator (Step 3 af 9)
- Kan genstartes fra Settings + /docs
