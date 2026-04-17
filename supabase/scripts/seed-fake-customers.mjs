#!/usr/bin/env node
// Seed 50 fake customers so pagination on /clientes has enough rows to
// exercise (LIT-82 surfaced that PAGE_SIZE=25 hid the buttons entirely
// under the default QA dataset).
//
// The rows are deterministic and carry a recognizable marker in
// `notas` so a follow-up run with `--clean` (or a direct DELETE) can
// wipe them before go-live without touching real data.
//
// Usage (local stack):
//   supabase start
//   SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | awk -F= '/SERVICE_ROLE_KEY/ {print $2}' | tr -d \") \
//   node supabase/scripts/seed-fake-customers.mjs
//
// Usage (staging):
//   SUPABASE_URL=https://<project-ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key> \
//   node supabase/scripts/seed-fake-customers.mjs
//
// Flags:
//   --clean   Delete previously seeded rows (matched by the notas tag)
//             before inserting. Safe to rerun.
//   --count N Override the number of rows (default: 50).
//
// Why service_role:
//   Same rationale as supabase/scripts/test-folios.mjs — the script is
//   a CLI tool, not frontend. It bypasses RLS so we can stamp rows
//   without signing in. Never embed this key in the browser bundle.

import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!KEY) {
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY is required. Grab it from `supabase status -o env` (local) or the Supabase dashboard → Project Settings → API (staging).'
  )
  process.exit(1)
}

const args = new Set(process.argv.slice(2))
const clean = args.has('--clean')

const countFlagIdx = process.argv.indexOf('--count')
const COUNT =
  countFlagIdx >= 0 ? Number(process.argv[countFlagIdx + 1]) : Number(process.env.SEED_COUNT ?? 50)

if (!Number.isInteger(COUNT) || COUNT <= 0 || COUNT > 999) {
  console.error(`--count must be a positive integer ≤ 999, got ${COUNT}`)
  process.exit(1)
}

// Single-line marker so a plain `where notas = <tag>` wipes the whole batch.
const SEED_TAG = 'SEED fake-customers — borrar antes de go-live'

const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

if (clean) {
  const { error, count } = await supabase
    .from('customers')
    .delete({ count: 'exact' })
    .eq('notas', SEED_TAG)
  if (error) {
    console.error(`FAIL: cleanup delete errored — ${error.message}`)
    process.exit(1)
  }
  console.log(`Cleaned ${count ?? 0} previously seeded customer(s).`)
}

// Deterministic rows. Phones/emails are unique so the LIT-81 unique
// indexes (coming) won't reject a rerun. Phones use the 10-digit MX
// national format LIT-80 will enforce on the form.
const rows = Array.from({ length: COUNT }, (_, i) => {
  const n = String(i + 1).padStart(3, '0')
  const hasRazonSocial = (i + 1) % 3 === 0 // every 3rd row is a "company"
  return {
    nombre: `Cliente Prueba ${n}`,
    razon_social: hasRazonSocial ? `Pruebas ProsesaOS ${n} S.A. de C.V.` : null,
    // RFC intentionally left null — the SAT check digit logic is
    // non-trivial and pagination tests don't need it.
    rfc: null,
    regimen_fiscal: null,
    cp_fiscal: null,
    telefono: `55${String(10000000 + i).padStart(8, '0')}`,
    email: `cliente.prueba.${n}@prosesa.test`,
    notas: SEED_TAG,
  }
})

const { error: insertError, count: insertedCount } = await supabase
  .from('customers')
  .insert(rows, { count: 'exact' })

if (insertError) {
  console.error(`FAIL: insert errored — ${insertError.message}`)
  if (insertError.code === '23505') {
    console.error(
      'Hint: a unique constraint blocked the insert. Rerun with --clean to wipe the previous batch first.'
    )
  }
  process.exit(1)
}

console.log(`PASS: inserted ${insertedCount ?? rows.length} fake customers into ${URL}.`)
console.log(`  tag: ${SEED_TAG}`)
console.log(
  `  cleanup: rerun with --clean, or \`delete from public.customers where notas = '${SEED_TAG}';\``
)
