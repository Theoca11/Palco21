'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type FinanceProps = {
  role: string;
};

type Teacher = {
  id: string;
  profile?: {
    full_name: string | null;
  } | null;
};

type TeacherPayment = {
  id?: string;
  teacher_id: string;
  month: string;
  assigned_students: number;
  rate_per_student: number;
  paid?: boolean;
};

export function Finance({ role }: FinanceProps) {
  const supabase = createClient();

  const isAdmin = role === 'administrador';

  const [month, setMonth] = useState(() => {
    const now = new Date();

    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}-01`;
  });

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [payments, setPayments] = useState<TeacherPayment[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    if (!isAdmin) return;

    setLoading(true);
    setError('');
    setMessage('');

    const teachersResult = await supabase
      .from('teachers')
      .select(
        'id,profile:profiles(full_name)'
      )
      .eq('active', true)
      .order('id');

    if (teachersResult.error) {
      setError(teachersResult.error.message);
      setLoading(false);
      return;
    }

    const paymentsResult = await supabase
      .from('teacher_monthly_payments')
      .select(
        'id,teacher_id,month,assigned_students,rate_per_student,paid'
      )
      .eq('month', month);

    if (paymentsResult.error) {
      /*
       * Se a tabela ainda não tiver registos,
       * não queremos bloquear o dashboard.
       */
      setPayments([]);
    } else {
      setPayments(
        (paymentsResult.data || []) as TeacherPayment[]
      );
    }

    setTeachers(
      ((teachersResult.data || []) as any[]).map(
        (teacher) => ({
          ...teacher,
          profile: Array.isArray(teacher.profile)
            ? teacher.profile[0] || null
            : teacher.profile || null,
        })
      )
    );

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [month, isAdmin]);

  async function createTeacherPayroll() {
    if (!isAdmin) return;

    setError('');
    setMessage('');

    const start = new Date(`${month}T00:00:00`);

    const end = new Date(start);

    end.setMonth(end.getMonth() + 1);

    const lessonsResult = await supabase
      .from('lessons')
      .select('teacher_id,student_id')
      .gte(
        'starts_at',
        start.toISOString()
      )
      .lt(
        'starts_at',
        end.toISOString()
      );

    if (lessonsResult.error) {
      setError(lessonsResult.error.message);
      return;
    }

    const studentsByTeacher =
      new Map<string, Set<string>>();

    (lessonsResult.data || []).forEach(
      (lesson: any) => {
        if (!lesson.teacher_id) return;
        if (!lesson.student_id) return;

        if (
          !studentsByTeacher.has(
            lesson.teacher_id
          )
        ) {
          studentsByTeacher.set(
            lesson.teacher_id,
            new Set()
          );
        }

        studentsByTeacher
          .get(lesson.teacher_id)!
          .add(lesson.student_id);
      }
    );

    const rows = teachers.map((teacher) => ({
      teacher_id: teacher.id,
      month,
      assigned_students:
        studentsByTeacher.get(teacher.id)?.size ||
        0,
      rate_per_student: 20,
    }));

    if (!rows.length) {
      setMessage(
        'Não existem professores ativos para gerar a folha.'
      );
      return;
    }

    const result = await supabase
      .from('teacher_monthly_payments')
      .upsert(rows, {
        onConflict: 'teacher_id,month',
      });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage(
      'Folha de professores atualizada a €20 por aluno.'
    );

    await load();
  }

  if (!isAdmin) {
    return null;
  }

  const paymentMap = new Map<
    string,
    TeacherPayment
  >();

  payments.forEach((payment) => {
    paymentMap.set(
      payment.teacher_id,
      payment
    );
  });

  const totalStudents = payments.reduce(
    (total, payment) =>
      total + Number(payment.assigned_students || 0),
    0
  );

  const totalPayroll = payments.reduce(
    (total, payment) =>
      total +
      Number(payment.assigned_students || 0) *
        Number(payment.rate_per_student || 20),
    0
  );

  const totalPaid = payments.reduce(
    (total, payment) => {
      if (!payment.paid) return total;

      return (
        total +
        Number(payment.assigned_students || 0) *
          Number(payment.rate_per_student || 20)
      );
    },
    0
  );

  const totalPending = totalPayroll - totalPaid;

  function formatMonth(value: string) {
    const date = new Date(
      `${value}T00:00:00`
    );

    return date.toLocaleDateString(
      'pt-PT',
      {
        month: 'long',
        year: 'numeric',
      }
    );
  }

  function formatMoney(value: number) {
    return value.toLocaleString(
      'pt-PT',
      {
        style: 'currency',
        currency: 'EUR',
      }
    );
  }

  return (
    <section
      id="finance-section"
      className="section"
    >
      <div className="panelHead">
        <div>
          <div className="eyebrow">
            FINANCEIRO
          </div>

          <h2
            style={{
              margin: '6px 0 2px',
            }}
          >
            Mensalidades e pagamentos
          </h2>

          <div className="muted">
            Gestão financeira da escola e folha
            de professores.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={(event) => {
              setMonth(
                `${event.target.value}-01`
              );
            }}
            className="input"
          />

          <button
            className="btn primary"
            onClick={createTeacherPayroll}
            disabled={loading}
          >
            Atualizar folha
          </button>
        </div>
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {message && (
        <div className="notice">
          {message}
        </div>
      )}

      <div
        className="metricGrid"
        style={{
          marginTop: 16,
        }}
      >
        <div className="card metric">
          <span className="muted">
            Alunos contabilizados
          </span>

          <strong>
            {totalStudents}
          </strong>

          <small className="muted">
            Alunos atribuídos aos professores
          </small>
        </div>

        <div className="card metric">
          <span className="muted">
            Folha prevista
          </span>

          <strong>
            {formatMoney(totalPayroll)}
          </strong>

          <small className="muted">
            A €20 por aluno/mês
          </small>
        </div>

        <div className="card metric">
          <span className="muted">
            Professores
          </span>

          <strong>
            {teachers.length}
          </strong>

          <small className="muted">
            Professores ativos
          </small>
        </div>

        <div className="card metric metricWarn">
          <span className="muted">
            Por pagar
          </span>

          <strong>
            {formatMoney(totalPending)}
          </strong>

          <small className="muted">
            Folha ainda não liquidada
          </small>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginTop: 16,
          overflowX: 'auto',
        }}
      >
        <div
          style={{
            padding: '18px 18px 12px',
          }}
        >
          <div className="eyebrow">
            FOLHA DE PROFESSORES
          </div>

          <h3
            style={{
              margin: '6px 0',
            }}
          >
            {formatMonth(month)}
          </h3>

          <div className="muted">
            Regra atual: €20 por aluno/mês
            atribuído ao professor.
          </div>
        </div>

        {loading ? (
          <div
            className="emptyCard"
            style={{
              margin: 16,
            }}
          >
            A carregar…
          </div>
        ) : teachers.length === 0 ? (
          <div
            className="emptyCard"
            style={{
              margin: 16,
            }}
          >
            Não existem professores ativos.
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse:
                'collapse',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 12,
                  }}
                >
                  Professor
                </th>

                <th
                  style={{
                    textAlign: 'left',
                    padding: 12,
                  }}
                >
                  Alunos
                </th>

                <th
                  style={{
                    textAlign: 'left',
                    padding: 12,
                  }}
                >
                  €/aluno
                </th>

                <th
                  style={{
                    textAlign: 'left',
                    padding: 12,
                  }}
                >
                  Total
                </th>

                <th
                  style={{
                    textAlign: 'left',
                    padding: 12,
                  }}
                >
                  Estado
                </th>
              </tr>
            </thead>

            <tbody>
              {teachers.map((teacher) => {
                const payment =
                  paymentMap.get(
                    teacher.id
                  );

                const students =
                  Number(
                    payment?.assigned_students ||
                      0
                  );

                const rate =
                  Number(
                    payment?.rate_per_student ||
                      20
                  );

                const total =
                  students * rate;

                return (
                  <tr
                    key={teacher.id}
                  >
                    <td
                      style={{
                        padding: 12,
                      }}
                    >
                      <strong>
                        {teacher.profile
                          ?.full_name ||
                          'Professor'}
                      </strong>
                    </td>

                    <td
                      style={{
                        padding: 12,
                      }}
                    >
                      {students}
                    </td>

                    <td
                      style={{
                        padding: 12,
                      }}
                    >
                      {formatMoney(rate)}
                    </td>

                    <td
                      style={{
                        padding: 12,
                      }}
                    >
                      <strong>
                        {formatMoney(
                          total
                        )}
                      </strong>
                    </td>

                    <td
                      style={{
                        padding: 12,
                      }}
                    >
                      {payment?.paid ? (
                        <span className="muted">
                          Pago
                        </span>
                      ) : (
                        <span className="muted">
                          Por pagar
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
