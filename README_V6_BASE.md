# Palco 21 — Produção v6 — Leads + Inscrições

Base Next.js + Supabase da Palco 21.

## Incluído
- Agenda e regras de sobreposição da v2
- Alunos e professores da v3
- Remarcações da v4 (regra das 24h)
- Financeiro da v5 (€20 por aluno/mês para professor)
- Leads e inscrições da v6
- Funil: visita → interesse → formulário iniciado → inscrição recebida → contactado → inscrito/perdido
- Origem/campanha por query params (`utm_source`, `utm_campaign`, também aceita `source`)
- Instrumento de interesse guardado no lead
- Contacto preferido: Chamada / Email / WhatsApp
- Consentimento obrigatório
- Área de leads visível apenas a Administrador

## Próximo passo
Aplicar `supabase/schema.sql` no projeto Supabase e configurar `.env` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
