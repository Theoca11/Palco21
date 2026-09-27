# Palco 21 — Checklist de Deploy

## Antes do deploy
- [ ] Criar projeto Supabase de produção.
- [ ] Aplicar SQL da pasta `supabase/`.
- [ ] Criar primeiro utilizador Admin.
- [ ] Configurar domínio e URLs de autenticação.
- [ ] Configurar variáveis de ambiente no hosting.
- [ ] Configurar fornecedor de email/SMS e respectivos segredos.
- [ ] Confirmar política de retenção/RGPD.

## Depois do deploy
- [ ] Abrir `/api/health`.
- [ ] Testar login Admin.
- [ ] Testar criação de Professor.
- [ ] Testar criação de Aluno/Encarregado.
- [ ] Testar aula de 50 minutos.
- [ ] Testar conflito de horário.
- [ ] Testar pedido de remarcação dentro/fora das 24h.
- [ ] Testar pagamento e cálculo de €20/aluno.
- [ ] Testar lead público e origem de campanha.
- [ ] Testar notificações.
- [ ] Confirmar que um Aluno não consegue consultar dados de outros alunos.
