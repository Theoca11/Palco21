create extension if not exists pgcrypto;
do $$ begin create type public.user_role as enum ('administrador','professor','aluno_encarregado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.reschedule_status as enum ('pendente','aprovado','rejeitado'); exception when duplicate_object then null; end $$;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,role public.user_role not null,full_name text not null,email text,phone text,notes text,created_at timestamptz not null default now());
create table if not exists public.teachers(id uuid primary key default gen_random_uuid(),profile_id uuid unique references public.profiles(id) on delete set null,specialty text,active boolean not null default true);
create table if not exists public.students(id uuid primary key default gen_random_uuid(),profile_id uuid unique references public.profiles(id) on delete set null,full_name text,phone text,email text,guardian_name text,guardian_phone text,guardian_email text,status text not null default 'ativo',important_notes text,created_at timestamptz not null default now());
create table if not exists public.instruments(id uuid primary key default gen_random_uuid(),name text unique not null);
create table if not exists public.student_instruments(student_id uuid not null references public.students(id) on delete cascade,instrument_id uuid not null references public.instruments(id) on delete restrict,primary key(student_id,instrument_id));
create table if not exists public.lessons(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id) on delete cascade,teacher_id uuid not null references public.teachers(id) on delete restrict,instrument_id uuid not null references public.instruments(id) on delete restrict,starts_at timestamptz not null,duration_minutes integer not null default 50 check(duration_minutes=50),status text not null default 'agendada',notes text,created_at timestamptz not null default now());
create table if not exists public.reschedule_requests(id uuid primary key default gen_random_uuid(),lesson_id uuid not null references public.lessons(id) on delete cascade,requested_by uuid references public.profiles(id) on delete set null,requested_at timestamptz not null default now(),proposed_starts_at timestamptz,reason text,status public.reschedule_status not null default 'pendente',decided_by uuid references public.profiles(id) on delete set null,decided_at timestamptz,decision_note text);
create table if not exists public.monthly_payments(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id) on delete cascade,month date not null,amount numeric(10,2) not null,status text not null default 'pendente',paid_at timestamptz,unique(student_id,month));
create table if not exists public.teacher_monthly_payments(id uuid primary key default gen_random_uuid(),teacher_id uuid not null references public.teachers(id) on delete cascade,month date not null,assigned_students integer not null default 0,rate_per_student numeric(10,2) not null default 20,amount numeric(10,2) generated always as(assigned_students*rate_per_student) stored,unique(teacher_id,month));
create table if not exists public.leads(id uuid primary key default gen_random_uuid(),name text,email text,phone text,preferred_contact text,interest_instrument_id uuid references public.instruments(id) on delete set null,source text,campaign text,funnel_stage text not null default 'visit',consent_at timestamptz,created_at timestamptz not null default now());
insert into public.instruments(name) values('Guitarra'),('Piano'),('Baixo'),('Bateria'),('Canto'),('Ukulele') on conflict(name) do nothing;

create or replace function public.current_role() returns public.user_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;
create or replace function public.current_teacher_id() returns uuid language sql stable security definer set search_path=public as $$ select id from public.teachers where profile_id=auth.uid() $$;

create or replace function public.validate_lesson_overlap() returns trigger language plpgsql security definer set search_path=public as $$
declare overlap_exists boolean; same_teacher boolean; role public.user_role;
begin
  role := public.current_role();
  select exists(select 1 from public.lessons l where l.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid) and l.starts_at < new.starts_at + interval '50 minutes' and l.starts_at + interval '50 minutes' > new.starts_at),
         exists(select 1 from public.lessons l where l.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid) and l.teacher_id=new.teacher_id and l.starts_at < new.starts_at + interval '50 minutes' and l.starts_at + interval '50 minutes' > new.starts_at)
    into overlap_exists,same_teacher;
  if overlap_exists and role='administrador' then raise exception 'Não é permitido criar aulas sobrepostas como administrador'; end if;
  if overlap_exists and role='professor' and new.teacher_id<>public.current_teacher_id() then raise exception 'Só pode gerir horários do próprio perfil'; end if;
  if overlap_exists and role='professor' and not same_teacher then raise exception 'O professor não pode sobrepor aulas de outro professor'; end if;
  return new;
end $$;
drop trigger if exists lessons_overlap_guard on public.lessons;
create trigger lessons_overlap_guard before insert or update on public.lessons for each row execute function public.validate_lesson_overlap();

