import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { WorkOrdersList } from '@/features/work-orders/WorkOrdersList'
import { useOrdersUnreadStore } from '@/store/orders-unread-store'

// Mirrors the WorkOrderStatus union from src/lib/queries/work-orders.
// Kept in sync manually — the union lives in a non-type file so Zod
// can't reuse it directly. If a status is added, update both.
const workOrderStatusSchema = z.enum([
  'cotizado',
  'anticipo_recibido',
  'en_diseno',
  'en_produccion',
  'en_instalacion',
  'terminado',
  'entregado',
])
const workOrderPrioritySchema = z.enum(['normal', 'urgente'])
const workOrderDateFieldSchema = z.enum(['created', 'promised'])

// Filter state lives in the URL so back-button, refresh, and shared
// links all restore the same filtered view. Every field is optional;
// malformed input falls through to undefined via `.catch(undefined)`.
const workOrdersSearchSchema = z.object({
  companyId: z.string().uuid().optional().catch(undefined),
  // Multi-status: array of statuses. PostgREST turns this into an IN
  // filter on the query side.
  statuses: z.array(workOrderStatusSchema).optional().catch(undefined),
  priority: workOrderPrioritySchema.optional().catch(undefined),
  customerId: z.string().uuid().optional().catch(undefined),
  dateField: workOrderDateFieldSchema.optional().catch(undefined),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  overdueOnly: z.boolean().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  page: z.number().int().nonnegative().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/work-orders/')({
  validateSearch: workOrdersSearchSchema,
  component: WorkOrdersIndexRoute,
})

function WorkOrdersIndexRoute() {
  // Reset the unread badge whenever the operator lands on the list
  // route (LIT-103). Lives on the index — not the layout — because
  // TanStack keeps the layout mounted across child route swaps, so a
  // mount effect there would only fire once per session.
  const markSeen = useOrdersUnreadStore((s) => s.markSeen)
  useEffect(() => {
    markSeen()
  }, [markSeen])

  return <WorkOrdersList />
}
