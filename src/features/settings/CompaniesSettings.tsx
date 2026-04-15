import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCompanies } from '@/lib/queries/companies'

import { CompanyForm } from './CompanyForm'
import { settingsMessages } from './messages'

export function CompaniesSettings() {
  const { data, isPending, isError } = useCompanies({ includeInactive: true })
  const messages = settingsMessages.companies

  return (
    <section className="space-y-4" data-testid="companies-settings">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{messages.sectionTitle}</h2>
        <p className="text-muted-foreground text-sm">{messages.sectionDescription}</p>
      </header>

      {isPending && (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {messages.loading}
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <CardHeader>
            <CardTitle>{messages.loadError}</CardTitle>
            <CardDescription>{settingsMessages.toast.error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {messages.empty}
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((company) => (
            <CompanyForm key={company.id} company={company} />
          ))}
        </div>
      )}
    </section>
  )
}
