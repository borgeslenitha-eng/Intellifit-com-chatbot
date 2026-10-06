# IntelliFit — Estoque + Chatbot

Sistema de gerenciamento de alimentos com chatbot integrado.

**Stack:** Node.js, TypeScript, Express, PostgreSQL, React, TypeScript e Vite.

## Requisitos

- Node.js 22.12+
- PostgreSQL

## Configuração

### Backend

```bash
cd backend
npm ci
copy .env.example .env
```

Configure o `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=SUA_SENHA
DB_NAME=intellifit
JWT_SECRET=SUA_CHAVE
PORT=3000
```

Inicialize o banco:

```bash
npm run db:init
```

Execute o backend:

```bash
npm run dev
```

### Frontend

Em outro terminal:

```bash
cd frontend
npm ci
npm run dev
```

Frontend:

```text
http://127.0.0.1:5173
```

Backend:

```text
http://localhost:3000
```

Swagger:

```text
http://localhost:3000/api-docs
```

## Observações

- O chatbot utiliza classificação de intenções com TF-IDF + regressão logística, executada localmente.
- O modelo não requer Python ou API externa durante a execução.
- O arquivo `.env` não deve ser versionado.
- A inicialização do banco é aditiva e não remove dados existentes.
