import { describe, expect, it } from 'vitest';
import {
  FIREBASE_CONFIG_KEYS,
  getAuthErrorMessage,
  readFirebaseConfig,
} from '../src/auth/config.js';

describe('configuración pública de Firebase', () => {
  it('lee y limpia la configuración web del entorno', () => {
    const result = readFirebaseConfig({
      VITE_FIREBASE_API_KEY: ' api-key ',
      VITE_FIREBASE_AUTH_DOMAIN: 'ledger.firebaseapp.com ',
      VITE_FIREBASE_PROJECT_ID: ' ledger ',
      VITE_FIREBASE_APP_ID: ' app-id ',
    });

    expect(result).toEqual({
      config: {
        apiKey: 'api-key',
        authDomain: 'ledger.firebaseapp.com',
        projectId: 'ledger',
        appId: 'app-id',
      },
      missingKeys: [],
    });
  });

  it('identifica valores ausentes sin activar un modo que omita el login', () => {
    const result = readFirebaseConfig({
      VITE_FIREBASE_API_KEY: 'api-key',
      VITE_FIREBASE_PROJECT_ID: '',
    });

    expect(result.missingKeys).toEqual(['authDomain', 'projectId', 'appId']);
    expect(result.missingKeys).toHaveLength(FIREBASE_CONFIG_KEYS.length - 1);
  });

  it('muestra errores de autenticación conocidos sin filtrar detalles internos', () => {
    expect(getAuthErrorMessage({ code: 'auth/unauthorized-domain' }))
      .toContain('dominio no está autorizado');
    expect(getAuthErrorMessage({ code: 'auth/network-request-failed' }))
      .toContain('No hay conexión');
    expect(getAuthErrorMessage({ code: 'auth/unexpected' }))
      .toContain('No se pudo iniciar sesión');
  });
});
