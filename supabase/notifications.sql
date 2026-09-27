create table if not exists public.notification_queue(
 id uuid primary key default gen_random_uuid(),
 channel text not null check(channel in ('email','sms')),
 recipient text not null,
 subject text,
 body text not null,
 event_type text not null,
 related_id uuid,
 status text not null default 'queued' check(status in ('queued','sending','sent','failed')),
 attempts integer not null default 0,
 provider_id text,
 error text,
 scheduled_for timestamptz not null default now(),
 sent_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists notification_queue_status_idx on public.notification_queue(status,scheduled_for);
alter table public.notification_queue enable row level security;
drop policy if exists "admin read notification queue" on public.notification_queue;
create policy "admin read notification queue" on public.notification_queue for select to authenticated using(public.current_role()='administrador');
drop policy if exists "admin insert notification queue" on public.notification_queue;
create policy "admin insert notification queue" on public.notification_queue for insert to authenticated with check(public.current_role()='administrador');
