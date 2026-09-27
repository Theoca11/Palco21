import {redirect} from 'next/navigation';
import {createClient} from '../../lib/supabase/server';
import ConfiguracaoClient from '../../components/ConfiguracaoClient';

export const dynamic='force-dynamic';

export default async function Configuracao(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('role,full_name').eq('id',user.id).single();
  if(profile?.role!=='administrador') redirect('/dashboard');
  const [{count:students},{count:teachers},{count:instruments},{count:lessons}]=await Promise.all([
    supabase.from('students').select('*',{count:'exact',head:true}),
    supabase.from('teachers').select('*',{count:'exact',head:true}),
    supabase.from('instruments').select('*',{count:'exact',head:true}),
    supabase.from('lessons').select('*',{count:'exact',head:true})
  ]);
  return <ConfiguracaoClient stats={{students:students||0,teachers:teachers||0,instruments:instruments||0,lessons:lessons||0}}/>;
}
