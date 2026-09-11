# Vínculo nativo com GitHub (GitHub App) — Design

## Contexto

Hoje, sincronizar uma página com um repositório do GitHub exige um passo
manual: o usuário cria um webhook à mão nas configurações do repositório,
aponta pra `api/webhooks/github-html.ts` e cola um secret compartilhado
(`GITHUB_WEBHOOK_SECRET`, uma única variável de ambiente pra todo o
projeto). O motor de sincronização (`fetchFileContent` + atualização do
bloco `custom_html` da página) já funciona e está em produção — o que
falta é a parte de "vínculo": hoje o sistema descobre qual página um
arquivo pertence por convenção de nome (`paginas/<slug>/index.html` ou
`<slug>.html`), e não existe nenhuma tela no gerenciador mostrando essa
conexão.

O objetivo desta feature é dar essa experiência "nativa" — como a Vercel:
o usuário conecta a própria conta do GitHub pela interface, escolhe o
repositório e o arquivo exatos, e dali em diante todo push atualiza a
página automaticamente, sem tocar em configuração de webhook nunca mais.

Múltiplas pessoas usam o mesmo gerenciador, cada uma com sua própria
conta GitHub — a conexão é por usuário logado, não uma única conta
compartilhada pra todo mundo.

## Decisões

1. **Conexão por usuário** — cada usuário logado (`users.id`) conecta sua
   própria conta/organização GitHub via instalação de um GitHub App. Ao
   escolher o repositório de origem de uma página, só aparecem os repos
   que aquele usuário autorizou.
2. **Seleção de arquivo por navegador de pastas** — ao vincular uma
   página, a pessoa navega a árvore de arquivos do repositório escolhido
   e clica no `.html` específico. Não depende de convenção de nome/pasta.
3. **Migração do vínculo fixo atual** — as páginas que hoje sincronizam
   via webhook fixo (`lexpages`, convenção de nome) são migradas para
   vínculos explícitos no novo sistema; o webhook fixo antigo é desativado
   depois da migração.
4. **Mecanismo: GitHub App, não OAuth simples** — só um GitHub App dá
   instalação por repositório (permissão mínima, escopo por repo) e
   webhook automático por instalação, sem o usuário nunca configurar
   webhook manualmente. Requer um cadastro único e manual do App nas
   configurações do GitHub (feito pelo usuário, meu papel é orientar
   cada campo).

## Arquitetura

```
Usuário loga → "Conectar GitHub" → tela de instalação do GitHub App
  (usuário escolhe quais repos liberar) → volta pro gerenciador conectado
  → gerenciador salva installation_id vinculado ao usuário

Criar/editar página → seletor "de qual repo vem o HTML?" (lista os repos
  da conexão do usuário) → escolhe repo → navegador de arquivos (API do
  GitHub) → escolhe arquivo .html → grava o vínculo (página, conexão,
  repo, caminho do arquivo)

Push no GitHub → GitHub App entrega webhook (installation_id incluído no
  payload) → api/webhooks/github-html.ts busca page_github_links por
  installation_id + repo + caminho → encontrou → atualiza o bloco
  custom_html da página (mesmo motor de hoje, renderPageResponse etc.)
```

## Modelo de dados

Duas tabelas novas em `db/schema.sql` (idempotentes, `create table if not
exists`), com um arquivo espelho em `db/migrations/` documentando a
mudança:

```sql
create table if not exists github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  installation_id bigint not null unique,
  account_login text not null,
  criado_em timestamptz not null default now()
);

create table if not exists page_github_links (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null unique references pages(id) on delete cascade,
  connection_id uuid not null references github_connections(id) on delete cascade,
  repo_owner text not null,
  repo_name text not null,
  file_path text not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_page_github_links_lookup
  on page_github_links(connection_id, repo_owner, repo_name, file_path);
```

Não guardamos token de acesso — o token de instalação do GitHub App
(válido por 1h) é gerado sob demanda a cada chamada à API do GitHub,
assinando um JWT com a chave privada do App (`GITHUB_APP_PRIVATE_KEY`,
`GITHUB_APP_ID` — variáveis de ambiente novas) e trocando por um token
via `POST /app/installations/{installation_id}/access_tokens`.

## Rotas

**Nova:** `api/github/[action].ts` — ações:
- `connect` (GET, autenticado): retorna a URL de instalação do App.
- `callback` (GET): recebe a volta da instalação do GitHub
  (`installation_id` na query), grava/atualiza `github_connections` para
  o usuário da sessão atual, redireciona de volta pro gerenciador.
