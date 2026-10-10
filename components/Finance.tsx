
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
  profile?: { full_name: string | null } | null;
};

type TeacherPayment = {
  id?: string;
  teacher_id: string;
  month: string;
  assigned_students: number;
  rate_per_student: number;
};

type FinanceTab = 'mensalidades' | 'professores' | 'lucro';

const DEFAULT_MONTHLY_FEE = 40;
const TEACHER_PERCENTAGE = 50;
const SCHOOL_PERCENTAGE = 50;

export function Finance({ role }: FinanceProps) {
  const supabase = createClient();
  const isAdmin = role === 'administrador';

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });

  const [activeTab, setActiveTab] = useState<FinanceTab>('mensalidades');
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

    try {
      const [
        studentsResult,
        teachersResult,
        paymentsResult,
        teacherPaymentsResult,
      ] = await Promise.all([
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
      if (paymentsResult.error) throw paymentsResult.error;

      const loadedStudents = (studentsResult.data || []) as Student[];
      const loadedPayments = (paymentsResult.data || []) as StudentPayment[];

      setStudents(loadedStudents);
      setStudentPayments(loadedPayments);

      setAmounts(
        Object.fromEntries(
          loadedPayments.map(payment => [
            payment.student_id,
            String(payment.amount ?? DEFAULT_MONTHLY_FEE),
          ])
        )
      );

      setTeachers(
        ((teachersResult.data || []) as any[]).map(teacher => ({
          ...teacher,
          profile: Array.isArray(teacher.profile)
            ? teacher.profile[0] || null
            : teacher.profile || null,
        }))
      );

      setTeacherPayments(
        teacherPaymentsResult.error
          ? []
          : ((teacherPaymentsResult.data || []) as TeacherPayment[])
      );

      const profileIds = loadedStudents
        .map(student => student.profile_id)
        .filter(Boolean) as string[];

      let profiles: { id: string; full_name: string | null }[] = [];

      if (profileIds.length) {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('id,full_name')
          .in('id', profileIds);

        if (profileError) throw profileError;
        profiles = data || [];
      }

      const profileNames = Object.fromEntries(
        profiles.map(profile => [profile.id, profile.full_name])
      );

      setStudentNames(
        Object.fromEntries(
          loadedStudents.map(student => [
            student.id,
            student.full_name ||
              profileNames[student.profile_id || ''] ||
              'Aluno sem nome',
          ])
        )
      );
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
      const existingIds = new Set(
        studentPayments.map(payment => payment.student_id)
      );

      const rows = students
        .filter(student => !existingIds.has(student.id))
        .map(student => ({
          student_id: student.id,
          month,
          amount: DEFAULT_MONTHLY_FEE,
          status: 'pendente',
        }));

      if (!rows.length) {
        setMessage('Todos os alunos já têm mensalidade registada neste mês.');
        return;
      }

      const { error } = await supabase
        .from('monthly_payments')
        .insert(rows);

      if (error) throw error;

      setMessage(
        `${rows.length} mensalidade(s) criada(s) para ${formatMonth(month)}, a 40 € por defeito.`
      );

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

    const newStatus = payment.status === 'pago' ? 'pendente' : 'pago';

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
          : 'Pagamento marcado novamente como pendente.'
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

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const start = new Date(`${month}T00:00:00`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      const lessonsResult = await supabase
        .from('lessons')
        .select('teacher_id,student_id')
        .gte('starts_at', start.toISOString())
        .lt('starts_at', end.toISOString());

      if (lessonsResult.error) throw lessonsResult.error;

      const studentPaymentsById = new Map(
        studentPayments.map(payment => [
          payment.student_id,
          Number(payment.amount || 0),
        ])
      );

      const studentsByTeacher = new Map<string, Set<string>>();

      (lessonsResult.data || []).forEach((lesson: any) => {
        if (!lesson.teacher_id || !lesson.student_id) return;

        if (!studentsByTeacher.has(lesson.teacher_id)) {
          studentsByTeacher.set(lesson.teacher_id, new Set());
        }

        studentsByTeacher.get(lesson.teacher_id)!.add(lesson.student_id);
      });

      const rows = teachers.map(teacher => {
        const assignedIds = Array.from(
          studentsByTeacher.get(teacher.id) || new Set<string>()
        );

        const totalFees = assignedIds.reduce(
          (sum, studentId) => sum + (studentPaymentsById.get(studentId) ?? DEFAULT_MONTHLY_FEE),
          0
        );

        const teacherTotal = totalFees * (TEACHER_PERCENTAGE / 100);
        const averageRate = assignedIds.length
          ? teacherTotal / assignedIds.length
          : DEFAULT_MONTHLY_FEE * (TEACHER_PERCENTAGE / 100);

        return {
          teacher_id: teacher.id,
          month,
          assigned_students: assignedIds.length,
          rate_per_student: Number(averageRate.toFixed(2)),
        };
      });

      if (!rows.length) {
        setMessage('Não existem professores ativos para gerar a folha.');
        return;
      }

      const result = await supabase
        .from('teacher_monthly_payments')
        .upsert(rows, { onConflict: 'teacher_id,month' });

      if (result.error) throw result.error;

      setMessage('Folha atualizada com a percentagem de 50% por professor.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível atualizar a folha de professores.');
    } finally {
      setSaving(false);
    }
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

  // O custo estimado é 50% das mensalidades registadas para o mês.
  const estimatedTeacherCost = totalExpected * (TEACHER_PERCENTAGE / 100);
  const receivedTeacherCost = totalReceived * (TEACHER_PERCENTAGE / 100);

  const estimatedStoreResult = totalExpected * (SCHOOL_PERCENTAGE / 100);
  const receivedStoreResult = totalReceived * (SCHOOL_PERCENTAGE / 100);

  return (
    <section id="finance-section" className="section">
      <div className="panelHead">
        <div>
          <div className="eyebrow">FINANCEIRO</div>
          <h2 style={{ margin: '6px 0 2px' }}>Financeiro da Palco 21</h2>
          <div className="muted">
            Mensalidade padrão de 40 €, repartida em 50% para o professor e 50% para a loja.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>
            <span className="muted" style={{ display: 'block', marginBottom: 4 }}>
              Escolher mês
            </span>
            <input
              type="month"
              value={month.slice(0, 7)}
              onChange={event => {
                if (event.target.value) setMonth(`${event.target.value}-01`);
              }}
              className="input"
              aria-label="Escolher mês do financeiro"
            />
          </label>

          <button
            className="btn primary"
            onClick={createMissingStudentPayments}
            disabled={loading || saving}
          >
            Criar mensalidades em falta
          </button>
        </div>
      </div>

      <div className="muted" style={{ marginTop: 8 }}>
        Podes selecionar meses anteriores ou futuros. Os pagamentos futuros ficam pendentes
        até registares que foram recebidos.
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="notice">{message}</div>}

      <div className="metricGrid" style={{ marginTop: 16 }}>
        <div className="card metric">
          <span className="muted">Mensalidades previstas</span>
          <strong>{formatMoney(totalExpected)}</strong>
          <small className="muted">{formatMonth(month)}</small>
        </div>

        <div className="card metric">
          <span className="muted">Recebido</span>
          <strong>{formatMoney(totalReceived)}</strong>
          <small className="muted">Pagamentos registados</small>
        </div>

        <div className="card metric metricWarn">
          <span className="muted">Por receber</span>
          <strong>{formatMoney(totalOutstanding)}</strong>
          <small className="muted">Mensalidades pendentes</small>
        </div>

        <div className="card metric">
          <span className="muted">Parte estimada da loja</span>
          <strong>{formatMoney(estimatedStoreResult)}</strong>
          <small className="muted">50% da receita prevista</small>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginTop: 20,
          marginBottom: 16,
        }}
      >
        <button
          className={`btn ${activeTab === 'mensalidades' ? 'primary' : 'ghost'}`}
          onClick={() => setActiveTab('mensalidades')}
        >
          Mensalidades
        </button>

        <button
          className={`btn ${activeTab === 'professores' ? 'primary' : 'ghost'}`}
          onClick={() => setActiveTab('professores')}
        >
          Professores
        </button>

        <button
          className={`btn ${activeTab === 'lucro' ? 'primary' : 'ghost'}`}
          onClick={() => setActiveTab('lucro')}
        >
          Lucro da loja
        </button>
      </div>

      {activeTab === 'mensalidades' && (
        <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
          <div style={{ padding: '18px 18px 12px' }}>
            <div className="eyebrow">MENSALIDADES DOS ALUNOS</div>
            <h3 style={{ margin: '6px 0' }}>{formatMonth(month)}</h3>
            <div className="muted">
              Valor padrão de 40 €. Podes alterar qualquer mensalidade deste mês,
              incluindo meses passados e meses futuros.
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
                  <th style={{ textAlign: 'left', padding: 12 }}>Mensalidade</th>
                  <th style={{ textAlign: 'left', padding: 12 }}>Professor (50%)</th>
                  <th style={{ textAlign: 'left', padding: 12 }}>Loja (50%)</th>
                  <th style={{ textAlign: 'left', padding: 12 }}>Estado</th>
                  <th style={{ textAlign: 'left', padding: 12 }}>Ações</th>
                </tr>
              </thead>

              <tbody>
                {students.map(student => {
                  const payment = paymentMap.get(student.id);
                  const amount = payment
                    ? Number(amounts[student.id] ?? payment.amount)
                    : DEFAULT_MONTHLY_FEE;

                  return (
                    <tr key={student.id}>
                      <td style={{ padding: 12 }}>
                        <strong>{studentNames[student.id] || 'Aluno sem nome'}</strong>
                      </td>

                      <td style={{ padding: 12, minWidth: 120 }}>
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
                            style={{ width: 100 }}
                          />
                        ) : (
                          <span>{formatMoney(DEFAULT_MONTHLY_FEE)}</span>
                        )}
                      </td>

                      <td style={{ padding: 12 }}>
                        {formatMoney(amount * TEACHER_PERCENTAGE / 100)}
                      </td>

                      <td style={{ padding: 12 }}>
                        {formatMoney(amount * SCHOOL_PERCENTAGE / 100)}
                      </td>

                      <td style={{ padding: 12 }}>
                        {!payment ? (
                          <span className="muted">Não criada</span>
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
                              {payment.status === 'pago'
                                ? 'Marcar pendente'
                                : 'Registar pagamento'}
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
      )}

      {activeTab === 'professores' && (
        <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
          <div style={{ padding: '18px 18px 12px' }}>
            <div className="eyebrow">FOLHA DE PROFESSORES</div>
            <h3 style={{ margin: '6px 0' }}>{formatMonth(month)}</h3>
            <div className="muted">
              A percentagem padrão do professor é 50% do valor da mensalidade.
            </div>

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
                  <th style={{ textAlign: 'left', padding: 12 }}>Alunos atribuídos</th>
                  <th style={{ textAlign: 'left', padding: 12 }}>Valor médio por aluno</th>
                  <th style={{ textAlign: 'left', padding: 12 }}>Total estimado</th>
                </tr>
              </thead>

              <tbody>
                {teachers.map(teacher => {
                  const payment = teacherPayments.find(
                    item => item.teacher_id === teacher.id
                  );

                  const count = Number(payment?.assigned_students || 0);
                  const rate = Number(payment?.rate_per_student ?? 20);

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

          <p className="muted" style={{ padding: 16 }}>
            A folha é uma estimativa baseada nos alunos associados às aulas desse mês.
            Se um aluno tiver aulas com mais de um professor, confirma a distribuição
            antes de usar os totais para pagamentos efetivos.
          </p>
        </div>
      )}

      {activeTab === 'lucro' && (
        <div className="card" style={{ marginTop: 16, padding: 20 }}>
          <div className="eyebrow">RESULTADO MENSAL</div>
          <h3 style={{ margin: '6px 0' }}>
            Resultado da loja — {formatMonth(month)}
          </h3>

          <p className="muted">
            Valores calculados automaticamente pela divisão de 50% para o professor
            e 50% para a loja. Ainda não desconta renda, eletricidade, impostos ou
            outras despesas.
          </p>

          <div className="metricGrid" style={{ marginTop: 16 }}>
            <div className="card metric">
              <span className="muted">Receita prevista</span>
              <strong>{formatMoney(totalExpected)}</strong>
            </div>

            <div className="card metric">
              <span className="muted">Receita recebida</span>
              <strong>{formatMoney(totalReceived)}</strong>
            </div>

            <div className="card metric">
              <span className="muted">Parte dos professores (50%)</span>
              <strong>{formatMoney(estimatedTeacherCost)}</strong>
              <small className="muted">Sobre a receita prevista</small>
            </div>

            <div className="card metric">
              <span className="muted">Parte da loja (50%)</span>
              <strong>{formatMoney(estimatedStoreResult)}</strong>
              <small className="muted">Antes de outras despesas</small>
            </div>

            <div className="card metric">
              <span className="muted">Parte da loja sobre o recebido</span>
              <strong>{formatMoney(receivedStoreResult)}</strong>
              <small className="muted">50% dos pagamentos recebidos</small>
            </div>

            <div className="card metric">
              <span className="muted">Parte do professor sobre o recebido</span>
              <strong>{formatMoney(receivedTeacherCost)}</strong>
              <small className="muted">50% dos pagamentos recebidos</small>
            </div>
          </div>

          <div className="notice" style={{ marginTop: 16 }}>
            Exemplo: numa mensalidade de 40 €, 20 € correspondem ao professor e 20 €
            à loja. Se ajustares uma mensalidade para 30 €, a divisão passa para 15 €
            e 15 €. Os meses futuros só entram nas contas depois de criares as respetivas
            mensalidades.
          </div>
        </div>
      )}
    </section>
  );
}

