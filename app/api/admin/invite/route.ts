import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

type Role = 'administrador' | 'professor' | 'aluno_encarregado'

const getAdmin = () =>
  createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

export async function POST(request: Request) {
  try {
    // Cliente normal para verificar o administrador
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado.' },
        { status: 401 }
      )
    }

    // Confirmar que o utilizador é administrador
    const { data: me, error: meError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (meError || me?.role !== 'administrador') {
      return NextResponse.json(
        { error: 'Sem permissão.' },
        { status: 403 }
      )
    }

    // Confirmar Service Role Key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error:
            'SUPABASE_SERVICE_ROLE_KEY não configurada.',
        },
        { status: 500 }
      )
    }

    // Ler dados do formulário
    const body = await request.json().catch(() => null)

    const email = String(body?.email || '')
      .trim()
      .toLowerCase()

    const fullName = String(body?.fullName || '').trim()

    const phone =
      String(body?.phone || '').trim() || null

    const role = body?.role as Role

    // Validar campos obrigatórios
    if (
      !email ||
      !fullName ||
      ![
        'administrador',
        'professor',
        'aluno_encarregado',
      ].includes(role)
    ) {
      return NextResponse.json(
        {
          error:
            'Nome, email e perfil são obrigatórios.',
        },
        { status: 400 }
      )
    }

    const admin = getAdmin()

    /*
     * IMPORTANTE:
     * O convite vai sempre para o domínio online.
     * Não usamos localhost.
     */
    const redirectTo =
      'https://palco21musica.online/auth/confirm'

    // Criar utilizador e enviar email de convite
    const { data, error } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          invited_role: role,
        },
        redirectTo,
      })

    if (error || !data.user) {
      return NextResponse.json(
        {
          error:
            error?.message ||
            'Não foi possível criar o convite.',
        },
        { status: 400 }
      )
    }

    const userId = data.user.id

    // Criar perfil
    const { error: profileError } =
      await admin.from('profiles').insert({
        id: userId,
        role,
        full_name: fullName,
        email,
        phone,
      })

    if (profileError) {
      await admin.auth.admin.deleteUser(userId)

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      )
    }

    // Criar registo de professor
    if (role === 'professor') {
      const specialty =
        String(body?.specialty || '').trim() || null

      const { error: teacherError } =
        await admin.from('teachers').insert({
          profile_id: userId,
          specialty,
        })

      if (teacherError) {
        await admin
          .from('profiles')
          .delete()
          .eq('id', userId)

        await admin.auth.admin.deleteUser(userId)

        return NextResponse.json(
          { error: teacherError.message },
          { status: 400 }
        )
      }
    }

    // Criar registo de aluno/encarregado
    if (role === 'aluno_encarregado') {
      const guardianName =
        String(body?.guardianName || '').trim() || null

      const guardianPhone =
        String(body?.guardianPhone || '').trim() || null

      const guardianEmail =
        String(body?.guardianEmail || '')
          .trim()
          .toLowerCase() || null

      const { error: studentError } =
        await admin.from('students').insert({
          profile_id: userId,
          full_name: fullName,
          email,
          phone,
          guardian_name: guardianName,
          guardian_phone: guardianPhone,
          guardian_email: guardianEmail,
        })

      if (studentError) {
        await admin
          .from('profiles')
          .delete()
          .eq('id', userId)

        await admin.auth.admin.deleteUser(userId)

        return NextResponse.json(
          { error: studentError.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Convite enviado para ${email}.`,
    })
  } catch (error) {
    console.error(
      'Erro ao enviar convite:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro inesperado ao enviar convite.',
      },
      { status: 500 }
    )
  }
}
