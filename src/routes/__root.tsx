import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { Toaster } from '@/components/ui/sonner'
import { isDev } from '@/lib/env'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster richColors />
      {isDev && <TanStackRouterDevtools position="bottom-right" />}
    </>
  )
}

function NotFound() {
  return (
    <main className="bg-background text-foreground grid min-h-svh place-items-center p-8">
      <div className="max-w-md space-y-2 text-center">
        <p className="text-muted-foreground text-sm">Error 404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Página no encontrada</h1>
        <p className="text-muted-foreground text-sm">La ruta que buscas no existe o fue movida.</p>
      </div>
    </main>
  )
}
