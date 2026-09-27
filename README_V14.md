# Palco 21 — Produção v14

v14 acrescenta um ecrã de Configuração/Onboarding para o administrador, com estado básico da base de dados e checklist antes da abertura a dados reais.

Inclui tudo o que existia na v13.

## Teste
1. Configurar as variáveis Supabase.
2. Aplicar `supabase/schema.sql` e as políticas/hardening existentes.
3. Criar uma conta com role `administrador`.
4. Abrir `/configuracao` e confirmar os contadores.
5. Só depois executar os testes funcionais com contas de teste.
