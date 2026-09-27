# Palco 21 — QA v15

Esta versão fecha a preparação para testes ponta a ponta com três perfis:

- Administrador
- Professor
- Aluno / Encarregado

## Ordem de teste

1. Criar três contas de teste no Supabase Auth.
2. Associar cada conta ao respetivo `profiles.role`.
3. Criar pelo menos dois alunos, dois professores e aulas de teste.
4. Confirmar que o administrador vê toda a operação.
5. Confirmar que o professor vê apenas os seus alunos e agenda aplicável.
6. Confirmar que o aluno/encarregado só vê as próprias aulas e informação.
7. Testar pedido de remarcação com mais de 24h e bloqueio abaixo de 24h.
8. Testar conflito de horários e a exceção de sobreposição permitida ao professor para os próprios alunos.
9. Testar cálculo financeiro de €20 por aluno/mês por professor.
10. Criar um lead pela inscrição pública e confirmar entrada no painel.
11. Testar fila de notificações sem colocar credenciais de fornecedores no cliente.
12. Rever RGPD/privacidade antes de dados reais.

## Validação local

```bash
npm run verify
npm run qa
npm run typecheck
npm run build
```

`verify` e `qa` são testes estáticos locais. O `typecheck` e `build` dependem das dependências instaladas e das variáveis/integrações configuradas.
