import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const sb=await createClient();
 const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:'Não autenticado'},{status:401});
 const {data:p}=await sb.from('profiles').select('role').eq('id',user.id).single();
 if(p?.role!=='administrador')return NextResponse.json({error:'Sem permissão'},{status:403});
 const payload=await req.json();
 const {error}=await sb.from('notification_queue').insert(payload.items||[]);
 if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({ok:true});
}
