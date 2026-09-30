import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const code = req.nextUrl.searchParams.get('code')
  const tokenHash = req.nextUrl.searchParams.get('token_hash')
  const type = req.nextUrl.searchParams.get('type')

  try {
    // Fluxo PKCE / code
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Erro ao trocar code por sessão:', error)

        return NextResponse.redirect(
          new URL('/login?error=convite_invalido', req.url)
        )
      }

      return NextResponse.redirect(
        new URL('/definir-password', req.url)
      )
    }

    // Fluxo de convite do Supabase
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      })

      if (error) {
        console.error('Erro ao validar convite:', error)

        return NextResponse.redirect(
          new URL('/login?error=convite_invalido', req.url)
        )
      }

      return NextResponse.redirect(
        new URL('/definir-password', req.url)
      )
    }

    return NextResponse.redirect(
      new URL('/login?error=link_invalido', req.url)
    )
  } catch (error) {
    console.error('Erro na confirmação:', error)

    return NextResponse.redirect(
      new URL('/login?error=erro_confirmacao', req.url)
    )
  }
}
