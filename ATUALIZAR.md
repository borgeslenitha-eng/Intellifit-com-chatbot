# Atualizar a instalação que você já está usando

Esta versão inclui ML local, os ajustes de interface e as correções de conversa. Ela usa o mesmo PostgreSQL e não precisa de chave de IA, pagamento ou Python para funcionar.

## Passo a passo

1. Nos dois terminais antigos (backend e frontend), pressione **Ctrl+C** para parar os servidores.
2. Extraia o ZIP atualizado em **outra pasta**, por exemplo `Downloads/Intellifit-ML`. Isso permite manter a versão antiga como cópia.
3. Copie apenas o arquivo **`.env` da pasta backend antiga** para a pasta `backend` nova. Ele já contém a senha do banco e sua chave JWT. Não substitua esse arquivo por `.env.example`.
4. Abra um CMD na pasta `backend` nova e execute, um comando por vez:

```bat
npm ci
npm run db:init
npm run dev
```

`db:init` também permite deixar a validade em branco. Os alimentos, contas e históricos existentes permanecem no banco. É necessário executar essa migração antes de usar a nova interface.

5. Abra outro CMD na pasta `frontend` nova e execute:

```bat
npm ci
npm run dev
```

6. Abra a URL mostrada pelo Vite (normalmente http://127.0.0.1:5173). Recarregue a página com Ctrl+F5 e entre na sua conta.

**Não é necessário criar outro banco, gerar outra chave JWT ou cadastrar novamente os alimentos.** Não inicie as duas versões do backend ao mesmo tempo na porta 3000.

## Confira os ajustes

- Clique em Validades: a opção lateral e o filtro ficam destacados. Visão geral limpa os filtros.
- O botão ↓ no chat vai à última mensagem. A lixeira apaga apenas a conversa, com confirmação.
- Peça uma receita e confira os títulos em negrito. O convite abaixo da tabela também pede receitas.
- Se houver ovos cadastrados, envie `comprei dois ovos`: escolha somar ao mesmo lote ou cadastrar outro.
- Antes de confirmar essa compra, envie `usei um ovo`: o chat troca de pedido sem registrar a compra anterior.
- Envie `o que vence em novembro` e `o que vence mês que vem`: o chat mostra o período consultado, inclusive o ano.
- Em um cadastro, escolha `Não informar` ao perguntar validade.
- Envie só o nome de um alimento: o chat oferece opções. Cadastros repetidos aparecem em botões numerados.
- Com arroz em kg, envie `usei 200g de arroz`: o saldo abaixo de 1 kg aparece em gramas.

Para apresentar a parte de ML, leia `ML_EXPLICADO.md`.
