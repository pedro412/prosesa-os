import { createFileRoute } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_app/')({
  component: HomeRoute,
})

function HomeRoute() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inicio</h1>
          <p className="text-muted-foreground text-sm">
            Navega a los módulos desde el menú lateral.
          </p>
        </div>
        <Badge variant="secondary">Fase 1</Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Bienvenido</CardTitle>
          <CardDescription>
            Las vistas reales aterrizan en tickets posteriores. Cada módulo del menú abre una página
            “Próximamente” hasta que su ticket correspondiente sea implementado.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Si encuentras algo raro, usa el botón de reporte flotante abajo a la derecha.
        </CardContent>
      </Card>
    </div>
  )
}
