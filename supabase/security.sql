-- Palco 21 v10 — hardening e auditoria
create table if not exists public.audit_log(
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists "admins read audit log" on public.audit_log;
create policy "admins read audit log" on public.audit_log for select to authenticated using(public.current_role()='administrador');
drop policy if exists "admins write audit log" on public.audit_log;
create policy "admins write audit log" on public.audit_log for insert to authenticated with check(public.current_role()='administrador');

-- Do not expose operational finance or notification queues to non-admin users.
-- Service-role processes can access these tables outside RLS.

alter table public.teacher_monthly_payments enable row level security;
alter table public.monthly_payments enable row level security;

-- Public leads remain insert-only from the anonymous client and require consent.
drop policy if exists "public create lead" on public.leads;
create policy "public create lead" on public.leads for insert to anon,authenticated
  with check (consent_at is not null and consent_at <= now());

-- Restrict instruments to read-only for regular users.
drop policy if exists "public read instruments" on public.instruments;
create policy "public read instruments" on public.instruments for select to anon,authenticated using(true);
