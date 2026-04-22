import { createFileRoute } from '@tanstack/react-router'

import { PageContainer } from '@/components/layout/PageContainer'
import { WorkOrderDetail } from '@/features/work-orders/WorkOrderDetail'

export const Route = createFileRoute('/_app/work-orders/$id')({
  component: WorkOrderDetailRoute,
})

function WorkOrderDetailRoute() {
  const { id } = Route.useParams()
  return (
    <PageContainer>
      <WorkOrderDetail workOrderId={id} />
    </PageContainer>
  )
}
