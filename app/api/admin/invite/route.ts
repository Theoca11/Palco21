import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

type Role = 'administrador' | 'professor' | 'aluno_encarregado'
const getAdmin = () => createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'administrador') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' }, { status: 500 })

  const body = await request.json().catch(() => null)
  const email = String(body?.email || '').trim().toLowerCase()
  const fullName = String(body?.fullName || '').trim()
  const phone = String(body?.phone || '').trim() || null
  const role = body?.role as Role
  if (!email || !fullName || !['administrador','professor','aluno_encarregado'].includes(role)) {
    return NextResponse.json({ error: 'Nome, email e perfil são obrigatórios.' }, { status: 400 })
  }

  const admin = getAdmin()
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName, invited_role: role } })
  if (error || !data.user) return NextResponse.json({ error: error?.message || 'Não foi possível criar o convite.' }, { status: 400 })
  const userId = data.user.id

  const { error: profileError } = await admin.from('profiles').insert({ id: userId, role, full_name: fullName, email, phone })
  if (profileError) { await admin.auth.admin.deleteUser(userId); return NextResponse.json({ error: profileError.message }, { status: 400 }) }

  if (role === 'professor') {
    const { error: e } = await admin.from('teachers').insert({ profile_id: userId, specialty: String(body?.specialty || '').trim() || null })
    if (e) { await admin.from('profiles').delete().eq('id', userId); await admin.auth.admin.deleteUser(userId); return NextResponse.json({ error: e.message }, { status: 400 }) }
  }
  if (role === 'aluno_encarregado') {
    const { error: e } = await admin.from('students').insert({ profile_id: userId, full_name: fullName, email, phone, guardian_name: String(body?.guardianName || '').trim() || null, guardian_phone: String(body?.guardianPhone || '').trim() || null, guardian_email: String(body?.guardianEmail || '').trim().toLowerCase() || null })
    if (e) { await admin.from('profiles').delete().eq('id', userId); await admin.auth.admin.deleteUser(userId); return NextResponse.json({ error: e.message }, { status: 400 }) }
  }
  return NextResponse.json({ ok: true, message: `Convite enviado para ${email}.` })
}
