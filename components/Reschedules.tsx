'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type RequestRow = {
  id: string;
  lesson_id: string;
  requested_at: string;
  proposed_starts_at: string | null;
  reason: string | null;
  status: string;
  decision_note: string | null;
  lesson?: {
    starts_at: string;
    duration_minutes: number;
    instrument?: { name: string } | null;
    student?: {
      full_name: string | null;
      profile?: { full_name: string | null } | null;
    } | null;
    teacher?: {
      profile?: { full_name: string | null } | null;
    } | null;
  } | null;
};

const fmt = (s: string) =>
  new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(s));

export function Reschedules({ role }: { role: string }) {
  const sb = createClient();

  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    const { data, error } = await sb
      .from('reschedule_requests')
      .select(
        'id,lesson_id,requested_at,proposed_starts_at,reason,status,decision_note,lesson:lessons(starts_at,duration_minutes,instrument:instruments(name),student:students(full_name,profile:profiles(full_name)),teacher:teachers(profile:profiles(full_name)))'
      )
      .order('requested_at', { ascending: false });

    if (error) {
      setError(error.message);
    }

    setRows((data || []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(
    id: string,
    status: 'aprovado' | 'rejeitado',
    row: RequestRow
  ) {
    setError('');
    setOk('');

    const note =
      status === 'aprovado'
        ? 'Remarcação aprovada.'
        : 'Remarcação rejeitada.';

    const { error } = await sb
      .from('reschedule_requests')
      .update({
        status,
        decision_note: note,
        decided_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      setError(error.message);
      return;
    }

    if (status === 'aprovado' && row.proposed_starts_at) {
      const { error: e2 } = await sb
        .from('lessons')
        .update({
          starts_at: new Date(
            row.proposed_starts_at
          ).toISOString()
        })
        .eq('id', row.lesson_id);

      if (e2) {
        setError(e2.message);
        return;
      }
    }

    try {
      await fetch('/api/notifications/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: [
            {
              channel: 'email',
              recipient: 'admin@palco21.pt',
              subject:
                status === 'aprovado'
                  ? 'Remarcação aprovada'
                  : 'Remarcação rejeitada',
              body: `O pedido de remarcação foi ${status}.`,
              event_type: 'reschedule_decided',
              related_id: id
            }
          ]
        })
      });
    } catch {}

    setOk(
      status === 'aprovado'
        ? 'Aula remarcada.'
        : 'Pedido rejeitado.'
    );

    load();
  }

  const canDecide =
    role === 'administrador' ||
    role === 'professor';

  return (
    <>
      <section className="section">
        <div className="peopleHead">
          <div>
            <div className="eyebrow">
              Remarcações
            </div>

            <h2 style={{ margin: '6px 0 4px' }}>
              {role === 'aluno_encarregado'
                ? 'Pedidos das tuas aulas'
                : 'Pedidos de remarcação'}
            </h2>

            <div className="muted">
              Os pedidos só podem ser feitos com pelo menos
              24 horas de antecedência.
            </div>
          </div>
        </div>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {ok && (
          <div className="success">
            {ok}
          </div>
        )}

        {loading ? (
          <div className="muted">
            A carregar…
          </div>
        ) : rows.length === 0 ? (
          <div className="emptyCard">
            Não existem pedidos.
          </div>
        ) : (
          <div className="requestGrid">
            {rows.map(r => (
              <div
                className="requestCard"
                key={r.id}
              >
                <div className="personTop">
                  <div>
                    <strong>
                      {r.lesson?.student?.full_name ||
                        r.lesson?.student?.profile
                          ?.full_name ||
                        'Aluno'}
                    </strong>

                    <div className="muted">
                      {r.lesson?.instrument?.name ||
                        'Instrumento'}{' '}
                      ·{' '}
                      {r.lesson?.teacher?.profile
                        ?.full_name ||
                        'Professor'}
                    </div>
                  </div>

                  <span className="pill">
                    {r.status}
                  </span>
                </div>

                <div className="personMeta">
                  Aula atual:{' '}
                  {r.lesson?.starts_at
                    ? fmt(r.lesson.starts_at)
                    : '—'}
                </div>

                {r.proposed_starts_at && (
                  <div className="personMeta">
                    Nova proposta:{' '}
                    <b>
                      {fmt(r.proposed_starts_at)}
                    </b>
                  </div>
                )}

                {r.reason && (
                  <div className="noteSmall">
                    Motivo: {r.reason}
                  </div>
                )}

                {canDecide &&
                  r.status === 'pendente' && (
                    <div className="agendaActions">
                      <button
                        className="btn primary"
                        onClick={() =>
                          decide(
                            r.id,
                            'aprovado',
                            r
                          )
                        }
                      >
                        Aprovar
                      </button>

                      <button
                        className="btn ghost"
                        onClick={() =>
                          decide(
                            r.id,
                            'rejeitado',
                            r
                          )
                        }
                      >
                        Rejeitar
                      </button>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* REGULAMENTO — APENAS ALUNO / ENCARREGADO */}
      {role === 'aluno_encarregado' && (
        <section className="section">
          <div className="peopleHead">
            <div>
              <div className="eyebrow">
                PALCO 21
              </div>

              <h2 style={{ margin: '6px 0 4px' }}>
                Regulamento
              </h2>

              <div className="muted">
                Informação sobre aulas, horários,
                mensalidades e faltas.
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{ marginTop: 16 }}
          >
            <div className="notice">
              <strong>
                Mensalidade: 40 €
              </strong>

              <br />

              Aula individual: 60 €
            </div>

            <h3>Cursos</h3>

            <p className="muted">
              As disciplinas na área da música são
              compostas por aulas teórico-práticas,
              sendo orientadas segundo metodologias
              próprias do professor que as esteja a
              lecionar.
            </p>

            <p className="muted">
              Se os alunos demonstrarem a ausência
              de conhecimentos na área de formação
              musical, esta parte será lecionada pelo
              professor de instrumento de acordo com
              a matéria que este irá dar.
            </p>

            <p className="muted">
              As aulas têm a duração de{' '}
              <strong>50 minutos semanais</strong>,
              exceto para alunos com idade inferior
              a 9 anos, em que têm a duração de{' '}
              <strong>30 minutos</strong>.
            </p>

            <h3>Horários</h3>

            <p className="muted">
              Os horários são definidos tendo em
              conta a conciliação do horário do aluno
              e do professor.
            </p>

            <h3>Matrículas</h3>

            <p className="muted">
              No ato da inscrição deve ser preenchida
              uma ficha com dados pessoais e de
              contacto e efetuado o pagamento da
              primeira mensalidade.
            </p>

            <h3>Mensalidade</h3>

            <p className="muted">
              O pagamento das mensalidades decorre
              do dia{' '}
              <strong>
                1 até ao dia 8 de cada mês
              </strong>.
            </p>

            <p className="muted">
              O não pagamento dentro deste período
              sem justificação resulta num acréscimo
              de <strong>5 €</strong> na mensalidade.
            </p>

            <p className="muted">
              A mensalidade é de{' '}
              <strong>40 €</strong>.
            </p>

            <p className="muted">
              As aulas são em par ou trio consoante
              o nível do aluno. No caso de aula
              individual, o valor é de{' '}
              <strong>60 €</strong>.
            </p>

            <h3>Faltas</h3>

            <p className="muted">
              As faltas relativas aos alunos serão
              cobradas. Podem eventualmente serem
              repostas pelo professor consoante a sua
              disponibilidade.
            </p>

            <p className="muted">
              As faltas relativas aos professores
              serão repostas ou não cobradas.
            </p>

            <p className="muted">
              Não haverá reposição de aulas nem
              descontado nenhum valor na mensalidade
              nos seguintes casos: feriados nacionais,
              feriados municipais, Carnaval e nos dias
              24 de Dezembro e 31 de Dezembro.
            </p>

            <p className="muted">
              Assim como, nos meses em que serão dadas
              5 aulas não será cobrado nenhum valor a
              mais.
            </p>

            <h3>Desistência</h3>

            <p className="muted">
              No caso de desistência, esta deve ser
              informada com{' '}
              <strong>
                30 dias de antecedência
              </strong>.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
