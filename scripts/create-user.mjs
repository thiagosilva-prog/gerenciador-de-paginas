import { sql } from '@vercel/postgres';

const [, , email, password, nome] = process.argv;

if (!email || !password) {
  console.error('Usage: node scripts/create-user.mjs <email> <password> [nome]');
  process.exit(1);
}

const { rows } = await sql.query(
  `insert into users (email, password_hash, nome)
   values ($1, crypt($2, gen_salt('bf')), $3)
   on conflict (email) do update set password_hash = excluded.password_hash, nome = excluded.nome
   returning id, email, nome`,
  [email, password, nome || null]
);

console.log('User ready:', rows[0]);
