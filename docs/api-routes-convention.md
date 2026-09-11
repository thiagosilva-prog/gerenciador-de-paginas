# Convenção de rotas da API

## Por que os arquivos em `api/*/[action].ts` existem

O plano Vercel Hobby limita o projeto a 12 funções serverless. Rotas com
várias ações (ex: `api/domains/[action].ts`, `api/experiments/[action].ts`)
juntam `list`/`create`/`delete` num único arquivo — um único `?action=` na
URL — só pra caber nesse limite. Não é a estrutura ideal, é a que o plano
atual permite.

## Convenção pra quando sairmos do limite de funções (VPS ou plano Pro)

Cada ação vira uma rota de verdade, um arquivo por endpoint — sem
`?action=` na URL. O `[action].ts` de hoje vira o roteador (ex: Express)
que só importa e monta essas rotas, ao invés de fazer o dispatch manual
por query string.

**Não crie esses arquivos adiantado.** Quando uma rota consolidada for
mexida por outro motivo (bug, feature nova), esse é o momento de separar
as ações dela em arquivos próprios — não antes, pra não manter código sem
uso no repositório.

Rotas hoje consolidadas por causa do limite: `api/auth/[action].ts`,
`api/domains/[action].ts`, `api/experiments/[action].ts`. `api/leads` e
`api/pages` são exceções — `POST /api/leads` é a URL pública de captura de
lead, já embutida em páginas publicadas; não pode virar rota com prefixo
de ação sem quebrar formulários já no ar.
