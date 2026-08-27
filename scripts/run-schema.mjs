import { readFileSync } from 'fs';
import { sql } from '@vercel/postgres';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

const withoutComments = schema
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

const statements = withoutComments
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  console.log('Running:', stmt.split('\n')[0], '...');
  await sql.query(stmt);
}

console.log('Schema applied successfully.');
