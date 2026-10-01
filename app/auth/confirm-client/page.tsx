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
         * CONVITES SUPABASE
         *
         * inviteUserByEmail pode devolver:
         *
         * #access_token=...
         * &refresh_token=...
         *
         * O fragmento só existe no browser.
         */

        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.substring(1)
          : window.location.hash

        if (hash) {
          const hashParams = new URLSearchParams(hash)

          const accessToken =
            hashParams.get('access_token')

          const refreshToken =
            hashParams.get('refresh_token')

          const hashError =
            hashParams.get('error_description')

          if (hashError) {
            throw new Error(
              decodeURIComponent(
                hashError.replace(/\+/g, ' ')
              )
            )
          }

          if (
            accessToken &&
            refreshToken
          ) {
            const {
              error: sessionError,
            } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (sessionError) {
              throw sessionError
            }

            /*
             * Limpar os tokens do URL.
             */
            window.history.replaceState(
              {},
              document.title,
              '/auth/confirm-client'
            )
          }
        }

        /*
         * Também suportamos ?code=...
         * caso seja utilizado PKCE.
         */

        const params =
          new URLSearchParams(
            window.location.search
          )

        const code =
          params.get('code')

        if (code) {
          const {
            error: codeError,
          } =
            await supabase.auth.exchangeCodeForSession(
              code
            )

          if (codeError) {
            throw codeError
          }
        }

        /*
         * Confirmar que temos sessão.
         */

        for (let i = 0; i < 20; i++) {
          const {
            data: { session },
          } =
            await supabase.auth.getSession()

          if (session) {
            if (!cancelled) {
              window.location.replace(
                '/definir-password'
              )
            }

            return
          }

          await new Promise(
            (resolve) =>
              setTimeout(resolve, 250)
          )
        }

        if (!cancelled) {
          setError(
            'Não foi possível validar o convite. O link pode ter expirado ou já ter sido utilizado.'
          )

          setLoading(false)
        }
      } catch (err) {
        console.error(
          'Erro ao processar convite:',
          err
        )

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível validar o convite.'
          )

          setLoading(false)
        }
      }
    }

    /*
     * Se a sessão for criada pelo Supabase,
     * avançamos imediatamente.
     */

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (
            session &&
            !cancelled
          ) {
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
            PALCO{' '}
            <span className="text-red-600">
              21
            </span>
          </div>
        </div>

        {loading ? (
          <>
            <h1 className="text-xl font-bold text-black">
              A validar o convite...
            </h1>

            <p className="mt-3 text-sm text-gray-600">
              Aguarda um momento. Estamos a
              preparar o acesso à tua conta.
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
