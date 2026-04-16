// UI copy for the admin settings area. Kept in one file per CLAUDE.md §5.

export const settingsMessages = {
  page: {
    title: 'Configuración',
    description:
      'Administra las razones sociales, los usuarios y los parámetros fiscales de Prosesa.',
  },
  tabs: {
    companies: 'Empresas',
    users: 'Usuarios',
  },
  companies: {
    sectionTitle: 'Razones sociales',
    sectionDescription:
      'Datos de cada empresa para notas de venta, facturación y reportes. Confirma los valores con Dana antes del arranque.',
    loading: 'Cargando empresas…',
    empty: 'Aún no hay empresas configuradas.',
    loadError: 'No se pudieron cargar las empresas.',
    columns: {
      code: 'Clave',
      nombreComercial: 'Nombre comercial',
      razonSocial: 'Razón social',
      rfc: 'RFC',
      regimenFiscal: 'Régimen',
      ivaRate: 'IVA',
      estado: 'Estado',
      actions: 'Acciones',
    },
    estado: {
      active: 'Activa',
      inactive: 'Inactiva',
    },
    notSet: '—',
    edit: 'Editar',
  },
  editDialog: {
    title: 'Editar empresa',
    description: 'Actualiza los datos fiscales y de facturación.',
  },
  form: {
    codeLabel: 'Clave de folio',
    codeHelp: 'Prefijo único en las notas (ej. A-0001).',
    nombreComercialLabel: 'Nombre comercial',
    razonSocialLabel: 'Razón social',
    rfcLabel: 'RFC',
    regimenFiscalLabel: 'Régimen fiscal',
    direccionFiscalLabel: 'Dirección fiscal',
    cpFiscalLabel: 'Código postal',
    logoUrlLabel: 'URL del logo',
    ivaRateLabel: 'Tasa de IVA',
    ivaRateHelp: 'Ingresa el porcentaje (ej. 16 para 16%).',
    ivaInclusiveLabel: 'Precios incluyen IVA',
    ivaInclusiveHelp: 'Si está activo, los precios de catálogo ya incluyen el impuesto.',
    isActiveLabel: 'Empresa activa',
    save: 'Guardar cambios',
    saving: 'Guardando…',
    reset: 'Descartar',
    errors: {
      ivaRateRange: 'La tasa de IVA debe estar entre 0 y 100.',
      required: 'Este campo es obligatorio.',
    },
  },
  toast: {
    success: 'Empresa actualizada.',
    error: 'No se pudieron guardar los cambios.',
  },
} as const
