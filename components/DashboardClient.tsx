
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

type Tab =
  | 'dashboard'
  | 'agenda'
  | 'alunos'
  | 'professores'
  | 'financeiro'
  | 'remarcacoes'
  | 'contactos'
  | 'utilizadores';

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

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
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

      if (lessonsResult.error) throw lessonsResult.error;
      if (reschedulesResult.error) throw reschedulesResult.error;

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

        setOverdue(paymentsResult.data?.length || 0);
        setNewLeads(0);
        setActiveStudents(0);
      } else {
        setOverdue(0);
        setNewLeads(0);
        setActiveStudents(0);
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'Não foi possível carregar o resumo do dashboard.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, [role]);

  const labels: Record<string, string> = {
    administrador: 'Administrador',
    professor: 'Professor',
    aluno_encarregado: 'Aluno / Encarregado',
  };

  const heading =
    role === 'administrador'
      ? 'Centro de controlo'
      : role === 'professor'
        ? 'O teu dia'
        : 'A tua área';

  const subtitle =
    role === 'administrador'
      ? 'Tudo o que merece atenção hoje, num único ecrã.'
      : role === 'professor'
        ? 'Agenda, tarefas e informação financeira.'
        : 'As tuas aulas e assuntos importantes.';

  const metrics = useMemo<Metric[]>(() => {
    if (role === 'administrador') {
      return [
        {
          label: 'Aulas hoje',
          value: String(lessons.length),
          hint: 'Na escola hoje',
        },
        {
          label: 'Remarcações',
          value: String(pendingRebooks),
          hint: 'Pedidos pendentes',
          tone: pendingRebooks ? 'warn' : 'ok',
        },
        {
          label: 'Pagamentos em falta',
          value: String(overdue),
          hint: 'Mensalidades pendentes',
          tone: overdue ? 'warn' : 'ok',
        },
        {
          label: 'Leads ativos',
          value: String(newLeads),
          hint: 'Ainda por converter',
          tone: newLeads ? 'warn' : 'ok',
        },
      ];
    }

    if (role === 'professor') {
      return [
        {
          label: 'Aulas hoje',
          value: String(lessons.length),
          hint: 'A tua agenda',
        },
        {
          label: 'Remarcações',
          value: String(pendingRebooks),
          hint: 'Pedidos pendentes',
          tone: pendingRebooks ? 'warn' : 'ok',
        },
        {
          label: 'Primeira aula',
          value: lessons[0] ? fmtTime(lessons[0].starts_at) : '—',
          hint: lessons[0]
            ? `Aluno ${lessons[0].student?.full_name || ''}`
            : 'Sem aulas hoje',
        },
        {
          label: 'Última aula',
          value: lessons.length
            ? fmtTime(lessons[lessons.length - 1].starts_at)
            : '—',
          hint: 'Fim do dia',
        },
      ];
    }

    return [
      {
        label: 'Aulas hoje',
        value: String(lessons.length),
        hint: 'As tuas aulas',
      },
      {
        label: 'Pagamento',
        value: overdue ? 'Em falta' : 'Regular',
        hint: overdue
          ? 'Há uma mensalidade pendente'
          : 'Sem pendências',
        tone: overdue ? 'warn' : 'ok',
      },
      {
        label: 'Próxima aula',
        value: lessons[0] ? fmtTime(lessons[0].starts_at) : '—',
        hint: lessons[0]?.instrument?.name || 'Sem aulas hoje',
      },
      {
        label: 'Pedidos',
        value: String(pendingRebooks),
        hint: 'Remarcações em análise',
      },
    ];
  }, [role, lessons, pendingRebooks, overdue, newLeads]);

  const tabs: { id: Tab; label: string }[] =
    role === 'administrador'
      ? [
          { id: 'dashboard', label: 'Resumo' },
          { id: 'agenda', label: 'Agenda' },
          { id: 'alunos', label: 'Alunos' },
          { id: 'professores', label: 'Professores' },
          { id: 'financeiro', label: 'Financeiro' },
          { id: 'remarcacoes', label: 'Remarcações' },
          { id: 'contactos', label: 'Contactos' },
          { id: 'utilizadores', label: 'Utilizadores' },
        ]
      : role === 'professor'
        ? [
            { id: 'dashboard', label: 'Resumo' },
            { id: 'agenda', label: 'Agenda' },
            { id: 'remarcacoes', label: 'Remarcações' },
            { id: 'financeiro', label: 'Financeiro' },
          ]
        : [
            { id: 'dashboard', label: 'Resumo' },
            { id: 'agenda', label: 'Agenda' },
            { id: 'remarcacoes', label: 'Remarcações' },
          ];

  function goToTab(tab: Tab) {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className="dash">
      <div className="dashHead">
        <div>
          <div className="eyebrow">
            PALCO 21 · {labels[role] || role}
          </div>

          <h1 style={{ margin: '6px 0' }}>
            {activeTab === 'alunos'
              ? 'Gestão de alunos'
              : activeTab === 'professores'
                ? 'Gestão de professores'
                : activeTab === 'agenda'
                  ? 'Agenda'
                  : activeTab === 'financeiro'
                    ? 'Financeiro'
                    : activeTab === 'remarcacoes'
                      ? 'Remarcações'
                      : activeTab === 'contactos'
                        ? 'Contactos'
                        : activeTab === 'utilizadores'
                          ? 'Utilizadores'
                          : heading}
          </h1>

          <div className="muted">
            {name} · {subtitle}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {role === 'administrador' && (
            <a className="btn ghost" href="/configuracao">
              Configuração
            </a>
          )}

          <button
            type="button"
            className="btn ghost"
            onClick={logout}
          >
            Terminar sessão
          </button>
        </div>
      </div>

      <nav
        aria-label="Navegação principal"
        style={{
          display: 'flex',
          gap: 8,
          margin: '20px 0',
          paddingBottom: 12,
          borderBottom: '1px solid #333',
          overflowX: 'auto',
          flexWrap: 'wrap',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`btn ${
              activeTab === tab.id ? 'primary' : 'ghost'
            }`}
            onClick={() => goToTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error && <div className="error">{error}</div>}

      {activeTab === 'dashboard' && (
        <>
          <div className="metricGrid">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className={`card metric ${
                  metric.tone === 'warn'
                    ? 'metricWarn'
                    : metric.tone === 'ok'
                      ? 'metricOk'
                      : ''
                }`}
              >
                <span className="muted">{metric.label}</span>
                <strong>{metric.value}</strong>
                <small className="muted">{metric.hint}</small>
              </div>
            ))}
          </div>

          <section className="todayPanel">
            <div className="panelHead">
              <div>
                <div className="eyebrow">Hoje</div>
                <h2 style={{ margin: '6px 0 2px' }}>
                  Agenda do dia
                </h2>
                <div className="muted">
                  {loading
                    ? 'A atualizar…'
                    : lessons.length
                      ? `${lessons.length} aula${
                          lessons.length === 1 ? '' : 's'
                        } marcada${
                          lessons.length === 1 ? '' : 's'
                        }.`
                      : 'Não tens aulas marcadas para hoje.'}
                </div>
              </div>

              <button
                type="button"
                className="btn primary"
                onClick={() => goToTab('agenda')}
              >
                Abrir agenda
              </button>
            </div>

            {loading ? (
              <div className="emptyCard">A carregar o resumo…</div>
            ) : lessons.length === 0 ? (
              <div className="emptyCard">
                Hoje está tranquilo. Nada pendente por aqui.
              </div>
            ) : (
              <div className="todayList">
                {lessons.map((lesson) => (
                  <div className="todayRow" key={lesson.id}>
                    <div className="todayTime">
                      {fmtTime(lesson.starts_at)}
                    </div>

                    <div>
                      <strong>
                        {role === 'professor' ||
                        role === 'administrador'
                          ? lesson.student?.full_name || 'Aluno'
                          : `Aula de ${
                              lesson.instrument?.name || 'música'
                            }`}
                      </strong>

                      <div className="muted">
                        {lesson.instrument?.name || 'Instrumento'} · 50 min
                        {role === 'administrador'
                          ? ` · ${
                              lesson.teacher?.profile?.full_name ||
                              'Professor'
                            }`
                          : ''}
                      </div>
                    </div>

                    <div className="todayDate">
                      {fmtDate(lesson.starts_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {role === 'administrador' && (
            <section className="quickActions">
              <button
                type="button"
                className="quickCard"
                onClick={() => goToTab('alunos')}
              >
                <span>+</span>
                <div>
                  <strong>Gestão de alunos</strong>
                  <small>Fichas, instrumentos e professores</small>
                </div>
              </button>

              <button
                type="button"
                className="quickCard"
                onClick={() => goToTab('agenda')}
              >
                <span>＋</span>
                <div>
                  <strong>Novo horário</strong>
                  <small>Marcar aula de 50 minutos</small>
                </div>
              </button>

              <button
                type="button"
                className="quickCard"
                onClick={() => goToTab('financeiro')}
              >
                <span>€</span>
                <div>
                  <strong>Financeiro</strong>
                  <small>
                    {overdue} mensalidades pendentes
                  </small>
                </div>
              </button>

              <button
                type="button"
                className="quickCard"
                onClick={() => goToTab('contactos')}
              >
                <span>↗</span>
                <div>
                  <strong>Contactos</strong>
                  <small>{newLeads} contactos para seguir</small>
                </div>
              </button>
            </section>
          )}

          {role === 'administrador' && (
            <>
              <Relatorios role={role} />
              <section className="section">
                <div className="notice">
                  <strong>
                    {activeStudents
                      ? `${activeStudents} alunos ativos neste momento.`
                      : 'Base de produção ativa.'}
                  </strong>
                  <p style={{ marginBottom: 0 }}>
                    O dashboard junta agenda, remarcações, pagamentos e
                    contactos importantes.
                  </p>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {activeTab === 'agenda' && <Agenda role={role} />}

      {activeTab === 'alunos' && role === 'administrador' && (
        <StudentManagement role={role} />
      )}

      {activeTab === 'professores' && role === 'administrador' && (
        <People role={role} />
      )}

      {activeTab === 'financeiro' && role === 'administrador' && (
        <Finance role={role} />
      )}

      {activeTab === 'financeiro' && role === 'professor' && (
        <TeacherFinance />
      )}

      {activeTab === 'remarcacoes' && (
        <Reschedules role={role} />
      )}

      {activeTab === 'contactos' && role === 'administrador' && (
        <>
          <Leads role={role} />
          <Notifications role={role} />
        </>
      )}

      {activeTab === 'utilizadores' && role === 'administrador' && (
        <AdminUsers role={role} />
      )}
    </main>
  );
}
