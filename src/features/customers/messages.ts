// UI copy for the customers CRUD. Kept in one file per CLAUDE.md §5.

export const customersMessages = {
  page: {
    title: 'Clientes',
    description: 'Registro compartido entre ambas razones sociales.',
    newButton: 'Nuevo cliente',
  },
  search: {
    placeholder: 'Buscar por nombre, RFC o teléfono',
    ariaLabel: 'Buscar clientes',
  },
  list: {
    loading: 'Cargando clientes…',
    loadError: 'No se pudieron cargar los clientes.',
    empty: 'Aún no hay clientes.',
    emptySearch: 'Sin resultados para la búsqueda.',
    resultCount: (shown: number, total: number) => `Mostrando ${shown} de ${total}`,
    pageOf: (current: number, total: number) => `Página ${current} de ${total}`,
    previous: 'Anterior',
    next: 'Siguiente',
    sentinelBadge: 'Predeterminado',
    invoiceBadge: 'Requiere factura',
  },
  columns: {
    nombre: 'Nombre',
    rfc: 'RFC',
    telefono: 'Teléfono',
    email: 'Correo',
    flags: 'Etiquetas',
    actions: 'Acciones',
  },
  actions: {
    edit: 'Editar',
    delete: 'Eliminar',
  },
  form: {
    nombreLabel: 'Nombre',
    nombrePlaceholder: 'Nombre del cliente o contacto',
    razonSocialLabel: 'Razón social',
    rfcLabel: 'RFC',
    rfcPlaceholder: 'Opcional · 12 o 13 caracteres',
    regimenFiscalLabel: 'Régimen fiscal',
    cpFiscalLabel: 'Código postal',
    telefonoLabel: 'Teléfono',
    emailLabel: 'Correo electrónico',
    requiereFacturaLabel: 'Requiere factura',
    requiereFacturaHelp: 'Marca cuando el cliente necesita CFDI.',
    notasLabel: 'Notas',
    notasPlaceholder: 'Datos útiles para el equipo de ventas.',
    save: 'Guardar',
    saving: 'Guardando…',
    cancel: 'Cancelar',
    errors: {
      nombreRequired: 'El nombre es obligatorio.',
      rfcFormat: 'RFC inválido. Debe tener 12 (moral) o 13 (física) caracteres.',
      emailFormat: 'Correo electrónico inválido.',
      cpFormat: 'El código postal debe tener 5 dígitos.',
    },
  },
  createDialog: {
    title: 'Nuevo cliente',
    description: 'Registra un cliente para poder emitir notas y órdenes de trabajo.',
  },
  editDialog: {
    title: 'Editar cliente',
    description: 'Actualiza los datos del cliente.',
  },
  deleteDialog: {
    title: '¿Eliminar cliente?',
    body: (nombre: string) =>
      `El cliente "${nombre}" dejará de aparecer en las listas. Solo administración puede restaurarlo.`,
    confirm: 'Eliminar',
    cancel: 'Cancelar',
  },
  toast: {
    createSuccess: 'Cliente creado.',
    updateSuccess: 'Cliente actualizado.',
    deleteSuccess: 'Cliente eliminado.',
    genericError: 'Ocurrió un problema. Intenta de nuevo.',
  },
  sentinelReadOnly: 'El cliente "Público en general" no es editable.',
} as const