- `connections` (GET, autenticado): lista as conexões do usuário logado.
- `repos` (GET, autenticado, `?connectionId=`): lista repositórios
  daquela instalação via API do GitHub.
- `tree` (GET, autenticado, `?connectionId=&repo=&path=`): lista arquivos
  e pastas daquele caminho no repositório.
- `link` (POST, autenticado): grava `page_github_links` para uma página.
- `unlink` (POST, autenticado): remove o vínculo de uma página.

**Modificada:** `api/webhooks/github-html.ts` — passa a validar a
assinatura com o secret do GitHub App, extrair `installation.id` do
payload, e buscar `page_github_links` por
`(connection.installation_id, repo_owner, repo_name, file_path)` em vez
de inferir o slug pelo nome do arquivo. A lógica de buscar o conteúdo do
arquivo e atualizar o bloco `custom_html` da página não muda.

**Restrição de função (Vercel Hobby, 12 funções):** a rota nova de
`api/github/[action].ts` usa o slot liberado pela consolidação de
`api/leads` já feita antes desta spec (`361b962`). Contagem permanece 12
após adicionar esta rota.

**Fora de escopo mudar agora:** `api/leads` e `api/pages` continuam como
estão — `POST /api/leads` é a URL pública de captura de lead já embutida
em páginas publicadas e não pode virar rota com prefixo de ação.

## Interface

- Tela nova/seção em Configurações: "Conexões GitHub" — lista conexões
  ativas do usuário, botão "Conectar GitHub", botão remover conexão.
- No fluxo de criar/editar página (onde hoje existe o bloco
  `custom_html`): seletor de repositório (das conexões do usuário) →
  navegador de arquivos → confirma vínculo. Mostra o vínculo atual da
  página (repo/arquivo) com opção de desvincular.
- Página com vínculo "perdido" (conexão desativada/desinstalada do lado
  do GitHub): mantém o último HTML sincronizado, mostra aviso pra
  reconectar.

## Tratamento de erros

- Instalação desinstalada do lado do GitHub (evento `installation.deleted`
  do App): marca a conexão como inativa; páginas vinculadas mostram aviso
  de "conexão perdida, reconecte", sem apagar o HTML já sincronizado.
- Token de instalação expira: não é um erro visível — é gerado a cada
  chamada, nunca cacheado além do necessário pra uma única requisição.
- Duas páginas apontando pro mesmo arquivo: permitido, não é validado
  como erro (caso de uso legítimo — duplicar conteúdo entre páginas).
- Falha ao buscar conteúdo do arquivo no push (API do GitHub fora do ar,
  arquivo removido): loga o erro, não atualiza a página, mantém o último
  HTML sincronizado — mesmo comportamento defensivo que o webhook atual já
  tem.

## Migração dos dados existentes

Página(s) hoje sincronizadas pelo webhook fixo (`lexpages`, convenção de
nome) recebem um `page_github_links` explícito apontando pro mesmo
repositório/arquivo que já usam, associado a uma conexão que o usuário
cria durante a migração. Depois de confirmado que a sincronização nova
funciona, o webhook fixo antigo (`GITHUB_WEBHOOK_SECRET` global) é
desativado.

## Passo manual do usuário (pré-requisito, antes da implementação)

Criar o GitHub App nas configurações do GitHub: nome, ícone, permissão
"Contents: Read-only", evento de webhook "Push", URL de webhook apontando
pra `api/webhooks/github-html.ts`, URL de callback de instalação apontando
pra `api/github/callback`. Gera `GITHUB_APP_ID`, uma chave privada
(`GITHUB_APP_PRIVATE_KEY`) e um novo `GITHUB_APP_WEBHOOK_SECRET` — três
variáveis de ambiente novas a configurar na Vercel antes do deploy final.

## Teste manual (sem suíte automatizada, mesmo padrão do projeto)

1. Conectar GitHub, escolher um repositório de teste.
2. Criar/vincular uma página a um arquivo `.html` daquele repo.
3. Editar o arquivo pelo GitHub, dar push.
4. Confirmar que a página no gerenciador atualiza automaticamente.
5. Desinstalar o App daquele repo pelo lado do GitHub, confirmar que a
   página mostra aviso de conexão perdida sem apagar o HTML.
