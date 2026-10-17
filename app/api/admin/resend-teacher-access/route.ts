
import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Tens de iniciar sessão.' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'administrador') {
      return NextResponse.json(
        { error: 'Só um administrador pode reenviar acessos.' },
        { status: 403 }
      );
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        { error: 'Configuração do Supabase incompleta.' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    const profileId = String(body?.profileId || '').trim();

    if (!profileId) {
      return NextResponse.json(
        { error: 'Falta indicar o professor.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: teacher, error: teacherError } = await admin
      .from('teachers')
      .select('id,profile_id,active')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (teacherError) throw teacherError;

    if (!teacher || !teacher.active) {
      return NextResponse.json(
        { error: 'Não foi encontrado um perfil de professor ativo.' },
        { status: 404 }
      );
    }

    const { data: targetProfile, error: targetError } = await admin
      .from('profiles')
      .select('id,email,full_name,role')
      .eq('id', profileId)
      .single();

    if (targetError || !targetProfile?.email || targetProfile.role !== 'professor') {
      return NextResponse.json(
        { error: 'Não foi encontrada uma conta de professor com email válido.' },
        { status: 404 }
      );
    }

    const { error: resetError } = await admin.auth.resetPasswordForEmail(
      targetProfile.email,
      {
        redirectTo: 'https://palco21musica.online/auth/confirm',
      }
    );

    if (resetError) {
      return NextResponse.json(
        { error: resetError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Email para redefinir o acesso enviado para ${targetProfile.email}.`,
    });
  } catch (error) {
    console.error('Erro ao reenviar acesso do professor:', error);

    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Não foi possível reenviar o acesso.',
      },
      { status: 500 }
    );
  }
}
