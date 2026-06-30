create extension if not exists pgcrypto;

-- =========================================================
-- 0) 공통: updated_at 자동 갱신 트리거 함수
-- =========================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- =========================================================
-- 1) strategies
-- =========================================================
create table strategies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  status      text not null default 'active'
              check (status in ('active','testing','paused','retired')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);
create trigger strategies_updated_at before update on strategies
  for each row execute function set_updated_at();

-- =========================================================
-- 2) rules  (사용자가 정의하는 매매 규칙)
-- =========================================================
create table rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- =========================================================
-- 3) trades
-- =========================================================
create table trades (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  exchange      text not null,
  symbol        text not null,
  side          text not null check (side in ('long','short')),
  status        text not null default 'closed' check (status in ('open','closed')),

  entry_time    timestamptz not null,
  exit_time     timestamptz,

  entry_price   numeric(20,8) not null,
  exit_price    numeric(20,8),
  quantity      numeric(20,8) not null,
  leverage      numeric(10,2),
  notional_usd  numeric(20,8),

  planned_stop   numeric(20,8),
  planned_target numeric(20,8),
  initial_risk   numeric(20,8),
  r_multiple     numeric(12,4),

  gross_pnl     numeric(20,8),
  fee           numeric(20,8) default 0,
  funding       numeric(20,8) default 0,
  net_pnl       numeric(20,8),
  pnl_percent   numeric(12,4),

  strategy_id   uuid references strategies(id) on delete set null,
  hypothesis    text,
  setup_reason  text,
  exit_reason   text,
  retro_note    text,
  notes         text,
  emotion       text check (emotion is null or emotion in
                  ('calm','confident','fearful','greedy','fomo','revenge','bored','frustrated')),
  mistake_type  text check (mistake_type is null or mistake_type in
                  ('none','late_stop','no_stop','early_exit','oversize',
                   'revenge_trade','chasing','plan_deviation','overtrading')),

  source             text not null default 'manual'
                     check (source in ('manual','csv','hyperliquid')),
  external_trade_ids text[],
  dedup_key          text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (user_id, dedup_key)
);
create trigger trades_updated_at before update on trades
  for each row execute function set_updated_at();

create index trades_user_entry_idx    on trades (user_id, entry_time desc);
create index trades_user_strategy_idx on trades (user_id, strategy_id);
create index trades_user_symbol_idx   on trades (user_id, symbol);
create index trades_user_status_idx   on trades (user_id, status);

-- =========================================================
-- 4) trade_rules  (거래별 규칙 준수/위반 — 구조화)
--    RLS 단순화를 위해 user_id 비정규화 포함
-- =========================================================
create table trade_rules (
  trade_id uuid not null references trades(id) on delete cascade,
  rule_id  uuid not null references rules(id)  on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  status   text not null check (status in ('followed','violated')),
  primary key (trade_id, rule_id)
);
create index trade_rules_user_idx on trade_rules (user_id);

-- =========================================================
-- 5) screenshots  (거래 1 : N 스크린샷)
-- =========================================================
create table screenshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  trade_id     uuid not null references trades(id) on delete cascade,
  storage_path text not null,
  caption      text,
  created_at   timestamptz not null default now()
);
create index screenshots_trade_idx on screenshots (trade_id);

-- =========================================================
-- 6) ai_reviews
-- =========================================================
create table ai_reviews (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  period_start      timestamptz not null,
  period_end        timestamptz not null,
  scope_type        text not null default 'all'
                    check (scope_type in ('all','losses','strategy','symbol','trade')),
  scope_value       text,
  trade_count       integer not null default 0,
  input_summary_json jsonb,
  result_json       jsonb,
  summary_text      text,
  process_score     integer check (process_score is null or process_score between 0 and 100),
  outcome_pnl       numeric(20,8),
  confidence        text check (confidence is null or confidence in ('low','medium','high')),
  model             text,
  prompt_version    text,
  token_usage       jsonb,
  status            text not null default 'pending'
                    check (status in ('pending','done','failed')),
  error_message     text,
  created_at        timestamptz not null default now()
);
create unique index ai_reviews_dedup_idx on ai_reviews
  (user_id, period_start, period_end, scope_type, coalesce(scope_value, ''));
create index ai_reviews_user_created_idx on ai_reviews (user_id, created_at desc);

-- =========================================================
-- 7) imports
-- =========================================================
create table imports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  source         text not null check (source in ('csv','hyperliquid')),
  file_name      text,
  storage_path   text,
  status         text not null default 'pending'
                 check (status in ('pending','done','failed','partial')),
  imported_count integer not null default 0,
  skipped_count  integer not null default 0,
  error_message  text,
  row_errors     jsonb,
  created_at     timestamptz not null default now()
);

-- =========================================================
-- 8) trade_fills  (선택 — Phase 4 Hyperliquid fill 보관)
-- =========================================================
create table trade_fills (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  trade_id         uuid references trades(id) on delete cascade,
  external_fill_id text,
  symbol           text,
  side             text,
  price            numeric(20,8),
  quantity         numeric(20,8),
  fee              numeric(20,8),
  filled_at        timestamptz,
  raw              jsonb,
  unique (user_id, external_fill_id)
);

-- =========================================================
-- 9) RLS  (전 테이블)
-- =========================================================
alter table strategies   enable row level security;
alter table rules        enable row level security;
alter table trades       enable row level security;
alter table trade_rules  enable row level security;
alter table screenshots  enable row level security;
alter table ai_reviews   enable row level security;
alter table imports      enable row level security;
alter table trade_fills  enable row level security;

create policy own_strategies  on strategies  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_rules       on rules       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_trades      on trades      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_trade_rules on trade_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_screenshots on screenshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_ai_reviews  on ai_reviews  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_imports     on imports     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_trade_fills on trade_fills for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================
-- 10) Storage: trade screenshots
-- =========================================================
insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', false)
on conflict (id) do nothing;

create policy trade_screenshots_select on storage.objects
  for select using (
    bucket_id = 'trade-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy trade_screenshots_insert on storage.objects
  for insert with check (
    bucket_id = 'trade-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy trade_screenshots_update on storage.objects
  for update using (
    bucket_id = 'trade-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'trade-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy trade_screenshots_delete on storage.objects
  for delete using (
    bucket_id = 'trade-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
