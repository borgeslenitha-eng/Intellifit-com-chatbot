> Revisão atual: leia AJUSTES_OUTUBRO.md para o novo fluxo de cadastro e as correções do último PDF.

# IntelliFit — estoque + chatbot

Projeto local baseado no ZIP original. Backend em Node.js/TypeScript/Express, banco PostgreSQL e frontend React/TypeScript/Vite.

## O que está pronto

- Criar conta, entrar e sair; dados separados por usuário com JWT.
- Cadastrar, listar, buscar, filtrar, editar e excluir alimentos pela interface.
- Filtros de despensa, geladeira, freezer e situação de validade.
- Chatbot em português com ML, consulta, resumo, compra com escolha de lote, cadastro guiado, edição, exclusão, baixa de quantidade e receitas.
- Confirmação antes de qualquer alteração pelo chat; seleção por botões ou números de opção quando há alimentos semelhantes.
- Conversão kg/g e l/ml; bloqueio de saldo negativo e conversões incompatíveis.
- Quantidade zero mantida no cadastro, sinalizada como “Sem saldo”; 0,8 kg é apresentado como 800 g.
- Histórico de conversa salvo no banco; operações pendentes expiram após 30 minutos sem interação.
- Receitas formatadas com ingredientes disponíveis e faltantes; molho de tomate é diferente de tomate fresco. Ingredientes vencidos ou sem saldo não contam como disponíveis. Itens sem validade exigem conferência do usuário.
- Layout para computador e celular; API documentada em `/api-docs`.

**Esta versão usa um chatbot híbrido: ML para classificar intenções, regras e fluxo guiado para validar dados e executar ações.** O modelo TF-IDF + regressão logística já está treinado e funciona localmente, sem API paga nem Python durante o uso. Leia `ML_EXPLICADO.md` para ver treinamento, métricas e limitações.

**Já instalou a versão anterior? Comece por `ATUALIZAR.md`.**

O catálogo tem 15 receitas. O sistema não faz planejamento nutricional, leitura de imagens, lista de compras persistente ou notificações fora do app. A validade é opcional e fica como NULL no banco quando não informada.

## Comece aqui — Windows / CMD

### 1. Pré-requisitos

- Node.js 22.12 ou superior (testado com Node 24).
- PostgreSQL instalado e iniciado; tenha a senha do usuário `postgres`.
- Extraia o ZIP. Trabalhe na pasta `intellifit-chatbot`, que contém `backend` e `frontend`.

É possível usar o banco `intellifit` já existente. A inicialização cria apenas tabelas e índices que faltam, preservando `users`, `foods` e quaisquer outras tabelas. Como o chatbot altera os dados de verdade, você pode preferir criar um banco separado, `intellifit_chatbot_teste`, para experimentar.

### 2. Configure o backend

Abra um CMD na pasta do projeto:

```bat
cd backend
npm ci
copy .env.example .env
notepad .env
```

No `.env`, preencha:

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=SUA_SENHA_DO_POSTGRES
DB_NAME=intellifit
JWT_SECRET=SUA_CHAVE_ALEATORIA_DE_PELO_MENOS_32_CARACTERES
PORT=3000
```

Gere uma chave para `JWT_SECRET` com este comando e copie o resultado para o `.env`:

```bat
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Não envie seu `.env` ao GitHub. Ele contém sua senha e sua chave.

### 3. Prepare o banco

Se o banco escolhido ainda não existir, crie pelo pgAdmin ou pelo terminal:

```bat
psql -U postgres -c "CREATE DATABASE intellifit;"
```

Se você já tem o banco `intellifit`, pule o comando acima. Se escolheu outro nome, use-o no comando e em `DB_NAME`.

Ainda na pasta `backend`, execute:

```bat
npm run db:init
npm run dev
```

A mensagem de inicialização deve indicar `http://localhost:3000`.

A migração é repetível: `database.sql` cria as tabelas originais se necessário; `migration-chat.sql` adiciona `chat_sessions`, `chat_messages` e índices. Nenhum comando apaga dados existentes.

