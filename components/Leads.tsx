'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../lib/supabase/client'

type Lead = {
  id: string
  name: string | null
  request_type: 'informacao' | 'inscricao'
  email: string | null
  phone: string | null
  preferred_contact: string | null
  source: string | null
  campaign: string | null
  funnel_stage: string
  consent_at: string | null
  created_at: string
  archived?: boolean
  instrument?: {
    name: string | null
  } | null
}

const stages = [
  'visit',
  'interest',
  'form_started',
  'completed',
  'contacted',
  'enrolled',
  'lost'
] as const

const labels: Record<string, string> = {
  visit: 'Visita',
  interest: 'Interesse',
  form_started: 'Formulário iniciado',
  completed: 'Pedido recebido',
  contacted: 'Contactado',
  enrolled: 'Inscrito',
  lost: 'Perdido'
}

export function Leads({ role }: { role: string }) {
  const admin = role === 'administrador'
  const supabase = createClient()

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showArchive, setShowArchive] = useState(false)

  async function load() {
    setLoading(true)
    setError('')

    /*
     * Tentamos usar archived.
     * Se a coluna ainda não existir, mostramos a mensagem
     * para executar o pequeno SQL que forneço abaixo.
     */
    const { data, error } = await supabase
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
        archived,
        instrument:instruments(name)
      `)
      .order('created_at', {
        ascending: false
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLeads(
      (data || []).map((row: any) => ({
        ...row,
        archived: Boolean(row.archived),
        request_type:
          row.request_type === 'inscricao'
            ? 'inscricao'
            : 'informacao',
        instrument: Array.isArray(row.instrument)
          ? row.instrument[0] ?? null
          : row.instrument
      })) as Lead[]
    )

    setLoading(false)
  }

  useEffect(() => {
    if (admin) {
      load()
    } else {
      setLoading(false)
    }
  }, [admin])

  const visibleLeads = useMemo(
    () =>
      leads.filter(
        lead =>
          Boolean(lead.archived) ===
          showArchive
      ),
    [leads, showArchive]
  )

  const activeLeads = leads.filter(
    lead => !lead.archived
  )

  const archivedLeads = leads.filter(
    lead => lead.archived
  )

  const stats = useMemo(
    () => ({
      informacoes: activeLeads.filter(
        lead =>
          lead.request_type ===
          'informacao'
      ).length,

      inscricoes: activeLeads.filter(
        lead =>
          lead.request_type ===
          'inscricao'
      ).length,

      contactados: activeLeads.filter(
        lead =>
          lead.funnel_stage ===
          'contacted'
      ).length,

      inscritos: activeLeads.filter(
        lead =>
          lead.funnel_stage ===
          'enrolled'
      ).length
    }),
    [activeLeads]
  )

  async function updateStage(
    id: string,
    stage: string
  ) {
    const { error } = await supabase
      .from('leads')
      .update({
        funnel_stage: stage
      })
      .eq('id', id)

    if (error) {
      setError(error.message)
      return
    }

    load()
  }

  async function archiveLead(lead: Lead) {
    const name =
      lead.name || 'este pedido'

    const confirmed = window.confirm(
      `Arquivar ${name}? O pedido desaparece da lista principal, mas pode ser recuperado.`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('leads')
      .update({
        archived: true
      })
      .eq('id', lead.id)

    if (error) {
      setError(error.message)
      return
    }

    load()
  }

  async function restoreLead(lead: Lead) {
    const name =
      lead.name || 'este pedido'

    const confirmed = window.confirm(
      `Recuperar ${name}?`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('leads')
      .update({
        archived: false
      })
      .eq('id', lead.id)

    if (error) {
      setError(error.message)
      return
    }

    load()
  }

  /*
   * Caso tenhas transformado um lead em aluno,
   * arquiva o pedido para deixar de ocupar espaço.
   */
  async function markAsHandled(lead: Lead) {
    const { error } = await supabase
      .from('leads')
      .update({
        funnel_stage: 'enrolled',
        archived: true
      })
      .eq('id', lead.id)

    if (error) {
      setError(error.message)
      return
    }

    load()
  }

  if (!admin) {
    return null
  }

  return (
    <section className="section">
      <div className="peopleHead">
        <div>
          <div className="eyebrow">
            Captação
          </div>

          <h2
            style={{
              margin: '6px 0 4px'
            }}
          >
            Pedidos e inscrições
          </h2>

          <div className="muted">
            Pedidos de informação e de inscrição.
          </div>
        </div>

        <button
          className="btn ghost"
          onClick={load}
        >
          Atualizar
        </button>
      </div>

      <div className="tabs">
        <button
          className={
            !showArchive
              ? 'tab active'
              : 'tab'
          }
          onClick={() =>
            setShowArchive(false)
          }
        >
          Ativos{' '}
          <span>
            {activeLeads.length}
          </span>
        </button>

        <button
          className={
            showArchive
              ? 'tab active'
              : 'tab'
          }
          onClick={() =>
            setShowArchive(true)
          }
        >
          Arquivo{' '}
          <span>
            {archivedLeads.length}
          </span>
        </button>
      </div>

      {!showArchive && (
        <div className="leadStats">
          <div className="card stat">
            <span className="muted">
              Pedidos de informação
            </span>
            <strong>
              {stats.informacoes}
            </strong>
          </div>

          <div className="card stat">
            <span className="muted">
              Pedidos de inscrição
            </span>
            <strong>
              {stats.inscricoes}
            </strong>
          </div>

          <div className="card stat">
            <span className="muted">
              Contactados
            </span>
            <strong>
              {stats.contactados}
            </strong>
          </div>

          <div className="card stat">
            <span className="muted">
              Inscritos
            </span>
            <strong>
              {stats.inscritos}
            </strong>
          </div>
        </div>
      )}

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="muted">
          A carregar…
        </div>
      ) : (
        <div className="leadTable">
          <div className="leadRow leadHead">
            <span>Contacto</span>
            <span>Tipo</span>
            <span>Instrumento</span>
            <span>Estado</span>
            <span>Ações</span>
          </div>

          {visibleLeads.map(
            lead => (
              <div
                className="leadRow"
                key={lead.id}
              >
                <span>
                  <strong>
                    {lead.name ||
                      'Sem nome'}
                  </strong>

                  <small>
                    {lead.email ||
                      lead.phone ||
                      'Sem contacto'}

                    {lead.preferred_contact
                      ? ` · ${lead.preferred_contact}`
                      : ''}
                  </small>
                </span>

                <span>
                  <strong>
                    {lead.request_type ===
                    'inscricao'
                      ? 'Inscrição'
                      : 'Informação'}
                  </strong>

                  <small>
                    {lead.source ||
                      'site'}

                    {lead.campaign
                      ? ` · ${lead.campaign}`
                      : ''}
                  </small>
                </span>

                <span>
                  {lead.instrument?.name ||
                    '—'}
                </span>

                <span>
                  <select
                    value={
                      lead.funnel_stage
                    }
                    onChange={e =>
                      updateStage(
                        lead.id,
                        e.target.value
                      )
                    }
                  >
                    {stages.map(
                      stage => (
                        <option
                          key={stage}
                          value={stage}
                        >
                          {labels[stage]}
                        </option>
                      )
                    )}
                  </select>
                </span>

                <span
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap'
                  }}
                >
                  {!lead.archived &&
                    lead.funnel_stage !==
                      'enrolled' && (
                      <button
                        className="btn ghost"
                        onClick={() =>
                          markAsHandled(
                            lead
                          )
                        }
                      >
                        Passou a aluno
                      </button>
                    )}

                  {lead.archived ? (
                    <button
                      className="btn ghost"
                      onClick={() =>
                        restoreLead(
                          lead
                        )
                      }
                    >
                      Recuperar
                    </button>
                  ) : (
                    <button
                      className="btn ghost"
                      onClick={() =>
                        archiveLead(
                          lead
                        )
                      }
                    >
                      Arquivar
                    </button>
                  )}
                </span>
              </div>
            )
          )}

          {visibleLeads.length === 0 && (
            <div className="emptyCard">
              {showArchive
                ? 'O arquivo está vazio.'
                : 'Não existem pedidos ativos.'}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
