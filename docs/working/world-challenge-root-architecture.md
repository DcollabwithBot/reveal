# Reveal — world / challenge / root architecture

## TL;DR

Målet er simpelt:
- `root` = gemte fakta / source-of-truth
- `world` = ren projection af root + config
- `challenge` = den spilbare enhed, bygget ovenpå world
- `Session.jsx` = orchestration + rendering, ikke domænemotor

Den nuværende `Session.jsx` bærer stadig for meget ansvar:
- fetch af config + approval state
- boss/reward/challenge-beregning
- roulette / retro / boss battle state
- advisory/writeback-trigger
- UI rendering

Det er præcis derfor `world/challenge/root` skal splittes rent.

---

## 1) Konkret mappe-/filstruktur

Anbefalet struktur under `app/src/`:

```text
app/src/
  domain/
    session/
      root/
        types.ts
        selectors.ts
        normalizers.ts
      world/
        projectWorld.ts
        worldLabels.ts
        worldRules.ts
      challenge/
        buildChallenge.ts
        challengeRules.ts
        challengeTypes.ts
      rewards/
        buildRewardLoot.ts
        achievements.ts
      boss/
        bossProjection.ts
      governance/
        approvalProjection.ts
      index.ts

  services/
    session/
      loadSessionContext.ts
      loadProjectionConfig.ts
      advisoryRequests.ts

  shared/
    projection.js          # transitional adapter; udfases gradvist
    constants.js
    utils.js

  screens/
    Session.jsx
```

### Ansvar pr. område

- `domain/session/root/`
  - kanoniske facts
  - typekontrakter for persisted/runtime root state
  - selectors og normalisering af inddata fra API/UI

- `domain/session/world/`
  - bygger `WorldProjection` fra root + config
  - beregner labels, tone, difficulty, progress, warnings, preview-data
  - ingen writes, ingen network

- `domain/session/challenge/`
  - bygger `ChallengeModel` fra root + world + config
  - afgør objective, blockedReason, action labels, rewards, boss/side-quest mode

- `domain/session/rewards/`
  - reward- og achievement-logik
  - flytter nuværende `buildRewardLoot` og achievement-resolution ud af generisk shared-fil

- `domain/session/boss/`
  - boss profile lookup
  - hp/damage/bonus projection
  - flytter nuværende boss-relaterede helpers ud af `shared/projection.js`

- `domain/session/governance/`
  - advisory/approval overlay-projection
  - afleder UI-state fra approval state + root governance

- `services/session/`
  - API-kald og I/O
  - `getProjectionConfig`, `getLatestApprovalState`, `submitAdvisoryRequest`
  - holder netværk væk fra domænemodulerne

### Hvad bliver hvorfra i nuværende kode

Nu i `Session.jsx`:
- `resolveBossProfile`, `getBossHpBase`, `getBossDamageMultiplier`, `getChallengeBonusHp`
- `buildRewardLoot`, achievement-resolver
- approval-state labels/farver
- challenge side effects og boss-regen

Bør flyttes sådan:
- boss helpers → `domain/session/boss/bossProjection.ts`
- reward helpers → `domain/session/rewards/buildRewardLoot.ts`
- achievement resolver → `domain/session/rewards/achievements.ts`
- approval label/color → `domain/session/governance/approvalProjection.ts`
- roulette/boss/challenge derivation → `domain/session/challenge/buildChallenge.ts`

---

## 2) Funktionssignaturer / interfaces for projection pipeline

Nedenfor er den anbefalede pipeline. TypeScript-navne er bevidst konkrete, selv hvis første implementation starter i JS.

### Root contracts

```ts
export type WorkItemKind = 'task' | 'quest' | 'boss' | 'approval' | null
export type WorkItemStatus = 'idle' | 'active' | 'blocked' | 'done'
export type ApprovalState = 'none' | 'pending_approval' | 'approved' | 'rejected' | 'applied'

export type RootState = {
  sessionId: string
  projectId: string | null
  nodeId: string | null
  actorId: string | null

  mode: 'poker' | 'roulette' | 'boss-retro'

  workItem: {
    id: string | null
    kind: WorkItemKind
    title: string | null
    status: WorkItemStatus
    priority: number | null
  }

  estimation: {
    selectedVote: number | null
    initialVote: number | null
    teamVotes: Array<{ memberId: number; value: number }>
    revealed: boolean
    confidence: number | null
    spread: number | null
    average: number | null
  }

  progression: {
    combo: number
    xp: number
    level: number
    streak: number
    bossId: string | null
    challengeId: string | null
  }

  governance: {
    approvalState: ApprovalState
    approvalRequired: boolean
    writebackAllowed: boolean
    advisoryPending: boolean
  }

  battle: {
    bossHp: number
    bossMaxHp: number
    bossDead: boolean
    activeChallengeModifier: number | null
    activeChallengeTitle: string | null
  }

  retro: {
    currentEventIndex: number
    oracleUsed: boolean
    oracleEvents: string[]
    problemEvents: string[]
    rootCauses: Record<string, string[]>
  }

  telemetry: {
    startedAt: string | null
    updatedAt: string
    completedSteps: number
    totalSteps: number
  }

  flags: {
    hasBlockingIssue: boolean
    isBossFight: boolean
    isRevoting: boolean
    lootVisible: boolean
  }
}
```

