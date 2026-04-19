import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { PageContainer } from '@/components/layout/PageContainer'
import { SalesNotesList } from '@/features/sales-notes/SalesNotesList'

const salesNoteStatusSchema = z.enum(['pagada', 'pendiente', 'abonada', 'cancelada'])
const paymentMethodSchema = z.enum(['efectivo', 'transferencia', 'tarjeta'])

// Filter state lives in the URL so back-button, refresh, and shared
// links all restore the same filtered view. Every field is optional;
// unknown input values (old links with dropped filters, hand-edited
// URLs) fall through to undefined via `.catch(undefined)` so the UI
// doesn't crash on a malformed param.
const salesNotesSearchSchema = z.object({
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  companyId: z.string().uuid().optional().catch(undefined),
  status: salesNoteStatusSchema.optional().catch(undefined),
  paymentMethod: paymentMethodSchema.optional().catch(undefined),
  customerId: z.string().uuid().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  page: z.number().int().nonnegative().optional().catch(undefined),
  openId: z.string().uuid().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/sales-notes')({
  validateSearch: salesNotesSearchSchema,
  component: SalesNotesRoute,
})

function SalesNotesRoute() {
  return (
    <PageContainer>
      <SalesNotesList />
    </PageContainer>
  )
}
