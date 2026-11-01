import { getCustomerProfile } from '../db/historial.js';
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

function money(cents, symbol) {
  const sign = cents < 0 ? '- ' : '';
  return `${sign}${symbol} ${formatSuggestedPrice(Math.abs(cents)).replace(/^Bs\s*/, '')}`;
}

function displayDate(value) {
  if (!value) return 'Sin fecha';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function renderFichaCliente() {
  return `
    <section>
      <a class="back-link" href="#/clientes">‹ Clientes</a>
      <p class="client-profile-feedback" id="client-profile-feedback" role="status">Cargando ficha…</p>
      <div id="client-profile"></div>
    </section>
  `;
}

export function mountFichaCliente(root, clientId) {
  const feedback = root.querySelector('#client-profile-feedback');
  const profileContainer = root.querySelector('#client-profile');
  getCustomerProfile(decodeURIComponent(clientId))
    .then((profile) => {
      if (!profile) {
        feedback.textContent = 'No se encontró este cliente.';
        feedback.setAttribute('role', 'alert');
        return;
      }
      feedback.hidden = true;
      profileContainer.innerHTML = `
        <section class="panel client-profile-heading">
          <h2>${escapeHtml(profile.cliente.nombre)}</h2>
          <p>${escapeHtml(profile.cliente.codigo_pais)} ${escapeHtml(profile.cliente.telefono)}</p>
          ${profile.cliente.notas ? `<p>${escapeHtml(profile.cliente.notas)}</p>` : ''}
          <dl class="client-profile-balances">
            <div><dt>Total vigente</dt><dd>${escapeHtml(money(profile.total_vigente, profile.simboloMoneda))}</dd></div>
            <div><dt>Pagado neto</dt><dd>${escapeHtml(money(profile.cobros_netos, profile.simboloMoneda))}</dd></div>
            <div><dt>Por cobrar</dt><dd>${escapeHtml(money(profile.por_cobrar, profile.simboloMoneda))}</dd></div>
            <div><dt>Deuda exigible</dt><dd>${escapeHtml(money(profile.deuda_exigible, profile.simboloMoneda))}</dd></div>
            <div><dt>Saldo a favor</dt><dd>${escapeHtml(money(profile.saldo_a_favor, profile.simboloMoneda))}</dd></div>
          </dl>
        </section>
        <section class="client-profile-orders">
          <h3>Trabajos y pedidos</h3>
          ${profile.trabajos.length ? profile.trabajos.map((line) => `
            <article class="panel client-profile-work">
              <div>
                <strong>${escapeHtml(line.tipo?.nombre ?? 'Tipo no disponible')}${line.descripcion ? ` · ${escapeHtml(line.descripcion)}` : ''}</strong>
                <p class="muted">${escapeHtml(line.estado)} · Entrega ${displayDate(line.fecha_entrega)}</p>
                <p>Total: ${escapeHtml(money(line.precio_acordado, profile.simboloMoneda))}</p>
              </div>
              <a class="secondary-button button-link" href="#/encargo/${encodeURIComponent(line.pedido_id)}">Ver pedido</a>
            </article>
          `).join('') : '<p class="muted">Este cliente todavía no tiene trabajos.</p>'}
        </section>
      `;
    })
    .catch((error) => {
      console.error('No se pudo cargar la ficha del cliente.', error);
      feedback.textContent = 'No se pudo cargar la ficha del cliente.';
      feedback.hidden = false;
      feedback.setAttribute('role', 'alert');
    });
}
