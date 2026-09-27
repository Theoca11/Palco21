import {redirect} from 'next/navigation';import {createClient} from '../../lib/supabase/server';import {DashboardClient} from '../../components/DashboardClient'
export const dynamic='force-dynamic'
export default async function Dashboard(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');const {data:profile}=await supabase.from('profiles').select('full_name,role').eq('id',user.id).single();return <DashboardClient name={profile?.full_name||user.email||'Utilizador'} role={profile?.role||'aluno_encarregado'}/>
}
