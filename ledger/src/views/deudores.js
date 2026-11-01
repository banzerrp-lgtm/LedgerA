import { getDebtorSummaries } from '../db/pedidos.js';
import { daysSinceDelivery } from '../logic/saldos.js';
import { formatSuggestedPrice } from '../logic/tipos-trabajo.js';
import { renderEstadoVacio } from '../components/estadoVacio.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function formatMoney(cents, symbol) {
  const sign = cents < 0 ? '- ' : '';
  return `${sign}${symbol} ${formatSuggestedPrice(Math.abs(cents)).replace(/^Bs\s*/, '')}`;
}

function displayDate(value) {
  const date = typeof value === 'string' ? value.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Fecha no disponible';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export function renderDeudores() {
  return `
    <section>
      <h1 class="page-title">Deudores</h1>
      <p class="debt-feedback" id="debt-feedback" role="status">Cargando saldos…</p>
      <div id="debt-empty" hidden>
        ${renderEstadoVacio({
          icon: 'check-circle',
          title: 'Todo al día',
          description: 'Nadie te debe nada por ahora.',
          positive: true,
        })}
      </div>
      <div class="debt-clients" id="debt-clients"></div>
    </section>
  `;
}

export function mountDeudores(root) {
  const feedback = root.querySelector('#debt-feedback');
  const empty = root.querySelector('#debt-empty');
  const list = root.querySelector('#debt-clients');
  getDebtorSummaries()
    .then(({ clientes, simboloMoneda }) => {
      if (!clientes.length) {
        feedback.hidden = true;
        empty.hidden = false;
        return;
      }

      feedback.hidden = true;
      empty.hidden = true;
      list.innerHTML = clientes.map((client) => `
        <section class="panel debt-client">
          <div class="debt-client-heading">
            <div>
              <h3>${escapeHtml(client.nombre)}</h3>
              <p class="muted">${escapeHtml(client.codigo_pais ?? '')} ${escapeHtml(client.telefono ?? '')}</p>
            </div>
            <div class="debt-client-totals">
              <strong>Deuda exigible: ${escapeHtml(formatMoney(client.deuda_exigible, simboloMoneda))}</strong>
              ${client.saldo_a_favor > 0
                ? `<span>Saldo a favor: ${escapeHtml(formatMoney(client.saldo_a_favor, simboloMoneda))}</span>`
                : ''}
            </div>
          </div>
          ${client.trabajos.length ? `
            <div class="debt-work-list">
              ${client.trabajos.map((line) => `
                <article class="debt-work">
                  <div>
                    <strong>${escapeHtml(line.tipo?.nombre ?? 'Trabajo')}${line.descripcion ? ` · ${escapeHtml(line.descripcion)}` : ''}</strong>
                    <p class="muted">Entregado: ${displayDate(line.fecha_terminado)} · Hace ${daysSinceDelivery(line.fecha_terminado)} ${daysSinceDelivery(line.fecha_terminado) === 1 ? 'día' : 'días'}</p>
                    <p>Saldo del trabajo: <strong>${escapeHtml(formatMoney(line.saldo, simboloMoneda))}</strong></p>
                  </div>
                  <a class="secondary-button button-link" href="#/encargo/${encodeURIComponent(line.pedido_id)}?linea=${encodeURIComponent(line.id)}">
                    Registrar pago
                  </a>
                </article>
              `).join('')}
            </div>
          ` : '<p class="muted">No hay trabajos entregados pendientes de cobro.</p>'}
        </section>
      `).join('');
    })
    .catch((error) => {
      console.error('No se pudieron cargar los saldos de clientes.', error);
      feedback.textContent = 'No se pudieron cargar los saldos. Inténtalo de nuevo.';
      feedback.hidden = false;
      feedback.setAttribute('role', 'alert');
    });
}
