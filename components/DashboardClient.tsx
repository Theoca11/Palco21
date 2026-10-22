'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';

import { Agenda } from './Agenda';
import { People } from './People';
import { StudentManagement } from './StudentManagement';
import { Reschedules } from './Reschedules';
import { Finance } from './Finance';
import { TeacherFinance } from './TeacherFinance';
import { Leads } from './Leads';
import { Notifications } from './Notifications';
import { AdminUsers } from './AdminUsers';
import { Relatorios } from './Relatorios';

type Metric = {
  label: string;
  value: string;
  hint: string;
  tone?: 'normal' | 'warn' | 'ok';
};

type Lesson = {
  id: string;
  starts_at: string;
  student_id: string;
  teacher_id: string;
  instrument?: { name: string } | null;
  student?: { full_name: string | null } | null;
  teacher?: {
    profile?: { full_name: string | null } | null;
  } | null;
};

const fmtTime = (value: string) =>
  new Intl.DateTimeFormat('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const fmtDate = (value: string) =>
  new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));

function todayBounds() {
  const now = new Date();

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function DashboardClient({
  name,
  role,
}: {
  name: string;
  role: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [pendingRebooks, setPendingRebooks] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [newLeads, setNewLeads] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function loadSummary() {
    setLoading(true);
    setError('');

    try {
      const { start, end } = todayBounds();

      const queries: PromiseLike<any>[] = [
        supabase
          .from('lessons')
          .select(
            'id,starts_at,student_id,teacher_id,instrument:instruments(name),student:students(full_name),teacher:teachers(profile:profiles(full_name))'
          )
          .gte('starts_at', start)
          .lt('starts_at', end)
          .order('starts_at'),

        supabase
          .from('reschedule_requests')
          .select('id,status')
          .eq('status', 'pendente'),
      ];

      if (role === 'administrador') {
        queries.push(
          supabase
            .from('monthly_payments')
            .select('id,status')
            .eq('status', 'pendente')
        );

        queries.push(
          supabase
            .from('leads')
            .select('id,funnel_stage')
            .in('funnel_stage', [
              'visit',
              'interest',
              'form_started',
              'form_contact',
            ])
        );

        queries.push(
          supabase
            .from('students')
            .select('id')
            .eq('status', 'ativo')
        );
      } else if (role === 'aluno_encarregado') {
        queries.push(
          supabase
            .from('monthly_payments')
            .select('id,status')
            .eq('status', 'pendente')
        );
      }

      const results = await Promise.all(queries);

      const lessonsResult = results[0];
      const reschedulesResult = results[1];

      if (lessonsResult.error) {
        throw lessonsResult.error;
      }

      if (reschedulesResult.error) {
        throw reschedulesResult.error;
      }

      setLessons((lessonsResult.data || []) as Lesson[]);
      setPendingRebooks(reschedulesResult.data?.length || 0);

      if (role === 'administrador') {
        const paymentsResult = results[2];
        const leadsResult = results[3];
        const studentsResult = results[4];

        if (paymentsResult.error) throw paymentsResult.error;
        if (leadsResult.error) throw leadsResult.error;
        if (studentsResult.error) throw studentsResult.error;

        setOverdue(paymentsResult.data?.length || 0);
        setNewLeads(leadsResult.data?.length || 0);
        setActiveStudents(studentsResult.data?.length || 0);
      } else if (role === 'aluno_encarregado') {
        const paymentsResult = results[2];

        if (paymentsResult.error) throw paymentsResult.error;

        setOverdue(paymentsResult.data?.length
