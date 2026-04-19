// UI copy for the POS counter-mode screen. Spanish (Mexico).
// Kept in one file per CLAUDE.md §5.

import { CARD_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/queries/payments'

export const posMessages = {
  page: {
    title: 'Punto de venta',
    description: 'Registra una venta de mostrador.',
  },
  blockers: {
    companyRequired: 'Selecciona una empresa para poder agregar productos y cobrar.',
  },
  company: {
    label: 'Empresa',
    placeholder: 'Selecciona una empresa',
    loading: 'Cargando empresas…',
    loadError: 'No se pudieron cargar las empresas.',
  },
  customer: {
    label: 'Cliente',
    optional: 'Opcional',
    defaultPlaceholder: 'Buscar por nombre, RFC o teléfono',
    defaultLabel: 'Público en general',
    newButton: 'Nuevo',
    none: 'Sin cliente',
    noResults: 'Sin resultados. Usa "Nuevo" para crearlo.',
    loading: 'Buscando…',
    editAria: 'Editar datos del cliente',
  },
  search: {
    label: 'Buscar producto o servicio',
    placeholder: 'Escribe para buscar en el catálogo',
    empty: 'No hay coincidencias en el catálogo.',
    loading: 'Buscando…',
    error: 'No se pudo cargar el catálogo.',
    addButton: 'Agregar',
    pickHint: 'Enter para agregar el primero',
  },
  freeForm: {
    openButton: 'Añadir concepto libre',
    title: 'Concepto libre',
    description: 'Captura un producto o servicio que no está en el catálogo.',
    fields: {
      concept: 'Concepto',
      conceptPlaceholder: 'Ej. Rotulación en puerta',
      dimensions: 'Dimensiones',
      dimensionsPlaceholder: 'Ej. 1.2 x 2.4 m',
      material: 'Material',
      materialPlaceholder: 'Ej. Vinil transparente',
      unit: 'Unidad',
      quantity: 'Cantidad',
      unitPrice: 'Precio unitario',
    },
    units: {
      pieza: 'pieza',
      m2: 'm²',
      m: 'm',
      litro: 'litro',
      rollo: 'rollo',
      hora: 'hora',
    },
    add: 'Agregar',
    cancel: 'Cancelar',
    errors: {
      conceptRequired: 'El concepto es obligatorio.',
      quantityInvalid: 'La cantidad debe ser mayor a 0.',
      unitPriceInvalid: 'El precio unitario no puede ser negativo.',
      unitRequired: 'Selecciona una unidad.',
    },
  },
  table: {
    empty: 'Aún no hay partidas. Agrega un producto o un concepto libre.',
    columns: {
      concept: 'Concepto',
      unit: 'Unidad',
      quantity: 'Cant.',
      unitPrice: 'Precio',
      discount: 'Descuento',
      lineTotal: 'Importe',
      actions: '',
    },
    removeAriaLabel: 'Eliminar partida',
    discountTypes: {
      none: 'Sin descuento',
      percent: 'Porcentaje',
      fixed: 'Monto fijo',
    },
  },
  totals: {
    subtotal: 'Subtotal',
    ivaLabel: (rate: string) => `IVA (${rate}%)`,
    total: 'Total',
    empty: '—',
    ivaInclusiveHint: 'Precios con IVA incluido.',
    ivaExclusiveHint: 'Precios antes de IVA.',
  },
  submit: {
    cta: 'Cobrar',
    sending: 'Guardando…',
    disabledReason: 'Agrega al menos una partida para cobrar.',
    success: (folio: string) => `Nota ${folio} creada.`,
    successHint: 'Nota pagada y registrada.',
    genericError: 'No se pudo generar la nota. Intenta de nuevo.',
    notAuthenticated: 'Tu sesión expiró. Vuelve a iniciar sesión.',
    companyInactive: 'La empresa seleccionada ya no está activa.',
  },
  payments: {
    title: 'Cobrar',
    description: 'Registra los pagos recibidos para esta nota.',
    methodLabel: 'Método',
    cardTypeLabel: 'Tipo de tarjeta',
    amountLabel: 'Monto',
    addRow: 'Añadir método',
    removeRow: 'Quitar método',
    methodPlaceholder: 'Selecciona un método',
    cardTypePlaceholder: 'Crédito o débito',
    // Shared with the thermal-ticket builder so the two surfaces can't
    // drift. Edit the maps in `@/lib/queries/payments`.
    methods: PAYMENT_METHOD_LABELS,
    cardTypes: CARD_TYPE_LABELS,
    cashTendered: {
      label: 'Efectivo recibido del cliente',
      placeholder: 'Opcional — para calcular el cambio',
      change: (amount: string) => `Cambio a devolver: ${amount}`,
      insufficient: 'Menor al monto a aplicar.',
    },
    balance: {
      total: 'Total a cobrar',
      sum: 'Suma de pagos',
      remaining: (amount: string) => `Faltante: ${amount}`,
      covered: 'Pago cubierto',
      over: (amount: string) => `Sobra: ${amount}`,
    },
    submit: 'Cobrar y confirmar',
    cancel: 'Cancelar',
    errors: {
      amountInvalid: 'El monto debe ser mayor a 0.',
      cardTypeRequired: 'Elige crédito o débito.',
      totalNotCovered: 'La suma de pagos no cubre el total.',
    },
  },
  notes: {
    label: 'Notas',
    placeholder: 'Observaciones internas para esta venta (opcional).',
  },
  draft: {
    restored: 'Venta restaurada.',
    drifted: 'Se restauró tu venta; algunos datos ya no están disponibles.',
    discard: {
      trigger: 'Descartar borrador',
      triggerAria: 'Descartar borrador de venta',
      title: '¿Descartar el borrador?',
      description:
        'Se perderán los datos capturados en esta venta. Esta acción no se puede deshacer.',
      confirm: 'Descartar',
      cancel: 'Cancelar',
      success: 'Borrador descartado.',
    },
  },
  invoice: {
    label: 'Requiere factura',
  },
  fiscalWarning: {
    noCustomerTitle: 'Requiere factura sin cliente',
    noCustomerDescription:
      'La nota saldrá con el RFC genérico XAXX010101000 y no podrá facturarse después.',
    incompleteTitle: 'Faltan datos fiscales del cliente',
    incompleteDescription: (fields: string) =>
      `Para poder facturar esta venta, complete: ${fields}.`,
    completeAction: 'Completar datos fiscales',
    fieldLabels: {
      rfc: 'RFC',
      razon_social: 'Razón social',
      regimen_fiscal: 'Régimen fiscal',
      cp_fiscal: 'Código postal',
      direccion_fiscal: 'Dirección fiscal',
      uso_cfdi: 'Uso de CFDI',
    },
  },
  print: {
    error: 'No se pudo imprimir el ticket.',
    errorHint: 'Revisa la conexión en Ajustes > Impresora.',
  },
  printer: {
    unsupported: {
      label: 'Sin WebUSB',
      tooltip: 'Este navegador no soporta WebUSB. Usa Chrome, Edge u Opera para imprimir tickets.',
    },
    unauthorized: {
      label: 'Sin impresora',
      tooltip:
        'Aún no autorizas una impresora. Haz clic aquí para abrir Ajustes > Impresora y solicitar acceso.',
    },
    disconnected: {
      label: 'Desconectada',
      tooltip:
        'La impresora autorizada no está conectada. Revisa el cable USB o reautoriza en Ajustes > Impresora.',
    },
    printing: {
      label: 'Imprimiendo…',
      tooltip: 'Enviando el ticket a la impresora.',
    },
    error: {
      label: 'Error al imprimir',
      tooltip: (detail: string | null) =>
        detail
          ? `El último ticket falló: ${detail}. Haz clic para abrir Ajustes > Impresora.`
          : 'El último ticket no se pudo imprimir. Haz clic para abrir Ajustes > Impresora.',
    },
    ready: {
      label: 'Impresora lista',
      tooltip: (device: string | null) =>
        device ? `Conectada: ${device}. Lista para imprimir.` : 'Lista para imprimir.',
    },
  },
} as const
