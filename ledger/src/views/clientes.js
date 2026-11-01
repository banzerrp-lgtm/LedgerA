import { renderFormularioCliente, obtenerDatosCliente } from '../components/formulario-cliente.js';
import { createRecord, getRecords, restoreRecord, softDeleteRecord, updateRecord } from '../db/db.js';
import { countClientJobs } from '../db/papelera.js';
import { getCustomerBalanceSummaries } from '../db/pedidos.js';
import { buscarClienteDuplicado, normalizarTelefono } from '../logic/clientes.js';
import { formatSuggestedPrice } from '../logic/tipos-trabajo.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function renderClientes() {
  return `
    <section aria-labelledby="clients-title">
      <div class="client-toolbar">
        <h2 id="clients-title">Clientes</h2>
        <button class="primary-button" type="button" data-action="new-client" aria-expanded="false">
          + Nuevo cliente
        </button>
      </div>
      ${renderFormularioCliente()}
      <label class="settings-field">
        Buscar por nombre o teléfono
        <input class="client-search" id="client-search" type="search" autocomplete="off"
          placeholder="Escribe un nombre o teléfono" />
      </label>
      <p class="client-feedback" id="client-list-feedback" role="status">Cargando clientes…</p>
      <div class="client-list" id="client-list"></div>
      <div class="client-undo" id="client-undo" role="status" hidden>
        <span id="client-undo-message">Cliente enviado a la papelera.</span>
        <button class="secondary-button" type="button" data-action="undo-delete">Deshacer</button>
      </div>
    </section>
  `;
}

