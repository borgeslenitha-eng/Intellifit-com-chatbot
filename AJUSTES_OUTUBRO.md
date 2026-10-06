# Ajustes de 05/10/2026

- Cadastro guiado: nome → unidade por extenso → quantidade com a unidade na pergunta → local → validade opcional → confirmação.
- Categoria retirada do chat e do formulário. O campo continua no banco para compatibilidade, com Outros como padrão; valores antigos são preservados.
- Datas DDMMaaaa aceitas no chat, com validação do calendário e exibição com barras.
- Novos cadastros não aceitam validade anterior ao dia atual em São Paulo. Alimentos antigos que vencerem permanecem consultáveis e podem ter consumo registrado.
- Consulta de validade informa explicitamente “Alimentos que vencem...”.
- Botão de apagar conversa usa seta circular; mantém confirmação e preserva o estoque.
- “coloque na despensa 7 bolachas”, “7 bolachas” e “cadastre 7 bolachas” iniciam o cadastro com nome e quantidade preenchidos; a unidade ainda é confirmada pelo usuário.
- “sim” aceita a oferta de cadastrar um alimento não encontrado.
- Registrar consumo pergunta pelo nome; mostra opções apenas para os resultados correspondentes.
- “liste meus alimentos” e “me fale todos os alimentos” apresentam a mesma consulta.

As correções de interpretação acima usam regras e contexto de diálogo. O modelo supervisionado da versão anterior permanece incluído e não foi retreinado nesta revisão; suas métricas não mudaram.

Validação desta revisão: 43 testes automatizados aprovados e compilação de backend e frontend concluída. A tentativa de repetir a verificação visual foi impedida por falha de inicialização do Chromium no ambiente de testes. As prévias da revisão anterior foram removidas para não representar uma interface desatualizada.

Para atualizar, siga ATUALIZAR.md, copiando o backend/.env da instalação atual. Não é necessário recriar o banco.

Mensagens de consumo sem exemplos adicionais; zero e números negativos recebem somente “Informe uma quantidade maior que zero.”

Cadastro também informa “Informe uma quantidade maior que zero.” para zero ou negativos. Concordância corrigida para “Quantas unidades”.
