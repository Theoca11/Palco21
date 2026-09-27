# Palco 21 — Produção v16

v16 é a etapa de **hardening do núcleo** antes do primeiro deploy real.

## O que mudou
- Relação explícita `teacher_student_assignments` para garantir que o professor só cria aulas para os seus alunos.
- Pedido de remarcação passa a exigir `requested_by = auth.uid()`.
- Nova data proposta numa remarcação tem de ser futura.
- Índices para agenda, remarcações, pagamentos e leads.

## Aplicação da migração
No Supabase SQL Editor, executar `supabase/v16_hardening.sql` **depois** de `supabase/schema.sql` e dos outros scripts da pasta `supabase`.

## Ordem de produção
1. Criar projeto Supabase.
2. Executar os SQL da pasta `supabase/`.
3. Criar a primeira conta Admin no Supabase Auth e inserir o respetivo profile como `administrador`.
4. Criar professores/alunos e respetivas relações em `teacher_student_assignments`.
5. Configurar variáveis no Vercel.
6. Fazer deploy.
7. Executar os cenários de QA antes de usar dados reais.

## Nota
O `build` completo ainda requer `npm install` com acesso à rede. Esta versão inclui verificações estáticas independentes.
