export const FIREBASE_CONFIG_KEYS = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
];

export function readFirebaseConfig(environment) {
  const config = {
    apiKey: environment.VITE_FIREBASE_API_KEY?.trim() ?? '',
    authDomain: environment.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
    projectId: environment.VITE_FIREBASE_PROJECT_ID?.trim() ?? '',
    appId: environment.VITE_FIREBASE_APP_ID?.trim() ?? '',
  };
  const missingKeys = FIREBASE_CONFIG_KEYS.filter((key) => !config[key]);
  return { config, missingKeys };
}

export function getAuthErrorMessage(error) {
  const messages = {
    'auth/account-exists-with-different-credential':
      'Ese correo ya está asociado a otro método de acceso. Contacta con soporte.',
    'auth/cancelled-popup-request': 'Ya hay una ventana de acceso abierta. Termínala o ciérrala.',
    'auth/network-request-failed': 'No hay conexión. Conéctate e inténtalo de nuevo.',
    'auth/operation-not-allowed':
      'El acceso con Google aún no está activado en el proyecto Firebase.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana. Permite ventanas emergentes para continuar.',
    'auth/popup-closed-by-user': 'Se cerró la ventana antes de completar el acceso.',
    'auth/unauthorized-domain':
      'Este dominio no está autorizado en Firebase Authentication.',
    'auth/web-storage-unsupported':
      'Este navegador no permite guardar la sesión de forma segura.',
  };
  return messages[error?.code]
    ?? 'No se pudo iniciar sesión. Revisa la configuración y vuelve a intentarlo.';
}
