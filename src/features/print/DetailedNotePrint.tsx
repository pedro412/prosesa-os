import { useEffect, useMemo, useState } from 'react'

import logoUrl from '@/assets/brand/prosesa-logo.png'
import { formatMXN } from '@/lib/format'
import { type Company } from '@/lib/queries/companies'
import { type Customer } from '@/lib/queries/customers'
import {
  CARD_TYPE_LABELS,
  type CardType,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '@/lib/queries/payments'
import { type SalesNoteWithDetails } from '@/lib/queries/sales-notes'
import type { Database } from '@/types/database'

import { detailedNotePrintMessages } from './messages'

// Shape we need from a vendor — only the attribution label. Passed in
// rather than fetched here so the parent route can batch the read.
interface VendorLite {
  nombre: string
}

interface WorkOrderLite {
  id: string
  folio: string
  description: string | null
  priority: string
  promised_at: string | null
  cancelled_at: string | null
}

type SalesNoteStatus = 'pagada' | 'pendiente' | 'abonada' | 'cancelada'

const STATUS_LABELS: Record<SalesNoteStatus, string> = {
  pagada: 'Pagada',
  pendiente: 'Pendiente',
  abonada: 'Abonada',
  cancelada: 'Cancelada',
}

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Mexico_City',
})

const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Mexico_City',
})

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFormatter.format(d)
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateTimeFormatter.format(d)
}

// Format a discount cell for the print table. The per-line shape mirrors
// sales_note_lines.discount_type / discount_value — percent renders as
// "10%", fixed as the money amount, none as an em-dash.
function formatDiscount(type: string, value: number): string {
  const messages = detailedNotePrintMessages.lines
  if (type === 'percent' && value > 0) {
    return messages.discountPercent(String(value))
  }
  if (type === 'fixed' && value > 0) {
    return formatMXN(Number(value))
  }
  return messages.discountNone
}

function ivaRatePercent(rate: number): string {
  // Rates are stored as decimals (0.16 → 16). Trim trailing zeros so a
  // 16% rate prints as "16", not "16.00".
  const pct = rate * 100
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2)
}

interface DetailedNotePrintProps {
  note: SalesNoteWithDetails
  company: Company
  customer: Customer | null
  vendor: VendorLite | null
  workOrders: WorkOrderLite[]
  // When set, scope the Conceptos table to this order's lines and add
  // the order folio to the header + file title. When null, the nota is
  // printed in its entirety (counter + order-attached lines).
  scopedWorkOrder: WorkOrderLite | null
  // Called after the component has mounted and the browser has painted.
  // The route passes `window.print` — keeping it as a prop makes the
  // component testable without poking at globals.
  onReady?: () => void
}

type PaymentRow = Database['public']['Tables']['payments']['Row']
type SalesNoteLine = Database['public']['Tables']['sales_note_lines']['Row']

