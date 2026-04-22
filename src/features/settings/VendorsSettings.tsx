import { useState } from 'react'
import { Plus } from 'lucide-react'

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
import { type Vendor, useVendors } from '@/lib/queries/vendors'

import { settingsMessages } from './messages'
import { VendorFormDialog } from './VendorFormDialog'

// Admin CRUD for vendedores de campo (LIT-107). Admin-only per route
// guard in `src/routes/_app/settings.tsx`. Includes inactive rows so
// admin can toggle is_active back on; the POS picker applies its own
// active filter.
export function VendorsSettings() {
  const { data, isPending, isError } = useVendors({ includeInactive: true })
  const messages = settingsMessages.vendors

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)

  return (
    <section className="space-y-4" data-testid="vendors-settings">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{messages.sectionTitle}</h2>
          <p className="text-muted-foreground text-sm">{messages.sectionDescription}</p>
        </div>
        <Button onClick={() => setCreating(true)} data-testid="vendor-new-button">
          <Plus aria-hidden className="size-4" />
          {messages.newButton}
        </Button>
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
            <CardDescription>{messages.toast.error}</CardDescription>
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
                <TableHead>{messages.columns.nombre}</TableHead>
                <TableHead>{messages.columns.telefono}</TableHead>
                <TableHead>{messages.columns.email}</TableHead>
                <TableHead>{messages.columns.estado}</TableHead>
                <TableHead className="sr-only">{messages.columns.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((vendor) => (
                <TableRow key={vendor.id} data-testid={`vendor-row-${vendor.id}`}>
                  <TableCell className="font-medium">{vendor.nombre}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {vendor.telefono ?? messages.notSet}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {vendor.email ?? messages.notSet}
                  </TableCell>
                  <TableCell>
                    <Badge variant={vendor.is_active ? 'default' : 'outline'}>
                      {vendor.is_active ? messages.estado.active : messages.estado.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(vendor)}
                      data-testid={`vendor-edit-${vendor.id}`}
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

      <VendorFormDialog
        mode="create"
        open={creating}
        onOpenChange={(open) => {
          if (!open) setCreating(false)
        }}
      />

      <VendorFormDialog
        mode="edit"
        vendor={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      />
    </section>
  )
}
