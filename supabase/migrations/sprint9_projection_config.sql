-- Sprint 9: Projection config surfaces

create table if not exists game_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  template_key text,
  key text not null,
  name text not null,
  is_default boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists boss_profiles (
  id uuid primary key default gen_random_uuid(),
  game_profile_id uuid not null references game_profiles(id) on delete cascade,
  key text not null,
  name text not null,
  theme text,
  icon text,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_profile_id, key)
);

create table if not exists reward_rules (
  id uuid primary key default gen_random_uuid(),
  game_profile_id uuid not null references game_profiles(id) on delete cascade,
  key text not null,
  trigger_type text not null,
  rule jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_profile_id, key)
);

create table if not exists achievement_definitions (
  id uuid primary key default gen_random_uuid(),
  game_profile_id uuid not null references game_profiles(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  icon text,
  rule jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_profile_id, key)
);

create index if not exists idx_game_profiles_org_default on game_profiles(organization_id, is_default);
create index if not exists idx_reward_rules_profile_trigger on reward_rules(game_profile_id, trigger_type);

create or replace function set_updated_at_projection_config()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_game_profiles_updated_at on game_profiles;
create trigger trg_game_profiles_updated_at before update on game_profiles
for each row execute function set_updated_at_projection_config();

drop trigger if exists trg_boss_profiles_updated_at on boss_profiles;
create trigger trg_boss_profiles_updated_at before update on boss_profiles
for each row execute function set_updated_at_projection_config();

drop trigger if exists trg_reward_rules_updated_at on reward_rules;
create trigger trg_reward_rules_updated_at before update on reward_rules
for each row execute function set_updated_at_projection_config();

drop trigger if exists trg_achievement_definitions_updated_at on achievement_definitions;
create trigger trg_achievement_definitions_updated_at before update on achievement_definitions
for each row execute function set_updated_at_projection_config();

-- default seed profile (organization_id null means global baseline)
insert into game_profiles (organization_id, template_key, key, name, is_default, config)
values (
  null,
  null,
  'default-standalone',
  'Default Standalone',
  true,
  jsonb_build_object(
    'mode', 'standalone',
    'pressureModel', 'delivery-pressure-default',
    'rewardModel', 'session-complete-default',
    'worldModel', 'default-world-v1'
  )
)
on conflict do nothing;

with gp as (
  select id from game_profiles where organization_id is null and key = 'default-standalone' limit 1
)
insert into boss_profiles (game_profile_id, key, name, theme, icon, rules)
select gp.id,
       'delivery-pressure-default',
       'Delivery Pressure',
       'execution',
       '👾',
       jsonb_build_object(
         'hpBase', 100,
         'pressureSources', jsonb_build_array('blocked_items', 'scope_spread', 'low_confidence'),
         'hpScale', jsonb_build_object('blocked_items', 12, 'scope_spread', 8, 'low_confidence', 10),
         'states', jsonb_build_object('healthy', jsonb_build_array(0, 29), 'warning', jsonb_build_array(30, 69), 'critical', jsonb_build_array(70, 100))
       )
from gp
where not exists (
  select 1 from boss_profiles bp where bp.game_profile_id = gp.id and bp.key = 'delivery-pressure-default'
);

with gp as (
  select id from game_profiles where organization_id is null and key = 'default-standalone' limit 1
)
insert into reward_rules (game_profile_id, key, trigger_type, rule, is_active)
select gp.id,
       'session-complete-default',
       'session_complete',
       jsonb_build_object(
         'xpBase', 45,
         'comboMultiplier', 5,
         'rewardBadges', jsonb_build_array(
           jsonb_build_object('when', 'root_causes_detected', 'badge', 'risk-badge'),
           jsonb_build_object('when', 'combo_gte_3', 'badge', 'streak-bonus'),
           jsonb_build_object('when', 'lifeline_used', 'badge', 'power-badge'),
           jsonb_build_object('when', 'session_complete', 'badge', 'session-star')
         )
       ),
       true
from gp
where not exists (
  select 1 from reward_rules rr where rr.game_profile_id = gp.id and rr.key = 'session-complete-default'
);

with gp as (
  select id from game_profiles where organization_id is null and key = 'default-standalone' limit 1
)
insert into achievement_definitions (game_profile_id, key, name, description, icon, rule, is_active)
select gp.id, a.key, a.name, a.description, a.icon, a.rule, true
from gp,
(
  values
    ('perfect-sprint', 'Perfect Sprint', 'No critical problems detected in retrospective flow.', '🏆', jsonb_build_object('triggerType', 'retrospective_complete', 'conditions', jsonb_build_array(jsonb_build_object('field', 'bossBattleHp', 'operator', 'eq', 'value', 0)))),
    ('streak-master', 'Streak Master', 'Hit a strong combo chain in session rewards.', '🔥', jsonb_build_object('triggerType', 'session_complete', 'conditions', jsonb_build_array(jsonb_build_object('field', 'combo', 'operator', 'gte', 'value', 3)))),
    ('risk-hunter', 'Risk Hunter', 'Detected multiple root causes in one session.', '🔍', jsonb_build_object('triggerType', 'session_complete', 'conditions', jsonb_build_array(jsonb_build_object('field', 'rootCauses', 'operator', 'gte', 'value', 3))))
) as a(key, name, description, icon, rule)
where not exists (
  select 1 from achievement_definitions ad where ad.game_profile_id = gp.id and ad.key = a.key
);
