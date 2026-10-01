import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'administrador') {
      return NextResponse.json(
        { error: 'Sem permissão.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const type = body?.type
    const id = String(body?.id || '').trim()

    if (!id || !['student', 'teacher'].includes(type)) {
      return NextResponse.json(
        { error: 'Dados inválidos.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // =========================
    // ALUNO
    // =========================

    if (type === 'student') {
      const { data: student, error } = await admin
        .from('students')
        .select('id,profile_id,full_name,email')
        .eq('id', id)
        .single()

      if (error || !student) {
        return NextResponse.json(
          { error: 'Aluno não encontrado.' },
          { status: 404 }
        )
      }

      const { data: lessons } = await admin
        .from('lessons')
        .select('id')
        .eq('student_id', id)

      const lessonIds =
        lessons?.map((lesson) => lesson.id) || []

      if (lessonIds.length) {
        await admin
          .from('reschedule_requests')
          .delete()
          .in('lesson_id', lessonIds)
      }

      await admin
        .from('lessons')
        .delete()
        .eq('student_id', id)

      await admin
        .from('monthly_payments')
        .delete()
        .eq('student_id', id)

      await admin
        .from('student_instruments')
        .delete()
        .eq('student_id', id)

      const { error: deleteError } = await admin
        .from('students')
        .delete()
        .eq('id', id)

      if (deleteError) {
        return NextResponse.json(
          { error: deleteError.message },
          { status: 400 }
        )
      }

      if (student.profile_id) {
        await admin.auth.admin.deleteUser(
          student.profile_id
        )
      }

      return NextResponse.json({
        ok: true,
        message: `${student.full_name || 'Aluno'} eliminado definitivamente.`,
      })
    }

    // =========================
    // PROFESSOR
    // =========================

    const { data: teacher, error } = await admin
      .from('teachers')
      .select(
        'id,profile_id,profile:profiles(full_name,email)'
      )
      .eq('id', id)
      .single()

    if (error || !teacher) {
      return NextResponse.json(
        { error: 'Professor não encontrado.' },
        { status: 404 }
      )
    }

    const { data: lessons } = await admin
      .from('lessons')
      .select('id')
      .eq('teacher_id', id)

    const lessonIds =
      lessons?.map((lesson) => lesson.id) || []

    if (lessonIds.length) {
      await admin
        .from('reschedule_requests')
        .delete()
        .in('lesson_id', lessonIds)
    }

    await admin
      .from('lessons')
      .delete()
      .eq('teacher_id', id)

    await admin
      .from('teacher_monthly_payments')
      .delete()
      .eq('teacher_id', id)

    const { error: deleteError } = await admin
      .from('teachers')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      )
    }

    if (teacher.profile_id) {
      await admin.auth.admin.deleteUser(
        teacher.profile_id
      )
    }

    const profile = Array.isArray(teacher.profile)
      ? teacher.profile[0]
      : teacher.profile

    return NextResponse.json({
      ok: true,
      message: `${profile?.full_name || 'Professor'} eliminado definitivamente.`,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro inesperado.',
      },
      { status: 500 }
    )
  }
}
