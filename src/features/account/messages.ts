// UI copy for the personal-account surfaces (just the name editor for
// now — see LIT-73). Kept in one file per CLAUDE.md §5.

export const accountMessages = {
  menu: {
    editName: 'Editar mi nombre',
  },
  editName: {
    dialog: {
      title: 'Editar mi nombre',
      description: 'Este nombre aparece en el menú superior. No cambia tu correo ni tus permisos.',
    },
    field: {
      label: 'Nombre',
      placeholder: 'Tu nombre como quieres aparecer',
    },
    actions: {
      save: 'Guardar',
      saving: 'Guardando…',
      cancel: 'Cancelar',
    },
    errors: {
      required: 'El nombre es obligatorio.',
      tooLong: 'El nombre no puede tener más de 120 caracteres.',
    },
    toast: {
      success: 'Nombre actualizado.',
      error: 'No se pudo guardar el nombre. Intenta de nuevo.',
    },
  },
} as const
