// Spanish (Mexico) copy for the detailed-note print surface (LIT-43).
// Kept in one file per CLAUDE.md §5 — the print doc is the literal
// printed artifact, every label on it is a client-visible string.

export const detailedNotePrintMessages = {
  doc: {
    title: 'Nota detallada',
    // `<folio>` appears in <title>; browsers use this as the suggested
    // filename when the user picks "Save as PDF" from the print dialog.
    fileTitle: (folio: string) => `Nota ${folio}`,
    fileTitleForOrder: (noteFolio: string, orderFolio: string) =>
      `Nota ${noteFolio} — Orden ${orderFolio}`,
  },
  loading: 'Preparando nota…',
  loadError: 'No se pudo preparar la nota. Verifica el enlace o vuelve al detalle.',
  backToDetail: 'Volver al detalle',
  header: {
    company: {
      rfcLabel: 'RFC:',
      regimenLabel: 'Régimen fiscal:',
      addressLabel: 'Dirección:',
    },
    folioLabel: 'Folio',
    dateLabel: 'Fecha',
    statusLabel: 'Estatus',
    companyLabel: 'Empresa',
    vendorLabel: 'Vendedor',
    sinVendedor: 'Sin vendedor',
    orderHeaderLabel: 'Orden',
  },
  customer: {
    title: 'Cliente',
    rfcLabel: 'RFC:',
    rfcGeneric: 'XAXX010101000',
    phoneLabel: 'Teléfono:',
    emailLabel: 'Correo:',
    addressLabel: 'Dirección:',
    regimenLabel: 'Régimen:',
    cpLabel: 'CP:',
    walkIn: 'Público en general',
  },
  orders: {
    title: 'Órdenes de trabajo',
    priorityUrgente: 'Urgente',
    promisedLabel: 'Prometida:',
    noPromisedDate: 'sin fecha',
  },
  lines: {
    title: 'Conceptos',
    columns: {
      concept: 'Concepto',
      unit: 'Unidad',
      quantity: 'Cant.',
      unitPrice: 'Precio',
      discount: 'Descuento',
      total: 'Importe',
    },
    orderBadgeLabel: (folio: string) => `Orden ${folio}`,
    counterLabel: 'Mostrador',
    discountPercent: (value: string) => `${value}%`,
    discountNone: '—',
  },
  totals: {
    subtotal: 'Subtotal',
    ivaLabel: (rate: string) => `IVA (${rate}%)`,
    total: 'Total',
  },
  payments: {
    title: 'Pagos',
    empty: 'Aún no hay pagos registrados.',
    paid: 'Pagado',
    saldo: 'Saldo pendiente',
    columns: {
      date: 'Fecha',
      method: 'Método',
      amount: 'Monto',
    },
    cardTypeParen: (label: string) => ` (${label})`,
  },
  observations: {
    title: 'Observaciones',
  },
  cancelled: {
    banner: (reason: string) => `Nota cancelada. Motivo: ${reason}`,
  },
  signatures: {
    received: 'Recibí conforme',
    delivered: 'Entregó',
  },
} as const
