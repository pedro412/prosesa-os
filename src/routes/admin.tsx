import { createFileRoute, Link } from '@tanstack/react-router'

import { AdminRoute } from '@/components/guards'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// LIT-17 scaffolding: this route exists solely to exercise AdminRoute end
// to end. Real admin pages (bug-reports triage, catalog management, corte
// de caja) land in their own tickets and can also use AdminRoute.
export const Route = createFileRoute('/admin')({
  component: AdminPlaceholderRoute,
})

function AdminPlaceholderRoute() {
  return (
    <AdminRoute>
      <main className="bg-background text-foreground min-h-svh p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight">Zona de admin</h1>

          <Card>
            <CardHeader>
              <CardTitle>Acceso confirmado</CardTitle>
              <CardDescription data-testid="admin-placeholder">
                Solo los usuarios con rol <code>admin</code> llegan aquí. Las vistas reales
                (reportes de errores, catálogos, corte de caja) reemplazan esta página conforme
                aterrizan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/">Volver al inicio</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </AdminRoute>
  )
}
