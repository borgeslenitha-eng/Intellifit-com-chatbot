# Revisão de 05/10/2026 — ajustes finais

43 testes aprovados. Builds de backend e frontend concluídos. Consulte AJUSTES_OUTUBRO.md para o escopo e a limitação da verificação visual desta revisão.

## Registro da revisão anterior

# Validação — 05/10/2026

## Testes de integração

34 testes aprovados (20 de integração e 14 de regressão/ML) em Node.js 24, usando PGlite (PostgreSQL embarcado) em memória e requisições HTTP às rotas Express reais. Nenhum banco do usuário foi acessado.

1. Autenticação obrigatória.
2. CRUD e isolamento entre contas.
3. Rejeição de datas, quantidades e unidades inválidas.
4. Consulta do chatbot aos dados armazenados.
5. Conversão g/kg e confirmação de consumo.
6. Confirmação repetida sem desconto duplicado.
7. Bloqueio de baixa excessiva e unidades incompatíveis.
8. Cadastro guiado e confirmação.
9. Edição de validade.
10. Seleção de cadastros duplicados por ID.
11. Cancelamento de ação baseada em dados alterados externamente.
12. Exclusão com cancelamento e confirmação.
13. Baixa total com saldo zero.
14. Separação de validade de hoje e alimentos vencidos.
15. Receitas com ingredientes disponíveis e faltantes, sem baixar estoque.
16. Persistência e isolamento do histórico.
17. Mensagens inválidas e pedidos fora do escopo.

Reproduzir: `cd backend` e `npm test`.

## Compilação

- Backend: `npm run build`.
- Frontend: `npm run build`.

## Navegador

Verificação automatizada com Chromium headless nos tamanhos 1440 × 1000 e 390 × 844:

- Cadastro de conta e login.
- Criação, edição e exclusão de alimentos pelos formulários.
- Pedido de consumo no chat, confirmação e atualização da tabela.
- Consulta de validade e persistência do histórico após recarregar.
- Visualização das abas Estoque e Assistente no celular.
- Nenhum erro de execução JavaScript durante o fluxo; nenhuma rolagem horizontal da página no celular.

As imagens em `previas/` mostram dados fictícios inseridos exclusivamente para a verificação. Não são dados pré-carregados no seu banco.

## Limites da validação

A conexão com o PostgreSQL instalado no Windows do usuário depende das credenciais locais e será feita ao seguir o README. O arquivo .bat foi preparado para CMD, mas não executado em Windows neste ambiente Linux. A instalação nativa de PostgreSQL não estava disponível no ambiente; os testes usam o motor embarcado. Não foi realizado teste de carga ou de concorrência em múltiplos processos.


## Atualização: PDF e ajustes da interface

Regressões verificadas: soma de compras com confirmação de lote, mudança de compra para consumo, botões numerados, formato 200g/800g, menu por nome do alimento, validade opcional, molho de tomate diferente de tomate fresco, consultas mensais exatas, passagem de dezembro para janeiro, fevereiro bissexto, novo lote com outra validade, nova intenção durante cadastro, comparação das previsões Python/TypeScript e participação do ML em uma resposta real.

Na interface, foram verificados: destaque dos filtros, retorno a Visão geral, receitas em cartões com títulos, convite clicável, soma de compras, consumo, botão de descer, cancelamento e confirmação de limpeza da conversa, preservação do estoque e do estado após recarregar, validade em branco no formulário e layout mobile sem transbordamento horizontal. Nenhum erro JavaScript observado nesses fluxos.

A suíte funcional não mede a acurácia do ML. A avaliação separada, em 60 frases de teste, obteve 70,0% de acurácia e F1 macro 0,6935. Consulte `ML_EXPLICADO.md` para os limites da base autoral e as regras complementares.
