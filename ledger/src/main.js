import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/inter';
import { initializeDatabase } from './db/db.js';
import { getAuthErrorMessage, readFirebaseConfig } from './auth/config.js';
import { createRouter } from './router.js';
import { renderIcon } from './components/icons.js';
import { mountAjustes, renderAjustes } from './views/ajustes.js';
import { mountClientes, renderClientes } from './views/clientes.js';
import { mountDeudores, renderDeudores } from './views/deudores.js';
import { mountEncargos, renderEncargos } from './views/encargos.js';
import { mountEstadisticas, renderEstadisticas } from './views/estadisticas.js';
import { mountFichaCliente, renderFichaCliente } from './views/ficha-cliente.js';
import { mountInicio, renderInicio } from './views/inicio.js';
import { mountLogin, renderLogin } from './views/login.js';
import { renderMas } from './views/mas.js';
import { mountPapelera, renderPapelera } from './views/papelera.js';
import { mountTerminados, renderTerminados } from './views/terminados.js';
import { mountTiposTrabajo, renderTiposTrabajo } from './views/tipos-trabajo.js';

const app = document.querySelector('#app');
let updateServiceWorker = async () => {};
let firebaseAuth;
let firebaseAuthApi;
let signedInUser;
let stopRouter;
let authGeneration = 0;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function renderSignedOut(options = {}) {
  app.innerHTML = renderLogin(options);
  mountLogin(app, {
    onSignIn: () => firebaseAuthApi.signInWithGoogle(firebaseAuth),
  });
}

function showUpdateNotice(updateServiceWorker) {
  let notice = document.querySelector('#pwa-update-notice');
  if (!notice) {
    notice = document.createElement('aside');
    notice.id = 'pwa-update-notice';
    notice.className = 'pwa-update-notice';
    notice.setAttribute('role', 'status');
    notice.innerHTML = `
      <span>Hay una versión nueva, toca para actualizar</span>
      <button class="primary-button" type="button" data-pwa-update>Actualizar</button>
      <button class="secondary-button" type="button" data-pwa-dismiss aria-label="Cerrar aviso">Ahora no</button>
    `;
    document.body.append(notice);
    notice.addEventListener('click', async (event) => {
      if (event.target.closest('[data-pwa-dismiss]')) {
        notice.remove();
        return;
      }
      if (!event.target.closest('[data-pwa-update]')) return;
      const button = notice.querySelector('[data-pwa-update]');
      button.disabled = true;
      try {
        await updateServiceWorker(true);
      } catch (error) {
        console.error('No se pudo instalar la actualización de Ledger.', error);
        notice.querySelector('span').textContent =
          'No se pudo actualizar. Comprueba tu conexión e inténtalo de nuevo.';
        button.disabled = false;
      }
    });
  }
}

updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    showUpdateNotice(updateServiceWorker);
  },
  onRegisterError(error) {
    console.error('No se pudo registrar el service worker de Ledger.', error);
  },
});

const pages = {
  inicio: { title: 'Inicio', render: renderInicio },
  encargos: { title: 'Encargos', render: renderEncargos },
  'nuevo-encargo': { title: 'Nuevo encargo', render: () => renderEncargos({ mode: 'form' }) },
  deudores: { title: 'Deudores', render: renderDeudores },
  mas: { title: 'Más', render: renderMas },
  ajustes: { title: 'Ajustes', render: renderAjustes },
  clientes: { title: 'Clientes', render: renderClientes },
  'tipos-trabajo': { title: 'Tipos de trabajo', render: renderTiposTrabajo },
  papelera: { title: 'Papelera', render: renderPapelera },
  terminados: { title: 'Terminados y portafolio', render: renderTerminados },
  estadisticas: { title: 'Estadísticas', render: renderEstadisticas },
};

const storedTheme = localStorage.getItem('ledger-theme');
let themePreference = ['auto', 'claro', 'oscuro'].includes(storedTheme)
  ? storedTheme
  : 'auto';

function applyTheme() {
  const theme = themePreference === 'oscuro' ? 'dark' : themePreference === 'claro' ? 'light' : 'auto';
  document.documentElement.dataset.theme = theme;
}

