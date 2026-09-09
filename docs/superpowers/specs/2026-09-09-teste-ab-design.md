# Teste A/B — Design

Data: 2026-09-09
Status: aprovado pelo usuário, pronto para plano de implementação

## Objetivo

Permitir que o usuário crie um "Teste A/B" a partir de páginas já existentes na
"Gestão de páginas lex": escolhe 2+ páginas como variantes, recebe um link
único do teste, e o tráfego desse link é dividido igualmente entre as
variantes, com contagem de visitas/conversões por variante reaproveitando a
infraestrutura de relatórios já existente.

## Decisões confirmadas com o usuário

1. **Servir mantendo a URL do teste** (não redireciona): o visitante nunca vê
   a URL real da página sorteada, só a URL do teste.
2. **Variantes = páginas já existentes** selecionadas pelo usuário, não cópias
   novas criadas pelo teste.
3. **Split sempre igual** entre as variantes (sem pesos configuráveis nesta
   versão — YAGNI, o pedido original foi "dividido igualmente").
4. **Sticky por cookie**: o mesmo visitante sempre vê a mesma variante em
   visitas futuras, evitando inflar contagem e dar resultado inconsistente.
5. Entrada da funcionalidade: botão "Teste A/B" na aba **Resumo** do
   detalhe da página, ao lado do botão de copiar link (`src/routes/pages/detail.tsx`).

## Modelo de dados

Duas tabelas novas no Postgres:

```sql
create table experiments (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,        -- usado na URL pública do teste
  status text not null default 'running', -- 'running' | 'paused'
  criado_em timestamptz not null default now()
);

create table experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references experiments(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (experiment_id, page_id)
);
```

Sem tabela nova de analytics: visitas e conversões continuam sendo contadas
em `page_views`/`leads`, ambas já chaveadas por `page_id` — a tela do teste
soma os números de cada variante reusando o mesmo dado que `api/reports.ts`
já calcula por página. "Exibição %" é calculado on-the-fly
(`1 / quantidade de variantes`), não armazenado.

## Rota pública e resolução de tráfego

Nova rota pública `/t/:slug`, roteada via `vercel.json` (mesmo padrão do
rewrite existente de `/p/:slug`) para uma função `api/render-experiment.ts`
que:

1. Busca o `experiment` pelo `slug` + `status='running'`. Se não encontrar,
   404 (mesmo padrão de `render-page.ts` para slug inválido).
2. Lê o cookie `exp_<experiment_id>`. Se existir e apontar para um
   `page_id` que ainda é variante do experimento, usa essa página.
3. Se não existir, sorteia uma variante com peso igual
   (`Math.random()` sobre a lista), grava o cookie
   (`Set-Cookie: exp_<experiment_id>=<page_id>; Max-Age=2592000; Path=/; HttpOnly`)
   — 30 dias.
4. Chama a **mesma função de renderização** já usada por `render-page.ts`
   (extraída para uma função compartilhada `renderPageResponse(page, res)`
   em vez de duplicar a lógica de blocks/html) para servir o conteúdo da
   página sorteada, e insere a linha em `page_views` normalmente
   (`page_id` = página sorteada) — nenhuma mudança no schema de
   `page_views`.
5. Cache: a página de teste **não** usa
   `Cache-Control: public, s-maxage=60` (isso quebraria o sorteio/cookie por
   visitante); serve com `Cache-Control: private, no-store` já que a resposta
   depende do cookie do visitante.

`render-page.ts` é levemente refatorado para extrair a lógica de
"renderizar uma `Page` já carregada em uma resposta HTTP" em uma função
compartilhada (`api/_lib/render-page-body.ts` ou similar), reaproveitada por
ambas as rotas — evita duplicar a lógica de blocks/html/tracking.

## UI

**Aba Resumo (`src/routes/pages/detail.tsx`)**: novo botão "Teste A/B" ao
lado do botão de copiar link existente. Se a página já pertence a um
experimento, o botão leva direto pra tela do teste; senão, abre um fluxo de
criação (nome do teste + seleção de outras páginas existentes como
variantes adicionais).

**Tela do teste A/B** (nova rota, ex. `/pages/:id/teste-ab`):
- Painel "Experimento": nome, link do teste (com botão copiar, reaproveitando
  o mesmo padrão de copiar-link já usado em `index.tsx`/`detail.tsx`).
- Tabela "Variações": uma linha por página-variante com Visitas, Conversões,
  Taxa de conversão (calculada), Exibição % (`100 / N`), botão "Editar
  Design" (navega para `/pages/:page_id`, mesmo destino que hoje), e um
  kebab com "Remover do teste".
- "+ Adicionar variação": abre um seletor das páginas existentes do usuário
  (mesma fonte de dados de `usePages`) que ainda não estão no teste.
- Sem os painéis de "Relevância estatística" nem "Hipótese" do produto de
  referência — fora de escopo (o pedido do usuário foi só rotação + link +
  acompanhar conversão).

## Hooks/API novos (client)

- `src/hooks/useExperiments.ts`: `useExperiment(pageId)`,
  `useCreateExperiment`, `useAddVariant`, `useRemoveVariant` — seguindo o
  mesmo padrão de `usePages.ts` (`apiFetch` + React Query).
- `api/experiments.ts` (Vercel function, `requireAuth`): CRUD do experimento
  e suas variantes (create, list variants + stats agregadas via join com
  `page_views`/`leads`, add/remove variant).

**Atenção ao limite de funções Vercel** ([[project_lexpages_webhook_deploy_blocker]]):
isso adiciona 2 arquivos novos em `api/` (`render-experiment.ts`,
`experiments.ts`). Confirmar contagem atual antes de implementar; se
estourar o limite do plano Hobby, consolidar em rotas dinâmicas
(`api/experiments/[action].ts`) como já feito antes.

## Fora de escopo (YAGNI)

- Pesos de split configuráveis por variante.
- "Relevância estatística" / significância estatística do teste.
- Pausar/encerrar automaticamente ao atingir significância.
- Criar páginas novas a partir do teste (variantes são sempre páginas
  pré-existentes).
