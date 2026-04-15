// UI copy for the auth feature. Kept in one file per CLAUDE.md §5 so the
// strings can be lifted into an i18n system later without touching components.

export const authMessages = {
  login: {
    title: 'Iniciar sesión',
    description: 'Accede con tu correo y contraseña de Prosesa.',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'tucorreo@prosesa.com.mx',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: '••••••••',
    submit: 'Entrar',
    submitting: 'Entrando…',
    success: 'Sesión iniciada',
    errors: {
      invalidEmail: 'Ingresa un correo válido.',
      passwordRequired: 'Ingresa tu contraseña.',
      invalidCredentials: 'Correo o contraseña incorrectos.',
      emailNotConfirmed: 'Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada.',
      rateLimited: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
      network: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
      generic: 'Ocurrió un error al iniciar sesión. Intenta de nuevo.',
    },
  },
  logout: {
    action: 'Cerrar sesión',
    success: 'Sesión cerrada',
    error: 'No se pudo cerrar la sesión. Intenta de nuevo.',
  },
  routeGuards: {
    adminOnly: 'No tienes permiso para acceder a esta sección.',
  },
} as const
