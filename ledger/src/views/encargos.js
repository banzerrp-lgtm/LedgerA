import { renderFormularioCliente, obtenerDatosCliente } from '../components/formulario-cliente.js';
import { mountSelectorTipo, renderSelectorTipo } from '../components/selector-tipo.js';
import { createRecord, getRecords, restoreRecord, softDeleteRecord } from '../db/db.js';
import { softDeleteLineAndPayments, softDeleteOrder } from '../db/papelera.js';
import { saveLineChange, saveLineLocation } from '../db/historial.js';
import {
  cancelOrderLine,
  createOrderWithLines,
  getLineCancellationRefund,
  getOrderDetail,
  getOrderSummaries,
  updateLineDeliveryDate,
  updateLineStatus,
} from '../db/pedidos.js';
import { savePaymentFromForm } from '../db/pagos.js';
import { buscarClienteDuplicado } from '../logic/clientes.js';
import { formatSuggestedPrice, parseSuggestedPrice } from '../logic/tipos-trabajo.js';
import { renderEstadoVacio } from '../components/estadoVacio.js';
import { validarPedido } from '../logic/validaciones.js';

const ORDER_STATES = [
  ['pendiente', 'Pendiente'],
  ['en_proceso', 'En proceso'],
  ['entregado', 'Entregado'],
  ['cancelado', 'Cancelado'],
];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value) {
  if (!value) return 'Sin fecha';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function decimalPrice(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) return '';
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function formatMoney(cents, currencySymbol) {
  const sign = cents < 0 ? '- ' : '';
  return `${sign}${currencySymbol} ${formatSuggestedPrice(Math.abs(cents)).replace(/^Bs\s*/, '')}`;
}

function renderOrderLine(index, deliveryDate) {
  return `
    <fieldset class="order-line" data-order-line>
      <legend>Línea ${index + 1}</legend>
      <div class="order-line-fields">
        ${renderSelectorTipo({ name: `tipo_linea_${index}`, label: 'Tipo de trabajo' })}
        <label>
          Título del trabajo
          <input name="titulo" type="text" maxlength="240" required data-line-field="titulo" />
        </label>
        <label>
          Precio acordado (Bs)
          <input class="order-line-price" name="precio" type="text"
            inputmode="decimal" placeholder="0,00" required data-line-field="precio" />
        </label>
        <label>
          Fecha de entrega
          <input name="fecha_entrega" type="date" value="${escapeHtml(deliveryDate)}"
            data-date-value="${escapeHtml(deliveryDate)}" required data-line-field="fecha_entrega" />
        </label>
        <label>
          Hora (opcional)
          <input name="hora_entrega" type="time" data-line-field="hora_entrega" />
        </label>
        <label>
          Nota de descuento (opcional)
          <textarea name="nota_descuento" maxlength="500"></textarea>
        </label>
      </div>
      ${index ? '<button class="danger-button" type="button" data-order-action="remove-line">Quitar línea</button>' : ''}
    </fieldset>
  `;
}

export function renderEncargos({ mode = 'list' } = {}) {
  if (mode === 'form') {
    const today = localDateString();
    return `
      <section>
        <form class="order-form" id="order-form" novalidate>
          <section class="panel order-section">
            <h2>Datos del pedido</h2>
            <label>
              Cliente
              <select id="order-client" name="cliente_id" required>
                <option value="">Cargando clientes…</option>
              </select>
            </label>
            <button class="secondary-button" type="button" data-order-action="new-client">
              + Nuevo cliente
            </button>
            <label>
              Fecha general de entrega (opcional)
              <input id="order-general-date" name="fecha_entrega_general" type="date" />
            </label>
            <label>
              Modalidad de pago
              <select name="modalidad_pago" required>
                <option value="contra_entrega">Contra entrega</option>
                <option value="adelanto">Con adelanto</option>
                <option value="completo_inicio">Completo al inicio</option>
              </select>
            </label>
            <label>
              Adelanto acordado (Bs)
              <input name="adelanto" type="text" inputmode="decimal" placeholder="0,00" />
            </label>
            <label>
              Notas del pedido (opcional)
              <textarea name="notas" maxlength="1000"></textarea>
            </label>
          </section>
          <section class="order-section">
            <h2>Líneas de trabajo</h2>
            <div id="order-lines"></div>
            <button class="secondary-button" type="button" data-order-action="add-line">
              + Agregar otra línea
            </button>
          </section>
          <p class="order-feedback" id="order-feedback" role="status" hidden></p>
          <div class="client-form-actions">
            <button class="primary-button" type="submit">Guardar pedido</button>
            <a class="secondary-button button-link" href="#/encargos">Cancelar</a>
          </div>
        </form>
        <div id="order-client-form">${renderFormularioCliente({}, { idPrefix: 'order-client' })}</div>
      </section>
    `;
  }

  return `
    <section>
      <div class="order-list-toolbar">
        <h1 class="page-title">Encargos</h1>
      </div>
      <p class="order-feedback" id="order-feedback" role="status">Cargando encargos…</p>
      <div class="order-list" id="order-list"></div>
    </section>
  `;
}

function renderOrderDetail(detail) {
  const { pedido, cliente, lineas, pagos, total, pagado, saldo, simboloMoneda } = detail;
  return `
    <section>
      <a class="back-link" href="#/encargos">‹ Encargos</a>
      <div class="order-detail-heading">
        <h2>Pedido</h2>
        <p>${escapeHtml(cliente?.nombre ?? 'Cliente no disponible')}</p>
        <p class="muted">Recibido: ${displayDate(pedido.fecha_pedido)}</p>
        <p class="muted">Pago: ${escapeHtml(pedido.modalidad_pago.replace(/_/g, ' '))}</p>
        ${pedido.adelanto_acordado ? `<p class="muted">Adelanto acordado: ${escapeHtml(simboloMoneda)} ${formatSuggestedPrice(pedido.adelanto_acordado).replace(/^Bs\s*/, '')}</p>` : ''}
        ${pedido.notas ? `<p class="muted">${escapeHtml(pedido.notas)}</p>` : ''}
        <p><strong>Total: ${escapeHtml(formatMoney(total, simboloMoneda))}</strong></p>
        <p>Pagado: ${escapeHtml(formatMoney(pagado, simboloMoneda))}</p>
        <p><strong>${saldo < 0 ? 'Saldo a favor' : 'Saldo'}: ${escapeHtml(formatMoney(Math.abs(saldo), simboloMoneda))}</strong></p>
        <button class="primary-button" type="button" data-payment-new>Registrar pago</button>
        <button class="danger-button" type="button" data-order-delete>Enviar pedido a la papelera</button>
      </div>
      <div class="order-lines-detail">
        ${lineas.map((line) => `
          <article class="panel order-detail-line">
            <h3>${escapeHtml(line.tipo?.nombre ?? 'Tipo no disponible')}${line.descripcion ? ` · ${escapeHtml(line.descripcion)}` : ''}</h3>
            <p>${escapeHtml(simboloMoneda)} ${formatSuggestedPrice(line.precio_acordado).replace(/^Bs\s*/, '')}</p>
            ${line.nota_descuento ? `<p class="muted">${escapeHtml(line.nota_descuento)}</p>` : ''}
            <label>
              Entrega
              <input type="date" value="${escapeHtml(line.fecha_entrega)}"
                data-line-date="${escapeHtml(line.id)}" />
            </label>
            ${line.hora_entrega ? `<p class="muted">Hora: ${escapeHtml(line.hora_entrega)}</p>` : ''}
            <label>
              Estado
              <select data-line-status="${escapeHtml(line.id)}">
                ${ORDER_STATES.map(([value, label]) => `
                  <option value="${value}" ${line.estado === value ? 'selected' : ''}>${label}</option>
                `).join('')}
              </select>
            </label>
            <button class="secondary-button" type="button" data-payment-new
              data-line-id="${escapeHtml(line.id)}">Registrar pago de esta línea</button>
            <button class="danger-button" type="button" data-line-delete="${escapeHtml(line.id)}">
              Enviar trabajo a la papelera
            </button>
            <details class="line-history-details">
              <summary>Ubicaciones y cambios (${line.ubicaciones.length + line.cambios.length})</summary>
              <div class="line-history-list">
                <h4>Ubicaciones</h4>
                ${line.ubicaciones.length ? line.ubicaciones.map((location) => `
                  <article class="line-history-entry">
                    <strong>${escapeHtml(location.tipo.toUpperCase())}</strong>
                    <p>${location.url
                      ? `<a href="${escapeHtml(location.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(location.enlace_o_ruta)}</a>`
                      : escapeHtml(location.enlace_o_ruta)}</p>
                    ${location.nota ? `<p class="muted">${escapeHtml(location.nota)}</p>` : ''}
                  </article>
                `).join('') : '<p class="muted">Sin ubicaciones registradas.</p>'}
                <form class="line-history-form" data-location-form="${escapeHtml(line.id)}">
                  <label>Tipo
                    <select name="tipo">
                      <option value="drive">Drive</option>
                      <option value="pc">PC</option>
                      <option value="usb">USB</option>
                      <option value="correo">Correo</option>
                      <option value="otro">Otro</option>
                    </select>
                  </label>
                  <label>Enlace o ruta
                    <input name="enlace_o_ruta" type="text" maxlength="1000" required />
                  </label>
                  <label>Nota (opcional)
                    <input name="nota" type="text" maxlength="500" />
                  </label>
                  <button class="secondary-button" type="submit">Guardar ubicación</button>
                </form>
                <h4>Cambios</h4>
                ${line.cambios.length ? line.cambios.map((change) => `
                  <article class="line-history-entry">
                    <strong>${displayDate(change.fecha)} · ${escapeHtml(change.descripcion)}</strong>
                    ${change.costo_extra ? `<p>Extra: ${escapeHtml(formatMoney(change.costo_extra, simboloMoneda))}</p>` : ''}
                  </article>
                `).join('') : '<p class="muted">Sin cambios registrados.</p>'}
                <form class="line-history-form" data-change-form="${escapeHtml(line.id)}">
                  <label>Fecha
                    <input name="fecha" type="date" value="${escapeHtml(localDateString())}" required />
                  </label>
                  <label>Descripción
                    <input name="descripcion" type="text" maxlength="500" required />
                  </label>
                  <label>Costo extra (${escapeHtml(simboloMoneda)}, opcional)
                    <input name="costo_extra" type="text" inputmode="decimal" placeholder="0,00" />
                  </label>
                  <button class="secondary-button" type="submit">Guardar cambio</button>
                </form>
              </div>
            </details>
          </article>
        `).join('')}
      </div>
      <section class="panel payment-section">
        <h3>Pagos</h3>
        ${pagos.length ? `
          <div class="payment-list">
            ${pagos.map((payment) => `
              <article class="payment-entry">
                <div>
                  <strong>${payment.tipo === 'devolucion' ? 'Devolución' : 'Cobro'} · ${escapeHtml(formatMoney(payment.monto, simboloMoneda))}</strong>
                  <p class="muted">${displayDate(payment.fecha)} · ${escapeHtml(payment.methodLabel ?? payment.metodo.toUpperCase())}${payment.linea ? ` · ${escapeHtml(payment.linea.tipo?.nombre ?? 'Línea')}` : ' · Pedido'}</p>
                  ${payment.nota ? `<p class="muted">${escapeHtml(payment.nota)}</p>` : ''}
                </div>
                <div class="payment-actions">
                  <button class="secondary-button" type="button" data-payment-edit="${escapeHtml(payment.id)}">Editar</button>
                  <button class="danger-button" type="button" data-payment-delete="${escapeHtml(payment.id)}">Papelera</button>
                </div>
              </article>
            `).join('')}
          </div>
        ` : '<p class="muted">Todavía no hay pagos registrados.</p>'}
      </section>
      <section class="panel payment-form-panel" id="payment-form-panel" hidden>
        <h3 id="payment-form-title">Registrar pago</h3>
        <form id="payment-form" class="payment-form">
          <label>
            Aplicar a
            <select name="linea_id">
              <option value="">Pedido completo</option>
              ${lineas.map((line) => `
                <option value="${escapeHtml(line.id)}">${escapeHtml(line.tipo?.nombre ?? 'Línea')}${line.descripcion ? ` · ${escapeHtml(line.descripcion)}` : ''}</option>
              `).join('')}
            </select>
          </label>
          <label>
            Monto (${escapeHtml(simboloMoneda)})
            <input name="monto" type="text" inputmode="decimal" placeholder="0,00" required />
          </label>
          <label>
            Fecha
            <input name="fecha" type="date" value="${escapeHtml(localDateString())}" required />
          </label>
          <label>
            Tipo
            <select name="tipo">
              <option value="cobro">Cobro</option>
              <option value="devolucion">Devolución</option>
            </select>
          </label>
          <label>
            Método
            <select name="metodo">
              <option value="efectivo">Efectivo</option>
              <option value="qr">QR</option>
              <option value="transferencia">Transferencia</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label>
            Nota (opcional)
            <textarea name="nota" maxlength="500"></textarea>
          </label>
          <p class="order-feedback" id="payment-feedback" role="status" hidden></p>
          <div class="client-form-actions">
            <button class="primary-button" type="submit">Guardar pago</button>
            <button class="secondary-button" type="button" data-payment-cancel>Cancelar</button>
          </div>
        </form>
      </section>
      <div class="client-undo" id="payment-undo" role="status" hidden>
        <span id="payment-undo-message">Pago enviado a la papelera.</span>
        <button class="secondary-button" type="button" data-payment-undo>Deshacer</button>
      </div>
    </section>
  `;
}

export function mountEncargos(root, { route } = {}) {
  if (route === 'nuevo-encargo') {
    mountOrderForm(root);
  } else if (route?.startsWith('encargo/')) {
    const [orderId] = route.slice('encargo/'.length).split('/');
    const requestedLineId = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('linea');
    mountOrderDetail(root, orderId, requestedLineId);
  } else {
    mountOrderList(root);
  }
}

function mountOrderList(root) {
  const feedback = root.querySelector('#order-feedback');
  const list = root.querySelector('#order-list');

  getOrderSummaries()
    .then((orders) => {
      if (!orders.length) {
        feedback.hidden = true;
        list.innerHTML = renderEstadoVacio({
          icon: 'clipboard-list',
          title: 'Todavía no hay encargos',
          description: 'Registra tu primer pedido y llévalo al día.',
          buttonLabel: 'Registrar encargo',
          href: '#/encargos/nuevo',
        });
        return;
      }
      feedback.hidden = true;
      list.innerHTML = orders.map((order) => {
        const remaining = order.lineas.filter((line) => !['entregado', 'cancelado'].includes(line.estado)).length;
        const earliest = order.lineas
          .filter((line) => line.estado !== 'cancelado')
          .map((line) => line.fecha_entrega)
          .sort()[0];
        return `
          <a class="panel order-list-card" href="#/encargo/${encodeURIComponent(order.id)}">
            <strong>${escapeHtml(order.cliente?.nombre ?? 'Cliente no disponible')}</strong>
            <span>${order.lineas.length} ${order.lineas.length === 1 ? 'línea' : 'líneas'} · ${remaining} pendientes</span>
            <span class="muted">Próxima entrega: ${displayDate(earliest)}</span>
          </a>
        `;
      }).join('');
    })
    .catch((error) => {
      console.error('No se pudieron cargar los encargos.', error);
      feedback.textContent = 'No se pudieron cargar los encargos. Inténtalo de nuevo.';
      feedback.hidden = false;
      feedback.setAttribute('role', 'alert');
    });
}

async function loadClientOptions(select) {
  const clients = await getRecords('clientes');
  select.innerHTML = `
    <option value="">Elige un cliente…</option>
    ${clients.map((client) => `
      <option value="${escapeHtml(client.id)}">${escapeHtml(client.nombre)} · ${escapeHtml(client.telefono)}</option>
    `).join('')}
  `;
}

function mountOrderForm(root) {
  const form = root.querySelector('#order-form');
  const submitButton = form.querySelector('[type="submit"]');
  const linesContainer = root.querySelector('#order-lines');
  const clientSelect = root.querySelector('#order-client');
  const clientForm = root.querySelector('#order-client-form form');
  const clientWarning = clientForm.querySelector('[id$="-duplicate-warning"]');
  const clientFormTitle = clientForm.querySelector('h2');
  const feedback = root.querySelector('#order-feedback');
  const selectorInstances = new Map();
  let nextLineId = 0;

  function clearValidationErrors() {
    form.querySelectorAll('.field-invalid').forEach((field) => {
      field.classList.remove('field-invalid');
      field.removeAttribute('aria-invalid');
    });
    feedback.hidden = true;
    feedback.textContent = '';
    feedback.setAttribute('role', 'status');
  }

  function findFieldForError(error) {
    if (error.campo === 'cliente_id') return clientSelect;
    if (error.campo === 'modalidad_pago') return form.elements.modalidad_pago;
    if (error.campo === 'adelanto') return form.elements.adelanto;
    if (error.campo === 'fecha_entrega_general') {
      return root.querySelector('#order-general-date');
    }
    if (!error.linea) return null;

    const lineElement = linesContainer.querySelectorAll('[data-order-line]')[error.linea - 1];
    if (!lineElement) return null;
    if (error.campo === 'tipo_id') {
      const selectors = [...lineElement.querySelectorAll('select[data-level]')];
      return selectors.find((select) => !select.value)
        ?? selectors.at(-1)
        ?? lineElement.querySelector('[data-type-selector]');
    }
    return lineElement.querySelector(`[data-line-field="${error.campo}"]`);
  }

  function showValidationErrors(errors) {
    if (!errors.length) return;
    feedback.hidden = false;
    feedback.textContent = errors.map(({ mensaje }) => mensaje).join(' ');
    feedback.setAttribute('role', 'alert');
    const fields = errors.map(findFieldForError).filter(Boolean);
    fields.forEach((field) => {
      field.classList.add('field-invalid');
      field.setAttribute('aria-invalid', 'true');
    });
    const firstField = fields[0];
    firstField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstField?.focus({ preventScroll: true });
  }

  function addLine(date = root.querySelector('#order-general-date').value || localDateString()) {
    const lineId = nextLineId++;
    const wrapper = document.createElement('div');
    wrapper.dataset.lineId = String(lineId);
    wrapper.innerHTML = renderOrderLine(linesContainer.querySelectorAll('[data-order-line]').length, date);
    linesContainer.append(wrapper);
    const selectorRoot = wrapper.querySelector('[data-type-selector]');
    const selector = mountSelectorTipo(selectorRoot, {
      onSelect: (type) => {
        clearValidationErrors();
        const priceInput = wrapper.querySelector('[name="precio"]');
        if (priceInput.dataset.edited === 'true') return;
        priceInput.value = type?.precio_sugerido == null
          ? ''
          : decimalPrice(type.precio_sugerido);
        priceInput.classList.toggle('is-suggested-price', type?.precio_sugerido != null);
      },
    });
    selectorInstances.set(lineId, selector);
  }

  function renumberLines() {
    linesContainer.querySelectorAll('[data-order-line]').forEach((line, index) => {
      line.querySelector('legend').textContent = `Línea ${index + 1}`;
      const removeButton = line.querySelector('[data-order-action="remove-line"]');
      if (removeButton) removeButton.hidden = linesContainer.querySelectorAll('[data-order-line]').length <= 1;
    });
  }

  loadClientOptions(clientSelect).catch((error) => {
    console.error('No se pudieron cargar los clientes para el pedido.', error);
    clientSelect.innerHTML = '<option value="">No se pudieron cargar los clientes</option>';
  });
  addLine();

  root.addEventListener('input', (event) => {
    if (event.target.closest('#order-form')) clearValidationErrors();
    if (event.target.matches('[name="precio"]')) {
      event.target.dataset.edited = 'true';
      event.target.classList.remove('is-suggested-price');
    }

    if (event.target.closest('#order-client-form form')) {
      getRecords('clientes').then((clients) => {
        const candidate = obtenerDatosCliente(clientForm);
        const duplicate = candidate.telefono.length >= 5
          ? buscarClienteDuplicado(clients, candidate)
          : undefined;
        clientWarning.hidden = !duplicate;
        clientWarning.textContent = duplicate
          ? 'Ya existe un cliente con este código y teléfono.'
          : '';
      }).catch((error) => console.error('No se pudieron validar los clientes.', error));
    }
  });

  root.addEventListener('change', (event) => {
    if (event.target.closest('#order-form')) clearValidationErrors();
    if (event.target.id !== 'order-general-date' || !event.target.value) return;
    linesContainer.querySelectorAll('[name="fecha_entrega"]').forEach((dateInput) => {
      if (dateInput.value === dateInput.dataset.dateValue) {
        dateInput.value = event.target.value;
        dateInput.dataset.dateValue = event.target.value;
      }
    });
  });

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-order-action], [data-action="cancel-form"]');
    if (!button) return;
    if (button.dataset.orderAction === 'add-line') {
      addLine();
      clearValidationErrors();
      return;
    }
    if (button.dataset.orderAction === 'remove-line') {
      const wrapper = button.closest('[data-line-id]');
      selectorInstances.delete(Number(wrapper.dataset.lineId));
      wrapper.remove();
      renumberLines();
      clearValidationErrors();
      return;
    }
    if (button.dataset.orderAction === 'new-client') {
      clientForm.reset();
      clientForm.elements.codigo_pais.value = '+591';
      clientWarning.hidden = true;
      clientFormTitle.textContent = 'Nuevo cliente';
      clientForm.hidden = false;
      clientForm.elements.nombre.focus();
      return;
    }
    if (button.dataset.action === 'cancel-form') {
      clientForm.hidden = true;
    }
  });

  clientForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const candidate = obtenerDatosCliente(clientForm);
    try {
      const clients = await getRecords('clientes');
      const duplicate = buscarClienteDuplicado(clients, candidate);
      if (duplicate && !window.confirm(
        `Ya existe ${duplicate.nombre} con ese código y teléfono. ¿Quieres guardarlo de todas formas?`,
      )) return;
      const client = await createRecord('clientes', candidate);
      await loadClientOptions(clientSelect);
      clientSelect.value = client.id;
      clientForm.hidden = true;
    } catch (error) {
      console.error('No se pudo guardar el nuevo cliente del pedido.', error);
      clientWarning.hidden = false;
      clientWarning.textContent = error.message || 'No se pudo guardar el cliente.';
      clientWarning.setAttribute('role', 'alert');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearValidationErrors();
    submitButton.disabled = true;
    submitButton.textContent = 'Guardando pedido…';
    try {
      const formData = new FormData(form);
      const lineElements = [...linesContainer.querySelectorAll('[data-order-line]')];
      const rawLines = lineElements.map((lineElement) => {
        const lineId = Number(lineElement.closest('[data-line-id]').dataset.lineId);
        const selector = selectorInstances.get(lineId);
        return {
          tipo_id: selector?.getSelectedTypeId() ?? null,
          titulo: lineElement.querySelector('[name="titulo"]').value,
          precio: lineElement.querySelector('[name="precio"]').value,
          nota_descuento: lineElement.querySelector('[name="nota_descuento"]').value.trim(),
          fecha_entrega: lineElement.querySelector('[name="fecha_entrega"]').value,
          hora_entrega: lineElement.querySelector('[name="hora_entrega"]').value || null,
        };
      });
      const orderForValidation = {
        cliente_id: formData.get('cliente_id'),
        fecha_entrega_general: formData.get('fecha_entrega_general'),
        modalidad_pago: formData.get('modalidad_pago'),
        adelanto: formData.get('adelanto'),
      };
      const workTypes = selectorInstances.values().next().value?.getTypes() ?? [];
      const errors = validarPedido({
        pedido: orderForValidation,
        lineas: rawLines,
        tiposTrabajo: workTypes,
      });
      if (errors.length) {
        showValidationErrors(errors);
        return;
      }

      const order = {
        cliente_id: orderForValidation.cliente_id,
        fecha_pedido: localDateString(),
        fecha_entrega_general: orderForValidation.fecha_entrega_general,
        modalidad_pago: orderForValidation.modalidad_pago,
        adelanto_acordado: parseSuggestedPrice(orderForValidation.adelanto) ?? 0,
        notas: String(formData.get('notas') ?? '').trim(),
      };
      const lines = rawLines.map((line) => ({
        tipo_id: line.tipo_id,
        descripcion: line.titulo.trim(),
        precio_acordado: parseSuggestedPrice(line.precio),
        nota_descuento: line.nota_descuento,
        fecha_entrega: line.fecha_entrega,
        hora_entrega: line.hora_entrega,
      }));
      const created = await createOrderWithLines(order, lines);
      window.location.hash = `#/encargo/${encodeURIComponent(created.pedido.id)}`;
    } catch (error) {
      console.error('No se pudo guardar el pedido.', error);
      feedback.hidden = false;
      feedback.textContent = error.message || 'No se pudo guardar el pedido. Revisa los datos e inténtalo de nuevo.';
      feedback.setAttribute('role', 'alert');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Guardar pedido';
    }
  });

}

