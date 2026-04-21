import type { WorkOrderStatus } from '@/lib/queries/work-orders'

// Mirrors the variants shipped by `@/components/ui/badge`. Kept local
// so this module doesn't depend on an unexported type from the
// primitive — if Badge grows a new variant, tweak this union.
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

// Single source of truth for how work-order statuses display across
// surfaces (list row pill, filter chips, future detail header, Kanban
// columns). LIT-42 and LIT-56 both reuse this — don't scatter the
// mapping into feature files.

// Canonical forward order, matching SPEC §4.5. Used to render filter
// chips in the expected left-to-right flow.
export const STATUS_ORDER: readonly WorkOrderStatus[] = [
  'cotizado',
  'anticipo_recibido',
  'en_diseno',
  'en_produccion',
  'en_instalacion',
  'terminado',
  'entregado',
] as const

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  cotizado: 'Cotizado',
  anticipo_recibido: 'Anticipo',
  en_diseno: 'En diseño',
  en_produccion: 'En producción',
  en_instalacion: 'En instalación',
  terminado: 'Terminado',
  entregado: 'Entregado',
}

// Maps each status to a Badge variant. `outline` / `secondary` /
// `default` / `destructive` are the only variants shipped today; we
// distribute them so the flow reads left-to-right from neutral → warm
// → green. Tweak visually if the palette evolves.
export function statusBadgeVariant(status: WorkOrderStatus): BadgeVariant {
  switch (status) {
    case 'cotizado':
      return 'outline'
    case 'anticipo_recibido':
    case 'en_diseno':
    case 'en_produccion':
    case 'en_instalacion':
      return 'secondary'
    case 'terminado':
    case 'entregado':
      return 'default'
  }
}

// Overdue = promised date passed, order still open, not cancelled.
// Cancelled + Entregado orders are terminal and not "overdue" even if
// promised_at < now(). Mirrors the listWorkOrdersPaged overdueOnly
// filter so client-side highlight matches server-side filtering.
export function isOverdue(order: {
  promised_at: string | null
  status: string
  cancelled_at: string | null
}): boolean {
  if (!order.promised_at) return false
  if (order.cancelled_at) return false
  if (order.status === 'entregado') return false
  return new Date(order.promised_at).getTime() < Date.now()
}

// ============================================================================
// Day-delta label for promised_at
// ============================================================================
// Operators scan the list looking for "what's due soon / overdue". A raw
// DD/MM/YYYY requires mental math; a signed day delta doesn't. We compute
// the delta at MX-calendar-day granularity (not a 24h rolling window) so
// a promise at 11pm today still reads as "Hoy" at 1am tomorrow's shift,
// matching operator intuition.

// Returns YYYY-MM-DD as it falls on the MX civil calendar for `d`. Using
// en-CA because its default locale format is already ISO — saves a
// manual yyyy-mm-dd concat.
const MX_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'America/Mexico_City',
})

function mxCivilDay(d: Date): string {
  return MX_DAY_FORMATTER.format(d)
}

function diffMxDays(isoA: string, isoB: string): number {
  // Treat the YYYY-MM-DD strings as UTC midnights and diff. Using UTC
  // avoids the DST pitfall of `new Date('2026-04-05') - new Date(...)` —
  // neither of these days ever cross DST in UTC.
  const a = Date.parse(`${isoA}T00:00:00Z`)
  const b = Date.parse(`${isoB}T00:00:00Z`)
  return Math.round((a - b) / 86_400_000)
}

export type DeltaTone = 'overdue' | 'urgent' | 'soon' | 'later' | 'done'

export interface PromisedDelta {
  // Raw signed day delta in MX calendar days (today = 0).
  deltaDays: number
  // Spanish label, scannable at a glance.
  label: string
  // Semantic tone for styling — caller decides the class.
  tone: DeltaTone
}

// Computes a scannable relative-day label for a promised_at timestamp,
// given the order's status + cancellation state. Returns null when the
// label would be noise:
//   * no promised_at set
//   * order cancelled
//   * order already delivered (status = 'entregado')
// Callers should still render the absolute date next to this — the
// delta complements, doesn't replace.
export function promisedDelta(order: {
  promised_at: string | null
  status: string
  cancelled_at: string | null
}): PromisedDelta | null {
  if (!order.promised_at) return null
  if (order.cancelled_at) return null
  if (order.status === 'entregado') return null

  const promisedDay = mxCivilDay(new Date(order.promised_at))
  const todayDay = mxCivilDay(new Date())
  const deltaDays = diffMxDays(promisedDay, todayDay)

  let label: string
  let tone: DeltaTone
  if (deltaDays < 0) {
    const days = Math.abs(deltaDays)
    label = days === 1 ? 'Hace 1 día' : `Hace ${days} días`
    tone = 'overdue'
  } else if (deltaDays === 0) {
    label = 'Hoy'
    tone = 'urgent'
  } else if (deltaDays === 1) {
    label = 'Mañana'
    tone = 'soon'
  } else if (deltaDays <= 3) {
    label = `En ${deltaDays} días`
    tone = 'soon'
  } else {
    label = `En ${deltaDays} días`
    tone = 'later'
  }

  return { deltaDays, label, tone }
}
