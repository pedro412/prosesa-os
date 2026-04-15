import { createFileRoute, Link } from '@tanstack/react-router'

import { AuthenticatedRoute } from '@/components/guards'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({
  component: HomeRoute,
})

function HomeRoute() {
  return (
    <AuthenticatedRoute>
      <main className="bg-background text-foreground min-h-svh p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">ProsesaOS</h1>
              <p className="text-muted-foreground text-sm">Inicio — router operando.</p>
            </div>
            <Badge variant="secondary">Fase 1</Badge>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Bienvenido</CardTitle>
              <CardDescription>
                Las vistas reales aterrizan en tickets posteriores (POS, órdenes, inventario).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button asChild variant="outline">
                <Link to="/admin" data-testid="home-admin-link">
                  Zona de admin
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </AuthenticatedRoute>
  )
}