function renderPage(route) {
  const page = pages[route] ?? (route.startsWith('encargo/')
    ? { title: 'Detalle del pedido', render: () => '' }
    : route.startsWith('cliente/')
      ? { title: 'Ficha del cliente', render: renderFichaCliente }
      : pages.inicio);
  const selectedTab = ['ajustes', 'clientes', 'tipos-trabajo', 'papelera', 'terminados', 'estadisticas'].includes(route)
    ? 'mas'
    : ['nuevo-encargo'].includes(route) || route.startsWith('encargo/')
      ? 'encargos'
      : route;
  const isNewOrderAvailable = route === 'inicio' || route === 'encargos';
  const themeIcon = { auto: 'monitor', claro: 'sun', oscuro: 'moon' }[themePreference];
  const themeLabel = { auto: 'Automático', claro: 'Claro', oscuro: 'Oscuro' }[themePreference];
  const userEmail = signedInUser?.email ?? '';
  const userInitial = userEmail.trim().charAt(0).toLocaleUpperCase('es') || 'L';
  app.innerHTML = `
    <div class="app-shell${isNewOrderAvailable ? ' app-shell--with-fab' : ''}">
      <header class="app-header">
        <a class="brand" href="#/inicio" aria-label="Ledger, ir a Inicio">
          <img class="brand-logo" src="/icons/logo-header-transparente.png" alt="" />
          <span class="brand-text"><span class="brand-name">Ledger</span><span class="brand-sub">by One</span></span>
        </a>
        <div class="header-actions">
          <button class="icon-btn" type="button" data-theme-cycle
            aria-label="Cambiar tema. Tema actual: ${themeLabel}" title="Tema: ${themeLabel}">
            ${renderIcon(themeIcon)}
          </button>
          <div class="account-menu">
            <button class="avatar-btn" type="button" data-account-toggle
              aria-label="Cuenta de ${escapeHtml(userEmail)}" aria-expanded="false"
              aria-controls="account-popover">${escapeHtml(userInitial)}</button>
            <div class="account-popover" id="account-popover" hidden>
              <span class="account-email">${escapeHtml(userEmail)}</span>
              <button class="account-signout" type="button" data-auth-signout>
                ${renderIcon('log-out')}<span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main class="page-content" id="page-content">${page.render({ user: signedInUser })}</main>
      ${isNewOrderAvailable ? `
        <a class="fab" href="#/encargos/nuevo" data-action="new-order">
          ${renderIcon('plus')}<span>Nuevo encargo</span>
        </a>
      ` : ''}
      <nav class="bottom-nav" aria-label="Navegación principal">
        <a href="#/inicio" class="bottom-nav-item${selectedTab === 'inicio' ? ' is-active' : ''}"
          ${selectedTab === 'inicio' ? 'aria-current="page"' : ''}>
          <span class="nav-icon">${renderIcon('home')}</span><span>Inicio</span>
        </a>
        <a href="#/encargos" class="bottom-nav-item${selectedTab === 'encargos' ? ' is-active' : ''}"
          ${selectedTab === 'encargos' ? 'aria-current="page"' : ''}>
          <span class="nav-icon">${renderIcon('clipboard-list')}</span><span>Encargos</span>
        </a>
        <a href="#/deudores" class="bottom-nav-item${selectedTab === 'deudores' ? ' is-active' : ''}"
          ${selectedTab === 'deudores' ? 'aria-current="page"' : ''}>
          <span class="nav-icon">${renderIcon('wallet')}</span><span>Deudores</span>
        </a>
        <a href="#/mas" class="bottom-nav-item${selectedTab === 'mas' ? ' is-active' : ''}"
          ${selectedTab === 'mas' ? 'aria-current="page"' : ''}>
          <span class="nav-icon">${renderIcon('layout-grid')}</span><span>Más</span>
        </a>
      </nav>
    </div>
  `;
  if (route === 'clientes') {
    mountClientes(document.querySelector('#page-content'));
  }
  if (route === 'ajustes') {
    mountAjustes(document.querySelector('#page-content'));
  }
  if (route === 'tipos-trabajo') {
    mountTiposTrabajo(document.querySelector('#page-content'));
  }
  if (route === 'papelera') {
    mountPapelera(document.querySelector('#page-content'));
  }
  if (route === 'terminados') {
    mountTerminados(document.querySelector('#page-content'));
  }
  if (route === 'estadisticas') {
    mountEstadisticas(document.querySelector('#page-content'));
  }
  if (route === 'inicio') {
    mountInicio(document.querySelector('#page-content'));
  }
  if (route === 'deudores') {
    mountDeudores(document.querySelector('#page-content'));
  }
  if (route.startsWith('cliente/')) {
    mountFichaCliente(document.querySelector('#page-content'), route.slice('cliente/'.length));
  }
  if (route === 'encargos' || route === 'nuevo-encargo' || route.startsWith('encargo/')) {
    mountEncargos(document.querySelector('#page-content'), { route });
  }
}

applyTheme();

app.addEventListener('change', (event) => {
  if (event.target.matches('#theme-preference')) setThemePreference(event.target.value);
});

function setThemePreference(preference) {
  if (!['auto', 'claro', 'oscuro'].includes(preference)) return;
  themePreference = preference;
  localStorage.setItem('ledger-theme', themePreference);
  applyTheme();
  const control = app.querySelector('[data-theme-cycle]');
  if (control) {
    const icon = { auto: 'monitor', claro: 'sun', oscuro: 'moon' }[themePreference];
    const label = { auto: 'Automático', claro: 'Claro', oscuro: 'Oscuro' }[themePreference];
    control.innerHTML = renderIcon(icon);
    control.setAttribute('aria-label', `Cambiar tema. Tema actual: ${label}`);
    control.title = `Tema: ${label}`;
  }
  app.querySelectorAll('[data-theme-choice]').forEach((button) => {
    const isSelected = button.dataset.themeChoice === themePreference;
    button.setAttribute('aria-pressed', String(isSelected));
  });
}

