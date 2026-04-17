// SAT c_RegimenFiscal catalog — the claves we persist on customers,
// and later on sales_notes / work_orders when facturación ships.
//
// Source: SAT's published c_RegimenFiscal table. Only entries that are
// still selectable in current CFDI 4.0 issuance are included; the
// deprecated 609 (Consolidación) is intentionally omitted.
//
// `aplicaA` mirrors the SAT's "Persona Física" / "Persona Moral"
// eligibility column — some claves apply to both. We use it to group
// the options in the UI dropdown so a receptionist isn't staring at
// 19 unfamiliar codes in one flat list.
//
// To update when SAT revises the catalog: edit this file and open a
// PR. No DB migration needed — `customers.regimen_fiscal` stores the
// clave as free text, so legacy values still round-trip in the form
// via `findRegimenByClave`'s fallback path.

export type RegimenAplicaA = 'fisica' | 'moral' | 'ambas'

export interface RegimenFiscalEntry {
  clave: string
  descripcion: string
  aplicaA: RegimenAplicaA
}

export const satRegimenFiscal: readonly RegimenFiscalEntry[] = [
  { clave: '601', descripcion: 'General de Ley Personas Morales', aplicaA: 'moral' },
  { clave: '603', descripcion: 'Personas Morales con Fines no Lucrativos', aplicaA: 'moral' },
  {
    clave: '605',
    descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
    aplicaA: 'fisica',
  },
  { clave: '606', descripcion: 'Arrendamiento', aplicaA: 'fisica' },
  {
    clave: '607',
    descripcion: 'Régimen de Enajenación o Adquisición de Bienes',
    aplicaA: 'fisica',
  },
  { clave: '608', descripcion: 'Demás ingresos', aplicaA: 'fisica' },
  {
    clave: '610',
    descripcion: 'Residentes en el Extranjero sin Establecimiento Permanente en México',
    aplicaA: 'ambas',
  },
  {
    clave: '611',
    descripcion: 'Ingresos por Dividendos (socios y accionistas)',
    aplicaA: 'fisica',
  },
  {
    clave: '612',
    descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales',
    aplicaA: 'fisica',
  },
  { clave: '614', descripcion: 'Ingresos por intereses', aplicaA: 'fisica' },
  {
    clave: '615',
    descripcion: 'Régimen de los ingresos por obtención de premios',
    aplicaA: 'fisica',
  },
  { clave: '616', descripcion: 'Sin obligaciones fiscales', aplicaA: 'fisica' },
  {
    clave: '620',
    descripcion: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos',
    aplicaA: 'moral',
  },
  { clave: '621', descripcion: 'Incorporación Fiscal', aplicaA: 'fisica' },
  {
    clave: '622',
    descripcion: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
    aplicaA: 'moral',
  },
  { clave: '623', descripcion: 'Opcional para Grupos de Sociedades', aplicaA: 'moral' },
  { clave: '624', descripcion: 'Coordinados', aplicaA: 'moral' },
  {
    clave: '625',
    descripcion:
      'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
    aplicaA: 'fisica',
  },
  { clave: '626', descripcion: 'Régimen Simplificado de Confianza', aplicaA: 'ambas' },
]

// Pre-grouped for the Select UI. Rendered in order: física → moral → ambas.
export const satRegimenByGroup: Record<RegimenAplicaA, RegimenFiscalEntry[]> = {
  fisica: satRegimenFiscal.filter((r) => r.aplicaA === 'fisica'),
  moral: satRegimenFiscal.filter((r) => r.aplicaA === 'moral'),
  ambas: satRegimenFiscal.filter((r) => r.aplicaA === 'ambas'),
}

export function findRegimenByClave(clave: string | null | undefined): RegimenFiscalEntry | null {
  if (!clave) return null
  return satRegimenFiscal.find((r) => r.clave === clave) ?? null
}
