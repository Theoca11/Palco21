-- Palco 21 v16: hardening of ownership, reschedule requests and lesson creation.

create table if not exists public.teacher_student_assignments(
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(teacher_id,student_id)
);

alter table public.teacher_student_assignments enable row level security;

drop policy if exists "admin manage assignments" on public.teacher_student_assignments;
create policy "admin manage assignments" on public.teacher_student_assignments
for all to authenticated
using(public.current_role()='administrador')
with check(public.current_role()='administrador');

drop policy if exists "teacher read own assignments" on public.teacher_student_assignments;
create policy "teacher read own assignments" on public.teacher_student_assignments
for select to authenticated
using(exists(select 1 from public.teachers t where t.id=teacher_student_assignments.teacher_id and t.profile_id=auth.uid()));

drop policy if exists "student read own assignments" on public.teacher_student_assignments;
create policy "student read own assignments" on public.teacher_student_assignments
for select to authenticated
using(exists(select 1 from public.students s where s.id=teacher_student_assignments.student_id and s.profile_id=auth.uid()));

-- A teacher may only create lessons for one of their assigned active students.
drop policy if exists "teacher create own lessons" on public.lessons;
create policy "teacher create own lessons" on public.lessons
for insert to authenticated
with check(
  public.current_role()='professor'
  and teacher_id=public.current_teacher_id()
  and exists(
    select 1 from public.teacher_student_assignments a
    where a.teacher_id=lessons.teacher_id and a.student_id=lessons.student_id and a.active=true
  )
);

-- A student/guardian cannot spoof requested_by on a reschedule request.
drop policy if exists "student request reschedule" on public.reschedule_requests;
create policy "student request reschedule" on public.reschedule_requests
for insert to authenticated
with check(
  requested_by=auth.uid()
  and exists(
    select 1
    from public.lessons l
    join public.students s on s.id=l.student_id
    where l.id=reschedule_requests.lesson_id
      and s.profile_id=auth.uid()
      and l.starts_at >= now()+interval '24 hours'
  )
);

-- A reschedule request can only target an existing lesson and cannot be moved to the past.
create or replace function public.validate_reschedule_request() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.proposed_starts_at is not null and new.proposed_starts_at <= now() then
    raise exception 'A nova data/hora tem de ser futura';
  end if;
  return new;
end $$;

drop trigger if exists reschedule_future_guard on public.reschedule_requests;
create trigger reschedule_future_guard
before insert or update on public.reschedule_requests
for each row execute function public.validate_reschedule_request();

-- Helpful indexes for the most frequent production reads.
create index if not exists lessons_teacher_starts_idx on public.lessons(teacher_id,starts_at);
create index if not exists lessons_student_starts_idx on public.lessons(student_id,starts_at);
create index if not exists reschedule_lesson_status_idx on public.reschedule_requests(lesson_id,status);
create index if not exists payments_student_month_idx on public.monthly_payments(student_id,month);
create index if not exists leads_stage_created_idx on public.leads(funnel_stage,created_at);
