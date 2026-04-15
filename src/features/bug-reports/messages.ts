// UI copy for the bug reporter. Kept in one file per CLAUDE.md §5.

export const bugReportMessages = {
  fab: {
    label: 'Reportar un problema',
  },
  dialog: {
    title: 'Reportar un problema',
    description:
      'Describe lo que pasó. Adjuntamos automáticamente la página actual, tu usuario y el navegador.',
    descriptionLabel: 'Descripción',
    descriptionPlaceholder: 'Al guardar la nota de venta apareció un error rojo…',
    screenshotLabel: 'Captura de pantalla (opcional)',
    screenshotHelp: 'Si tomaste una captura, súbela aquí. Formato: PNG o JPG, hasta 5 MB.',
    screenshotRemove: 'Quitar captura',
    cancel: 'Cancelar',
    submit: 'Enviar',
    submitting: 'Enviando…',
    errors: {
      descriptionRequired: 'Agrega una descripción.',
      screenshotTooLarge: 'La captura supera los 5 MB.',
      screenshotWrongType: 'Usa una imagen PNG o JPG.',
      generic: 'No se pudo enviar el reporte. Intenta de nuevo.',
    },
  },
  toast: {
    success: 'Reporte enviado. ¡Gracias!',
    error: 'No se pudo enviar el reporte.',
  },
} as const