### 4. Inicie a interface

Abra **outro CMD** na pasta do projeto:

```bat
cd frontend
npm ci
npm run dev
```

Abra **http://127.0.0.1:5173** no navegador. Se essa porta estiver ocupada, use a URL mostrada pelo Vite.

Mantenha os dois terminais abertos. O Vite encaminha `/api` para o backend local, sem necessidade de configurar CORS. Se mudar a porta 3000, ajuste também o destino em `frontend/vite.config.ts`.

### 5. Teste

1. Clique em **Criar conta** e cadastre seu nome, e-mail e senha.
2. Cadastre `Arroz`, quantidade `1`, unidade `kg`, categoria `Cereais`, local `despensa` e uma validade futura.
3. No chat, envie `Tenho arroz?`.
4. Envie `Usei 200 g de arroz` e clique em **Confirmar**. O saldo da tabela passa para `800 g` (armazenado como 0,8 kg).
5. Envie `Cadastrar alimento`. Responda às perguntas e confirme.
6. Cadastre ovos, tomate ou cenoura com validade futura e peça `Sugerir receitas`.
7. Experimente `Editar arroz`, `Excluir arroz` e **Cancelar**.
8. Recarregue a página para conferir a persistência do estoque e da conversa.
9. Entre com uma segunda conta para conferir que ela não vê seus alimentos.

Nas próximas vezes, basta executar `npm run dev` em cada pasta. Há também `INICIAR_WINDOWS.bat`, que abre os dois servidores depois da configuração inicial.

## Exemplos de conversa

| Objetivo | Mensagem |
|---|---|
| Ajuda e atalhos | `ajuda` |
| Todo o estoque | `Listar alimentos` |
| Buscar | `Tenho arroz?` |
| Filtrar local | `O que tenho na geladeira?` |
| Validades | `O que vence nesta semana?` |
| Somente hoje | `O que vence hoje?` |
| Vencidos | `Quais alimentos estão vencidos?` |
| Resumo | `Resumo do estoque` |
| Cadastro guiado | `Cadastrar alimento` |
| Cadastro parcial | `Comprei 1 litro de leite, vence 31/12/2027 e fica na geladeira` |
| Alteração | `Editar arroz` → `Quantidade` → `2` → `Confirmar` |
| Validade | `Editar leite` → `Validade` → `31/12/2027` → `Confirmar` |
| Baixa | `Usei 200 g de arroz` |
| Baixa por unidade | `Usei 2 ovos` |
| Exclusão | `Excluir leite` → `Confirmar` |
| Escolher entre duplicados | Toque no botão do alimento ou digite `1`, `2` etc. |
| Receitas | `Sugerir receitas` |
| Aproveitamento | `O que preparar com o que vence primeiro?` |
| Cancelar um fluxo | `cancelar` |

Durante o cadastro, responda à pergunta atual. Um novo pedido reconhecido troca de operação sem gravar a anterior. Você também pode enviar `cancelar`. No cadastro, a validade aceita `DD/MM/AAAA`, `AAAA-MM-DD`, `hoje`, `amanhã` ou `Não informar`. Nas consultas, há suporte a hoje, amanhã, próximo mês, mês por nome (com ano opcional), ano, data completa e próxima semana. O período entendido aparece na resposta. Mês por nome sem ano usa o ano atual. Expressões não suportadas, como “até sexta”, pedem um período mais claro. Quantidades têm até duas casas decimais; unidades suportadas: `g`, `kg`, `ml`, `l`, `un`. Não há conversão de unidades para gramas nem de volume para peso.

As receitas não definem quantidades por porção e não descontam estoque ao serem sugeridas. Informe o consumo real separadamente. Para o catálogo, use nomes comuns em português, como “ovos”, “tomate”, “arroz”, “banana”, “aveia” e “frango”.

## Conferir diretamente no PostgreSQL

No Query Tool do pgAdmin, conectado ao mesmo banco indicado no `.env`:

