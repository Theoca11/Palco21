'use client';
import {useEffect,useMemo,useState} from 'react';
import {createClient} from '../lib/supabase/client';

type Student={id:string;full_name:string;status:string};
type Teacher={id:string;name:string};
type Payment={id:string;student_id:string;month:string;amount:number;status:string;paid_at:string|null};
type TeacherPayment={id:string;teacher_id:string;month:string;assigned_students:number;rate_per_student:number;amount:number};

const euro=(n:number)=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(n);
const monthNow=new Date().toISOString().slice(0,7)+'-01';

export function Finance({role}:{role:string}){
 const supabase=createClient();
 const [month,setMonth]=useState(monthNow),[students,setStudents]=useState<Student[]>([]),[teachers,setTeachers]=useState<Teacher[]>([]),[payments,setPayments]=useState<Payment[]>([]),[tp,setTp]=useState<TeacherPayment[]>([]),[loading,setLoading]=useState(true),[msg,setMsg]=useState('');
 const isAdmin=role==='administrador';
 async function load(){
  setLoading(true);setMsg('');
  const [s,t,p,tp0]=await Promise.all([
   supabase.from('students').select('id,full_name,status').order('full_name'),
   supabase.from('teachers').select('id,profile_id').eq('active',true),
   supabase.from('monthly_payments').select('*').eq('month',month).order('status'),
   supabase.from('teacher_monthly_payments').select('*').eq('month',month)
  ]);
  setStudents(s.data||[]);setPayments(p.data||[]);setTp(tp0.data||[]);
  const ids=(t.data||[]).map((x:any)=>x.id); if(ids.length){
   const pr=await supabase.from('profiles').select('id,full_name').in('id',(t.data||[]).map((x:any)=>x.profile_id).filter(Boolean));
   const map=new Map((pr.data||[]).map((x:any)=>[x.id,x.full_name])); setTeachers((t.data||[]).map((x:any)=>({id:x.id,name:map.get(x.profile_id)||'Professor'})));
  } else setTeachers([]);
  setLoading(false);
 }
 useEffect(()=>{load()},[month]);
 const totals=useMemo(()=>{
  const expected=payments.reduce((a,p)=>a+Number(p.amount||0),0);
  const paid=payments.filter(p=>p.status==='pago').reduce((a,p)=>a+Number(p.amount||0),0);
  const payroll=tp.reduce((a,p)=>a+Number(p.amount||0),0);
  return {expected,paid,pending:expected-paid,payroll,balance:paid-payroll};
 },[payments,tp]);
 async function markPaid(id:string){if(!isAdmin)return; const {error}=await supabase.from('monthly_payments').update({status:'pago',paid_at:new Date().toISOString()}).eq('id',id); if(error)setMsg(error.message);else load();}
 async function createStudentPayments(){
  if(!isAdmin)return;
  const active=students.filter(s=>s.status==='ativo'); if(!active.length){setMsg('Não há alunos ativos.');return;}
  const rows=active.map(s=>({student_id:s.id,month,amount:0,status:'pendente'}));
  const r=await supabase.from('monthly_payments').upsert(rows,{onConflict:'student_id,month'}); if(r.error)setMsg(r.error.message); else {setMsg('Mensalidades criadas.');load();}
 }
 async function createTeacherPayroll(){
  if(!isAdmin)return;
  const lessons=await supabase.from('lessons').select('teacher_id,student_id').gte('starts_at',`${month.slice(0,7)}-01T00:00:00`).lt('starts_at',new Date(new Date(month).setMonth(new Date(month).getMonth()+1)).toISOString());
  if(lessons.error){setMsg(lessons.error.message);return;}
  const by=new Map<string,Set<string>>(); (lessons.data||[]).forEach((x:any)=>{if(!by.has(x.teacher_id))by.set(x.teacher_id,new Set());by.get(x.teacher_id)!.add(x.student_id)});
  const rows=teachers.map(t=>({teacher_id:t.id,month,assigned_students:by.get(t.id)?.size||0,rate_per_student:20}));
  const r=await supabase.from('teacher_monthly_payments').upsert(rows,{onConflict:'teacher_id,month'}); if(r.error)setMsg(r.error.message);else {setMsg('Folha de professores atualizada a €20/aluno.');load();}
 }
 if(!isAdmin && role!=='professor' && role!=='aluno_encarregado')return null;
 const studentMap=new Map(students.map(s=>[s.id,s.full_name])); const teacherMap=new Map(teachers.map(t=>[t.id,t.name]));
 return <section className="section"><div className="sectionHead"><div><div className="eyebrow">Financeiro</div><h2>Mensalidades e pagamentos</h2></div><input aria-label="Mês" type="month" value={month.slice(0,7)} onChange={e=>setMonth(`${e.target.value}-01`)} /></div>
  {msg&&<div className="notice" style={{marginBottom:12}}>{msg}</div>}
  <div className="statGrid"><div className="card stat"><span className="muted">Faturação esperada</span><strong>{euro(totals.expected)}</strong><small className="muted">Mensalidades do mês</small></div><div className="card stat"><span className="muted">Recebido</span><strong>{euro(totals.paid)}</strong><small className="muted">Pago</small></div><div className="card stat"><span className="muted">Em falta</span><strong>{euro(totals.pending)}</strong><small className="muted">Por cobrar</small></div><div className="card stat"><span className="muted">Saldo após professores</span><strong>{euro(totals.balance)}</strong><small className="muted">Recebido − folha</small></div></div>
  {isAdmin&&<div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'14px 0'}}><button className="btn" onClick={createStudentPayments}>Gerar mensalidades</button><button className="btn" onClick={createTeacherPayroll}>Calcular folha professores</button></div>}
  <div className="card"><div className="tableWrap"><table><thead><tr><th>Aluno</th><th>Valor</th><th>Estado</th><th>Data</th><th></th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td>{studentMap.get(p.student_id)||'Aluno'}</td><td>{euro(Number(p.amount||0))}</td><td><span className={p.status==='pago'?'pill ok':'pill'}>{p.status}</span></td><td>{p.paid_at?new Date(p.paid_at).toLocaleDateString('pt-PT'):'—'}</td><td>{isAdmin&&p.status!=='pago'&&<button className="btn small" onClick={()=>markPaid(p.id)}>Marcar pago</button>}</td></tr>)}</tbody></table></div></div>
  <div className="card" style={{marginTop:14}}><h3>Folha de professores</h3><div className="tableWrap"><table><thead><tr><th>Professor</th><th>Alunos</th><th>€/aluno</th><th>Total</th></tr></thead><tbody>{tp.map(p=><tr key={p.id}><td>{teacherMap.get(p.teacher_id)||'Professor'}</td><td>{p.assigned_students}</td><td>{euro(Number(p.rate_per_student))}</td><td><strong>{euro(Number(p.amount))}</strong></td></tr>)}</tbody></table></div><div className="muted" style={{marginTop:8}}>Regra atual: €20 por aluno/mês atribuído ao professor.</div></div>
  {loading&&<div className="muted" style={{marginTop:10}}>A carregar…</div>}
 </section>
}
