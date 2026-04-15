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
    forgotPasswordLink: '¿Olvidaste tu contraseña?',
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
  updatePassword: {
    titles: {
      invite: 'Bienvenido a ProsesaOS',
      recovery: 'Restablece tu contraseña',
      change: 'Actualiza tu contraseña',
    },
    descriptions: {
      invite:
        'Define una contraseña para tu cuenta. La usarás para iniciar sesión de ahora en adelante.',
      recovery: 'Escribe tu nueva contraseña dos veces para confirmar.',
      change: 'Escribe una nueva contraseña dos veces para confirmar.',
    },
    passwordLabel: 'Nueva contraseña',
    passwordPlaceholder: '••••••••',
    confirmLabel: 'Confirma la contraseña',
    submit: 'Guardar contraseña',
    submitting: 'Guardando…',
    success: 'Contraseña actualizada',
    invalidLink: {
      title: 'Enlace no válido',
      description:
        'Este enlace ya se usó o expiró. Vuelve a iniciar sesión o solicita un nuevo correo de recuperación.',
      backToLogin: 'Volver al inicio de sesión',
    },
    errors: {
      minLength: 'La contraseña debe tener al menos 6 caracteres.',
      mismatch: 'Las contraseñas no coinciden.',
      samePassword: 'La nueva contraseña debe ser diferente a la anterior.',
      weakPassword: 'La contraseña no cumple con los requisitos mínimos.',
      rateLimited: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
      network: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
      generic: 'No pudimos actualizar la contraseña. Intenta de nuevo.',
    },
  },
  forgotPassword: {
    title: 'Recupera tu contraseña',
    description: 'Te enviaremos un correo con un enlace para que definas una nueva contraseña.',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'tucorreo@prosesa.com.mx',
    submit: 'Enviar correo',
    submitting: 'Enviando…',
    // Neutral success copy — we don't confirm whether the email exists, to
    // avoid leaking which addresses have accounts.
    success: 'Si la cuenta existe, recibirás un correo con instrucciones en los próximos minutos.',
    backToLogin: 'Volver al inicio de sesión',
    errors: {
      invalidEmail: 'Ingresa un correo válido.',
      rateLimited: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
      network: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
      generic: 'No pudimos enviar el correo. Intenta de nuevo.',
    },
  },
  routeGuards: {
    adminOnly: 'No tienes permiso para acceder a esta sección.',
  },
} as const

export type AuthFlow = 'invite' | 'recovery' | 'change'
