
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type Lead = {
  id: string;
  name: string | null;
  request_type: 'informacao' | 'inscricao';
  email: string | null;
  phone: string | null;
  preferred_contact: string | null;
  source: string | null;
  campaign: string | null;
  funnel_stage: string;
  consent_at: string | null;
  created_at: string;
  updated_at?: string | null;
  archived?: boolean;
  message?: string | null;
  notes?: string | null;
  interest_instrument_id?: string | null;
};

type Instrument = {
  id: string;
  name: string;
};

type Activity = {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
};

const stages = [
  'visit',
  'interest',
  'form_started',
  'completed',
  'contacted',
  'enrolled',
  'lost',
] as const;

const labels: Record<string, string> = {
  visit: 'Visita',
  interest: 'Interesse',
  form_started: 'Formulário iniciado',
  completed: 'Pedido recebido',
  contacted: 'Contactado',
  enrolled: 'Inscrito',
  lost: 'Perdido',
};

const actionLabels: Record<string, string> = {
  created: 'Pedido criado',
  status_changed: 'Estado alterado',
  notes_updated: 'Notas atualizadas',
  archived: 'Pedido arquivado',
  restored: 'Pedido recuperado',
  student_created: 'Ficha de aluno criada',
};

const dateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('pt-PT', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '—';

export function Leads({ role }: { role: string }) {
  const admin = role === 'administrador';
  const supabase = createClient();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  const [selected, setSelected] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [activityDraft, setActivityDraft] = useState('');
  const [feedback, setFeedback] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const [leadsResult, instrumentsResult] = await Promise.all([
      supabase
        .from('leads')
        .select(`
          id,
          name,
          request_type,
          email,
          phone,
          preferred_contact,
          source,
          campaign,
          funnel_stage,
          consent_at,
          created_at,
          updated_at,
          archived,
          message,
          notes,
          interest_instrument_id
        `)
        .order('created_at', { ascending: false }),

      supabase.from('instruments').select('id,name').order('name'),
    ]);

    if (leadsResult.error) {
      setError(leadsResult.error.message);
      setLoading(false);
      return;
    }

    if (instrumentsResult.error) {
      setError(instrumentsResult.error.message);
      setLoading(false);
      return;
    }

    setLeads(
      (leadsResult.data || []).map((row: any) => ({
        ...row,
        archived: Boolean(row.archived),
        request_type:
          row.request_type === 'inscricao' ? 'inscricao' : 'informacao',
      })) as Lead[]
    );

    setInstruments((instrumentsResult.data || []) as Instrument[]);
    setLoading(false);
  }, [supabase]);

  const loadActivity = useCallback(async (leadId: string) => {
    setLoadingActivity(true);

    const { data, error } = await supabase
      .from('lead_activity')
      .select('id,action,details,created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      setActivities([]);
      setFeedback(
        'O pedido foi aberto, mas não foi possível carregar o histórico: ' +
          error.message
      );
    } else {
      setActivities((data || []) as Activity[]);
    }

    setLoadingActivity(false);
  }, [supabase]);

  useEffect(() => {
    if (admin) void load();
    else setLoading(false);
  }, [admin, load]);

  const visibleLeads = useMemo(
    () =>
      leads.filter(
        lead => Boolean(lead.archived) === showArchive
      ),
    [leads, showArchive]
  );

  const activeLeads = leads.filter(lead => !lead.archived);
  const archivedLeads = leads.filter(lead => lead.archived);

  const stats = useMemo(
    () => ({
      informacoes: activeLeads.filter(
        lead => lead.request_type === 'informacao'
      ).length,
      inscricoes: activeLeads.filter(
        lead => lead.request_type === 'inscricao'
      ).length,
      contactados: activeLeads.filter(
        lead => lead.funnel_stage === 'contacted'
      ).length,
      inscritos: activeLeads.filter(
        lead => lead.funnel_stage === 'enrolled'
      ).length,
    }),
    [activeLeads]
  );

  const instrumentName = (lead: Lead) =>
    instruments.find(
      item => item.id === lead.interest_instrument_id
    )?.name || 'Não indicado';

  async function logActivity(
    leadId: string,
    action: string,
    details?: string
  ) {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('lead_activity').insert({
      lead_id: leadId,
      action,
      details: details || null,
      created_by: user?.id || null,
    });

    if (error) {
      setFeedback(
        'A ação foi guardada, mas o histórico não foi atualizado: ' +
          error.message
      );
    }
  }

  async function openLead(lead: Lead) {
    setSelected(lead);
    setNotesDraft(lead.notes || '');
    setActivityDraft('');
    setFeedback('');
    await loadActivity(lead.id);
  }

  async function updateStage(lead: Lead, stage: string) {
    setError('');

    const { error } = await supabase
      .from('leads')
      .update({ funnel_stage: stage })
      .eq('id', lead.id);

    if (error) {
      setError(error.message);
      return;
    }

    await logActivity(
      lead.id,
      'status_changed',
      `${labels[lead.funnel_stage] || lead.funnel_stage} → ${
        labels[stage] || stage
      }`
    );

    await load();

    setSelected(current =>
      current?.id === lead.id
        ? { ...current, funnel_stage: stage }
        : current
    );

    await loadActivity(lead.id);
  }

  async function saveNotes() {
    if (!selected) return;

    setSaving(true);
    setFeedback('');

    const { error } = await supabase
      .from('leads')
      .update({ notes: notesDraft })
      .eq('id', selected.id);

    if (error) {
      setFeedback('Não foi possível guardar as notas: ' + error.message);
      setSaving(false);
      return;
    }

    await logActivity(
      selected.id,
      'notes_updated',
      'Notas internas atualizadas'
    );

    setSelected({ ...selected, notes: notesDraft });
    await load();
    await loadActivity(selected.id);

    setFeedback('Notas guardadas.');
    setSaving(false);
  }

  async function addActivityNote() {
    if (!selected || !activityDraft.trim()) return;

    setSaving(true);
    setFeedback('');

    await logActivity(
      selected.id,
      'contact_note',
      activityDraft.trim()
    );

    setActivityDraft('');
    await loadActivity(selected.id);
    setFeedback('Apontamento registado.');
    setSaving(false);
  }

  async function archiveLead(lead: Lead) {
    if (
      !window.confirm(
        `Arquivar "${lead.name || 'este pedido'}"? Poderás recuperá-lo mais tarde.`
      )
    ) return;

    const { error } = await supabase
      .from('leads')
      .update({ archived: true })
      .eq('id', lead.id);

    if (error) {
      setError(error.message);
      return;
    }

    await logActivity(lead.id, 'archived', 'Pedido arquivado');
    await load();
    setSelected(null);
  }

  async function restoreLead(lead: Lead) {
    const { error } = await supabase
      .from('leads')
      .update({ archived: false })
      .eq('id', lead.id);

    if (error) {
      setError(error.message);
      return;
    }

    await logActivity(lead.id, 'restored', 'Pedido recuperado do arquivo');
    await load();
  }

  async function convertToStudent(lead: Lead) {
    if (lead.funnel_stage === 'enrolled') {
      setFeedback('Este pedido já está marcado como inscrito.');
      return;
    }

    if (!lead.name?.trim()) {
      setFeedback(
        'Este pedido não tem nome. Abre a ficha e confirma os dados antes de criar o aluno.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Criar uma ficha de aluno para ${lead.name} com os dados deste pedido?`
    );

    if (!confirmed) return;

    setSaving(true);
    setFeedback('');
    setError('');

    try {
      // Evita criar uma ficha duplicada quando o email já existe.
      if (lead.email) {
        const { data: existing, error: existingError } = await supabase
          .from('students')
          .select('id')
          .ilike('email', lead.email.trim())
          .limit(1);

        if (existingError) throw existingError;

        if (existing && existing.length > 0) {
          setFeedback(
            'Já existe um aluno com este email. Verifica a área Alunos antes de continuar.'
          );
          setSaving(false);
          return;
        }
      }

      const { data: student, error: studentError } = await supabase
        .from('students')
        .insert({
          full_name: lead.name.trim(),
          email: lead.email?.trim() || null,
          phone: lead.phone?.trim() || null,
          status: 'ativo',
        })
        .select('id')
        .single();

      if (studentError) throw studentError;

      if (lead.interest_instrument_id) {
        const { error: instrumentError } = await supabase
          .from('student_instruments')
          .insert({
            student_id: student.id,
            instrument_id: lead.interest_instrument_id,
          });

        if (instrumentError) {
          throw new Error(
            `A ficha foi criada, mas não foi possível associar o instrumento: ${instrumentError.message}`
          );
        }
      }

      const { error: leadError } = await supabase
        .from('leads')
        .update({
          funnel_stage: 'enrolled',
          archived: true,
        })
        .eq('id', lead.id);

      if (leadError) {
        throw new Error(
          `A ficha do aluno foi criada, mas o pedido não foi atualizado: ${leadError.message}`
        );
      }

      await logActivity(
        lead.id,
        'student_created',
        `Ficha de aluno criada. ID: ${student.id}`
      );

      await load();
      setSelected(null);
      setFeedback('Ficha de aluno criada e pedido arquivado.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar a ficha do aluno.');
    } finally {
      setSaving(false);
    }
  }

  if (!admin) return null;

  return (
    <section className="section">
      <div className="peopleHead">
        <div>
          <div className="eyebrow">Captação</div>
          <h2 style={{ margin: '6px 0 4px' }}>
            Pedidos e inscrições
          </h2>
          <div className="muted">
            Consulta os pedidos, guarda notas e acompanha cada contacto.
          </div>
        </div>

        <button className="btn ghost" onClick={() => void load()}>
          Atualizar
        </button>
      </div>

      <div className="tabs">
        <button
          className={!showArchive ? 'tab active' : 'tab'}
          onClick={() => setShowArchive(false)}
        >
          Ativos <span>{activeLeads.length}</span>
        </button>

        <button
          className={showArchive ? 'tab active' : 'tab'}
          onClick={() => setShowArchive(true)}
        >
          Arquivo <span>{archivedLeads.length}</span>
        </button>
      </div>

      {!showArchive && (
        <div className="leadStats">
          <div className="card stat">
            <span className="muted">Pedidos de informação</span>
            <strong>{stats.informacoes}</strong>
          </div>
          <div className="card stat">
            <span className="muted">Pedidos de inscrição</span>
            <strong>{stats.inscricoes}</strong>
          </div>
          <div className="card stat">
            <span className="muted">Contactados</span>
            <strong>{stats.contactados}</strong>
          </div>
          <div className="card stat">
            <span className="muted">Inscritos</span>
            <strong>{stats.inscritos}</strong>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {feedback && <div className="notice">{feedback}</div>}

      {loading ? (
        <div className="muted">A carregar…</div>
      ) : (
        <div className="leadTable">
          <div className="leadRow leadHead">
            <span>Contacto</span>
            <span>Tipo</span>
            <span>Instrumento</span>
            <span>Estado</span>
            <span>Ações</span>
          </div>

          {visibleLeads.map(lead => (
            <div className="leadRow" key={lead.id}>
              <span>
                <strong>{lead.name || 'Sem nome'}</strong>
                <small>
                  {lead.email || lead.phone || 'Sem contacto'}
                  {lead.preferred_contact
                    ? ` · ${lead.preferred_contact}`
                    : ''}
                </small>
              </span>

              <span>
                <strong>
                  {lead.request_type === 'inscricao'
                    ? 'Inscrição'
                    : 'Informação'}
                </strong>
                <small>
                  {lead.source || 'Site'}
                  {lead.campaign ? ` · ${lead.campaign}` : ''}
                </small>
              </span>

              <span>{instrumentName(lead)}</span>

              <span>
                <select
                  value={lead.funnel_stage}
                  onChange={e => void updateStage(lead, e.target.value)}
                >
                  {stages.map(stage => (
                    <option key={stage} value={stage}>
                      {labels[stage]}
                    </option>
                  ))}
                </select>
              </span>

              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  className="btn primary"
                  onClick={() => void openLead(lead)}
                >
                  Ver pedido
                </button>

                {lead.archived ? (
                  <button
                    className="btn ghost"
                    onClick={() => void restoreLead(lead)}
                  >
                    Recuperar
                  </button>
                ) : (
                  <button
                    className="btn ghost"
                    onClick={() => void archiveLead(lead)}
                  >
                    Arquivar
                  </button>
                )}
              </span>
            </div>
          ))}

          {visibleLeads.length === 0 && (
            <div className="emptyCard">
              {showArchive
                ? 'O arquivo está vazio.'
                : 'Não existem pedidos ativos.'}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="modalBackdrop" onClick={() => setSelected(null)}>
          <section
            className="modalCard"
            style={{ width: 'min(900px, 96vw)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="dashHead">
              <div>
                <div className="eyebrow">Ficha do pedido</div>
                <h2 style={{ margin: '6px 0' }}>
                  {selected.name || 'Contacto sem nome'}
                </h2>
                <div className="muted">
                  Recebido em {dateTime(selected.created_at)}
                </div>
              </div>

              <button className="btn ghost" onClick={() => setSelected(null)}>
                Fechar
              </button>
            </div>

            <div className="leadStats">
              <div className="card stat">
                <span className="muted">Tipo de pedido</span>
                <strong>
                  {selected.request_type === 'inscricao' ? 'Inscrição' : 'Informação'}
                </strong>
              </div>
              <div className="card stat">
                <span className="muted">Instrumento</span>
                <strong>{instrumentName(selected)}</strong>
              </div>
              <div className="card stat">
                <span className="muted">Estado atual</span>
                <strong>{labels[selected.funnel_stage] || selected.funnel_stage}</strong>
              </div>
            </div>

            <div className="twoFields">
              <div className="field">
                <label>Nome</label>
                <div className="personMeta">{selected.name || 'Não indicado'}</div>
              </div>
              <div className="field">
                <label>Email</label>
                <div className="personMeta">
                  {selected.email ? (
                    <a href={`mailto:${selected.email}`}>{selected.email}</a>
                  ) : 'Não indicado'}
                </div>
              </div>
              <div className="field">
                <label>Telefone</label>
                <div className="personMeta">
                  {selected.phone ? (
                    <a href={`tel:${selected.phone}`}>{selected.phone}</a>
                  ) : 'Não indicado'}
                </div>
              </div>
              <div className="field">
                <label>Contacto preferido</label>
                <div className="personMeta">
                  {selected.preferred_contact || 'Não indicado'}
                </div>
              </div>
              <div className="field">
                <label>Origem</label>
                <div className="personMeta">{selected.source || 'Não indicada'}</div>
              </div>
              <div className="field">
                <label>Campanha</label>
                <div className="personMeta">{selected.campaign || 'Não indicada'}</div>
              </div>
              <div className="field">
                <label>Consentimento registado</label>
                <div className="personMeta">{dateTime(selected.consent_at)}</div>
              </div>
              <div className="field">
                <label>Última atualização</label>
                <div className="personMeta">
                  {dateTime(selected.updated_at || selected.created_at)}
                </div>
              </div>
            </div>

            <div className="field">
              <label>Mensagem enviada no pedido</label>
              <div className="emptyCard" style={{ whiteSpace: 'pre-wrap' }}>
                {selected.message?.trim() ||
                  'Não existe mensagem guardada neste pedido.'}
              </div>
            </div>

            <div className="field">
              <label>Estado do pedido</label>
              <select
                value={selected.funnel_stage}
                onChange={e => void updateStage(selected, e.target.value)}
              >
                {stages.map(stage => (
                  <option key={stage} value={stage}>
                    {labels[stage]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Notas internas</label>
              <textarea
                rows={4}
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                placeholder="Ex.: Contactei por telefone; vai confirmar o horário..."
              />
              <button
                className="btn primary"
                disabled={saving}
                onClick={() => void saveNotes()}
              >
                Guardar notas
              </button>
            </div>

            <div className="field">
              <label>Registar contacto ou apontamento no histórico</label>
              <textarea
                rows={3}
                value={activityDraft}
                onChange={e => setActivityDraft(e.target.value)}
                placeholder="Ex.: Liguei hoje; pediu para voltar a contactar na próxima semana."
              />
              <button
                className="btn ghost"
                disabled={saving || !activityDraft.trim()}
                onClick={() => void addActivityNote()}
              >
                Registar no histórico
              </button>
            </div>

            <div className="field">
              <label>Histórico do pedido</label>

              {loadingActivity ? (
                <div className="muted">A carregar histórico…</div>
              ) : activities.length === 0 ? (
                <div className="emptyCard">
                  Ainda não existem ações registadas no histórico.
                </div>
              ) : (
                <div className="todayList">
                  {activities.map(item => (
                    <div className="todayRow" key={item.id}>
                      <div className="todayTime">
                        {dateTime(item.created_at)}
                      </div>
                      <div>
                        <strong>
                          {actionLabels[item.action] || item.action}
                        </strong>
                        {item.details && (
                          <div className="muted">{item.details}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {feedback && <div className="notice">{feedback}</div>}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selected.funnel_stage !== 'enrolled' && (
                <button
                  className="btn primary"
                  disabled={saving}
                  onClick={() => void convertToStudent(selected)}
                >
                  {saving ? 'A guardar…' : 'Criar ficha de aluno'}
                </button>
              )}

              {!selected.archived ? (
                <button
                  className="btn ghost"
                  disabled={saving}
                  onClick={() => void archiveLead(selected)}
                >
                  Arquivar pedido
                </button>
              ) : (
                <button
                  className="btn ghost"
                  disabled={saving}
                  onClick={() => void restoreLead(selected)}
                >
                  Recuperar pedido
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