export function mountClientes(root) {
  const form = root.querySelector('#client-form');
  const list = root.querySelector('#client-list');
  const search = root.querySelector('#client-search');
  const feedback = root.querySelector('#client-list-feedback');
  const warning = root.querySelector('#client-duplicate-warning');
  const newButton = root.querySelector('[data-action="new-client"]');
  const undoPanel = root.querySelector('#client-undo');
  const undoMessage = root.querySelector('#client-undo-message');
  let clients = [];
  let balancesByClientId = new Map();
  let currencySymbol = 'Bs';
  let editingId = null;
  let recentlyDeletedId = null;
  let undoTimer;

  function showForm(client = null) {
    editingId = client?.id ?? null;
    form.reset();
    form.elements.nombre.value = client?.nombre ?? '';
    form.elements.codigo_pais.value = client?.codigo_pais ?? '+591';
    form.elements.telefono.value = client?.telefono ?? '';
    form.elements.notas.value = client?.notas ?? '';
    root.querySelector('#client-form-title').textContent = client ? 'Editar cliente' : 'Nuevo cliente';
    form.hidden = false;
    warning.hidden = true;
    warning.textContent = '';
    newButton.setAttribute('aria-expanded', 'true');
    form.elements.nombre.focus();
  }

  function hideForm() {
    form.hidden = true;
    editingId = null;
    newButton.setAttribute('aria-expanded', 'false');
    warning.hidden = true;
    warning.textContent = '';
  }

  function renderList() {
    const query = search.value.trim().toLocaleLowerCase('es');
    const queryDigits = normalizarTelefono(query);
    const visibleClients = clients.filter((client) =>
      client.nombre.toLocaleLowerCase('es').includes(query)
      || (queryDigits && normalizarTelefono(client.telefono).includes(queryDigits)),
    );

    feedback.hidden = visibleClients.length > 0;
    feedback.textContent = query
      ? 'No se encontraron clientes con esa búsqueda.'
      : 'Todavía no hay clientes. Agrega el primero.';
    list.innerHTML = visibleClients.map((client) => `
      <article class="client-card">
        <div>
          <h3>${escapeHtml(client.nombre)}</h3>
          <p>${escapeHtml(client.codigo_pais)} ${escapeHtml(client.telefono)}</p>
          ${client.notas ? `<p>${escapeHtml(client.notas)}</p>` : ''}
          ${(balancesByClientId.get(client.id)?.saldo_a_favor ?? 0) > 0
            ? `<p>Saldo a favor: ${escapeHtml(currencySymbol)} ${formatSuggestedPrice(balancesByClientId.get(client.id).saldo_a_favor).replace(/^Bs\s*/, '')}</p>`
            : ''}
        </div>
        <div class="client-actions">
          <a class="secondary-button button-link" href="#/cliente/${encodeURIComponent(client.id)}">Ver ficha</a>
          <button class="secondary-button" type="button" data-action="edit-client" data-id="${escapeHtml(client.id)}">
            Editar
          </button>
          <button class="danger-button" type="button" data-action="delete-client" data-id="${escapeHtml(client.id)}">
            Eliminar
          </button>
        </div>
      </article>
    `).join('');
  }

  async function loadClients() {
    feedback.hidden = false;
    feedback.textContent = 'Cargando clientes…';
    try {
      const [savedClients, balanceData] = await Promise.all([
        getRecords('clientes'),
        getCustomerBalanceSummaries(),
      ]);
      clients = savedClients;
      currencySymbol = balanceData.simboloMoneda;
      balancesByClientId = new Map(balanceData.clientes.map((client) => [client.id, client]));
      renderList();
    } catch (error) {
      console.error('No se pudieron cargar los clientes.', error);
      feedback.hidden = false;
      feedback.textContent = 'No se pudieron cargar los clientes. Inténtalo de nuevo.';
      feedback.setAttribute('role', 'alert');
    }
  }

  form.addEventListener('input', () => {
    const candidate = obtenerDatosCliente(form);
    const duplicate = candidate.telefono.length >= 5
      ? buscarClienteDuplicado(clients, candidate, editingId)
      : undefined;

    warning.hidden = !duplicate;
    warning.classList.toggle('client-feedback--warning', Boolean(duplicate));
    warning.textContent = duplicate
      ? 'Ya existe un cliente con este código de país y teléfono.'
      : '';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const candidate = obtenerDatosCliente(form);
    if (!candidate.nombre || candidate.telefono.length < 5 || !candidate.codigo_pais) {
      warning.hidden = false;
      warning.classList.add('client-feedback--warning');
      warning.textContent = 'Completa el nombre, el código de país y un teléfono válido.';
      return;
    }

    const duplicate = buscarClienteDuplicado(clients, candidate, editingId);
    if (duplicate && !window.confirm(
      `Ya existe ${duplicate.nombre} con ese código y teléfono. ¿Quieres guardar el cliente de todas formas?`,
    )) {
      return;
    }

    try {
      if (editingId) {
        await updateRecord('clientes', editingId, candidate);
      } else {
        await createRecord('clientes', candidate);
      }
      hideForm();
      await loadClients();
    } catch (error) {
      console.error('No se pudo guardar el cliente.', error);
      warning.hidden = false;
      warning.classList.add('client-feedback--warning');
      warning.textContent = 'No se pudo guardar el cliente. Comprueba los datos e inténtalo de nuevo.';
      warning.setAttribute('role', 'alert');
    }
  });

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    if (button.dataset.action === 'new-client') {
      if (form.hidden) showForm();
      else hideForm();
      return;
    }
    if (button.dataset.action === 'cancel-form') {
      hideForm();
      return;
    }
    if (button.dataset.action === 'edit-client') {
      const client = clients.find(({ id }) => id === button.dataset.id);
      if (client) showForm(client);
      return;
    }
    if (button.dataset.action === 'delete-client') {
      try {
        const client = clients.find(({ id }) => id === button.dataset.id);
        const affectedJobs = await countClientJobs(button.dataset.id);
        const warning = affectedJobs
          ? ` Esto afecta a ${affectedJobs} ${affectedJobs === 1 ? 'trabajo' : 'trabajos'}; se conservarán en sus pedidos.`
          : '';
        if (!window.confirm(`¿Enviar a la papelera a ${client?.nombre ?? 'este cliente'}?${warning}`)) return;
        await softDeleteRecord('clientes', button.dataset.id);
        recentlyDeletedId = button.dataset.id;
        undoMessage.textContent = `${client?.nombre ?? 'Cliente'} enviado a la papelera.${warning}`;
        undoPanel.hidden = false;
        window.clearTimeout(undoTimer);
        undoTimer = window.setTimeout(() => {
          undoPanel.hidden = true;
          recentlyDeletedId = null;
        }, 5000);
        await loadClients();
      } catch (error) {
        console.error('No se pudo enviar el cliente a la papelera.', error);
        feedback.hidden = false;
        feedback.textContent = 'No se pudo eliminar el cliente. Inténtalo de nuevo.';
        feedback.setAttribute('role', 'alert');
      }
      return;
    }
    if (button.dataset.action === 'undo-delete' && recentlyDeletedId) {
      try {
        await restoreRecord('clientes', recentlyDeletedId);
        recentlyDeletedId = null;
        window.clearTimeout(undoTimer);
        undoPanel.hidden = true;
        await loadClients();
      } catch (error) {
        console.error('No se pudo restaurar el cliente.', error);
        undoMessage.textContent = 'No se pudo deshacer. Inténtalo de nuevo.';
        undoPanel.setAttribute('role', 'alert');
      }
    }
  });

  search.addEventListener('input', renderList);
  loadClients();
}
