import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'app/login/page.tsx',
  'app/dashboard/page.tsx',
  'app/api/health/route.ts',
  'supabase/schema.sql',
  'supabase/accounts.sql',
  'supabase/notifications.sql',
  'supabase/security.sql',
  'supabase/v16_hardening.sql',
  '.env.example',
];
let pass = 0;
for (const f of required) {
  if (fs.existsSync(path.join(root, f))) { pass++; console.log(`PASS ${f}`); }
  else console.log(`FAIL ${f}`);
}
const sql = fs.readFileSync(path.join(root,'supabase/v16_hardening.sql'),'utf8');
const checks = [
  ['assignment table', /create table if not exists public\.teacher_student_assignments/],
  ['teacher ownership policy', /teacher create own lessons/],
  ['requester spoof guard', /requested_by=auth\.uid\(\)/],
  ['future reschedule guard', /validate_reschedule_request/],
];
for (const [name,re] of checks) { if(re.test(sql)){pass++;console.log(`PASS ${name}`)}else console.log(`FAIL ${name}`)}
console.log(`v16 checks: ${pass}/${required.length+checks.length}`);
process.exit(pass === required.length+checks.length ? 0 : 1);
