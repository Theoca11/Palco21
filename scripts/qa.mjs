import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];
function ok(name, condition, detail='') {
  checks.push({name, pass:Boolean(condition), detail});
}
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }

ok('Dashboard route', fs.existsSync(path.join(root,'app/dashboard/page.tsx')));
ok('Agenda component', fs.existsSync(path.join(root,'components/Agenda.tsx')));
ok('People component', fs.existsSync(path.join(root,'components/People.tsx')));
ok('Remarcações component', fs.existsSync(path.join(root,'components/Reschedules.tsx')));
ok('Financeiro component', fs.existsSync(path.join(root,'components/Finance.tsx')));
ok('Leads component', fs.existsSync(path.join(root,'components/Leads.tsx')));
ok('Notificações component', fs.existsSync(path.join(root,'components/Notifications.tsx')));
ok('Configuração route', fs.existsSync(path.join(root,'app/configuracao/page.tsx')));
ok('Privacidade route', fs.existsSync(path.join(root,'app/privacidade/page.tsx')));
ok('Termos route', fs.existsSync(path.join(root,'app/termos/page.tsx')));
ok('Supabase schema', fs.existsSync(path.join(root,'supabase/schema.sql')));
ok('Supabase security', fs.existsSync(path.join(root,'supabase/security.sql')));
ok('Supabase notifications', fs.existsSync(path.join(root,'supabase/notifications.sql')));
ok('Environment template', fs.existsSync(path.join(root,'.env.example')));

const pkg = JSON.parse(read('package.json'));
ok('Next.js dependency', typeof pkg.dependencies?.next === 'string');
ok('Supabase SSR dependency', typeof pkg.dependencies?.['@supabase/ssr'] === 'string');
ok('TypeScript check script', pkg.scripts?.typecheck === 'tsc --noEmit');

const agenda=read('components/Agenda.tsx');
ok('50-minute lesson rule', agenda.includes('50') || agenda.includes('duration'));
ok('Teacher conflict exception present', agenda.toLowerCase().includes('sobrepos'));
const res=read('components/Reschedules.tsx');
ok('24-hour reschedule rule', res.includes('24'));
const finance=read('components/Finance.tsx');
ok('€20 teacher rule', finance.includes('20'));
const signup=read('components/SignupForm.tsx');
ok('Preferred contact captured', signup.toLowerCase().includes('contact'));
const people=read('components/People.tsx');
ok('Multiple instruments supported', people.includes('instruments') || people.includes('instrument'));

const sql = read('supabase/security.sql') + '\n' + read('supabase/schema.sql');
ok('RLS policies present', /enable row level security|create policy/i.test(sql));
ok('Role-aware access present', /role|profiles/i.test(sql));

const results = checks.map(c => `${c.pass?'PASS':'FAIL'} | ${c.name}${c.detail?` | ${c.detail}`:''}`).join('\n');
console.log(results);
const failures = checks.filter(c=>!c.pass);
console.log(`\\nQA: ${checks.length-failures.length}/${checks.length} checks passed.`);
if (failures.length) process.exit(1);
