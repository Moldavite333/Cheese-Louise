import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(
  new URL('../supabase/migrations/20261103010000_uncap_cheese_grating.sql',import.meta.url),
  'utf8'
);
// This is a source-contract regression, not a substitute for applying the
// migration to a staging Postgres database and testing the live trigger.
const executable=sql.replace(/--[^\n]*/g,'');

test('Cheese Grating database constraint has no 100-point ceiling',()=>{
  assert.match(executable,/drop\s+constraint\s+if\s+exists\s+movies_cheese_score_check/i);
  assert.match(executable,/add\s+constraint\s+movies_cheese_score_check\s+check\s*\(\s*cheese_score\s*>=\s*0\s*\)/i);
  assert.doesNotMatch(executable,/cheese_score\s*<=\s*100/i);
});

test('uncapping migration is schema-only and does not rewrite historical scores',()=>{
  assert.doesNotMatch(executable,/\b(update|insert|delete|truncate)\s+(?:into\s+|from\s+)?(?:public\.)?(?:movies|movie_traits|cheese_traits)\b/i);
});
