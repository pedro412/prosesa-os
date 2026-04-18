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
    printer: 'Impresora',
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
  printer: {
    sectionTitle: 'Impresora térmica',
    sectionDescription:
      'Configura la impresora de tickets para este equipo. La autorización se guarda por navegador; si cambias de computadora tendrás que repetirla aquí.',
    unsupported: 'Tu navegador no soporta WebUSB. Usa Chrome, Edge u Opera para imprimir tickets.',
    status: {
      label: 'Estado',
      idle: 'Sin imprimir todavía',
      printing: 'Enviando al impresor…',
      ok: 'Último ticket enviado correctamente.',
      error: 'Hubo un problema con la última impresión.',
    },
    device: {
      label: 'Dispositivo autorizado',
      none: 'Ninguno — solicita acceso para continuar.',
      authorize: 'Solicitar acceso a impresora',
      reauthorize: 'Cambiar impresora',
      authorizeHint: 'Se abrirá una ventana del navegador donde debes elegir tu impresora USB.',
      authorized: (name: string) => `Autorizada: ${name}`,
      authorizeError: 'No se autorizó ninguna impresora.',
    },
    paper: {
      label: 'Ancho de papel',
      option80: '80 mm (42 columnas)',
      option58: '58 mm (32 columnas)',
      hint: 'La mayoría de los tickets de Prosesa usan 80 mm.',
    },
    test: {
      button: 'Imprimir ticket de prueba',
      hint: 'Envía un ticket de ejemplo a la impresora autorizada.',
      sending: 'Imprimiendo…',
      success: 'Ticket de prueba enviado.',
      error: 'No se pudo imprimir la prueba.',
    },
    preview: {
      label: 'Previsualización',
      hint: 'Así se verá el ancho del papel. Ajústalo si los bordes quedan cortados.',
    },
    companyNotice: {
      label: 'Empresa para la prueba',
      hint: 'El ticket de prueba se imprime con los datos fiscales de la empresa activa en POS.',
      missing: 'Configura al menos una empresa activa para poder imprimir la prueba.',
    },
  },
} as const
