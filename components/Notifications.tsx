'use client';
import {useEffect,useState} from 'react';
import {createClient} from '../lib/supabase/client';
const fmt=(s:string)=>new Intl.DateTimeFormat('pt-PT',{dateStyle:'short',timeStyle:'short'}).format(new Date(s));
export function Notifications({role}:{role:string}){
 const admin=role==='administrador'; const sb=createClient(); const [rows,setRows]=useState<any[]>([]); const [error,setError]=useState(''); const [msg,setMsg]=useState('');
 async function load(){if(!admin)return;const {data,error}=await sb.from('notification_queue').select('*').order('created_at',{ascending:false}).limit(50);if(error)setError(error.message);else setRows(data||[])}
 useEffect(()=>{load()},[admin]); if(!admin)return null;
 async function process(){setMsg('A enviar…');setError('');const r=await fetch('/api/notifications/process',{method:'POST'});const j=await r.json();if(!r.ok)setError(j.error||'Erro');else setMsg(`${j.processed||0} notificações processadas.`);load()}
 return <section className="section"><div className="peopleHead"><div><div className="eyebrow">Comunicação</div><h2 style={{margin:'6px 0 4px'}}>Notificações</h2><div className="muted">Fila de emails e SMS automáticos.</div></div><div className="agendaActions"><button className="btn ghost" onClick={load}>Atualizar</button><button className="btn primary" onClick={process}>Processar fila</button></div></div>{error&&<div className="error">{error}</div>}{msg&&<div className="success">{msg}</div>}<div className="card"><div className="tableWrap"><table><thead><tr><th>Canal</th><th>Destino</th><th>Assunto</th><th>Evento</th><th>Estado</th><th>Data</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.channel==='email'?'📧 Email':'📱 SMS'}</td><td>{r.recipient}</td><td>{r.subject||'—'}</td><td>{r.event_type}</td><td><span className={r.status==='sent'?'pill ok':'pill'}>{r.status}</span>{r.error&&<small className="muted"> {r.error}</small>}</td><td>{fmt(r.created_at)}</td></tr>)}</tbody></table>{rows.length===0&&<div className="emptyCard">A fila está vazia.</div>}</div></div></section>
}
