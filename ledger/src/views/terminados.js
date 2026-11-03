import { getCompletedHistory } from '../db/historial.js';
import { filterCompletedHistory, summarizePortfolio } from '../logic/historial.js';
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

function displayDate(value) {
  if (!value) return 'Sin fecha';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function money(cents, symbol) {
  return `${symbol} ${formatSuggestedPrice(cents).replace(/^Bs\s*/, '')}`;
}

export function renderTerminados() {
  return `
    <section class="completed-page">
      <a class="back-link" href="#/mas">‹ Más</a>
      <h2>Terminados y portafolio</h2>
      <section class="panel history-panel">
        <h3>Historial de trabajos</h3>
        <div class="history-filters">
          <label>Buscar por cliente, texto o tipo
            <input id="history-query" type="search" autocomplete="off" />
          </label>
          <label>Tipo de trabajo
            <select id="history-type"><option value="">Todos los tipos</option></select>
          </label>
          <label>Desde
            <input id="history-from" type="date" />
          </label>
          <label>Hasta
            <input id="history-to" type="date" />
          </label>
        </div>
        <p id="history-feedback" class="history-feedback" role="status">Cargando historial…</p>
        <div id="history-list" class="history-list"></div>
      </section>
      <section class="panel portfolio-panel">
        <h3>Portafolio</h3>
        <p class="muted">Resumen de trabajos entregados en el periodo elegido.</p>
        <div class="history-filters">
          <label>Desde
            <input id="portfolio-from" type="date" />
          </label>
          <label>Hasta
            <input id="portfolio-to" type="date" />
          </label>
        </div>
        <label class="portfolio-toggle">
          <input id="portfolio-private" type="checkbox" checked />
          Ocultar nombres y precios
        </label>
        <p id="portfolio-feedback" class="history-feedback" role="status"></p>
        <div id="portfolio-list" class="portfolio-list"></div>
      </section>
    </section>
  `;
}

export function mountTerminados(root) {
  const query = root.querySelector('#history-query');
  const typeFilter = root.querySelector('#history-type');
  const from = root.querySelector('#history-from');
  const to = root.querySelector('#history-to');
  const historyList = root.querySelector('#history-list');
  const historyFeedback = root.querySelector('#history-feedback');
  const portfolioFrom = root.querySelector('#portfolio-from');
  const portfolioTo = root.querySelector('#portfolio-to');
  const privateMode = root.querySelector('#portfolio-private');
  const portfolioList = root.querySelector('#portfolio-list');
  const portfolioFeedback = root.querySelector('#portfolio-feedback');
  let history = [];
  let currencySymbol = 'Bs';

  function renderHistory() {
    const filtered = filterCompletedHistory(history, {
      query: query.value,
      typeId: typeFilter.value,
      from: from.value,
      to: to.value,
    });
    if (!filtered.length) {
      historyFeedback.textContent = 'No hay trabajos que coincidan con la búsqueda.';
      historyFeedback.hidden = false;
      historyList.innerHTML = '';
      return;
    }
    historyFeedback.hidden = true;
    historyList.innerHTML = filtered.map((entry) => `
      <article class="history-entry">
        <div>
          <strong>${escapeHtml(entry.descripcion || entry.tipo_nombre)}</strong>
          <p class="muted">${escapeHtml(entry.tipo_nombre)}</p>
          <p>Para ${entry.cliente_id
            ? `<a href="#/cliente/${encodeURIComponent(entry.cliente_id)}">${escapeHtml(entry.cliente_nombre)}</a>`
            : escapeHtml(entry.cliente_nombre)}</p>
          <p class="muted">Terminado · ${displayDate(entry.fecha_terminado)}</p>
        </div>
        <div class="history-money">
          <span>Precio: ${money(entry.precio_acordado, currencySymbol)}</span>
          <span>Pagado: ${money(entry.pagos_aplicados, currencySymbol)}</span>
        </div>
      </article>
    `).join('');
  }

  function renderPortfolio() {
    const portfolioHistory = history.filter((entry) => entry.estado === 'entregado');
    const summary = summarizePortfolio(portfolioHistory, {
      from: portfolioFrom.value,
      to: portfolioTo.value,
    });
    if (!summary.length) {
      portfolioFeedback.textContent = 'No hay trabajos entregados en ese periodo.';
      portfolioList.innerHTML = '';
      return;
    }
    portfolioFeedback.textContent = `${summary.reduce((count, item) => count + item.cantidad, 0)} trabajos entregados.`;
    const hidePrivate = privateMode.checked;
    const portfolioRows = summary.map((item) => {
      const works = portfolioHistory.filter((entry) => (entry.tipo_id ?? 'sin-tipo') === item.tipo_id);
      return `
      <article class="portfolio-entry">
        <strong>${escapeHtml(item.tipo_nombre)}</strong>
        <span>${item.cantidad} ${item.cantidad === 1 ? 'trabajo' : 'trabajos'}</span>
        ${hidePrivate ? '' : `
          <span>Total ${money(item.total, currencySymbol)} · Pagado ${money(item.pagado, currencySymbol)}</span>
          <ul>${works.map((entry) => `
            <li>${escapeHtml(entry.cliente_nombre)}${entry.descripcion ? ` · ${escapeHtml(entry.descripcion)}` : ''} — ${money(entry.precio_acordado, currencySymbol)}</li>
          `).join('')}</ul>
        `}
      </article>
      `;
    });
    portfolioList.innerHTML = portfolioRows.join('');
  }

  function render() {
    renderHistory();
    renderPortfolio();
  }

  for (const control of [query, typeFilter, from, to, portfolioFrom, portfolioTo, privateMode]) {
    control.addEventListener('input', render);
    control.addEventListener('change', render);
  }

  getCompletedHistory()
    .then((result) => {
      history = result.history;
      currencySymbol = result.simboloMoneda;
      const types = new Map(
        history.map((entry) => [entry.tipo_id, entry.tipo_nombre]),
      );
      typeFilter.insertAdjacentHTML('beforeend', [...types.entries()].map(([id, name]) =>
        `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`,
      ).join(''));
      render();
    })
    .catch((error) => {
      console.error('No se pudo cargar el historial de trabajos.', error);
      historyFeedback.textContent = 'No se pudo cargar el historial. Inténtalo de nuevo.';
      historyFeedback.hidden = false;
      historyFeedback.setAttribute('role', 'alert');
    });
}
