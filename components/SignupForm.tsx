'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../lib/supabase/client'

type Instrument = {
  id: string
  name: string
}

export function SignupForm() {
  const params = useSearchParams()

  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [instruments, setInstruments] = useState<Instrument[]>([])

  useEffect(() => {
    createClient()
      .from('instruments')
      .select('id,name')
      .order('name')
      .then(({ data }) => {
        setInstruments(data || [])
      })
  }, [])

  async function submit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault()

    setStatus('')
    setLoading(true)

    const form = new FormData(e.currentTarget)

    const interestInstrumentId =
      String(
        form.get('interest_instrument_id') || ''
      ) || null

    const source =
      params.get('utm_source') ||
      params.get('source') ||
      'site'

    const campaign =
      params.get('utm_campaign') || null

    const payload = {
      contact_name:
        String(form.get('name') || '')
          .trim() || null,

      email:
        String(form.get('email') || '')
          .trim() || null,

      phone:
        String(form.get('phone') || '')
          .trim() || null,

      preferred_contact:
        String(
          form.get('preferred_contact') || ''
        ) || null,

      interest_instrument_id:
        interestInstrumentId,

      source,
      campaign,

      consent:
        form.get('consent') === 'on',

      // Alunos são criados/geridos apenas
      // pelo administrador dentro da aplicação.
      students: []
    }

    try {
      const response = await fetch(
        '/api/leads/submit',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      )

      const result =
        await response
          .json()
          .catch(() => ({}))

      if (!response.ok) {
        setStatus(
          `Erro: ${
            result?.error ||
            'Não foi possível enviar a inscrição.'
          }`
        )

        return
      }

      if (result?.notification_error) {
        setStatus(
          'Recebido. A inscrição ficou registada. ' +
          'A equipa deve verificar a configuração de notificações.'
        )
      } else {
        setStatus(
          'Recebido. Entramos em contacto consigo brevemente.'
        )
      }

      e.currentTarget.reset()
    } catch {
      setStatus(
        'Erro: não foi possível enviar a inscrição.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      className="form"
      onSubmit={submit}
    >
      <div className="eyebrow">
        Inscrição
      </div>

      <h2>
        Quero inscrever-me
      </h2>

      <p className="muted">
        Deixa os teus dados e escolhe o
        instrumento em que tens interesse.
        A escola entra depois em contacto.
      </p>

      <div className="field">
        <label>
          Nome
        </label>

        <input
          name="name"
          autoComplete="name"
        />
      </div>

      <div className="field">
        <label>
          Instrumento de interesse
        </label>

        <select
          name="interest_instrument_id"
          defaultValue=""
        >
          <option value="">
            Escolher…
          </option>

          {instruments.map(
            instrument => (
              <option
                key={instrument.id}
                value={instrument.id}
              >
                {instrument.name}
              </option>
            )
          )}
        </select>
      </div>

      <div className="field">
        <label>
          Email
        </label>

        <input
          name="email"
          type="email"
          autoComplete="email"
        />
      </div>

      <div className="field">
        <label>
          Telemóvel
        </label>

        <input
          name="phone"
          autoComplete="tel"
        />
      </div>

      <div className="field">
        <label>
          Preferes contacto por
        </label>

        <select
          name="preferred_contact"
          defaultValue=""
        >
          <option value="">
            Escolher…
          </option>

          <option>
            Chamada
          </option>

          <option>
            Email
          </option>

          <option>
            WhatsApp
          </option>
        </select>
      </div>

      <label
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          fontSize: 13,
          marginBottom: 15
        }}
      >
        <input
          name="consent"
          type="checkbox"
          required
        />

        Aceito que a Palco 21 utilize os
        meus dados para responder ao pedido
        de inscrição.
      </label>

      {status && (
        <div
          className={
            status.startsWith('Erro')
              ? 'error'
              : 'success'
          }
        >
          {status}
        </div>
      )}

      <button
        className="btn primary"
        disabled={loading}
      >
        {loading
          ? 'A ENVIAR…'
          : 'ENVIAR INSCRIÇÃO →'}
      </button>
    </form>
  )
}
