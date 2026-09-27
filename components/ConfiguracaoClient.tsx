'use client';
import {useState} from 'react';

export default function ConfiguracaoClient({stats}:{stats:{students:number;teachers:number;instruments:number;lessons:number}}){
 const [copied,setCopied]=useState(false);
 const envReady=typeof window!=='undefined';
 const items=[
  ['Base de dados','Supabase responde e a aplicação consegue consultar as tabelas.',true],
  ['Conta de administrador','A sessão atual tem permissões de administrador.',true],
  ['Professores',`${stats.teachers} perfil${stats.teachers===1?'':'is'} criado${stats.teachers===1?'':'s'}.`,stats.teachers>0],
  ['Alunos',`${stats.students} aluno${stats.students===1?'':'s'} na base.`,stats.students>0],
  ['Instrumentos',`${stats.instruments} instrumento${stats.instruments===1?'':'s'} disponível${stats.instruments===1?'':'is'}.`,stats.instruments>0],
  ['Aulas',`${stats.lessons} aula${stats.lessons===1?'':'s'} registada${stats.lessons===1?'':'s'}.`,stats.lessons>0]
 ];
 async function copy(){await navigator.clipboard.writeText(`${location.origin}/configuracao`);setCopied(true);setTimeout(()=>setCopied(false),1600)}
 return <main className='dash'><div className='dashHead'><div><div className='eyebrow'>PALCO 21 · ADMINISTRADOR</div><h1 style={{margin:'6px 0'}}>Configuração</h1><div className='muted'>Checklist da instalação antes de começar a usar dados reais.</div></div><button className='btn ghost' onClick={copy}>{copied?'Copiado':'Copiar URL'}</button></div>
 <div className='metricGrid'>{items.map(([title,text,ok])=><div className={`card metric ${ok?'metricOk':'metricWarn'}`} key={title}><span className='muted'>{title}</span><strong>{ok?'OK':'ATENÇÃO'}</strong><small className='muted'>{text}</small></div>)}</div>
 <section className='section card'><div className='eyebrow'>Antes da abertura</div><h2>Passos de produção</h2><div className='notice'><strong>1.</strong> Criar todos os professores e definir os respetivos acessos.<br/><strong>2.</strong> Criar os alunos e associar cada instrumento/professor.<br/><strong>3.</strong> Rever horários e confirmar as regras de sobreposição.<br/><strong>4.</strong> Configurar as credenciais de email/SMS no ambiente de produção.<br/><strong>5.</strong> Testar inscrição pública, remarcação, pagamentos e recuperação de palavra-passe com contas de teste.<br/><strong>6.</strong> Só depois importar dados reais.</div></section>
 <section className='section card'><div className='eyebrow'>Segurança</div><h2>Regra de ouro</h2><p className='muted'>Nunca coloques palavras-passe de alunos/professores, chaves secretas do Supabase ou credenciais de email/SMS no GitHub. Os segredos devem existir apenas nas variáveis de ambiente do projeto de produção.</p></section>
 </main>
}
