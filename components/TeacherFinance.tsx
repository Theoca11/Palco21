
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type Payment = {
  id: string;
  month: string;
  assigned_students: number;
  rate_per_student: number;
  amount: number;
  paid: boolean;
  paid_at: string | null;
};

const money = (value: number) =>
  Number(value || 0).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  });

const monthName = (value: string) =>
  new Date(`${value.slice(0, 7)}-01T12:00:00`).toLocaleDateString(
    'pt-PT',
    { month: 'long', year: 'numeric' }
  );

export function TeacherFinance() {
  const supabase = createClient();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error('Sessão não encontrada.');

      const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('profile_id', user.id)
        .eq('active', true)
        .maybeSingle();

      if (teacherError) throw teacherError;
      if (!teacher) {
        throw new Error('Não foi encontrado um perfil de professor ativo.');
      }

      const { data, error: paymentsError } = await supabase
        .from('teacher_monthly_payments')
        .select('id,month,assigned_students,rate_per_student,amount,paid,paid_at')
        .eq('teacher_id', teacher.id)
        .order('month', { ascending: false });

      if (paymentsError) throw paymentsError;

      setPayments((data || []) as Payment[]);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o financeiro.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const currentPayment = payments.find(p => p.month === month);
  const totalOwed = payments
    .filter(p => !p.paid)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalPaid = payments
    .filter(p => p.paid)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <section className="section">
      <div className="panelHead">
        <div>
          <div className="eyebrow">FINANCEIRO</div>
          <h2 style={{ margin: '6px 0' }}>Os meus pagamentos</h2>
          <div className="muted">
            Consulta os valores a receber e os pagamentos já registados.
          </div>
        </div>

        <label>
          <span className="muted" style={{ display: 'block', marginBottom: 4 }}>
            Mês
          </span>
          <input
            className="input"
            type="month"
            value={month.slice(0, 7)}
            onChange={e => {
              if (e.target.value) setMonth(`${e.target.value}-01`);
            }}
          />
        </label>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="metricGrid" style={{ marginTop: 16 }}>
        <div className="card metric metricWarn">
          <span className="muted">Total por receber</span>
          <strong>{money(totalOwed)}</strong>
          <small className="muted">Todos os meses pendentes</small>
        </div>

        <div className="card metric metricOk">
          <span className="muted">Total já pago</span>
          <strong>{money(totalPaid)}</strong>
          <small className="muted">Pagamentos registados</small>
        </div>

        <div className="card metric">
          <span className="muted">Valor do mês</span>
          <strong>{money(Number(currentPayment?.amount || 0))}</strong>
          <small className="muted">{monthName(month)}</small>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, overflowX: 'auto' }}>
        <div style={{ padding: 18 }}>
          <div className="eyebrow">HISTÓRICO</div>
          <h3 style={{ margin: '6px 0' }}>Pagamentos mensais</h3>
        </div>

        {loading ? (
          <div className="emptyCard" style={{ margin: 16 }}>
            A carregar…
          </div>
        ) : payments.length === 0 ? (
          <div className="emptyCard" style={{ margin: 16 }}>
            Ainda não existem valores financeiros registados para este perfil.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 12 }}>Mês</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Alunos</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Valor por aluno</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Total</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Estado</th>
                <th style={{ textAlign: 'left', padding: 12 }}>Data de pagamento</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(payment => (
                <tr key={payment.id}>
                  <td style={{ padding: 12 }}>{monthName(payment.month)}</td>
                  <td style={{ padding: 12 }}>{payment.assigned_students}</td>
                  <td style={{ padding: 12 }}>{money(payment.rate_per_student)}</td>
                  <td style={{ padding: 12 }}>
                    <strong>{money(Number(payment.amount || 0))}</strong>
                  </td>
                  <td style={{ padding: 12 }}>
                    {payment.paid
                      ? <span className="success">Pago</span>
                      : <span className="muted">Por pagar</span>}
                  </td>
                  <td style={{ padding: 12 }}>
                    {payment.paid_at
                      ? new Date(payment.paid_at).toLocaleDateString('pt-PT')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="muted">
        Os valores apresentados dependem da folha mensal gerada pela administração.
        Se ainda não houver uma folha para determinado mês, esse mês não terá um
        valor calculado nesta lista.
      </p>
    </section>
  );
}