function mountOrderDetail(root, orderId, initialLineId = null) {
  let recentlyDeletedPaymentId = null;
  let undoTimer;
  let currentDetail;

  const render = async () => {
    try {
      const detail = await getOrderDetail(decodeURIComponent(orderId));
      if (!detail) {
        root.innerHTML = '<section class="panel"><h2>Pedido no encontrado</h2><a href="#/encargos">Volver a encargos</a></section>';
        return;
      }
      currentDetail = detail;
      root.innerHTML = renderOrderDetail(detail);
      root.querySelector('#payment-undo').hidden = !recentlyDeletedPaymentId;
      if (initialLineId) {
        const line = detail.lineas.find(({ id }) => id === initialLineId);
        initialLineId = null;
        if (line) {
          const form = root.querySelector('#payment-form');
          form.reset();
          form.dataset.paymentId = '';
          form.elements.fecha.value = localDateString();
          form.elements.linea_id.value = line.id;
          root.querySelector('#payment-form-title').textContent = 'Registrar pago';
          root.querySelector('#payment-form-panel').hidden = false;
          form.elements.monto.focus();
        }
      }
    } catch (error) {
      console.error('No se pudo cargar el detalle del pedido.', error);
      root.innerHTML = '<p class="panel" role="alert">No se pudo cargar el pedido.</p>';
    }
  };

  root.addEventListener('change', async (event) => {
    const status = event.target.closest('[data-line-status]');
    const date = event.target.closest('[data-line-date]');
    if (!status && !date) return;
    try {
      if (status && status.value === 'cancelado') {
        const refundAmount = await getLineCancellationRefund(status.dataset.lineStatus);
        const refundAdvance = refundAmount > 0 && window.confirm(
          `Hay ${formatMoney(refundAmount, currentDetail.simboloMoneda)} asignados a este trabajo. ¿Registrar una devolución? Si eliges Cancelar, se conservará como saldo a favor.`,
        );
        await cancelOrderLine(status.dataset.lineStatus, { refundAdvance });
      } else if (status) await updateLineStatus(status.dataset.lineStatus, status.value);
      else await updateLineDeliveryDate(date.dataset.lineDate, date.value);
      await render();
    } catch (error) {
      console.error('No se pudo actualizar la línea del pedido.', error);
      window.alert(error.message || 'No se pudo actualizar la línea.');
      await render();
    }
  });

  root.addEventListener('click', async (event) => {
    const newPayment = event.target.closest('[data-payment-new]');
    const editPayment = event.target.closest('[data-payment-edit]');
    const deletePayment = event.target.closest('[data-payment-delete]');
    const deleteLine = event.target.closest('[data-line-delete]');
    const deleteOrder = event.target.closest('[data-order-delete]');
    const cancelPayment = event.target.closest('[data-payment-cancel]');
    const undoPayment = event.target.closest('[data-payment-undo]');
    if (newPayment) {
      const form = root.querySelector('#payment-form');
      form.reset();
      form.dataset.paymentId = '';
      form.elements.fecha.value = localDateString();
      form.elements.linea_id.value = newPayment.dataset.lineId ?? '';
      root.querySelector('#payment-form-title').textContent = 'Registrar pago';
      root.querySelector('#payment-form-panel').hidden = false;
      form.elements.monto.focus();
      return;
    }
    if (editPayment) {
      const payment = currentDetail?.pagos.find(({ id }) => id === editPayment.dataset.paymentEdit);
      if (!payment) return;
      const form = root.querySelector('#payment-form');
      form.dataset.paymentId = payment.id;
      form.elements.linea_id.value = payment.linea_id ?? '';
      form.elements.monto.value = decimalPrice(payment.monto);
      form.elements.fecha.value = payment.fecha;
      form.elements.tipo.value = payment.tipo;
      form.elements.metodo.value = payment.metodo;
      form.elements.nota.value = payment.nota ?? '';
      root.querySelector('#payment-form-title').textContent = 'Editar pago';
      root.querySelector('#payment-form-panel').hidden = false;
      form.elements.monto.focus();
      return;
    }
    if (cancelPayment) {
      root.querySelector('#payment-form-panel').hidden = true;
      return;
    }
    if (deleteLine) {
      const paymentCount = currentDetail?.pagos.filter(
        (payment) => payment.linea_id === deleteLine.dataset.lineDelete,
      ).length ?? 0;
      const impact = paymentCount
        ? ` También se enviarán ${paymentCount} ${paymentCount === 1 ? 'pago' : 'pagos'} asociados a la papelera.`
        : '';
      if (!window.confirm(`¿Enviar este trabajo a la papelera?${impact}`)) return;
      try {
        await softDeleteLineAndPayments(deleteLine.dataset.lineDelete);
        await render();
      } catch (error) {
        console.error('No se pudo enviar el trabajo a la papelera.', error);
        window.alert(error.message || 'No se pudo enviar el trabajo a la papelera.');
      }
      return;
    }
    if (deleteOrder) {
      if (!window.confirm('¿Enviar este pedido a la papelera? Sus trabajos y pagos se conservarán y volverán al restaurarlo.')) return;
      try {
        await softDeleteOrder(decodeURIComponent(orderId));
        window.location.hash = '#/encargos';
      } catch (error) {
        console.error('No se pudo enviar el pedido a la papelera.', error);
        window.alert(error.message || 'No se pudo enviar el pedido a la papelera.');
      }
      return;
    }
    if (deletePayment) {
      try {
        await softDeleteRecord('pagos', deletePayment.dataset.paymentDelete);
        recentlyDeletedPaymentId = deletePayment.dataset.paymentDelete;
        root.querySelector('#payment-undo-message').textContent = 'Pago enviado a la papelera.';
        window.clearTimeout(undoTimer);
        undoTimer = window.setTimeout(() => {
          recentlyDeletedPaymentId = null;
          const panel = root.querySelector('#payment-undo');
          if (panel) panel.hidden = true;
        }, 5000);
        await render();
      } catch (error) {
        console.error('No se pudo enviar el pago a la papelera.', error);
        window.alert(error.message || 'No se pudo eliminar el pago.');
      }
      return;
    }
    if (undoPayment && recentlyDeletedPaymentId) {
      try {
        await restoreRecord('pagos', recentlyDeletedPaymentId);
        recentlyDeletedPaymentId = null;
        window.clearTimeout(undoTimer);
        await render();
      } catch (error) {
        console.error('No se pudo restaurar el pago.', error);
        window.alert(error.message || 'No se pudo deshacer la eliminación.');
      }
    }
  });

  root.addEventListener('submit', async (event) => {
    const locationForm = event.target.closest('[data-location-form]');
    const changeForm = event.target.closest('[data-change-form]');
    if (locationForm) {
      event.preventDefault();
      try {
        await saveLineLocation({
          linea_id: locationForm.dataset.locationForm,
          tipo: locationForm.elements.tipo.value,
          enlace_o_ruta: locationForm.elements.enlace_o_ruta.value,
          nota: locationForm.elements.nota.value,
        });
        await render();
      } catch (error) {
        console.error('No se pudo guardar la ubicación del trabajo.', error);
        window.alert(error.message || 'No se pudo guardar la ubicación.');
      }
      return;
    }
    if (changeForm) {
      event.preventDefault();
      try {
        await saveLineChange({
          linea_id: changeForm.dataset.changeForm,
          fecha: changeForm.elements.fecha.value,
          descripcion: changeForm.elements.descripcion.value,
          costo_extra: changeForm.elements.costo_extra.value,
        });
        await render();
      } catch (error) {
        console.error('No se pudo guardar el cambio del trabajo.', error);
        window.alert(error.message || 'No se pudo guardar el cambio.');
      }
      return;
    }
    const form = event.target.closest('#payment-form');
    if (!form) return;
    event.preventDefault();
    const feedback = root.querySelector('#payment-feedback');
    try {
      await savePaymentFromForm({
        id: form.dataset.paymentId || undefined,
        pedido_id: decodeURIComponent(orderId),
        linea_id: form.elements.linea_id.value || null,
        monto: form.elements.monto.value,
        fecha: form.elements.fecha.value,
        tipo: form.elements.tipo.value,
        metodo: form.elements.metodo.value,
        nota: form.elements.nota.value,
      });
      await render();
    } catch (error) {
      console.error('No se pudo guardar el pago.', error);
      feedback.hidden = false;
      feedback.textContent = error.message || 'No se pudo guardar el pago. Revisa los datos e inténtalo de nuevo.';
      feedback.setAttribute('role', 'alert');
    }
  });

  render();
}
