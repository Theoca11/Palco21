import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    // =========================================================
    // 1. Verificar utilizador autenticado
    // =========================================================

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

    // =========================================================
    // 2. Verificar se é administrador
    // =========================================================

    const { data: adminProfile, error: adminProfileError } =
      await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (
      adminProfileError ||
      adminProfile?.role !== 'administrador'
    ) {
      return NextResponse.json(
        { error: 'Sem permissão.' },
        { status: 403 }
      )
    }

    // =========================================================
    // 3. Verificar Service Role Key
    // =========================================================

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        {
          error:
            'Configuração do Supabase incompleta.',
        },
        { status: 500 }
      )
    }

    // =========================================================
    // 4. Ler dados enviados pelo People.tsx
    // =========================================================

    const body = await request.json()

    const type = String(body?.type || '').trim()

    const id = String(body?.id || '').trim()

    if (
      !id ||
      !['student', 'teacher'].includes(type)
    ) {
      return NextResponse.json(
        {
          error:
            'Tipo ou ID inválido.',
        },
        { status: 400 }
      )
    }

    // =========================================================
    // 5. Cliente ADMIN
    // =========================================================

    const admin = createAdminClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // =========================================================
    // =========================================================
    // ALUNO
    // =========================================================
    // =========================================================

    if (type === 'student') {
      // -------------------------------------------------------
      // Procurar aluno
      // -------------------------------------------------------

      const {
        data: student,
        error: studentFindError,
      } = await admin
        .from('students')
        .select(
          'id, profile_id, full_name, email'
        )
        .eq('id', id)
        .single()

      if (
        studentFindError ||
        !student
      ) {
        return NextResponse.json(
          {
            error:
              'Aluno não encontrado.',
          },
          { status: 404 }
        )
      }

      const studentProfileId =
        student.profile_id

      // -------------------------------------------------------
      // Procurar aulas do aluno
      // -------------------------------------------------------

      const {
        data: studentLessons,
        error: studentLessonsFindError,
      } = await admin
        .from('lessons')
        .select('id')
        .eq('student_id', id)

      if (studentLessonsFindError) {
        return NextResponse.json(
          {
            error:
              studentLessonsFindError.message,
          },
          { status: 400 }
        )
      }

      const studentLessonIds =
        (studentLessons || []).map(
          (lesson) => lesson.id
        )

      // -------------------------------------------------------
      // Apagar pedidos de remarcação
      // -------------------------------------------------------

      if (
        studentLessonIds.length > 0
      ) {
        const {
          error:
            studentRescheduleDeleteError,
        } = await admin
          .from('reschedule_requests')
          .delete()
          .in(
            'lesson_id',
            studentLessonIds
          )

        if (
          studentRescheduleDeleteError
        ) {
          return NextResponse.json(
            {
              error:
                studentRescheduleDeleteError.message,
            },
            { status: 400 }
          )
        }
      }

      // -------------------------------------------------------
      // Apagar aulas
      // -------------------------------------------------------

      const {
        error: studentLessonsDeleteError,
      } = await admin
        .from('lessons')
        .delete()
        .eq('student_id', id)

      if (
        studentLessonsDeleteError
      ) {
        return NextResponse.json(
          {
            error:
              studentLessonsDeleteError.message,
          },
          { status: 400 }
        )
      }

      // -------------------------------------------------------
      // Apagar aluno
      // -------------------------------------------------------

      const {
        error: studentDeleteError,
      } = await admin
        .from('students')
        .delete()
        .eq('id', id)

      if (studentDeleteError) {
        return NextResponse.json(
          {
            error:
              studentDeleteError.message,
          },
          { status: 400 }
        )
      }

      // -------------------------------------------------------
      // Apagar perfil
      // -------------------------------------------------------

      if (studentProfileId) {
        const {
          error:
            studentProfileDeleteError,
        } = await admin
          .from('profiles')
          .delete()
          .eq(
            'id',
            studentProfileId
          )

        if (
          studentProfileDeleteError
        ) {
          return NextResponse.json(
            {
              error:
                studentProfileDeleteError.message,
            },
            { status: 400 }
          )
        }

        // -----------------------------------------------------
        // Apagar conta Auth definitivamente
        // -----------------------------------------------------

        const {
          error:
            studentAuthDeleteError,
        } = await admin.auth.admin.deleteUser(
          studentProfileId
        )

        if (
          studentAuthDeleteError
        ) {
          return NextResponse.json(
            {
              error:
                `Aluno eliminado, mas a conta de acesso não foi eliminada: ${studentAuthDeleteError.message}`,
            },
            { status: 400 }
          )
        }
      }

      return NextResponse.json({
        ok: true,
        message:
          `${student.full_name || 'Aluno'} eliminado definitivamente.`,
      })
    }

    // =========================================================
    // =========================================================
    // PROFESSOR
    // =========================================================
    // =========================================================

    const {
      data: teacher,
      error: teacherFindError,
    } = await admin
      .from('teachers')
      .select(
        'id, profile_id, profile:profiles(full_name, email)'
      )
      .eq('id', id)
      .single()

    if (
      teacherFindError ||
      !teacher
    ) {
      return NextResponse.json(
        {
          error:
            'Professor não encontrado.',
        },
        { status: 404 }
      )
    }

    const teacherProfileId =
      teacher.profile_id

    // ---------------------------------------------------------
    // Procurar aulas do professor
    // ---------------------------------------------------------

    const {
      data: teacherLessons,
      error: teacherLessonsFindError,
    } = await admin
      .from('lessons')
      .select('id')
      .eq('teacher_id', id)

    if (teacherLessonsFindError) {
      return NextResponse.json(
        {
          error:
            teacherLessonsFindError.message,
        },
        { status: 400 }
      )
    }

    const teacherLessonIds =
      (teacherLessons || []).map(
        (lesson) => lesson.id
      )

    // ---------------------------------------------------------
    // Apagar pedidos de remarcação
    // ---------------------------------------------------------

    if (
      teacherLessonIds.length > 0
    ) {
      const {
        error:
          teacherRescheduleDeleteError,
      } = await admin
        .from('reschedule_requests')
        .delete()
        .in(
          'lesson_id',
          teacherLessonIds
        )

      if (
        teacherRescheduleDeleteError
      ) {
        return NextResponse.json(
          {
            error:
              teacherRescheduleDeleteError.message,
          },
          { status: 400 }
        )
      }
    }

    // ---------------------------------------------------------
    // Apagar aulas do professor
    // ---------------------------------------------------------

    const {
      error: teacherLessonsDeleteError,
    } = await admin
      .from('lessons')
      .delete()
      .eq('teacher_id', id)

    if (
      teacherLessonsDeleteError
    ) {
      return NextResponse.json(
        {
          error:
            teacherLessonsDeleteError.message,
        },
        { status: 400 }
      )
    }

    // ---------------------------------------------------------
    // Apagar professor
    // ---------------------------------------------------------

    const {
      error: teacherDeleteError,
    } = await admin
      .from('teachers')
      .delete()
      .eq('id', id)

    if (teacherDeleteError) {
      return NextResponse.json(
        {
          error:
            teacherDeleteError.message,
        },
        { status: 400 }
      )
    }

    // ---------------------------------------------------------
    // Apagar perfil
    // ---------------------------------------------------------

    if (teacherProfileId) {
      const {
        error:
          teacherProfileDeleteError,
      } = await admin
        .from('profiles')
        .delete()
        .eq(
          'id',
          teacherProfileId
        )

      if (
        teacherProfileDeleteError
      ) {
        return NextResponse.json(
          {
            error:
              teacherProfileDeleteError.message,
          },
          { status: 400 }
        )
      }

      // -------------------------------------------------------
      // Apagar conta Auth definitivamente
      // -------------------------------------------------------

      const {
        error:
          teacherAuthDeleteError,
      } = await admin.auth.admin.deleteUser(
        teacherProfileId
      )

      if (
        teacherAuthDeleteError
      ) {
        return NextResponse.json(
          {
            error:
              `Professor eliminado, mas a conta de acesso não foi eliminada: ${teacherAuthDeleteError.message}`,
          },
          { status: 400 }
        )
      }
    }

    // ---------------------------------------------------------
    // Nome para mensagem final
    // ---------------------------------------------------------

    const teacherProfile =
      Array.isArray(teacher.profile)
        ? teacher.profile[0]
        : teacher.profile

    return NextResponse.json({
      ok: true,
      message:
        `${teacherProfile?.full_name || 'Professor'} eliminado definitivamente.`,
    })
  } catch (error) {
    console.error(
      'Erro ao eliminar pessoa:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro inesperado ao eliminar.',
      },
      { status: 500 }
    )
  }
}
