import {NextResponse} from 'next/server';
import {createClient as createServerClient} from '../../../../lib/supabase/server';
import {createClient as createSupabaseClient} from '@supabase/supabase-js';
export const dynamic='force-dynamic';
async function sendEmail(to:string,subject:string,html:string){
 const key=process.env.RESEND_API_KEY; const from=process.env.RESEND_FROM;
 if(!key||!from)throw new Error('Email não configurado: RESEND_API_KEY/RESEND_FROM');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to,subject,html})});
 const j=await r.json().catch(()=>({})); if(!r.ok)throw new Error(j?.message||'Erro Resend'); return j?.id||null;
}
async function sendSms(to:string,body:string){
 const sid=process.env.TWILIO_ACCOUNT_SID,token=process.env.TWILIO_AUTH_TOKEN,from=process.env.TWILIO_NUMBER;
 if(!sid||!token||!from)throw new Error('SMS não configurado: TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_NUMBER');
 const auth=Buffer.from(`${sid}:${token}`).toString('base64');
 const form=new URLSearchParams({To:to,From:from,Body:body});
 const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body:form});
 const j=await r.json().catch(()=>({})); if(!r.ok)throw new Error(j?.message||'Erro Twilio'); return j?.sid||null;
}
export async function POST(req:Request){
 const publicSb=await createServerClient(); const {data:{user}}=await publicSb.auth.getUser();
 const cron=req.headers.get('x-cron-secret');
 if(!user && (!cron || cron!==process.env.NOTIFICATIONS_CRON_SECRET)) return NextResponse.json({error:'Não autorizado'},{status:401});
 if(user){const {data:p}=await publicSb.from('profiles').select('role').eq('id',user.id).single(); if(p?.role!=='administrador')return NextResponse.json({error:'Sem permissão'},{status:403})}
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'SUPABASE_SERVICE_ROLE_KEY em falta'},{status:500});
 const sb=createSupabaseClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:rows,error}=await sb.from('notification_queue').select('*').eq('status','queued').lte('scheduled_for',new Date().toISOString()).order('created_at').limit(25);
 if(error)return NextResponse.json({error:error.message},{status:500});
 const results=[];
 for(const n of rows||[]){
   await sb.from('notification_queue').update({status:'sending',attempts:(n.attempts||0)+1,error:null}).eq('id',n.id).eq('status','queued');
   try{
     const provider_id=n.channel==='email'?await sendEmail(n.recipient,n.subject||'Palco 21',`<p>${String(n.body).replace(/\n/g,'<br/>')}</p>`):await sendSms(n.recipient,n.body);
     await sb.from('notification_queue').update({status:'sent',provider_id,sent_at:new Date().toISOString()}).eq('id',n.id);
     results.push({id:n.id,status:'sent'});
   }catch(e:any){await sb.from('notification_queue').update({status:'failed',error:e?.message||'Erro'}).eq('id',n.id);results.push({id:n.id,status:'failed',error:e?.message||'Erro'});}
 }
 return NextResponse.json({processed:results.length,results});
}