export function DetailedNotePrint({
  note,
  company,
  customer,
  vendor,
  workOrders,
  scopedWorkOrder,
  onReady,
}: DetailedNotePrintProps) {
  const messages = detailedNotePrintMessages

  // Filter lines to the scoped order's children when present. The nota
  // object is otherwise intact; totals stay the nota's headline totals.
  const lines = useMemo<SalesNoteLine[]>(() => {
    if (scopedWorkOrder === null) return note.lines
    return note.lines.filter((line) => line.work_order_id === scopedWorkOrder.id)
  }, [note.lines, scopedWorkOrder])

  // Map work_order_id → folio for the per-line Orden chip. When we're
  // scoped to a single order the chip is redundant, so we skip it.
  const workOrderFolioById = useMemo(() => {
    const map = new Map<string, string>()
    for (const wo of workOrders) map.set(wo.id, wo.folio)
    return map
  }, [workOrders])

  const paidSum = useMemo(
    () => note.payments.reduce((sum, p) => sum + Number(p.amount), 0),
    [note.payments]
  )
  const saldo = Number(note.total) - paidSum

  // Wait for the logo image to actually decode before signalling ready.
  // On a cold cache the <img> hasn't loaded yet when useEffect runs;
  // triggering window.print() in that window produces a preview with a
  // missing logo (second visit works because the asset is cached).
  const [logoReady, setLogoReady] = useState(false)

  useEffect(() => {
    if (!logoReady) return
    const handle = window.requestAnimationFrame(() => {
      onReady?.()
    })
    return () => window.cancelAnimationFrame(handle)
  }, [logoReady, onReady])

  const status = note.status as SalesNoteStatus
  const cancelled = status === 'cancelada'

  return (
    <article className="print-page text-sm leading-snug text-black">
      {cancelled && note.cancellation_reason && (
        <div className="mb-4 border-2 border-red-600 bg-red-50 p-2 text-sm font-medium text-red-700 print-avoid-break">
          {messages.cancelled.banner(note.cancellation_reason)}
        </div>
      )}

      <header className="mb-4 flex items-start gap-4 print-avoid-break">
        <img
          src={logoUrl}
          alt="ProsesaOS"
          className="h-16 w-16 shrink-0 object-contain"
          onLoad={() => setLogoReady(true)}
          // Fall back to ready on error so a missing logo file doesn't
          // block the print dialog forever — the rest of the doc is
          // still useful without the image.
          onError={() => setLogoReady(true)}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold uppercase tracking-tight">{company.razon_social}</h1>
          <p className="text-xs text-gray-700">
            {messages.header.company.rfcLabel} {company.rfc}
          </p>
          {company.regimen_fiscal && (
            <p className="text-xs text-gray-700">
              {messages.header.company.regimenLabel} {company.regimen_fiscal}
            </p>
          )}
          {company.direccion_fiscal && (
            <p className="text-xs text-gray-700">
              {messages.header.company.addressLabel} {company.direccion_fiscal}
              {company.cp_fiscal ? ` · CP ${company.cp_fiscal}` : ''}
            </p>
          )}
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 border-y border-gray-400 py-2 text-xs print-avoid-break">
        <div>
          <span className="font-semibold">{messages.header.folioLabel}:</span>{' '}
          <span className="font-mono">{note.folio}</span>
          {scopedWorkOrder && (
            <>
              {' · '}
              <span className="font-semibold">{messages.header.orderHeaderLabel}:</span>{' '}
              <span className="font-mono">{scopedWorkOrder.folio}</span>
            </>
          )}
        </div>
        <div>
          <span className="font-semibold">{messages.header.dateLabel}:</span>{' '}
          {formatDateTime(note.created_at)}
        </div>
        <div>
          <span className="font-semibold">{messages.header.statusLabel}:</span>{' '}
          {STATUS_LABELS[status]}
        </div>
        <div>
          <span className="font-semibold">{messages.header.companyLabel}:</span>{' '}
          {company.nombre_comercial}
        </div>
        <div>
          <span className="font-semibold">{messages.header.vendorLabel}:</span>{' '}
          {vendor ? vendor.nombre : messages.header.sinVendedor}
        </div>
      </section>

      <section className="mb-4 print-avoid-break">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-600">
          {messages.customer.title}
        </h2>
        <p className="text-sm font-medium">
          {customer?.razon_social || customer?.nombre || messages.customer.walkIn}
        </p>
        <p className="text-xs text-gray-700">
          {messages.customer.rfcLabel}{' '}
          <span className="font-mono">{customer?.rfc || messages.customer.rfcGeneric}</span>
          {customer?.regimen_fiscal && (
            <>
              {' · '}
              {messages.customer.regimenLabel} {customer.regimen_fiscal}
            </>
          )}
        </p>
        {(customer?.telefono || customer?.email) && (
          <p className="text-xs text-gray-700">
            {customer.telefono && (
              <>
                {messages.customer.phoneLabel} {customer.telefono}
              </>
            )}
            {customer.telefono && customer.email && ' · '}
            {customer.email && (
              <>
                {messages.customer.emailLabel} {customer.email}
              </>
            )}
          </p>
        )}
        {customer?.direccion_fiscal && (
          <p className="text-xs text-gray-700">
            {messages.customer.addressLabel} {customer.direccion_fiscal}
            {customer.cp_fiscal ? ` · ${messages.customer.cpLabel} ${customer.cp_fiscal}` : ''}
          </p>
        )}
      </section>

      {!scopedWorkOrder && workOrders.length > 0 && (
        <section className="mb-4 print-avoid-break">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-600">
            {messages.orders.title}
          </h2>
          <ul className="space-y-0.5 text-xs">
            {workOrders.map((wo) => (
              <li key={wo.id} className={wo.cancelled_at ? 'text-gray-500 line-through' : ''}>
                <span className="font-mono font-medium">{wo.folio}</span>
                {wo.description ? ` — ${wo.description}` : ''}
                {wo.priority === 'urgente' && (
                  <span className="ml-1 text-red-600">· {messages.orders.priorityUrgente}</span>
                )}
                {' · '}
                {messages.orders.promisedLabel}{' '}
                {wo.promised_at ? formatDate(wo.promised_at) : messages.orders.noPromisedDate}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-4">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-600">
          {messages.lines.title}
        </h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-gray-400 bg-gray-100">
              <th className="px-1 py-1 text-left font-semibold">
                {messages.lines.columns.concept}
              </th>
              <th className="px-1 py-1 text-left font-semibold">{messages.lines.columns.unit}</th>
              <th className="px-1 py-1 text-right font-semibold">
                {messages.lines.columns.quantity}
              </th>
              <th className="px-1 py-1 text-right font-semibold">
                {messages.lines.columns.unitPrice}
              </th>
              <th className="px-1 py-1 text-right font-semibold">
                {messages.lines.columns.discount}
              </th>
              <th className="px-1 py-1 text-right font-semibold">{messages.lines.columns.total}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const orderFolio = line.work_order_id
                ? workOrderFolioById.get(line.work_order_id)
                : null
              return (
                <tr key={line.id} className="border-b border-gray-200 align-top print-avoid-break">
                  <td className="px-1 py-1">
                    <div className="font-medium">{line.concept}</div>
                    {(line.dimensions || line.material) && (
                      <div className="text-xs text-gray-600">
                        {[line.dimensions, line.material].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {!scopedWorkOrder && orderFolio && (
                      <div className="text-xs text-gray-500">
                        {messages.lines.orderBadgeLabel(orderFolio)}
                      </div>
                    )}
                    {!scopedWorkOrder && !orderFolio && (
                      <div className="text-xs text-gray-500">{messages.lines.counterLabel}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 text-xs">{line.unit}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{Number(line.quantity)}</td>
                  <td className="px-1 py-1 text-right tabular-nums">
                    {formatMXN(Number(line.unit_price))}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums">
                    {formatDiscount(line.discount_type, Number(line.discount_value))}
                  </td>
                  <td className="px-1 py-1 text-right font-medium tabular-nums">
                    {formatMXN(Number(line.line_total))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="mb-4 flex justify-end print-avoid-break">
        <dl className="w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>{messages.totals.subtotal}</dt>
            <dd className="font-mono tabular-nums">{formatMXN(Number(note.subtotal))}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{messages.totals.ivaLabel(ivaRatePercent(Number(note.iva_rate_snapshot)))}</dt>
            <dd className="font-mono tabular-nums">{formatMXN(Number(note.iva))}</dd>
          </div>
          <div className="flex justify-between border-t border-gray-400 pt-1 text-base font-bold">
            <dt>{messages.totals.total}</dt>
            <dd className="font-mono tabular-nums">{formatMXN(Number(note.total))}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-4 print-avoid-break">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-600">
          {messages.payments.title}
        </h2>
        {note.payments.length === 0 ? (
          <p className="text-xs text-gray-600">{messages.payments.empty}</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="px-1 py-0.5 text-left font-semibold">
                  {messages.payments.columns.date}
                </th>
                <th className="px-1 py-0.5 text-left font-semibold">
                  {messages.payments.columns.method}
                </th>
                <th className="px-1 py-0.5 text-right font-semibold">
                  {messages.payments.columns.amount}
                </th>
              </tr>
            </thead>
            <tbody>
              {note.payments.map((p: PaymentRow) => (
                <tr key={p.id}>
                  <td className="px-1 py-0.5">{formatDateTime(p.paid_at)}</td>
                  <td className="px-1 py-0.5">
                    {PAYMENT_METHOD_LABELS[p.method as PaymentMethod]}
                    {p.card_type &&
                      messages.payments.cardTypeParen(CARD_TYPE_LABELS[p.card_type as CardType])}
                  </td>
                  <td className="px-1 py-0.5 text-right font-mono tabular-nums">
                    {formatMXN(Number(p.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-1 flex justify-end">
          <dl className="w-64 space-y-0.5 text-xs">
            <div className="flex justify-between">
              <dt>{messages.payments.paid}</dt>
              <dd className="font-mono tabular-nums">{formatMXN(paidSum)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>{messages.payments.saldo}</dt>
              <dd className="font-mono tabular-nums">{formatMXN(saldo)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {note.notes && (
        <section className="mb-6 print-avoid-break">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-600">
            {messages.observations.title}
          </h2>
          <p className="whitespace-pre-wrap text-xs text-gray-800">{note.notes}</p>
        </section>
      )}

      <section className="mt-10 grid grid-cols-2 gap-8 text-xs print-avoid-break">
        <div className="text-center">
          <div className="mb-1 border-b border-gray-800 pb-6" />
          <p>{messages.signatures.received}</p>
        </div>
        <div className="text-center">
          <div className="mb-1 border-b border-gray-800 pb-6" />
          <p>{messages.signatures.delivered}</p>
        </div>
      </section>
    </article>
  )
}