app.addEventListener('click', (event) => {
  const themeChoice = event.target.closest('[data-theme-choice]');
  if (themeChoice) {
    setThemePreference(themeChoice.dataset.themeChoice);
  }
  const themeCycle = event.target.closest('[data-theme-cycle]');
  if (themeCycle) {
    const preferences = ['auto', 'claro', 'oscuro'];
    const next = preferences[(preferences.indexOf(themePreference) + 1) % preferences.length];
    setThemePreference(next);
  }
  const accountToggle = event.target.closest('[data-account-toggle]');
  const accountPopover = app.querySelector('#account-popover');
  if (accountToggle && accountPopover) {
    const isOpening = accountPopover.hidden;
    accountPopover.hidden = !isOpening;
    accountToggle.setAttribute('aria-expanded', String(isOpening));
  } else if (accountPopover && !event.target.closest('.account-menu')) {
    accountPopover.hidden = true;
    app.querySelector('[data-account-toggle]')?.setAttribute('aria-expanded', 'false');
  }
  const signOutButton = event.target.closest('[data-auth-signout]');
  if (signOutButton) {
    signOutButton.disabled = true;
    firebaseAuthApi.signOutFromLedger(firebaseAuth).catch((error) => {
      console.error('No se pudo cerrar la sesión de Ledger.', error);
      signOutButton.disabled = false;
      const notice = document.createElement('p');
      notice.className = 'panel';
      notice.setAttribute('role', 'alert');
      notice.textContent = 'No se pudo cerrar la sesión. Inténtalo de nuevo.';
      document.querySelector('#page-content')?.prepend(notice);
    });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const accountPopover = app.querySelector('#account-popover');
  if (!accountPopover || accountPopover.hidden) return;
  accountPopover.hidden = true;
  app.querySelector('[data-account-toggle]')?.setAttribute('aria-expanded', 'false');
  app.querySelector('[data-account-toggle]')?.focus();
});

function showDatabaseNotice(message, isError = false) {
  const notice = document.createElement('p');
  notice.className = 'panel';
  notice.setAttribute('role', isError ? 'alert' : 'status');
  notice.textContent = message;
  document.querySelector('#page-content')?.prepend(notice);
}

async function showAuthenticatedApp(user) {
  const generation = ++authGeneration;
  signedInUser = user;
  let databaseNotice;
  try {
    const persistentStorageGranted = await initializeDatabase();
    if (!persistentStorageGranted) {
      databaseNotice = {
        message: 'El navegador no garantizó almacenamiento persistente. Puede eliminar datos locales si necesita espacio.',
        isError: false,
      };
    }
  } catch (error) {
    console.error('No se pudo inicializar la base de datos local.', error);
    databaseNotice = {
      message: 'No se pudo abrir la base de datos local. Comprueba el almacenamiento del navegador e inténtalo de nuevo.',
      isError: true,
    };
  }
  if (generation !== authGeneration || signedInUser?.uid !== user.uid) return;
  stopRouter?.();
  stopRouter = createRouter(renderPage);
  if (databaseNotice) showDatabaseNotice(databaseNotice.message, databaseNotice.isError);
}

async function startAuthentication() {
  const { missingKeys } = readFirebaseConfig(import.meta.env);
  if (missingKeys.length) {
    renderSignedOut({ configured: false });
    return;
  }
  try {
    firebaseAuthApi = await import('./auth/firebase.js');
    const initialized = await firebaseAuthApi.initializeLedgerAuth();
    if (!initialized.auth) {
      renderSignedOut({ configured: false });
      return;
    }
    firebaseAuth = initialized.auth;
    renderSignedOut({ configured: true, loading: true });
    firebaseAuthApi.observeLedgerAuth(firebaseAuth, (user) => {
      if (user) {
        void showAuthenticatedApp(user);
        return;
      }
      authGeneration += 1;
      signedInUser = null;
      stopRouter?.();
      stopRouter = undefined;
      renderSignedOut({ configured: true });
    }, (error) => {
      console.error('No se pudo comprobar la sesión de Firebase.', error);
      authGeneration += 1;
      signedInUser = null;
      stopRouter?.();
      stopRouter = undefined;
      renderSignedOut({
        configured: true,
        error: getAuthErrorMessage(error),
      });
    });
  } catch (error) {
    console.error('No se pudo iniciar Firebase Authentication.', error);
    renderSignedOut({
      configured: true,
      error: getAuthErrorMessage(error),
    });
  }
}

void startAuthentication();
