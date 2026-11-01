import logoUrl from '../../assets/logo-ledger-provisional.png';
import { FIREBASE_CONFIG_KEYS, getAuthErrorMessage } from '../auth/config.js';

const configLabels = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function renderLogin({ configured = true, loading = false, error = '' } = {}) {
  const configurationMessage = !configured
    ? `
      <div class="auth-setup" role="alert">
        <strong>Falta conectar Firebase.</strong>
        <p>Completa las variables de configuración y vuelve a compilar la app:</p>
        <ul>${FIREBASE_CONFIG_KEYS.map((key) => `<li><code>${configLabels[key]}</code></li>`).join('')}</ul>
        <p>Usa <code>.env.example</code> como referencia. No pegues credenciales privadas en archivos versionados.</p>
      </div>
    `
    : '';
  return `
    <main class="auth-screen">
      <section class="panel auth-card">
        <img class="auth-logo" src="${logoUrl}" alt="" />
        <h1>Ledger</h1>
        <p class="muted">Agenda tus encargos con seguridad.</p>
        ${configurationMessage}
        ${error ? `<p class="auth-feedback" role="alert">${escapeHtml(error)}</p>` : ''}
        ${configured ? `
          <button class="primary-button auth-google-button" type="button" data-google-sign-in
            ${loading ? 'disabled' : ''}>
            ${loading ? 'Comprobando sesión…' : 'Continuar con Google'}
          </button>
          <p class="auth-privacy-note">Solo solicitamos los datos básicos de tu perfil de Google.</p>
        ` : ''}
      </section>
    </main>
  `;
}

export function mountLogin(root, { onSignIn } = {}) {
  const button = root.querySelector('[data-google-sign-in]');
  if (!button) return;
  const feedback = root.querySelector('.auth-feedback');

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Conectando con Google…';
    feedback?.remove();
    try {
      await onSignIn();
    } catch (error) {
      console.error('No se pudo iniciar sesión con Google.', error);
      button.disabled = false;
      button.textContent = 'Continuar con Google';
      const notice = document.createElement('p');
      notice.className = 'auth-feedback';
      notice.setAttribute('role', 'alert');
      notice.textContent = getAuthErrorMessage(error);
      button.before(notice);
    }
  });
}
