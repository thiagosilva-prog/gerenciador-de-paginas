# Gestão de Páginas

Editor de landing pages por blocos, extraído do módulo "Páginas" do KVision — sem o
conceito de clientes/multi-tenant, rodando 100% em cima da Vercel (hosting +
Postgres + Blob) em vez de Supabase.

## O que tem aqui

- **Lista de páginas** (`/pages`) — criar, excluir, ver status.
- **Editor visual de blocos** (`/pages/:id/editor`) — os mesmos blocos do KVision
  (headers, depoimentos, formulários, CTA, etc.), drag-free, com histórico
  undo/redo.
- **Detalhe da página** (`/pages/:id`) — abas de Resumo, Leads, Integrações
  (Facebook Pixel, GA, GTM, scripts customizados) e Domínio/SEO.
- **Página pública** (`/p/:slug`) — renderiza o HTML publicado.
- **Captura de leads** — o formulário publicado faz `POST /api/leads`
  diretamente (funciona mesmo em domínio customizado, CORS liberado), com
  geolocalização automática (país/cidade/estado) via headers da Vercel.
- **Login** (`/login`) — tela idêntica à do KVision, autenticando contra a
  tabela `users` do Postgres (senha com hash via `pgcrypto`, sessão em cookie
  assinado). Todas as rotas de `/pages/*` e as APIs de escrita/leitura ficam
  atrás desse login; só a página pública e o `POST /api/leads` continuam abertos.

## Stack

- Vite + React 19 + TypeScript + Tailwind v4 + Radix UI
- React Query para data-fetching
- Vercel Postgres (Neon) via `@vercel/postgres`, acessado só pelas funções em `/api`
- Vercel Blob (`@vercel/blob`) para upload de favicon
- Login próprio (sem serviço externo): senha com hash `pgcrypto` no Postgres +
  cookie de sessão assinado com HMAC (`SESSION_SECRET`)

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar o projeto na Vercel e conectar um banco

```bash
npx vercel link          # conecta esta pasta a um projeto Vercel (cria um novo se preciso)
```

No dashboard da Vercel: **Storage → Create Database → Postgres** (Neon) e
conecte ao projeto. Depois, opcionalmente, **Storage → Create → Blob** (só é
necessário se for usar upload de favicon por arquivo — a opção de URL sempre
funciona sem isso).

Puxe as variáveis de ambiente geradas:

```bash
npx vercel env pull .env.local
```

### 3. Rodar o schema no banco

```bash
npm run db:migrate
```

Isso lê `.env.local` (gerado no passo 2) e roda `db/schema.sql` contra o banco
conectado. Alternativa manual: copiar `db/schema.sql` e colar no SQL editor do
Neon (aba Storage → seu banco → Query, na Vercel).

### 4. Criar seu usuário de login

Rode no mesmo banco (SQL editor ou `psql`), trocando e-mail/senha/nome:

```sql
insert into users (email, password_hash, nome)
values ('voce@exemplo.com', crypt('sua-senha-aqui', gen_salt('bf')), 'Seu Nome');
```

E defina `SESSION_SECRET` (um valor aleatório, ex: `openssl rand -hex 32`) nas
variáveis de ambiente do projeto na Vercel — sem isso o login não funciona.

### 5. Rodar localmente

```bash
npm run dev
```

Isso roda `vercel dev`, que sobe o Vite **e** as funções serverless de `/api`
juntas em `http://localhost:3000`. (`npm run dev:vite` sobe só o front, sem
as rotas de API funcionando.) Repita `vercel env pull .env.local` se você
definir `SESSION_SECRET` depois do passo 2, pra puxar ele pro ambiente local.

### 6. Deploy

```bash
npx vercel --prod
```

## O que foi deixado de fora / simplificado em relação ao KVision

- Sem conceito de "clientes" — todas as páginas pertencem à mesma instância,
  compartilhada por quem tiver login.
- Login é single-tenant simples (uma tabela `users`, sem convite/recuperação
  de senha/2FA) — dá pra evoluir depois se precisar de mais gente com acesso.
- Geolocalização do lead funciona só em produção (a Vercel não injeta esses
  headers em `vercel dev` local).
- O envio de eventos pro Facebook CAPI (server-side) que existia em outro
  fluxo do KVision não foi trazido — só o Pixel client-side (via script de
  integração, aba "Integrações").