```sql
SELECT id, name, email FROM users ORDER BY id;
SELECT id, user_id, name, quantity, unit, storage_location, expiration_date
FROM foods ORDER BY id;
SELECT user_id, role, content, created_at
FROM chat_messages ORDER BY id DESC LIMIT 30;
```

A interface só mostra os alimentos pertencentes à conta que entrou. Se você vê alimentos no pgAdmin mas não na interface, confira `user_id` e `DB_NAME`.

## Testes e build

Dentro de `backend`:

```bat
npm test
npm run build
```

Os testes de integração usam **PGlite (PostgreSQL embarcado) em memória**, passando pelas rotas HTTP reais. Não usam nem alteram seu banco local. Há 34 testes no total, cobrindo integração, regressões das falhas relatadas e equivalência do modelo Python/TypeScript. Incluem isolamento entre contas, validade opcional, mudança de intenção, soma de compras, meses e limpeza de conversa sem perda de estoque. Essa verificação não substitui a conexão ao PostgreSQL instalado no seu Windows.

Dentro de `frontend`:

```bat
npm run build
```

Também foi verificado no navegador o fluxo de criar conta, cadastrar, editar, excluir, conversar, confirmar consumo e recarregar dados, nos layouts desktop e mobile. Veja `VALIDACAO.md`.

## Estrutura adicionada

```text
backend/
  migration-chat.sql          conversa e validade opcional (migração aditiva)
  scripts/init-db.ts          inicialização transacional
  ml/                         dados, treino, modelo e avaliação
  src/ml/classifier.ts        inferência local de Machine Learning
  src/chat/engine.ts          integração ML, regras e fluxo guiado
  src/chat/language.ts        quantidades, nomes e períodos de validade
  src/chat/routes.ts          autenticação, persistência e transações
  src/chat/recipes.ts         catálogo e seleção de receitas
  src/chat/validation.ts      datas, unidades e validação
  tests/                     testes com PostgreSQL embarcado
frontend/
  src/App.tsx                login, estoque e chatbot
  src/App.css                layout responsivo
  vite.config.ts             proxy para a API local
```

As rotas originais de autenticação e alimentos foram mantidas. As validações foram reforçadas; a validade agora é retornada como data sem horário. Cada confirmação reconsulta os dados: se o alimento mudou enquanto o usuário conversava, a operação pendente é cancelada para evitar sobrescrever uma alteração recente.

## Rotas principais

- `POST /api/auth/register` e `POST /api/auth/login`
- `GET /api/foods`, `POST /api/foods`
- `GET /api/foods/expiring`
- `GET /api/foods/:id`, `PUT /api/foods/:id`, `DELETE /api/foods/:id`
- `POST /api/chat` — `{ "message": "Tenho arroz?" }`
- `GET /api/chat/model-info` — informações do classificador
- `GET /api/chat/history` — até 100 mensagens mais recentes
- `DELETE /api/chat/history` — limpa conversa e operação pendente

Use `Authorization: Bearer SEU_TOKEN` nas rotas de alimentos e chat. O Swagger está em `http://localhost:3000/api-docs`.

## Problemas comuns

- **Senha do banco incorreta:** corrija `DB_PASSWORD` no `backend/.env` e reinicie.
- **Banco não existe:** crie o banco antes de `npm run db:init`.
- **Tabela chat_sessions não existe:** execute `npm run db:init` na pasta `backend`.
- **Porta 3000 em uso:** feche o backend antigo antes de iniciar este projeto.
- **Erro de conexão no frontend:** confirme que o backend está aberto e apontando para o banco correto.
- **psql não reconhecido:** use o pgAdmin para criar o banco; `npm run db:init` continua funcionando sem `psql` no PATH.
- **Página aberta pelo arquivo index.html:** abra pela URL do Vite; não dê duplo clique no HTML.
- **Sessão expirou:** entre novamente. O token dura um dia e fica no sessionStorage da aba.

Este pacote está preparado para desenvolvimento e testes locais. Uma publicação na internet exigiria configuração própria de hospedagem, HTTPS, segredos e proteções operacionais.