alter table public.profiles enable row level security; alter table public.teachers enable row level security; alter table public.students enable row level security; alter table public.instruments enable row level security; alter table public.student_instruments enable row level security; alter table public.lessons enable row level security; alter table public.reschedule_requests enable row level security; alter table public.monthly_payments enable row level security; alter table public.teacher_monthly_payments enable row level security; alter table public.leads enable row level security;

create policy "public read instruments" on public.instruments for select to anon,authenticated using(true);
create policy "public create lead" on public.leads for insert to anon,authenticated with check(consent_at is not null);
create policy "users read own profile" on public.profiles for select to authenticated using(id=auth.uid() or public.current_role()='administrador');
create policy "admins manage profiles" on public.profiles for all to authenticated using(public.current_role()='administrador') with check(public.current_role()='administrador');
create policy "admins manage teachers" on public.teachers for all to authenticated using(public.current_role()='administrador') with check(public.current_role()='administrador');
create policy "admins manage students" on public.students for all to authenticated using(public.current_role()='administrador') with check(public.current_role()='administrador');
create policy "student can read own student row" on public.students for select to authenticated using(profile_id=auth.uid() or public.current_role()='administrador');
create policy "teachers read assigned students" on public.students for select to authenticated using(public.current_role()='administrador' or exists(select 1 from public.lessons l join public.teachers t on t.id=l.teacher_id where l.student_id=students.id and t.profile_id=auth.uid()));
create policy "admin manage lessons" on public.lessons for all to authenticated using(public.current_role()='administrador') with check(public.current_role()='administrador');
create policy "teacher read own lessons" on public.lessons for select to authenticated using(exists(select 1 from public.teachers t where t.id=lessons.teacher_id and t.profile_id=auth.uid()));
create policy "teacher create own lessons" on public.lessons for insert to authenticated with check(public.current_role()='professor' and teacher_id=public.current_teacher_id());
create policy "teacher update own lessons" on public.lessons for update to authenticated using(public.current_role()='professor' and teacher_id=public.current_teacher_id()) with check(public.current_role()='professor' and teacher_id=public.current_teacher_id());
create policy "student read own lessons" on public.lessons for select to authenticated using(exists(select 1 from public.students s where s.id=lessons.student_id and s.profile_id=auth.uid()));
create policy "admin manage leads" on public.leads for select,update,delete to authenticated using(public.current_role()='administrador') with check(public.current_role()='administrador');
create policy "admin manage payments" on public.monthly_payments for all to authenticated using(public.current_role()='administrador') with check(public.current_role()='administrador');
create policy "student read own payments" on public.monthly_payments for select to authenticated using(exists(select 1 from public.students s where s.id=monthly_payments.student_id and s.profile_id=auth.uid()));
create policy "admin manage teacher payments" on public.teacher_monthly_payments for all to authenticated using(public.current_role()='administrador') with check(public.current_role()='administrador');
create policy "teacher read own teacher payment" on public.teacher_monthly_payments for select to authenticated using(exists(select 1 from public.teachers t where t.id=teacher_monthly_payments.teacher_id and t.profile_id=auth.uid()));
create policy "student request reschedule" on public.reschedule_requests for insert to authenticated with check(exists(select 1 from public.lessons l join public.students s on s.id=l.student_id where l.id=reschedule_requests.lesson_id and s.profile_id=auth.uid() and l.starts_at >= now()+interval '24 hours'));
create policy "student read own reschedule" on public.reschedule_requests for select to authenticated using(requested_by=auth.uid());
create policy "teacher/admin manage reschedule" on public.reschedule_requests for select,update to authenticated using(public.current_role()='administrador' or exists(select 1 from public.lessons l join public.teachers t on t.id=l.teacher_id where l.id=reschedule_requests.lesson_id and t.profile_id=auth.uid())) with check(public.current_role()='administrador' or exists(select 1 from public.lessons l join public.teachers t on t.id=l.teacher_id where l.id=reschedule_requests.lesson_id and t.profile_id=auth.uid()));


-- People-management read policies for the admin/teacher screens.
drop policy if exists "admin read all profiles" on public.profiles;
create policy "admin read all profiles" on public.profiles for select to authenticated using(public.current_role()='administrador');
drop policy if exists "teachers read assigned student profiles" on public.profiles;
create policy "teachers read assigned student profiles" on public.profiles for select to authenticated using(public.current_role()='professor' and exists(select 1 from public.students s join public.lessons l on l.student_id=s.id join public.teachers t on t.id=l.teacher_id where s.profile_id=profiles.id and t.profile_id=auth.uid()));

-- Students can exist before an online account is created.
drop policy if exists "admins manage students" on public.students;
create policy "admins manage students" on public.students for all to authenticated using(public.current_role()='administrador') with check(public.current_role()='administrador');
