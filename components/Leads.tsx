'use client'
import {useEffect,useMemo,useState} from 'react'
import {createClient} from '../lib/supabase/client'

type Lead={id:string;name:string|null;email:string|null;phone:string|null;preferred_contact:string|null;source:string|null;campaign:string|null;funnel_stage:string;consent_at:string|null;created_at:string;instrument?:{name:string|null}|null}
const stages=['visit','interest','form_started','completed','contacted','enrolled','lost'] as const
const labels:Record<string,string>={visit:'Visita',interest:'Interesse',form_started:'Formulário iniciado',completed:'Inscrição recebida',contacted:'Contactado',enrolled:'Inscrito',lost:'Perdido'}
export function Leads({role}:{role:string}){
 const admin=role==='administrador'; const supabase=createClient(); const [leads,setLeads]=useState<Lead[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 async function load(){setLoading(true);const {data,error}=await supabase.from('leads').select('id,name,email,phone,preferred_contact,source,campaign,funnel_stage,consent_at,created_at,instrument:instruments(name)').order('created_at',{ascending:false});if(error)setError(error.message);else setLeads((data || []).map((row: any) => ({
  ...row,
  instrument: Array.isArray(row.instrument)
    ? row.instrument[0] ?? null
    : row.instrument,
})) as Lead[]);setLoading(false)}
 useEffect(()=>{if(admin)load(); else setLoading(false)},[admin]);
 const stats=useMemo(()=>Object.fromEntries(stages.map(s=>[s,leads.filter(l=>l.funnel_stage===s).length])),[leads]);
 async function updateStage(id:string,stage:string){const {error}=await supabase.from('leads').update({funnel_stage:stage}).eq('id',id);if(error)setError(error.message);else load()}
 if(!admin)return null
 return <section className="section"><div className="peopleHead"><div><div className="eyebrow">Captação</div><h2 style={{margin:'6px 0 4px'}}>Leads e inscrições</h2><div className="muted">Acompanha a origem dos contactos e o avanço no funil.</div></div><button className="btn ghost" onClick={load}>Atualizar</button></div>
  <div className="leadStats">{stages.map(s=><div className="card stat" key={s}><span className="muted">{labels[s]}</span><strong>{stats[s]}</strong></div>)}</div>
  {error&&<div className="error">{error}</div>}{loading?<div className="muted">A carregar…</div>:<div className="leadTable"><div className="leadRow leadHead"><span>Contacto</span><span>Origem</span><span>Instrumento</span><span>Estado</span><span>Data</span></div>{leads.map(l=><div className="leadRow" key={l.id}><span><strong>{l.name||'Sem nome'}</strong><small>{l.email||l.phone||'Sem contacto'}{l.preferred_contact?` · ${l.preferred_contact}`:''}</small></span><span>{l.source||'—'}{l.campaign&&<small>{l.campaign}</small>}</span><span>{l.instrument?.name||'—'}</span><span><select value={l.funnel_stage} onChange={e=>updateStage(l.id,e.target.value)}>{stages.map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></span><span>{new Date(l.created_at).toLocaleDateString('pt-PT')}</span></div>)}{leads.length===0&&<div className="emptyCard">Ainda não existem leads.</div>}</div>}
 </section>
}
