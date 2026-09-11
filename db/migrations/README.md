# Migrations

`db/schema.sql` é a base — o estado atual do banco, rodado inteiro por
`npm run db:migrate` (`scripts/run-schema.mjs`). Toda instrução nele é
idempotente (`create table if not exists`, `add column if not exists`),
então rodar de novo em produção nunca duplica nada.

A partir de agora, toda mudança de schema nova ganha um arquivo aqui,
nomeado `YYYY-MM-DD-descricao.sql`, com o SQL exato que foi rodado —
serve de histórico e de referência pra copiar pro `db/schema.sql` (que
continua sendo o único arquivo que o `db:migrate` realmente executa).

Os arquivos aqui não rodam sozinhos — depois de escrever um, cole o
mesmo SQL no final de `db/schema.sql` pra ele entrar no fluxo real de
migração.