### Projection config contract

```ts
export type ProjectionConfig = {
  bossProfiles: unknown[]
  rewardRules: unknown[]
  achievements: unknown[]
  challengeProfiles?: unknown[]
  worldProfiles?: unknown[]
}
```

### World projection

```ts
export type WorldProjection = {
  theme: {
    worldId: string
    worldLabel: string
    zoneLabel: string
    tone: 'calm' | 'tense' | 'epic'
  }

  player: {
    level: number
    xp: number
    streak: number
    energy: 'low' | 'medium' | 'high'
  }

  encounter: {
    bossId: string | null
    bossLabel: string | null
    challengeId: string | null
    challengeLabel: string | null
    difficulty: 'trivial' | 'normal' | 'hard' | 'boss'
  }

  progress: {
    current: number
    total: number
    percent: number
    statusLabel: string
  }

  rewards: {
    previewXp: number
    previewLoot: Array<{ icon: string; label: string; color?: string }>
    unlocks: string[]
  }

  governance: {
    approvalLabel: string
    approvalColor: string
    warning: string | null
    canSubmitAdvisory: boolean
  }

  ui: {
    showBossPanel: boolean
    showRewardPreview: boolean
    showApprovalGate: boolean
    showChallengePrompt: boolean
  }
}
```

### Challenge model

```ts
export type ChallengeModel = {
  id: string
  kind: 'task-run' | 'cleanup' | 'boss' | 'approval' | 'side-quest'

  objective: {
    title: string
    description: string
    winCondition: string
    failureState?: string
  }

  rules: {
    canStart: boolean
    blockedReason: string | null
    requiresApproval: boolean
    writebackOnComplete: boolean
    modifier: number
  }

  rewards: {
    xp: number
    loot: Array<{ icon: string; label: string; color?: string }>
    bossDamage?: number
  }

  actions: {
    primaryLabel: string
    secondaryLabel?: string
    completeLabel?: string
  }
}
```

### Services / loaders

```ts
export async function loadProjectionConfig(): Promise<ProjectionConfig>
export async function loadApprovalState(targetId: string): Promise<ApprovalState>
export async function submitAdvisoryRequest(input: AdvisoryRequestInput): Promise<{ state: ApprovalState }>
```

### Root builders / normalizers

```ts
export function createRootState(input: {
  avatar: unknown
  node: unknown
  project: unknown
  approvalState: ApprovalState
  projectionConfig: ProjectionConfig | null
}): RootState

export function patchRootState(root: RootState, patch: Partial<RootState>): RootState
```

### Pure projection functions

```ts
export function projectBoss(root: RootState, config: ProjectionConfig | null): {
  bossId: string | null
  bossLabel: string | null
  bossMaxHp: number
  bossDamageMultiplier: number
  challengeBonusHp: (modifier: number) => number
}

export function projectRewards(root: RootState, config: ProjectionConfig | null): WorldProjection['rewards']

export function projectGovernance(root: RootState): WorldProjection['governance']

export function projectWorld(root: RootState, config: ProjectionConfig | null): WorldProjection

export function buildChallenge(root: RootState, world: WorldProjection, config: ProjectionConfig | null): ChallengeModel | null
```

### UI-facing selectors

```ts
export function getSessionViewModel(input: {
  root: RootState
  config: ProjectionConfig | null
}): {
  world: WorldProjection
  challenge: ChallengeModel | null
}
```

### Vigtig regel for signaturerne

- Ingen af projection-funktionerne må kalde API
- Ingen af projection-funktionerne må bruge React state direkte
- De må kun tage data ind og returnere data ud

---

## 3) Migrationsplan fra nuværende `Session.jsx`

Planen er bevidst kort og operationel.

### Fase 1 — Extract uden adfærdsændring

Mål:
- flyt ren logik ud af `Session.jsx`
- ingen visuel redesign
- ingen behavior drift

