#!/usr/bin/env node
// Concurrency regression test for LIT-23: next_folio() must produce
// N unique, monotonic folios when called N times in parallel.
//
// This is a Node script rather than a SQL script (as check-rls.sql
// and test-audit.sql are) because atomicity claims can only be
// exercised with multiple concurrent connections — a single psql
// session serializes by definition.
//
// Usage:
//   supabase start
//   SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | awk -F= '/SERVICE_ROLE_KEY/ {print $2}' | tr -d \") \
//   node supabase/scripts/test-folios.mjs
//
// Optional env:
//   SUPABASE_URL          defaults to http://127.0.0.1:54321
//   FOLIO_TEST_N          number of concurrent calls (default 1000)
//   FOLIO_TEST_COMPANY    company code to target (default: first active)
//
// The script uses the service_role key so it can call the RPC without
// signing in. That bypasses RLS, which is fine here — the property
// under test is atomicity of the function itself, not the auth gate.

import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!KEY) {
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY is required. Grab it from `supabase status -o env`.'
  )
  process.exit(1)
}

const CONCURRENT = Number(process.env.FOLIO_TEST_N ?? 1000)
if (!Number.isInteger(CONCURRENT) || CONCURRENT <= 0) {
  console.error(`FOLIO_TEST_N must be a positive integer, got ${process.env.FOLIO_TEST_N}`)
  process.exit(1)
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

// Pick a company to target. Default: first active row.
const companyQuery = supabase
  .from('companies')
  .select('id, code')
  .eq('is_active', true)
  .is('deleted_at', null)
  .order('code', { ascending: true })
  .limit(1)

const wantedCode = process.env.FOLIO_TEST_COMPANY
const { data: companies, error: companiesError } = wantedCode
  ? await supabase
      .from('companies')
      .select('id, code')
      .eq('code', wantedCode)
      .is('deleted_at', null)
      .limit(1)
  : await companyQuery

if (companiesError) throw companiesError
if (!companies || companies.length === 0) {
  console.error('No matching company. Seed companies first (LIT-21).')
  process.exit(1)
}
const { id: companyId, code } = companies[0]

// Unique doc_type per run so reruns don't pile onto the same counter
// and invalidate the "1..N, no gaps" assertion.
const docType = `test_${Date.now()}`

console.log(
  `Firing ${CONCURRENT} parallel next_folio calls on ${code} / ${docType}`
)

const start = Date.now()
const results = await Promise.all(
  Array.from({ length: CONCURRENT }, async () => {
    const { data, error } = await supabase.rpc('next_folio', {
      p_company_id: companyId,
      p_doc_type: docType,
    })
    if (error) throw error
    return data
  })
)
const elapsed = Date.now() - start

// Uniqueness.
const unique = new Set(results)
if (unique.size !== CONCURRENT) {
  console.error(
    `FAIL: ${CONCURRENT} calls produced only ${unique.size} unique folios — duplicates detected`
  )
  const counts = results.reduce((m, f) => m.set(f, (m.get(f) ?? 0) + 1), new Map())
  for (const [folio, count] of counts) {
    if (count > 1) console.error(`  ${folio} × ${count}`)
  }
  process.exit(1)
}

// Monotonicity / no gaps.
const numbers = results
  .map((folio) => {
    const parts = folio.split('-')
    if (parts[0] !== code) {
      console.error(`FAIL: unexpected prefix in ${folio}`)
      process.exit(1)
    }
    return Number(parts[1])
  })
  .sort((a, b) => a - b)

for (let i = 0; i < numbers.length; i++) {
  if (numbers[i] !== i + 1) {
    console.error(`FAIL: gap at position ${i} — expected ${i + 1}, got ${numbers[i]}`)
    process.exit(1)
  }
}

console.log(
  `PASS: ${CONCURRENT} unique monotonic folios in ${elapsed}ms (${Math.round(
    (CONCURRENT / elapsed) * 1000
  )} rps)`
)
console.log(`  first: ${code}-${String(1).padStart(4, '0')}`)
console.log(`  last:  ${code}-${String(CONCURRENT).padStart(4, '0')}`)
