# Palco 21 — Produção v13

Aplicação Next.js + Supabase para gestão do Palco 21.

Esta versão mantém os módulos funcionais anteriores e acrescenta uma camada de CI no GitHub e um guia de deploy para Supabase + Vercel.

## Comandos

```bash
npm ci
npm run verify
npm run typecheck
npm run dev
```

Antes de produção, preencher as variáveis em `.env.example` no ambiente de alojamento. Não guardar segredos no Git.
