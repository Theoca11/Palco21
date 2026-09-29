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

  async function load() {
    setLoading(true)
    setError('')

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
        instrument:instruments(name)
      `)
      .order('created_at', {
        ascending: false
      })

    if (error) {
      setError(error.message)
    } else {
      setLeads(
        (data || []).map((row: any) => ({
          ...row,
          request_type:
            row.request_type === 'inscricao'
              ? 'inscricao'
              : 'informacao',
          instrument: Array.isArray(row.instrument)
            ? row.instrument[0] ?? null
            : row.instrument
        })) as Lead[]
      )
    }

    setLoading(false)
  }

  useEffect(() => {
    if (admin) {
      load()
    } else {
      setLoading(false)
    }
  }, [admin])

  const stats = useMemo(
    () => ({
      informacoes: leads.filter(
        lead =>
          lead.request_type === 'informacao'
      ).length,
      inscricoes: leads.filter(
        lead =>
          lead.request_type === 'inscricao'
      ).length,
      contactados: leads.filter(
        lead =>
          lead.funnel_stage === 'contacted'
      ).length,
      inscritos: leads.filter(
        lead =>
          lead.funnel_stage === 'enrolled'
      ).length
    }),
    [leads]
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
    } else {
      load()
    }
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
            Distingue pedidos de informação de pedidos
            de inscrição e acompanha cada contacto.
          </div>
        </div>

        <button
          className="btn ghost"
          onClick={load}
        >
          Atualizar
        </button>
      </div>

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
            <span>Data</span>
          </div>

          {leads.map(lead => (
            <div
              className="leadRow"
              key={lead.id}
            >
              <span>
                <strong>
                  {lead.name || 'Sem nome'}
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
                {lead.request_type === 'inscricao' ? (
                  <strong>
                    Inscrição
                  </strong>
                ) : (
                  <strong>
                    Informação
                  </strong>
                )}

                <small>
                  {lead.source || 'site'}
                  {lead.campaign
                    ? ` · ${lead.campaign}`
                    : ''}
                </small>
              </span>

              <span>
                {lead.instrument?.name || '—'}
              </span>

              <span>
                <select
                  value={lead.funnel_stage}
                  onChange={e =>
                    updateStage(
                      lead.id,
                      e.target.value
                    )
                  }
                >
                  {stages.map(stage => (
                    <option
                      key={stage}
                      value={stage}
                    >
                      {labels[stage]}
                    </option>
                  ))}
                </select>
              </span>

              <span>
                {new Date(
                  lead.created_at
                ).toLocaleDateString('pt-PT')}
              </span>
            </div>
          ))}

          {leads.length === 0 && (
            <div className="emptyCard">
              Ainda não existem pedidos.
            </div>
          )}
        </div>
      )}
    </section>
  )
}
