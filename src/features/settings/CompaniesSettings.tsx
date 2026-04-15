import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type Company, useCompanies } from '@/lib/queries/companies'

import { CompanyEditDialog } from './CompanyEditDialog'
import { settingsMessages } from './messages'

export function CompaniesSettings() {
  const { data, isPending, isError } = useCompanies({ includeInactive: true })
  const messages = settingsMessages.companies

  const [editing, setEditing] = useState<Company | null>(null)

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
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{messages.columns.code}</TableHead>
                <TableHead>{messages.columns.nombreComercial}</TableHead>
                <TableHead>{messages.columns.razonSocial}</TableHead>
                <TableHead>{messages.columns.rfc}</TableHead>
                <TableHead>{messages.columns.regimenFiscal}</TableHead>
                <TableHead className="text-right">{messages.columns.ivaRate}</TableHead>
                <TableHead>{messages.columns.estado}</TableHead>
                <TableHead className="sr-only">{messages.columns.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((company) => (
                <TableRow
                  key={company.id}
                  data-testid={`company-row-${company.code.toLowerCase()}`}
                >
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {company.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{company.nombre_comercial}</TableCell>
                  <TableCell className="text-muted-foreground">{company.razon_social}</TableCell>
                  <TableCell className="font-mono text-xs">{company.rfc}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.regimen_fiscal ?? messages.notSet}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(company.iva_rate * 100).toFixed(2).replace(/\.?0+$/, '')}%
                  </TableCell>
                  <TableCell>
                    <Badge variant={company.is_active ? 'default' : 'outline'}>
                      {company.is_active ? messages.estado.active : messages.estado.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(company)}
                      data-testid={`company-edit-${company.code.toLowerCase()}`}
                    >
                      {messages.edit}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CompanyEditDialog
        company={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      />
    </section>
  )
}
