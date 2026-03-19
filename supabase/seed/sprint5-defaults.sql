-- ============================================================
-- SPRINT 5 SEED DATA — Global Defaults
-- Run AFTER sprint5.sql migration
-- organization_id = NULL means global default (available to all orgs)
-- ============================================================

-- ── Retro Events (from SPRINT_EVENTS in constants.js) ──────

INSERT INTO retro_events (organization_id, cat, icon, title, description, dmg, hp, is_active)
VALUES
  -- Well
  (NULL, 'well',     '✅', 'LEVERET TIL TIDEN',   'Feature/task landed as expected',             15,   NULL, true),
  (NULL, 'well',     '🤝', 'GOD KOMMUNIKATION',    'Teamet holdt hinanden opdaterede',            12,   NULL, true),
  (NULL, 'well',     '🔥', 'TEKNISK FREMSKRIDT',   'Vi betalte teknisk gæld ned',                 18,   NULL, true),

  -- Wrong
  (NULL, 'wrong',    '💥', 'SCOPE CREEP',          'Opgaven voksede undervejs uden aftale',       NULL, 20,   true),
  (NULL, 'wrong',    '🐛', 'BUGS I PROD',          'Vi sendte fejl til production',               NULL, 25,   true),
  (NULL, 'wrong',    '🗣️', 'BLOCKER FOR SENT',    'Vi sad stille for længe med en blocker',      NULL, 15,   true),
  (NULL, 'wrong',    '📄', 'MANGLENDE SPEC',       'Vi startede uden tydelige krav',              NULL, 20,   true),

  -- Improve
  (NULL, 'improve',  '🔄', 'REVIEW PROCESSEN',     'PR review var flaskehals eller manglede',     5,    10,   true),
  (NULL, 'improve',  '📊', 'ESTIMERING',           'Estimater ramte ikke',                        5,    10,   true),
  (NULL, 'improve',  '🧪', 'TEST COVERAGE',        'Vi testede for lidt eller for sent',          5,    12,   true),

  -- Surprise
  (NULL, 'surprise', '😱', 'UVENTET AFHÆNGIGHED',  'En afhængighed vi ikke kendte til dukkede op', NULL, 20, true),
  (NULL, 'surprise', '🌀', 'UVENTET KOMPLEKSITET', 'Opgaven var langt sværere end antaget',        NULL, 25, true)
ON CONFLICT DO NOTHING;

-- ── Challenges (from ROULETTE_CHALLENGES in constants.js) ──

INSERT INTO challenges (organization_id, cat, icon, title, description, modifier, color, is_active)
VALUES
  -- Human
  (NULL, 'human', '🏖️',  'IT HAR FERIE',                    'Nøglepersonen er på ferie i 2 uger. Hvem overtager?',                           1.5, '#feae34', true),
  (NULL, 'human', '🧑‍💻', 'SINGLE POINT OF KNOWLEDGE',        'Kun én person forstår den kode. Han er syg.',                                   2.0, '#e04040', true),
  (NULL, 'human', '🔄',  'NY UDVIKLER PÅ HOLDET',            'Junior starter mandag. On-boarding tager tid.',                                 1.3, '#feae34', true),
  (NULL, 'human', '🤷',  'PRODUCT OWNER UTILGÆNGELIG',        'PO er i møde hele ugen. Ingen kan godkende krav.',                              1.4, '#feae34', true),
  (NULL, 'human', '💼',  'KONSULENT STOPPER',                 'Ekstern konsulent forlader projektet om 3 dage.',                               1.8, '#e04040', true),

  -- Tech
  (NULL, 'tech',  '📉',  'USTABILT MILJØ',                   'Test-serveren crasher under load. CI/CD er ude.',                               1.6, '#d77643', true),
  (NULL, 'tech',  '🧱',  'LEGACY INTEGRATION',               'Systemet skal snakke med et 20 år gammelt AS/400.',                             2.0, '#e04040', true),
  (NULL, 'tech',  '🔒',  'SIKKERHEDSKRAV DUKKER OP',         'GDPR-review kræver ekstra audit trail og kryptering.',                          1.7, '#d77643', true),
  (NULL, 'tech',  '📦',  'DEPENDENCY OPDATERING',            'Kritisk npm-pakke har breaking changes i ny version.',                          1.4, '#feae34', true),
  (NULL, 'tech',  '🐛',  'SKJULT TEKNISK GÆLD',             'Koden har ingen tests. Refaktor kræves før feature.',                           1.8, '#e04040', true),
  (NULL, 'tech',  '🌐',  'API ÆNDRET UDEN VARSEL',           'Ekstern leverandør har ændret endpoint-struktur.',                              1.5, '#d77643', true),

  -- Extern
  (NULL, 'extern','🔄',  'KUNDEN ÆNDRER KRAV',               'Midt i sprinten kommer ny feature-request fra direktionen.',                    1.6, '#f04f78', true),
  (NULL, 'extern','📄',  'DOKUMENTATION MANGLER',            'Ingen spec overhovedet. Dev skal selv analysere og dokumentere.',               1.5, '#d77643', true),
  (NULL, 'extern','🏛️',  'MYNDIGHEDSKRAV',                   'NIS2-direktiv kræver compliance-ændringer inden release.',                      2.0, '#e04040', true),
  (NULL, 'extern','⚖️',  'JURIDISK REVIEW',                  'Advokat skal godkende data-behandlingsaftale. 2 uger.',                         1.4, '#feae34', true),
  (NULL, 'extern','🧪',  'UAT FAILER',                       'Kunden finder showstopper-bug i UAT. Scope udvides.',                           1.6, '#f04f78', true),
  (NULL, 'extern','🏢',  'TREDJEPARTSLEVERANDØR FORSINKET',  'Azure AD-integration venter på svar fra Microsoft support.',                    1.5, '#d77643', true),
  (NULL, 'extern','💸',  'BUDGET SKÆRES',                    'Kunden reducerer hours med 20%. Scope skal prioriteres.',                       1.3, '#feae34', true)
ON CONFLICT DO NOTHING;
