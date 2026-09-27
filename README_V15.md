# Palco 21 — Produção v15

v15 é uma etapa de QA e preparação para testes ponta a ponta.

Inclui tudo o que estava na v14 e acrescenta um conjunto de verificações automáticas da estrutura da aplicação e um checklist operacional para testar os três perfis de utilizador.

## Comandos

```bash
npm install
npm run verify
npm run qa
npm run typecheck
npm run build
```

Apenas os comandos `verify` e `qa` são validações estáticas autónomas. O `typecheck` e o `build` precisam das dependências instaladas.
