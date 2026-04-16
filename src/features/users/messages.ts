// UI copy for user management. Kept in one file per CLAUDE.md §5.

export const usersMessages = {
  section: {
    title: 'Usuarios',
    description:
      'Invita personas, controla su rol y acceso. Las eliminaciones son reversibles desde el filtro "Mostrar eliminados".',
  },
  toolbar: {
    inviteButton: 'Invitar usuario',
    showDeletedLabel: 'Mostrar eliminados',
  },
  list: {
    loading: 'Cargando usuarios…',
    loadError: 'No se pudieron cargar los usuarios.',
    empty: 'Aún no hay usuarios.',
    resultCount: (shown: number, total: number) => `Mostrando ${shown} de ${total}`,
    pageOf: (current: number, total: number) => `Página ${current} de ${total}`,
    previous: 'Anterior',
    next: 'Siguiente',
  },
  columns: {
    email: 'Correo',
    name: 'Nombre',
    role: 'Rol',
    active: 'Activo',
    lastSignIn: 'Último acceso',
    actions: 'Acciones',
  },
  roles: {
    admin: 'Admin',
    ventas: 'Ventas',
  },
  status: {
    deletedBadge: 'Eliminado',
    never: 'Nunca',
  },
  actions: {
    delete: 'Eliminar',
    restore: 'Restaurar',
    selfBlocked: 'No puedes modificar tu propio acceso desde aquí.',
  },
  toast: {
    roleUpdated: 'Rol actualizado.',
    activated: 'Usuario activado.',
    deactivated: 'Usuario desactivado.',
    deleted: 'Usuario eliminado.',
    restored: 'Usuario restaurado.',
    inviteSent: (email: string) => `Invitación enviada a ${email}.`,
    error: 'Ocurrió un problema. Intenta de nuevo.',
    selfBlocked: 'No puedes modificar tu propio acceso desde aquí.',
    lastAdmin: 'No puedes degradar, desactivar ni eliminar al último administrador activo.',
    rateLimited: 'Demasiadas invitaciones recientes. Espera unos minutos e intenta de nuevo.',
    alreadyInvited: 'Esta persona ya tiene cuenta o invitación pendiente.',
    invalidEmail: 'Correo inválido.',
    forbidden: 'Solo administración puede invitar usuarios.',
    partialRoleUpdate:
      'Invitación enviada, pero no se pudo asignar el rol de admin. Cámbialo manualmente desde la lista.',
  },
  inviteDialog: {
    title: 'Invitar nuevo usuario',
    description:
      'Se enviará un correo con un enlace para definir contraseña. La cuenta queda activa una vez que la persona acepte.',
    emailLabel: 'Correo',
    emailPlaceholder: 'persona@empresa.com',
    fullNameLabel: 'Nombre',
    fullNamePlaceholder: 'Nombre completo (opcional)',
    roleLabel: 'Rol',
    adminWarning:
      'Este rol concede acceso total: cancelar notas, gestionar usuarios, ajustar inventario y catálogo.',
    submit: 'Enviar invitación',
    submitting: 'Enviando…',
    cancel: 'Cancelar',
    errors: {
      emailRequired: 'El correo es obligatorio.',
      emailFormat: 'Correo inválido.',
    },
  },
  demoteDialog: {
    title: '¿Quitar permisos de administrador?',
    body: (name: string) =>
      `${name} pasará a rol "ventas" y dejará de poder cancelar notas, gestionar usuarios o ajustar inventario.`,
    confirm: 'Cambiar a ventas',
    cancel: 'Cancelar',
  },
  deleteDialog: {
    title: '¿Eliminar usuario?',
    body: (name: string) =>
      `${name} dejará de aparecer en la lista. Solo administración puede restaurarlo desde el filtro "Mostrar eliminados".`,
    confirm: 'Eliminar',
    cancel: 'Cancelar',
  },
} as const
