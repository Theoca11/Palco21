import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const required = [
  'app/layout.tsx',
  'app/login/page.tsx',
  'app/dashboard/page.tsx',
  'app/api/health/route.ts',
  'app/api/admin/invite/route.ts',
  'app/api/notifications/enqueue/route.ts',
  'app/api/notifications/process/route.ts',
  'components/Agenda.tsx',
  'components/People.tsx',
  'components/Reschedules.tsx',
  'components/Finance.tsx',
  'components/Leads.tsx',
  'components/Notifications.tsx',
  'components/AdminUsers.tsx',
  'supabase/schema.sql',
  'supabase/security.sql',
  '.env.example',
]

const missing = required.filter((file) => !existsSync(join(root, file)))
if (missing.length) {
  console.error('MISSING FILES')
  for (const file of missing) console.error(`- ${file}`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const env = readFileSync(join(root, '.env.example'), 'utf8')
const checks = [
  ['Next.js dependency', Boolean(pkg.dependencies?.next)],
  ['React dependency', Boolean(pkg.dependencies?.react)],
  ['Supabase SSR dependency', Boolean(pkg.dependencies?.['@supabase/ssr'])],
  ['Supabase URL env', /SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL/.test(env)],
  ['Supabase publishable key env', /SUPABASE_ANON_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/.test(env)],
]

const failed = checks.filter(([, ok]) => !ok)
console.log(`Palco 21 v12 verification: ${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length) {
  for (const [label] of failed) console.error(`- FAILED: ${label}`)
  process.exit(1)
}
console.log('Static structure checks passed.')
