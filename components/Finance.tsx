
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type FinanceProps = {
  role: string;
};

type Student = {
  id: string;
  full_name: string | null;
  profile_id: string | null;
};

type StudentPayment = {
  id: string;
  student_id: string;
  month: string;
  amount: number;
  status: string;
  paid_at: string | null;
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
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [studentPayments, setStudentPayments] = useState<StudentPayment[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherPayments, setTeacherPayments] = useState<TeacherPayment[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function formatMoney(value: number) {
    return Number(value || 0).toLocaleString('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    });
  }

  function formatMonth(value: string) {
    return new Date(`${value.slice(0, 7)}-01T12:00:00`).toLocaleDateString(
      'pt-PT',
      { month: 'long', year: 'numeric' }
    );
  }

  async function load() {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const [studentsResult, teachersResult, studentPaymentsResult, teacherPaymentsResult] =
        await Promise.all([
          supabase
            .from('students')
            .select('id,full_name,profile_id')
            .eq('status', 'ativo')
            .order('full_name'),

          supabase
            .from('teachers')
            .select('id,profile:profiles(full_name)')
            .eq('active', true),

          supabase
            .from('monthly_payments')
            .select('id,student_id,month,amount,status,paid_at')
            .eq('month', month),

          supabase
            .from('teacher_monthly_payments')
            .select('id,teacher_id,month,assigned_students,rate_per_student')
            .eq('month', month),
        ]);

      if (studentsResult.error) throw studentsResult.error;
      if (teachersResult.error) throw teachersResult.error;
      if (studentPaymentsResult.error) throw studentPaymentsResult.error;

      setStudents((studentsResult.data || []) as Student[]);

      setStudentPayments((studentPaymentsResult.data || []) as StudentPayment[]);

      setAmounts(Object.fromEntries(
        (studentPaymentsResult.data || []).map((p: any) => [
          p.student_id,
          String(p.amount ?? 20),
        ])
      ));

      setTeachers(((teachersResult.data || []) as any[]).map(t => ({
        ...t,
        profile: Array.isArray(t.profile) ? t.profile[0] || null : t.profile || null,
      })));

      setTeacherPayments(
        teacherPaymentsResult.error
          ? []
          : (teacherPaymentsResult.data || []) as TeacherPayment[]
      );

      const profileIds = studentsResult.data
        .map((s: any) => s.profile_id)
        .filter(Boolean);

      let profiles: any[] = [];

      if (profileIds.length) {
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select('id,full_name')
          .in('id', profileIds);

        if (profilesError) throw profilesError;
        profiles = data || [];
      }

      const profileNames = Object.fromEntries(
        profiles.map(p => [p.id, p.full_name])
      );

      setStudentNames(Object.fromEntries(
        (studentsResult.data || []).map((s: any) => [
          s.id,
          s.full_name || profileNames[s.profile_id] || 'Aluno sem nome',
        ])
      ));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o financeiro.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [month, isAdmin]);

  async function createMissingStudentPayments() {
    if (!isAdmin || saving) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const existingIds = new Set(studentPayments.map(p => p.student_id));

      const rows = students
        .filter(student => !existingIds.has(student.id))
        .map(student => ({
          student_id: student.id,
          month,
          amount: 20,
          status: 'pendente',
        }));

      if (!rows.length) {
        setMessage('Todos os alunos já têm uma mensalidade registada para este mês.');
        return;
      }

      const { error } = await supabase
        .from('monthly_payments')
        .insert(rows);

      if (error) throw error;

      setMessage(`Foram criadas ${rows.length} mensalidades a 20 € por defeito.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar as mensalidades.');
    } finally {
      setSaving(false);
    }
  }

  async function saveStudentAmount(payment: StudentPayment) {
    if (!isAdmin || saving) return;

    const raw = amounts[payment.student_id] ?? String(payment.amount);
    const amount = Number(raw.replace(',', '.'));

    if (!Number.isFinite(amount) || amount < 0) {
      setError('Introduz um valor válido, igual ou superior a 0 €.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase
        .from('monthly_payments')
        .update({ amount })
        .eq('id', payment.id);

      if (error) throw error;

      setMessage(`Mensalidade atualizada para ${formatMoney(amount)}.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível guardar o valor.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStudentPayment(payment: StudentPayment) {
    if (!isAdmin || saving) return;

    const isPaid = payment.status === 'pago';
    const newStatus = isPaid ? 'pendente' : 'pago';

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase
        .from('monthly_payments')
        .update({
          status: newStatus,
          paid_at: newStatus === 'pago' ? new Date().toISOString() : null,
        })
        .eq('id', payment.id);

      if (error) throw error;

      setMessage(
        newStatus === 'pago'
          ? `Pagamento de ${studentNames[payment.student_id] || 'aluno'} registado.`
          : 'Mensalidade novamente marcada como pendente.'
      );

      await load();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível atualizar o pagamento.');
    } finally {
      setSaving(false);
    }
  }

  async function createTeacherPayroll() {
    if (!isAdmin || saving) return;

    setError('');
    setMessage('');

    const start = new Date(`${month}T00:00:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const lessonsResult = await supabase
      .from('lessons')
      .select('teacher_id,student_id')
      .gte('starts_at', start.toISOString())
      .lt('starts_at', end.toISOString());

    if (lessonsResult.error) {
      setError(lessonsResult.error.message);
      return;
    }

    const studentsByTeacher = new Map<string, Set<string>>();

    (lessonsResult.data || []).forEach((lesson: any) => {
      if (!lesson.teacher_id || !lesson.student_id) return;

      if (!studentsByTeacher.has(lesson.teacher_id)) {
        studentsByTeacher.set(lesson.teacher_id, new Set());
      }

      studentsByTeacher.get(lesson.teacher_id)!.add(lesson.student_id);
    });

    const rows = teachers.map(teacher => ({
      teacher_id: teacher.id,
      month,
      assigned_students: studentsByTeacher.get(teacher.id)?.size || 0,
      rate_per_student: 20,
    }));

    if (!rows.length) {
      setMessage('Não existem professores ativos para gerar a folha.');
      return;
    }

    const result = await supabase
      .from('teacher_monthly_payments')
      .upsert(rows, { onConflict: 'teacher_id,month' });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage('Folha de professores atualizada a 20 € por aluno.');
    await load();
  }

  if (!isAdmin) return null;

  const paymentMap = new Map(
    studentPayments.map(payment => [payment.student_id, payment])
  );

  const totalExpected = studentPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const totalReceived = studentPayments.reduce(
    (sum, payment) =>
      sum + (payment.status === 'pago' ? Number(payment.amount || 0) : 0),
    0
  );

  const totalOutstanding = totalExpected - totalReceived;

  const teacherPayrollTotal = teacherPayments.reduce(
    (sum, payment) =>
      sum + Number(payment.assigned_students || 0) * Number(payment.rate_per_student || 20),
    0
  );

  return (
    <section id="finance-section" className="section">
      <div className="panelHead">
        <div>
          <div className="eyebrow">FINANCEIRO</div>
          <h2 style={{ margin: '6px 0 2px' }}>Mensalidades e pagamentos</h2>
          <div className="muted">
            Gere as mensalidades dos alunos e a folha de professores.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={event => setMonth(`${event.target.value}-01`)}
            className="input"
          />

          <button
            className="btn primary"
            onClick={createMissingStudentPayments}
            disabled={loading || saving}
          >
            Criar mensalidades em falta
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="notice">{message}</div>}

      <div className="metricGrid" style={{ marginTop: 16 }}>
        <div className="card metric">
          <span className="muted">Previsto dos alunos</span>
          <strong>{formatMoney(totalExpected)}</strong>
          <small className="muted">{formatMonth(month)}</small>
        </div>

        <div className="card metric">
          <span className="muted">Recebido</span>
          <strong>{formatMoney(totalReceived)}</strong>
          <small className="muted">Mensalidades marcadas como pagas</small>
        </div>

        <div className="card metric metricWarn">
          <span className="muted">Por receber</span>
          <strong>{formatMoney(totalOutstanding)}</strong>
          <small className="muted">Mensalidades pendentes</small>
        </div>

        <div className="card metric">
          <span className="muted">Folha de professores</span>
          <strong>{formatMoney(teacherPayrollTotal)}</strong>
          <small className="muted">Valor calculado para o mês</small>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <div style={{ padding: '18px 18px 12px' }}>
          <div className="eyebrow">MENSALIDADES DOS ALUNOS</div>
          <h3 style={{ margin: '6px 0' }}>{formatMonth(month)}</h3>
          <div className="muted">
            O valor inicial é 20 €. Podes alterá-lo individualmente para cada aluno e mês.
          </div>
        </div>

        {loading ? (
          <div className="emptyCard" style={{ margin: 16 }}>A carregar…</div>
        ) : students.length === 0 ? (
          <div className="emptyCard" style={{ margin: 16 }}>
            Não existem alunos ativos.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 12 }}>Aluno</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Valor (€)</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Estado</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {students.map(student => {
                const payment = paymentMap.get(student.id);

                return (
                  <tr key={student.id}>
                    <td style={{ padding: 12 }}>
                      <strong>{studentNames[student.id] || 'Aluno sem nome'}</strong>
                    </td>

                    <td style={{ padding: 12, minWidth: 130 }}>
                      {payment ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={amounts[student.id] ?? String(payment.amount)}
                          onChange={event =>
                            setAmounts(current => ({
                              ...current,
                              [student.id]: event.target.value,
                            }))
                          }
                          aria-label={`Mensalidade de ${studentNames[student.id] || 'aluno'}`}
                          className="input"
                          style={{ width: 110 }}
                        />
                      ) : (
                        <span className="muted">Ainda não criada</span>
                      )}
                    </td>

                    <td style={{ padding: 12 }}>
                      {!payment ? (
                        <span className="muted">—</span>
                      ) : payment.status === 'pago' ? (
                        <span className="success">Pago</span>
                      ) : (
                        <span className="muted">Pendente</span>
                      )}
                    </td>

                    <td style={{ padding: 12 }}>
                      {!payment ? (
                        <span className="muted">
                          Usa «Criar mensalidades em falta»
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            className="btn ghost"
                            disabled={saving}
                            onClick={() => saveStudentAmount(payment)}
                          >
                            Guardar valor
                          </button>

                          <button
                            className="btn primary"
                            disabled={saving}
                            onClick={() => toggleStudentPayment(payment)}
                          >
                            {payment.status === 'pago' ? 'Marcar pendente' : 'Registar pagamento'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <div style={{ padding: '18px 18px 12px' }}>
          <div className="eyebrow">FOLHA DE PROFESSORES</div>
          <h3 style={{ margin: '6px 0' }}>{formatMonth(month)}</h3>
          <div className="muted">Regra atual: 20 € por aluno atribuído ao professor.</div>

          <button
            className="btn primary"
            style={{ marginTop: 12 }}
            onClick={createTeacherPayroll}
            disabled={loading || saving}
          >
            Atualizar folha de professores
          </button>
        </div>

        {teachers.length === 0 ? (
          <div className="emptyCard" style={{ margin: 16 }}>
            Não existem professores ativos.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 12 }}>Professor</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Alunos</th>
                <th style={{ textAlign: 'left', padding: 12 }}>€/aluno</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Total</th>
              </tr>
            </thead>

            <tbody>
              {teachers.map(teacher => {
                const payment = teacherPayments.find(p => p.teacher_id === teacher.id);
                const count = Number(payment?.assigned_students || 0);
                const rate = Number(payment?.rate_per_student || 20);

                return (
                  <tr key={teacher.id}>
                    <td style={{ padding: 12 }}>
                      <strong>{teacher.profile?.full_name || 'Professor'}</strong>
                    </td>
                    <td style={{ padding: 12 }}>{count}</td>
                    <td style={{ padding: 12 }}>{formatMoney(rate)}</td>
                    <td style={{ padding: 12 }}>
                      <strong>{formatMoney(count * rate)}</strong>
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
