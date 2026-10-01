'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

export default function ConfirmClientPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()

    let cancelled = false

    async function processAuth() {
      try {
        /*
         * 1. Se vier um ?code=...
         *    usamos o fluxo PKCE.
         */
        const params = new URLSearchParams(
          window.location.search
        )

        const code = params.get('code')

        if (code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(
              code
            )

          if (error) {
            console.error(
              'Erro ao trocar código por sessão:',
              error
            )

            if (!cancelled) {
              setError(
                'O convite é inválido ou já expirou.'
              )
              setLoading(false)
            }

            return
          }
        }

        /*
         * 2. O Supabase também pode ter colocado
         *    a sessão no fragmento #access_token...
         *
         *    O browser client trata esse fragmento
         *    automaticamente.
         *
         *    Esperamos a sessão ficar disponível.
         */
        let session = null

        for (let i = 0; i < 20; i++) {
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession()

          if (currentSession) {
            session = currentSession
            break
          }

          await new Promise((resolve) =>
            setTimeout(resolve, 250)
          )
        }

        /*
         * 3. Se ainda não houver sessão,
         *    tentamos novamente através do estado
         *    de autenticação.
         */
        if (!session) {
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession()

          session = currentSession
        }

        if (cancelled) return

        if (!session) {
          setError(
            'Não foi possível validar o convite. O link pode ter expirado.'
          )
          setLoading(false)
          return
        }

        /*
         * 4. Convite validado.
         *
         *    NÃO mandamos para /login.
         *
         *    Mandamos diretamente para criar a password.
         */
        window.location.replace(
          '/definir-password'
        )
      } catch (err) {
        console.error(
          'Erro ao processar convite:',
          err
        )

        if (!cancelled) {
          setError(
            'Ocorreu um erro ao validar o convite.'
          )
          setLoading(false)
        }
      }
    }

    /*
     * Também ouvimos alterações de autenticação.
     * Isto é especialmente importante para links
     * que chegam através de #access_token.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session && !cancelled) {
          window.location.replace(
            '/definir-password'
          )
        }
      }
    )

    processAuth()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">

        <div className="mb-6">
          <div className="text-2xl font-bold text-black">
            PALCO <span className="text-red-600">21</span>
          </div>
        </div>

        {loading ? (
          <>
            <h1 className="text-xl font-bold text-black">
              A validar o convite...
            </h1>

            <p className="mt-3 text-sm text-gray-600">
              Aguarda um momento. Estamos a preparar
              o acesso à tua conta.
            </p>

            <div className="mt-6">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-red-600" />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-black">
              Não foi possível validar o convite
            </h1>

            <p className="mt-3 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                router.push('/login')
              }
              className="mt-6 w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700"
            >
              Ir para o login
            </button>
          </>
        )}
      </div>
    </main>
  )
}
