// UI copy for the work-orders list (LIT-41 / M4-6). Spanish (Mexico).
// Kept in one file per CLAUDE.md §5.

export const workOrdersMessages = {
  page: {
    title: 'Órdenes de trabajo',
    description:
      'Consulta las órdenes activas. Filtra por estatus, prioridad o fecha para priorizar la producción.',
  },
  filters: {
    statusLabel: 'Estatus',
    statusAll: 'Todas',
    priorityLabel: 'Prioridad',
    priorityAll: 'Todas',
    priorityOptions: {
      normal: 'Normal',
      urgente: 'Urgente',
    },
    companyLabel: 'Empresa',
    companyAll: 'Todas',
    customerLabel: 'Cliente',
    customerAll: 'Todos',
    dateFieldLabel: 'Campo de fecha',
    dateFieldOptions: {
      created: 'Creación',
      promised: 'Entrega prometida',
    },
    dateFromLabel: 'Desde',
    dateToLabel: 'Hasta',
    overdueOnlyLabel: 'Solo vencidas',
    searchLabel: 'Buscar por folio',
    searchPlaceholder: 'Ej. A-0042-01',
    clear: 'Limpiar filtros',
  },
  columns: {
    folio: 'Folio',
    customer: 'Cliente',
    status: 'Estatus',
    priority: 'Prioridad',
    promisedAt: 'Fecha prometida',
    saldo: 'Saldo',
    updatedAt: 'Última actualización',
    actions: '',
  },
  priority: {
    normal: 'Normal',
    urgente: 'Urgente',
  },
  list: {
    loading: 'Cargando órdenes…',
    loadError: 'No se pudieron cargar las órdenes.',
    empty: 'Aún no hay órdenes de trabajo.',
    emptyFiltered: 'Sin resultados para los filtros aplicados.',
    resultCount: (shown: number, total: number) => `Mostrando ${shown} de ${total}`,
    pageOf: (current: number, total: number) => `Página ${current} de ${total}`,
    previous: 'Anterior',
    next: 'Siguiente',
  },
  row: {
    overdueAriaLabel: 'Orden vencida',
    cancelledLabel: 'Cancelada',
    noCustomer: 'Sin cliente',
    noPromisedDate: '—',
    noSaldo: '—',
    viewAction: 'Ver detalle',
  },
} as const
