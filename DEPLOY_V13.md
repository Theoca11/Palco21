# Palco 21 — v13 Deploy

Objetivo: ligar o repositório ao Supabase e Vercel sem colocar segredos no GitHub.

## 1. GitHub

Subir todo o conteúdo desta pasta para o repositório `Theoca11/Palco21`, mantendo `package.json`, `app/`, `supabase/`, `proxy.ts` e `.github/workflows/ci.yml`.

O workflow valida automaticamente cada push/PR com `npm ci`, `npm run verify` e `npm run typecheck`.

## 2. Supabase

Criar um projeto novo no Supabase e executar, pela ordem:

1. `supabase/schema.sql`
2. `supabase/security.sql`
3. `supabase/accounts.sql`
4. `supabase/notifications.sql`

Depois configurar Auth por email. Não colocar a service role key no browser.

## 3. Variáveis de ambiente

Copiar `.env.example` para as variáveis do projeto na Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — apenas servidor
- `RESEND_API_KEY` — apenas servidor
- `TWILIO_ACCOUNT_SID` — apenas servidor
- `TWILIO_AUTH_TOKEN` — apenas servidor
- `TWILIO_FROM_NUMBER` — apenas servidor

## 4. Vercel

Importar o repositório `Theoca11/Palco21`.
Framework: Next.js.
Build: `npm run build`.

Adicionar as mesmas variáveis de ambiente antes do primeiro deploy.

## 5. Depois do deploy

Abrir `/api/health` e confirmar resposta HTTP 200.

Testar nesta ordem: login → criar aluno → criar professor → criar aula → pedido de remarcação → decisão → lead → notificação.

## Segurança

Nunca commitar `.env`, credenciais reais, service-role keys, tokens SMS ou dados reais de alunos. Usar contas de teste até todas as regras de acesso e RLS estarem validadas.
