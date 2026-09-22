# Encurtador de links — Design

## Contexto

O gerenciador hoje só tem uma área funcional: "Páginas" (`/pages`), uma
lista com criar/editar/publicar landing pages. Não existe nenhum conceito
de navegação com múltiplas seções — é uma tela só, com um cabeçalho que
tem botões de ação (Nova página, Nova pasta, Sair).

O objetivo desta feature é adicionar um encurtador de links simples: colar
uma URL de destino, gerar um código curto, e o link redirecionar quem
acessa, com contagem de cliques — útil pra campanhas, bio de rede social,
ou qualquer lugar que precise de um link curto ao invés da URL completa.

## Decisões

1. **Tela própria, não um modal dentro de outra coisa** — nova rota
   `/links`, estruturada como uma segunda página do mesmo jeito que
   `/pages` já é (lista, criar, editar, apagar), acessível por um botão no
   cabeçalho de Páginas. Não introduz um menu lateral/nav novo — seria
   over-engineering pra uma feature isolada num app de tela única.
2. **Reaproveita os domínios já cadastrados** — o link curto sai em
   `<domínio escolhido>/l/<código>`, usando a mesma tabela `domains` que
   as páginas já usam. Se nenhum domínio for escolhido, usa o domínio
   padrão do app.
3. **Rastreia cliques** — cada acesso ao link curto é registrado
   individualmente (mesmo padrão de `page_views`), não só um contador
   simples, para permitir métricas por período no futuro sem nova
   migração.
4. **Destino é qualquer URL** — externa (WhatsApp, Instagram, checkout,
   etc.) ou uma página do próprio gerenciador. Sem restrição.

## Arquitetura

```
Usuário acessa /links → lista de links curtos (código, destino, cliques,
  criado em) → botão "Novo link" → dialog (destino, domínio opcional,
  código opcional) → salva

Visitante acessa <domínio>/l/<código> → rewrite do vercel.json aponta pra
  api/render-page.ts?shortCode=<código> (MESMA função que já serve
  /p/:slug e /t/:slug — zero funções novas gastas nisso) → busca
  short_links pelo código → encontrou → registra o clique em
  short_link_clicks → responde com redirect HTTP 302 pra destino_url
```

## Modelo de dados

Duas tabelas novas em `db/schema.sql` (idempotentes), com o arquivo
espelho em `db/migrations/`:

```sql
create table if not exists short_links (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  destino_url text not null,
  domain_id uuid references domains(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists short_link_clicks (
  id uuid primary key default gen_random_uuid(),
  short_link_id uuid not null references short_links(id) on delete cascade,
  ip text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_short_link_clicks_short_link_id
  on short_link_clicks(short_link_id);
```

## Rotas

**Modificada:** `api/render-page.ts` — novo branch no `handler`: se
`req.query.shortCode` estiver presente, busca `short_links` pelo
`codigo`; se não encontrar, usa o mesmo `sendNotFound` já existente; se
encontrar, insere uma linha em `short_link_clicks` e responde com
`res.writeHead(302, { Location: destino_url }).end()`. `Cache-Control:
no-store` na resposta, pra não deixar o CDN cachear o redirect e mascarar
a contagem de cliques.

**Nova:** `api/short-links/[action].ts` (mesmo padrão de
`api/domains/[action].ts`) — ações `list` (GET, com contagem de cliques
via `count(*)` em `short_link_clicks`), `create` (POST — gera código
aleatório de 6 caracteres se não informado, valida unicidade, tenta de
novo automaticamente em caso de colisão), `update` (POST — editar
destino/domínio), `delete` (POST). Usa o slot de função liberado pela
consolidação do `api/leads` feita antes desta spec.

**`vercel.json`** ganha:
```json
{ "source": "/l/:codigo", "destination": "/api/render-page?shortCode=:codigo" }
```

**Restrição de função (Vercel Hobby, 12 funções):** a nova rota usa o
slot já liberado; contagem permanece 12 depois desta feature.

## Interface

- Botão novo no cabeçalho de `/pages` (ícone `Link2`, ao lado de "Sair")
  levando pra `/links`.
- Tela `/links`: mesma estrutura visual de `/pages` — cabeçalho com
  contagem, botão "Novo link", tabela com código/destino/cliques/criado
  em, botão copiar, editar e apagar por linha.
- Dialog "Novo link": campo destino (URL, obrigatório, valida
  `http(s)://` e corrige automaticamente se faltar), campo código
  (opcional — se vazio, gera aleatório), seletor de domínio (opcional,
  lista os domínios já cadastrados, mostra qual será usado como padrão
  se nenhum for escolhido).

## Tratamento de erros

- Código já em uso: se foi gerado automaticamente, tenta de novo (mesmo
  padrão de `uniqueSlug` que `api/experiments/[action].ts` já usa); se
  foi digitado manualmente pelo usuário, erro pedindo outro código.
- URL de destino sem protocolo: corrige automaticamente prefixando
  `https://` antes de salvar.
- Código inexistente em `/l/:codigo`: mesma página `NOT_FOUND_HTML` que
  `/p/:slug` já usa.
- Link apontando pra si mesmo / loop de redirecionamento: não validado
  ativamente — caso raro, o usuário percebe testando o próprio link, não
  vale a complexidade de checar antecipadamente.

## Teste manual (sem suíte automatizada, mesmo padrão do projeto)

1. Criar um link pela tela `/links` sem escolher domínio — confirmar que
   sai no domínio padrão do app.
2. Criar um link escolhendo um domínio específico — confirmar a URL
   final correta.
3. Acessar o link curto num navegador, confirmar o redirect e a contagem
   de cliques subindo na lista.
4. Acessar um código inexistente, confirmar a página de não encontrado.
5. Tentar criar um link com um código já existente, confirmar a
   mensagem de erro.
