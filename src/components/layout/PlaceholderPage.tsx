import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { layoutMessages } from './messages'
import { PageContainer } from './PageContainer'

interface PlaceholderPageProps {
  title: string
  testId?: string
}

export function PlaceholderPage({ title, testId }: PlaceholderPageProps) {
  return (
    <PageContainer>
      <div className="space-y-6" data-testid={testId}>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <Card>
          <CardHeader>
            <CardTitle>{layoutMessages.placeholder.title}</CardTitle>
            <CardDescription>{layoutMessages.placeholder.description}</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Mientras tanto revisa otros módulos desde el menú.
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
