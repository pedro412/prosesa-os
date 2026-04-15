// App shell copy. Kept in one file per CLAUDE.md §5 so we can lift it
// into an i18n system later without touching components.

export const layoutMessages = {
  app: {
    title: 'ProsesaOS',
  },
  nav: {
    groupLabel: 'Menú',
    pos: 'Punto de venta',
    workOrders: 'Órdenes de trabajo',
    inventory: 'Inventario',
    salesNotes: 'Notas de venta',
    cashClose: 'Corte de caja',
    customers: 'Clientes',
    catalog: 'Catálogo',
    settings: 'Configuración',
  },
  placeholder: {
    title: 'Próximamente',
    description: 'Esta vista aterriza en un ticket posterior.',
  },
} as const
