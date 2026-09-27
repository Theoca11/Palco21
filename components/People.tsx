'use client';
import {useEffect,useMemo,useState} from 'react';
import {createClient} from '../lib/supabase/client';

type Student={id:string;full_name:string|null;phone:string|null;email:string|null;guardian_name:string|null;guardian_phone:string|null;status:string;important_notes:string|null};
type Teacher={id:string;profile_id:string|null;specialty:string|null;active:boolean;profile?:{full_name:string|null;email:string|null;phone:string|null}|null};
type Instrument={id:string;name:string};

type ViewMode='active'|'archive';

export function People({role}:{role:string}){
 const supabase=createClient();
 const [students,setStudents]=useState<Student[]>([]);
 const [teachers,setTeachers]=useState<Teacher[]>([]);
 const [instruments,setInstruments]=useState<Instrument[]>([]);
 const [studentInstruments,setStudentInstruments]=useState<Record<string,string[]>>({});
 const [tab,setTab]=useState<'students'|'teachers'>('students');
 const [view,setView]=useState<ViewMode>('active');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [ok,setOk]=useState('');
 const [open,setOpen]=useState(false);
 const [form,setForm]=useState({full_name:'',email:'',phone:'',guardian_name:'',guardian_phone:'',important_notes:'',instrument_ids:[] as string[]});
 const admin=role==='administrador';

 async function load(){
  setLoading(true); setError('');
  const ss=await supabase.from('students').select('id,full_name,phone,email,guardian_name,guardian_phone,status,important_notes').order('full_name',{ascending:true});
  if(ss.error){setError(ss.error.message);setLoading(false);return}
  const ts=await supabase.from('teachers').select('id,profile_id,specialty,active,profile:profiles(full_name,email,phone)').order('active',{ascending:false});
  if(ts.error){setError(ts.error.message);setLoading(false);return}
  const ins=await supabase.from('instruments').select('id,name').order('name');
  if(ins.error){setError(ins.error.message);setLoading(false);return}
  const si=await supabase.from('student_instruments').select('student_id,instrument_id');
  if(si.error){setError(si.error.message);setLoading(false);return}

  const map:Record<string,string[]>={};
  (si.data||[]).forEach((x:any)=>{(map[x.student_id] ||= []).push(x.instrument_id)});

  setStudents((ss.data||[]) as Student[]);
  setTeachers((ts.data||[]).map((row:any)=>({...row,profile:Array.isArray(row.profile)?row.profile[0]??null:row.profile})) as Teacher[]);
  setInstruments((ins.data||[]) as Instrument[]);
  setStudentInstruments(map);
  setLoading(false);
 }

 useEffect(()=>{load()},[]);

 function toggleInstrument(id:string){setForm(f=>({...f,instrument_ids:f.instrument_ids.includes(id)?f.instrument_ids.filter(x=>x!==id):[...f.instrument_ids,id]}))}
 function openNew(){setForm({full_name:'',email:'',phone:'',guardian_name:'',guardian_phone:'',important_notes:'',instrument_ids:[]});setOk('');setError('');setOpen(true)}

 async function saveStudent(e:React.FormEvent){
  e.preventDefault();
  if(!admin)return;
  setError('');setOk('');
  if(!form.full_name.trim()){setError('Nome é obrigatório.');return}
  const {data,error}=await supabase.from('students').insert({full_name:form.full_name.trim(),email:form.email||null,phone:form.phone||null,guardian_name:form.guardian_name||null,guardian_phone:form.guardian_phone||null,important_notes:form.important_notes||null}).select('id').single();
  if(error){setError(error.message);return}
  if(form.instrument_ids.length){
    const {error:instrumentError}=await supabase.from('student_instruments').insert(form.instrument_ids.map(instrument_id=>({student_id:data.id,instrument_id})));
    if(instrumentError){setError(instrumentError.message);return}
  }
  setOpen(false);setOk('Aluno criado.');load()
 }

 async function archiveStudent(student:Student){
  if(!admin)return;
  const name=student.full_name||'este aluno';
  if(!window.confirm(`Arquivar ${name}? O aluno deixa de aparecer nos ativos, mas fica recuperável.`))return;
  setError('');setOk('');
  const {error}=await supabase.from('students').update({status:'arquivado'}).eq('id',student.id);
  if(error){setError(error.message);return}
  setOk(`${name} foi arquivado.`);load()
 }

 async function restoreStudent(student:Student){
  if(!admin)return;
  const name=student.full_name||'este aluno';
  if(!window.confirm(`Recuperar ${name}?`))return;
  setError('');setOk('');
  const {error}=await supabase.from('students').update({status:'ativo'}).eq('id',student.id);
  if(error){setError(error.message);return}
  setOk(`${name} foi recuperado.`);load()
 }

 async function archiveTeacher(teacher:Teacher){
  if(!admin)return;
  const name=teacher.profile?.full_name||'este professor';
  if(!window.confirm(`Arquivar ${name}? O professor passa para o arquivo e deixa de aparecer nos professores ativos.`))return;
  setError('');setOk('');
  const {error}=await supabase.from('teachers').update({active:false}).eq('id',teacher.id);
  if(error){setError(error.message);return}
  setOk(`${name} foi arquivado.`);load()
 }

 async function restoreTeacher(teacher:Teacher){
  if(!admin)return;
  const name=teacher.profile?.full_name||'este professor';
  if(!window.confirm(`Recuperar ${name}?`))return;
  setError('');setOk('');
  const {error}=await supabase.from('teachers').update({active:true}).eq('id',teacher.id);
  if(error){setError(error.message);return}
  setOk(`${name} foi recuperado.`);load()
 }

 const instrumentName=useMemo(()=>Object.fromEntries(instruments.map(i=>[i.id,i.name])),[instruments]);
 const visibleStudents=students.filter(s=>view==='archive'?s.status==='arquivado':s.status!=='arquivado');
 const visibleTeachers=teachers.filter(t=>view==='archive'?!t.active:t.active);
 const studentArchiveCount=students.filter(s=>s.status==='arquivado').length;
 const teacherArchiveCount=teachers.filter(t=>!t.active).length;

 return <section className="section">
  <div className="peopleHead">
   <div>
    <div className="eyebrow">Pessoas</div>
    <h2 style={{margin:'6px 0 4px'}}>Alunos e professores</h2>
    <div className="muted">Perfis ligados à agenda e às permissões de acesso.</div>
   </div>
   {admin&&view==='active'&&tab==='students'&&<button className="btn primary" onClick={openNew}>+ Novo aluno</button>}
  </div>

  <div className="tabs" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
   <button className={tab==='students'?'tab active':'tab'} onClick={()=>setTab('students')}>Alunos <span>{students.filter(s=>s.status!=='arquivado').length}</span></button>
   <button className={tab==='teachers'?'tab active':'tab'} onClick={()=>setTab('teachers')}>Professores <span>{teachers.filter(t=>t.active).length}</span></button>
   {admin&&<button className={view==='archive'?'tab active':'tab'} onClick={()=>setView(v=>v==='active'?'archive':'active')}>Arquivo <span>{studentArchiveCount+teacherArchiveCount}</span></button>}
  </div>

  {admin&&<div className="muted" style={{margin:'8px 0 12px'}}>{view==='archive'?'A visualizar elementos arquivados. Podem ser recuperados a qualquer momento.':'A visualizar apenas elementos ativos.'}</div>}
  {error&&<div className="error">{error}</div>}
  {ok&&<div className="success">{ok}</div>}

  {loading?<div className="muted">A carregar…</div>:tab==='students'?<div className="peopleGrid">
   {visibleStudents.map(s=><div className="personCard" key={s.id}>
    <div className="personTop">
     <div><strong>{s.full_name||'Sem nome'}</strong><div className="muted">{view==='archive'?'Arquivado':s.status}</div></div>
     <span className="pill">{(studentInstruments[s.id]||[]).map(id=>instrumentName[id]).filter(Boolean).join(' · ')||'Sem instrumento'}</span>
    </div>
    <div className="personMeta">{s.phone||'Sem telefone'}{s.email?` · ${s.email}`:''}</div>
    {s.guardian_name&&<div className="personMeta">Encarregado: {s.guardian_name}{s.guardian_phone?` · ${s.guardian_phone}`:''}</div>}
    {s.important_notes&&<div className="noteSmall">{s.important_notes}</div>}
    {admin&&<div style={{display:'flex',gap:8,marginTop:10}}>{view==='archive'?<button className="btn ghost" onClick={()=>restoreStudent(s)}>Recuperar</button>:<button className="btn ghost" onClick={()=>archiveStudent(s)}>Arquivar</button>}</div>}
   </div>)}
   {visibleStudents.length===0&&<div className="emptyCard">{view==='archive'?'Não existem alunos arquivados.':'Ainda não existem alunos ativos.'}</div>}
  </div>
  :<div className="peopleGrid">
   {visibleTeachers.map(t=><div className="personCard" key={t.id}>
    <div className="personTop"><div><strong>{t.profile?.full_name||'Professor sem perfil'}</strong><div className="muted">{t.specialty||'Especialidade por definir'}</div></div><span className="pill">{view==='archive'?'Arquivado':'Ativo'}</span></div>
    <div className="personMeta">{t.profile?.email||'Sem email'}{t.profile?.phone?` · ${t.profile.phone}`:''}</div>
    {admin&&<div style={{display:'flex',gap:8,marginTop:10}}>{view==='archive'?<button className="btn ghost" onClick={()=>restoreTeacher(t)}>Recuperar</button>:<button className="btn ghost" onClick={()=>archiveTeacher(t)}>Arquivar</button>}</div>}
   </div>)}
   {visibleTeachers.length===0&&<div className="emptyCard">{view==='archive'?'Não existem professores arquivados.':'Ainda não existem professores ativos.'}</div>}
  </div>}

  {open&&<div className="modalBackdrop"><form className="modalCard" onSubmit={saveStudent}>
   <div className="dashHead"><div><div className="eyebrow">Novo aluno</div><h3 style={{margin:'6px 0'}}>Ficha do aluno</h3></div><button type="button" className="btn ghost" onClick={()=>setOpen(false)}>Fechar</button></div>
   <div className="field"><label>Nome completo</label><input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></div>
   <div className="twoFields"><div className="field"><label>Telefone</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div><div className="field"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div></div>
   <div className="twoFields"><div className="field"><label>Encarregado</label><input value={form.guardian_name} onChange={e=>setForm({...form,guardian_name:e.target.value})}/></div><div className="field"><label>Telefone encarregado</label><input value={form.guardian_phone} onChange={e=>setForm({...form,guardian_phone:e.target.value})}/></div></div>
   <div className="field"><label>Instrumentos</label><div className="checks">{instruments.map(i=><label className="check" key={i.id}><input type="checkbox" checked={form.instrument_ids.includes(i.id)} onChange={()=>toggleInstrument(i.id)}/>{i.name}</label>)}</div></div>
   <div className="field"><label>Notas importantes</label><textarea rows={4} value={form.important_notes} onChange={e=>setForm({...form,important_notes:e.target.value})}/></div>
   <button className="btn primary" type="submit">Guardar aluno</button>
  </form></div>}
 </section>
}
