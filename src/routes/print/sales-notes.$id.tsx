import { useCallback, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { DetailedNotePrint } from '@/features/print/DetailedNotePrint'
import { detailedNotePrintMessages } from '@/features/print/messages'
import { useCompany } from '@/lib/queries/companies'
import { useCustomer } from '@/lib/queries/customers'
import { useSalesNote } from '@/lib/queries/sales-notes'
import { useVendor } from '@/lib/queries/vendors'
import { useWorkOrdersForNote } from '@/lib/queries/work-orders'

// Search schema — `workOrderId` optionally scopes the Conceptos table
// to a single work order's lines. When omitted the whole nota prints.
const printSearchSchema = z.object({
  workOrderId: z.string().uuid().optional().catch(undefined),
})

export const Route = createFileRoute('/print/sales-notes/$id')({
  validateSearch: printSearchSchema,
  component: PrintSalesNoteRoute,
})

function PrintSalesNoteRoute() {
  const { id } = Route.useParams()
  const { workOrderId } = Route.useSearch()
  const messages = detailedNotePrintMessages

  const { data: note, isPending: notePending, isError: noteError } = useSalesNote(id)
  const { data: company, isPending: companyPending } = useCompany(note?.company_id)
  const { data: customer } = useCustomer(note?.customer_id ?? undefined)
  const { data: vendor } = useVendor(note?.vendor_id ?? undefined)
  const { data: workOrders } = useWorkOrdersForNote(id)

  const ready =
    !notePending && !noteError && !!note && !companyPending && !!company && workOrders !== undefined

  const scopedWorkOrder =
    workOrderId && workOrders ? (workOrders.find((wo) => wo.id === workOrderId) ?? null) : null

  // Update the document title so the browser's "Save as PDF" suggestion
  // names the file usefully. Reset on unmount to avoid leaking the title
  // into the next route mount.
  useEffect(() => {
    if (!note) return
    const fileTitle = scopedWorkOrder
      ? messages.doc.fileTitleForOrder(note.folio, scopedWorkOrder.folio)
      : messages.doc.fileTitle(note.folio)
    const previous = document.title
    document.title = fileTitle
    return () => {
      document.title = previous
    }
  }, [note, scopedWorkOrder, messages.doc])

  const handleReady = useCallback(() => {
    // Auto-open the browser print dialog once the DOM is painted.
    // `window.print()` is synchronous in blink/webkit; the browser
    // renders the preview off-screen. Closing the dialog returns
    // control here without a callback.
    window.print()
  }, [])

  if (notePending || companyPending) {
    return (
      <div className="p-8 text-sm text-gray-600" data-print-hide>
        {messages.loading}
      </div>
    )
  }

  if (noteError || !note || !company) {
    return (
      <div className="space-y-3 p-8 text-sm" data-print-hide>
        <p className="text-red-700">{messages.loadError}</p>
        <Button asChild variant="outline">
          <Link to="/sales-notes">{messages.backToDetail}</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div
        className="sticky top-0 z-10 flex justify-end gap-2 bg-gray-100 p-2 text-xs"
        data-print-hide
      >
        <Button variant="outline" size="sm" asChild>
          <Link to="/sales-notes">{messages.backToDetail}</Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          Imprimir
        </Button>
      </div>
      {ready && (
        <DetailedNotePrint
          note={note}
          company={company}
          customer={customer ?? null}
          vendor={vendor ?? null}
          workOrders={workOrders ?? []}
          scopedWorkOrder={scopedWorkOrder}
          onReady={handleReady}
        />
      )}
    </>
  )
}
