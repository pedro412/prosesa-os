// SAT c_UsoCFDI 4.0 catalog — the claves we persist on customers for
// Dana's Contpaqi workbench flow and, if Facturapi ever ships, for
// in-app CFDI issuance.
//
// Source: SAT's published c_UsoCFDI table (CFDI 4.0). Only entries
// still selectable in current issuance are included; each clave is
// tagged with its "aplica a" eligibility so the UI can group claves
// that a Persona Física vs Moral can actually use.
//
// Parallels `sat-regimen-fiscal.ts` deliberately — same shape, same
// grouping, same free-text storage on the DB side. To update when SAT
// revises the catalog: edit this file and open a PR. No DB migration
// needed — `customers.uso_cfdi` stores the clave as free text, so
// legacy values round-trip via `findUsoCfdiByClave`'s fallback.

export type UsoCfdiAplicaA = 'fisica' | 'moral' | 'ambas'

export interface UsoCfdiEntry {
  clave: string
  descripcion: string
  aplicaA: UsoCfdiAplicaA
}

export const satUsoCfdi: readonly UsoCfdiEntry[] = [
  { clave: 'G01', descripcion: 'Adquisición de mercancías', aplicaA: 'ambas' },
  {
    clave: 'G02',
    descripcion: 'Devoluciones, descuentos o bonificaciones',
    aplicaA: 'ambas',
  },
  { clave: 'G03', descripcion: 'Gastos en general', aplicaA: 'ambas' },
  { clave: 'I01', descripcion: 'Construcciones', aplicaA: 'ambas' },
  {
    clave: 'I02',
    descripcion: 'Mobiliario y equipo de oficina por inversiones',
    aplicaA: 'ambas',
  },
  { clave: 'I03', descripcion: 'Equipo de transporte', aplicaA: 'ambas' },
  { clave: 'I04', descripcion: 'Equipo de cómputo y accesorios', aplicaA: 'ambas' },
  {
    clave: 'I05',
    descripcion: 'Dados, troqueles, moldes, matrices y herramental',
    aplicaA: 'ambas',
  },
  { clave: 'I06', descripcion: 'Comunicaciones telefónicas', aplicaA: 'ambas' },
  { clave: 'I07', descripcion: 'Comunicaciones satelitales', aplicaA: 'ambas' },
  { clave: 'I08', descripcion: 'Otra maquinaria y equipo', aplicaA: 'ambas' },
  {
    clave: 'D01',
    descripcion: 'Honorarios médicos, dentales y gastos hospitalarios',
    aplicaA: 'fisica',
  },
  {
    clave: 'D02',
    descripcion: 'Gastos médicos por incapacidad o discapacidad',
    aplicaA: 'fisica',
  },
  { clave: 'D03', descripcion: 'Gastos funerales', aplicaA: 'fisica' },
  { clave: 'D04', descripcion: 'Donativos', aplicaA: 'fisica' },
  {
    clave: 'D05',
    descripcion: 'Intereses reales efectivamente pagados por créditos hipotecarios',
    aplicaA: 'fisica',
  },
  {
    clave: 'D06',
    descripcion: 'Aportaciones voluntarias al SAR',
    aplicaA: 'fisica',
  },
  {
    clave: 'D07',
    descripcion: 'Primas por seguros de gastos médicos',
    aplicaA: 'fisica',
  },
  {
    clave: 'D08',
    descripcion: 'Gastos de transportación escolar obligatoria',
    aplicaA: 'fisica',
  },
  {
    clave: 'D09',
    descripcion: 'Depósitos en cuentas para el ahorro, primas de pensiones',
    aplicaA: 'fisica',
  },
  {
    clave: 'D10',
    descripcion: 'Pagos por servicios educativos (colegiaturas)',
    aplicaA: 'fisica',
  },
  { clave: 'S01', descripcion: 'Sin efectos fiscales', aplicaA: 'ambas' },
  { clave: 'CP01', descripcion: 'Pagos', aplicaA: 'ambas' },
  { clave: 'CN01', descripcion: 'Nómina', aplicaA: 'fisica' },
]

// Pre-grouped for the Select UI. Rendered in order: ambas → física → moral.
// "Ambas" floats to the top because G01/G03 are the most common picks for
// a print shop's B2B customers and we don't want them buried.
export const satUsoCfdiByGroup: Record<UsoCfdiAplicaA, UsoCfdiEntry[]> = {
  ambas: satUsoCfdi.filter((u) => u.aplicaA === 'ambas'),
  fisica: satUsoCfdi.filter((u) => u.aplicaA === 'fisica'),
  moral: satUsoCfdi.filter((u) => u.aplicaA === 'moral'),
}

export function findUsoCfdiByClave(clave: string | null | undefined): UsoCfdiEntry | null {
  if (!clave) return null
  return satUsoCfdi.find((u) => u.clave === clave) ?? null
}
