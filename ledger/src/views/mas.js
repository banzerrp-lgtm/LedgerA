import packageJson from '../../package.json';
import { renderIcon } from '../components/icons.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function renderLinks(title, links) {
  return `
    <section class="more-group" aria-labelledby="${title.toLowerCase()}-title">
      <h2 id="${title.toLowerCase()}-title">${title}</h2>
      <nav class="more-links card" aria-label="${title}">
        ${links.map(({ label, href, icon }) => `
          <a href="${href}">
            <span class="more-link-icon">${renderIcon(icon)}</span>
            <span>${label}</span>
            ${renderIcon('chevron-right', 'more-link-chevron')}
          </a>
        `).join('')}
      </nav>
    </section>
  `;
}

export function renderMas({ user } = {}) {
  const email = user?.email ?? '';
  const initial = email.trim().charAt(0).toLocaleUpperCase('es') || 'L';
  return `
    <section class="account-card card" aria-label="Cuenta">
      <span class="account-avatar account-card-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
      <span class="account-card-email">${escapeHtml(email)}</span>
      <button class="account-signout" type="button" data-auth-signout>
        ${renderIcon('log-out')}<span>Cerrar sesión</span>
      </button>
    </section>
    ${renderLinks('Gestión', [
      { label: 'Clientes', href: '#/clientes', icon: 'users' },
      { label: 'Tipos de trabajo', href: '#/tipos-trabajo', icon: 'tags' },
    ])}
    ${renderLinks('Análisis', [
      { label: 'Terminados y portafolio', href: '#/terminados', icon: 'check-circle' },
      { label: 'Estadísticas', href: '#/estadisticas', icon: 'bar-chart' },
    ])}
    ${renderLinks('Sistema', [
      { label: 'Papelera', href: '#/papelera', icon: 'trash' },
      { label: 'Ajustes', href: '#/ajustes', icon: 'settings' },
    ])}
    <p class="app-version">Ledger v${escapeHtml(packageJson.version)} · by One</p>
  `;
}
