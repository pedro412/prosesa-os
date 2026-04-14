import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Toaster } from '@/components/ui/sonner'

function App() {
  return (
    <main className="bg-background text-foreground min-h-svh p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              ProsesaOS
            </h1>
            <p className="text-muted-foreground text-sm">
              Scaffold UI — Tailwind + shadcn.
            </p>
          </div>
          <Badge variant="secondary">Fase 1</Badge>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Prueba de primitivos</CardTitle>
            <CardDescription>
              Esta vista se reemplaza cuando aterrice el router.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demo">Nombre del cliente</Label>
              <Input id="demo" placeholder="Público en general" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => toast.success('Guardado correctamente')}>
                Guardar
              </Button>
              <Button variant="outline">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Toaster richColors />
    </main>
  )
}

export default App
