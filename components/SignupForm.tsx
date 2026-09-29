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

    const formElement = e.currentTarget

    setStatus('')
    setLoading(true)

    const form = new FormData(formElement)

    const payload = {
      contact_name:
        String(form.get('name') || '').trim() || null,

      request_type:
        String(form.get('request_type') || 'informacao'),

      email:
        String(form.get('email') || '').trim() || null,

      phone:
        String(form.get('phone') || '').trim() || null,

      preferred_contact:
        String(form.get('preferred_contact') || '') || null,

      interest_instrument_id:
        String(form.get('interest_instrument_id') || '') || null,

      source:
        params.get('utm_source') ||
        params.get('source') ||
        'site',

      campaign:
        params.get('utm_campaign') || null,

      consent:
        form.get('consent') === 'on',

      students: []
    }

    try {
      const response = await fetch('/api/leads/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const raw = await response.text()

      let result: any = {}

      try {
        result = raw ? JSON.parse(raw) : {}
      } catch {
        result = {
          error:
            raw ||
            'A resposta do servidor não é válida.'
        }
      }

      if (!response.ok) {
        setStatus(
          `Erro ${response.status}: ${
            result?.error ||
            'Não foi possível enviar o pedido.'
          }`
        )
        return
      }

      if (result?.notification_error) {
        setStatus(
          `Pedido recebido. ${
            result.notification_error
          }`
        )
      } else {
        setStatus(
          'Pedido recebido. Entramos em contacto consigo brevemente.'
        )
      }

      formElement.reset()
    } catch (errorValue: any) {
      setStatus(
        `Erro de ligação ao servidor: ${
          errorValue?.message ||
          'não foi possível enviar o pedido.'
        }`
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
        Contacto
      </div>

      <h2>
        Queres saber mais?
      </h2>

      <p className="muted">
        Podes pedir informações sobre as aulas
        ou indicar que queres avançar com a inscrição.
        A escola entra depois em contacto.
      </p>

      <div className="field">
        <label>
          O que pretendes?
        </label>

        <select
          name="request_type"
          defaultValue="informacao"
        >
          <option value="informacao">
            Quero apenas informações
          </option>

          <option value="inscricao">
            Quero inscrever-me
          </option>
        </select>
      </div>

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

          {instruments.map(instrument => (
            <option
              key={instrument.id}
              value={instrument.id}
            >
              {instrument.name}
            </option>
          ))}
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

        Aceito que a Palco 21 utilize os meus
        dados para responder ao meu pedido.
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
          : 'ENVIAR PEDIDO →'}
      </button>
    </form>
  )
}