Gør dette først:
- opret `domain/session/boss/bossProjection.ts`
- opret `domain/session/rewards/buildRewardLoot.ts`
- opret `domain/session/rewards/achievements.ts`
- opret `domain/session/governance/approvalProjection.ts`
- lad `Session.jsx` importere derfra i stedet for `shared/projection.js`

Succes-kriterie:
- build grøn
- samme UI-output som nu
- `Session.jsx` mister de første 100-150 linjer helperansvar

### Fase 2 — Indfør `RootState`

Mål:
- samle facts ét sted
- stoppe implicit derivation spredt over hele komponenten

Gør dette:
- opret `domain/session/root/types.ts`
- opret `domain/session/root/selectors.ts`
- indfør `createRootState(...)`
- beregn `allV`, `avg`, `spread`, approval status, battle mode, challenge modifier via selectors i stedet for inline-lokale variabler

Succes-kriterie:
- alle persisted/runtime facts kan peges tilbage til `root`
- inline helper-kaos omkring votes/approval/challenge reduceres markant

### Fase 3 — Indfør `projectWorld(root, config)`

Mål:
- få world-laget ud af JSX
- gøre UI til ren consumer

Gør dette:
- opret `domain/session/world/projectWorld.ts`
- flyt boss labels, difficulty, progress labels, approval label/color, reward preview og warnings over i projection
- erstat inline UI-beslutninger i `Session.jsx` med `world.*`

Eksempler fra nuværende komponent:
- `approvalStateLabel(approvalState)` → `world.governance.approvalLabel`
- `approvalStateColor(approvalState)` → `world.governance.approvalColor`
- `bossName/maxHp/bossDamageMultiplier` → `world.encounter + boss projection`

Succes-kriterie:
- `Session.jsx` spørger ikke længere selv: “hvad skal vises?”
- den spørger kun: “hvad siger world?”

### Fase 4 — Indfør `buildChallenge(root, world, config)`

Mål:
- isolere gameplay-beslutninger
- holde roulette/boss/task som samme domænemønster

Gør dette:
- opret `domain/session/challenge/buildChallenge.ts`
- flyt beslutning om challenge title, modifier, blockedReason, action labels, reward outcome og writeback-on-complete herind
- lad `handleChallengeComplete(...)` opdatere root-data, ikke selv beregne boss-regen og labels

Succes-kriterie:
- challenge-logik er ét sted
- `Session.jsx` er ikke længere game-engine

### Fase 5 — Tynd `Session.jsx` aggressivt ned

End-state:
- fetch services i toppen
- root state som lokal orchestrator-state
- `const { world, challenge } = getSessionViewModel(...)`
- JSX renderer kun
- event handlers opdaterer root eller trigger service calls

Det er først her komponenten er “stabil” i arkitektonisk forstand.

---

## Helt konkret: hvad er galt i den nuværende komponent?

Tre mønstre skaber skrøbelighed:

### 1. Rendering + domain-beslutninger er blandet sammen
Eksempler:
- challenge completion ændrer boss HP direkte i UI-handler
- approval label/color ligger som UI-helper i samme fil
- reward generation sker ved finish i komponenten

### 2. Root facts og derived facts er blandet sammen
Eksempler:
- `bossHp`, `maxHp`, `bossDamageMultiplier`, `activeChallenge`, `approvalState`, `projectionConfig` lever side om side uden tydelig kontrakt
- nogle ting er kanoniske facts, andre er kun projections, men de behandles næsten ens

### 3. Session-komponenten fungerer som policy-lag
Eksempler:
- `sendToApprovalQueue()` bygger governance/advisory payload inline
- retro, roulette, boss, reward og approval lever i samme state-maskine

Det er præcis det nye split skal dræbe.

---

## Anbefalet implementeringsrækkefølge

Hvis det skal gøres uden at knække flowet igen:

1. Extract helpers
2. Indfør `RootState`
3. Indfør `projectWorld(...)`
4. Indfør `buildChallenge(...)`
5. Tynd `Session.jsx` ned
6. Først derefter: evt. rename/flyt `shared/projection.js` til domain-lag

Ikke omvendt.

---

## Done-definition for dette spor

Sporet er først reelt færdigt når:
- `Session.jsx` ikke længere ejer boss/reward/world-policy
- projection-funktioner er pure
- challenge-beslutninger ligger ét sted
- approval overlay er projected state, ikke inline view-hjælp
- en ny udvikler kan læse dataflowet som:
  - load data
  - build root
  - project world
  - build challenge
  - render UI
