'use client';
import {useEffect,useMemo,useState} from 'react';
import {createClient} from '../lib/supabase/client';

type Student={id:string;full_name:string|null;phone:string|null;email:string|null;guardian_name:string|null;guardian_phone:string|null;status:string;important_notes:string|null};
type Teacher={id:string;profile_id:string|null;specialty:string|null;active:boolean;profile?:{full_name:string|null;email:string|null;phone:string|null}|null};
type Instrument={id:string;name:string};

export function People({role}:{role:string}){
 const supabase=createClient();
 const [students,setStudents]=useState<Student[]>([]); const [teachers,setTeachers]=useState<Teacher[]>([]); const [instruments,setInstruments]=useState<Instrument[]>([]);
 const [studentInstruments,setStudentInstruments]=useState<Record<string,string[]>>({});
 const [tab,setTab]=useState<'students'|'teachers'>('students'); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [ok,setOk]=useState(''); const [open,setOpen]=useState(false);
 const [form,setForm]=useState({full_name:'',email:'',phone:'',guardian_name:'',guardian_phone:'',important_notes:'',instrument_ids:[] as string[]});
 const admin=role==='administrador';
 async function load(){setLoading(true);setError('');
  const ss=await supabase.from('students').select('id,full_name,phone,email,guardian_name,guardian_phone,status,important_notes').order('full_name',{ascending:true});
  if(ss.error){setError(ss.error.message);setLoading(false);return}
  const ts=await supabase.from('teachers').select('id,profile_id,specialty,active,profile:profiles(full_name,email,phone)').order('active',{ascending:false});
  if(ts.error){setError(ts.error.message)}
  const ins=await supabase.from('instruments').select('id,name').order('name'); if(ins.error){setError(ins.error.message)}
  const si=await supabase.from('student_instruments').select('student_id,instrument_id');
  const map:Record<string,string[]>={}; (si.data||[]).forEach((x:any)=>(map[x.student_id] ||= []).push(x.instrument_id));
  setStudents((ss.data || []) as Student[]);

setTeachers((ts.data || []).map((row: any) => ({
  ...row,
  profile: Array.isArray(row.profile)
    ? row.profile[0] ?? null
    : row.profile,
})) as Teacher[]); setInstruments((ins.data||[]) as Instrument[]); setStudentInstruments(map); setLoading(false)
 }
 useEffect(()=>{load()},[]);
 function toggleInstrument(id:string){setForm(f=>({...f,instrument_ids:f.instrument_ids.includes(id)?f.instrument_ids.filter(x=>x!==id):[...f.instrument_ids,id]}))}
 function openNew(){setForm({full_name:'',email:'',phone:'',guardian_name:'',guardian_phone:'',important_notes:'',instrument_ids:[]});setOk('');setError('');setOpen(true)}
 async function saveStudent(e:React.FormEvent){e.preventDefault();if(!admin)return;setError('');setOk('');if(!form.full_name.trim()){setError('Nome é obrigatório.');return}
  const ins=form.instrument_ids[0]||null;
  const {data,error}=await supabase.from('students').insert({full_name:form.full_name.trim(),email:form.email||null,phone:form.phone||null,guardian_name:form.guardian_name||null,guardian_phone:form.guardian_phone||null,important_notes:form.important_notes||null}).select('id').single();
  if(error){setError(error.message);return} if(ins){await supabase.from('student_instruments').insert(form.instrument_ids.map(instrument_id=>({student_id:data.id,instrument_id}))) }
  setOpen(false);setOk('Aluno criado.');load()
 }
 const instrumentName=useMemo(()=>Object.fromEntries(instruments.map(i=>[i.id,i.name])),[instruments]);
 return <section className="section"><div className="peopleHead"><div><div className="eyebrow">Pessoas</div><h2 style={{margin:'6px 0 4px'}}>Alunos e professores</h2><div className="muted">Perfis ligados à agenda e às permissões de acesso.</div></div>{admin&&tab==='students'&&<button className="btn primary" onClick={openNew}>+ Novo aluno</button>}</div>
  <div className="tabs"><button className={tab==='students'?'tab active':'tab'} onClick={()=>setTab('students')}>Alunos <span>{students.length}</span></button><button className={tab==='teachers'?'tab active':'tab'} onClick={()=>setTab('teachers')}>Professores <span>{teachers.length}</span></button></div>
  {error&&<div className="error">{error}</div>}{ok&&<div className="success">{ok}</div>}
  {loading?<div className="muted">A carregar…</div>:tab==='students'?<div className="peopleGrid">{students.map(s=><div className="personCard" key={s.id}><div className="personTop"><div><strong>{s.full_name||'Sem nome'}</strong><div className="muted">{s.status}</div></div><span className="pill">{(studentInstruments[s.id]||[]).map(id=>instrumentName[id]).filter(Boolean).join(' · ')||'Sem instrumento'}</span></div><div className="personMeta">{s.phone||'Sem telefone'}{s.email?` · ${s.email}`:''}</div>{s.guardian_name&&<div className="personMeta">Encarregado: {s.guardian_name}{s.guardian_phone?` · ${s.guardian_phone}`:''}</div>}{s.important_notes&&<div className="noteSmall">{s.important_notes}</div>}</div>)}{students.length===0&&<div className="emptyCard">Ainda não existem alunos.</div>}</div>
  :<div className="peopleGrid">{teachers.map(t=><div className="personCard" key={t.id}><div className="personTop"><div><strong>{t.profile?.full_name||'Professor sem perfil'}</strong><div className="muted">{t.specialty||'Especialidade por definir'}</div></div><span className="pill">{t.active?'Ativo':'Inativo'}</span></div><div className="personMeta">{t.profile?.email||'Sem email'}{t.profile?.phone?` · ${t.profile.phone}`:''}</div></div>)}{teachers.length===0&&<div className="emptyCard">Ainda não existem professores.</div>}</div>}
  {open&&<div className="modalBackdrop"><form className="modalCard" onSubmit={saveStudent}><div className="dashHead"><div><div className="eyebrow">Novo aluno</div><h3 style={{margin:'6px 0'}}>Ficha do aluno</h3></div><button type="button" className="btn ghost" onClick={()=>setOpen(false)}>Fechar</button></div>
   <div className="field"><label>Nome completo</label><input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></div>
   <div className="twoFields"><div className="field"><label>Telefone</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div><div className="field"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div></div>
   <div className="twoFields"><div className="field"><label>Encarregado</label><input value={form.guardian_name} onChange={e=>setForm({...form,guardian_name:e.target.value})}/></div><div className="field"><label>Telefone encarregado</label><input value={form.guardian_phone} onChange={e=>setForm({...form,guardian_phone:e.target.value})}/></div></div>
   <div className="field"><label>Instrumentos</label><div className="checks">{instruments.map(i=><label className="check" key={i.id}><input type="checkbox" checked={form.instrument_ids.includes(i.id)} onChange={()=>toggleInstrument(i.id)}/>{i.name}</label>)}</div></div>
   <div className="field"><label>Notas importantes</label><textarea rows={4} value={form.important_notes} onChange={e=>setForm({...form,important_notes:e.target.value})}/></div>
   <button className="btn primary" type="submit">Guardar aluno</button>
  </form></div>}
 </section>
}
