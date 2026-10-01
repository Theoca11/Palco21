import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  /*
   * IMPORTANTE:
   *
   * O Supabase pode devolver a sessão no fragmento do URL:
   *
   * #access_token=...
   *
   * O fragmento nunca é enviado para o servidor.
   *
   * Por isso encaminhamos para uma página Client Component,
   * que consegue ler/processar a sessão no browser.
   */

  const url = new URL(
    '/auth/confirm-client',
    req.url
  )

  // Preservar parâmetros ?code=, ?token_hash=, ?type=, etc.
  req.nextUrl.searchParams.forEach(
    (value, key) => {
      url.searchParams.set(key, value)
    }
  )

  return NextResponse.redirect(url)
}
