-- ═══════════════════════════════════════════════════════════════
-- PROMO CODES
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════

create table if not exists promo_codes (
  code        text primary key,
  plan        text not null default 'pro',
  max_uses    int,                        -- null = unlimited
  uses        int not null default 0,
  note        text,                       -- e.g. "for coaching friends"
  expires_at  timestamptz,               -- null = never expires
  created_at  timestamptz default now()
);

-- Only service role can insert/update/delete codes
-- Anyone (anon) can call the validate function below
alter table promo_codes enable row level security;

create policy "no public access" on promo_codes
  for all using (false);

-- ── Secure function: validate + atomically increment uses ──────
-- Returns the plan name if valid, null if invalid/expired/maxed out
create or replace function validate_promo_code(p_code text)
returns text
language plpgsql
security definer
as $$
declare
  v_plan      text;
  v_max_uses  int;
  v_uses      int;
  v_expires   timestamptz;
begin
  select plan, max_uses, uses, expires_at
    into v_plan, v_max_uses, v_uses, v_expires
    from promo_codes
   where lower(code) = lower(p_code);

  -- Code not found
  if not found then return null; end if;

  -- Expired
  if v_expires is not null and v_expires < now() then return null; end if;

  -- Max uses hit
  if v_max_uses is not null and v_uses >= v_max_uses then return null; end if;

  -- Valid — increment uses
  update promo_codes set uses = uses + 1 where lower(code) = lower(p_code);

  return v_plan;
end;
$$;

-- ── Seed some starter codes ────────────────────────────────────
-- Add your own here, or add more later via the Supabase dashboard
insert into promo_codes (code, plan, note) values
  ('COACHPAL2025', 'pro', 'General friend code'),
  ('SIDELINE',     'pro', 'Coaching network promo')
on conflict (code) do nothing;
