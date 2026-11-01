import { getDashboardData, updateLineDeliveryDate, updateLinePriority, updateLineStatus } from '../db/pedidos.js';
import { formatSuggestedPrice } from '../logic/tipos-trabajo.js';
import { sortUpcomingDeliveries } from '../logic/entregas.js';
import { formatBackupAge } from '../logic/respaldo.js';
import { renderEstadoVacio } from '../components/estadoVacio.js';
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

function displayDate(value) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function renderDelivery(line, currencySymbol) {
  const { entrega } = line;
  const overdueActions = entrega.overdue
    ? `
      <div class="delivery-actions">
        <button class="secondary-button" type="button" data-delivery-action="priority"
          data-id="${escapeHtml(line.id)}" data-priority="${!line.prioridad}">
          ${line.prioridad ? 'Quitar prioridad' : 'Prioridad'}
        </button>
        <label class="reschedule-field">
          Reprogramar
          <input type="date" value="${escapeHtml(line.fecha_entrega)}"
            data-reschedule-date="${escapeHtml(line.id)}" />
        </label>
        <button class="secondary-button" type="button" data-delivery-action="reschedule"
          data-id="${escapeHtml(line.id)}">Guardar fecha</button>
        <button class="danger-button" type="button" data-delivery-action="cancel"
          data-id="${escapeHtml(line.id)}">Cancelar</button>
      </div>
    `
    : '';

  return `
    <article class="delivery-card delivery-card--${entrega.color}" data-line-id="${escapeHtml(line.id)}">
      <h3>${escapeHtml(line.tipo?.nombre ?? 'Trabajo')}${line.descripcion ? ` · ${escapeHtml(line.descripcion)}` : ''}</h3>
      <p>${escapeHtml(line.cliente?.nombre ?? 'Cliente no disponible')}</p>
      <div class="delivery-meta">
        <span class="delivery-status">${escapeHtml(entrega.label)} · ${displayDate(line.fecha_entrega)}${line.hora_entrega ? ` · ${escapeHtml(line.hora_entrega)}` : ''}${line.prioridad ? ' · Prioridad' : ''}</span>
        <strong>${escapeHtml(currencySymbol)} ${formatSuggestedPrice(line.precio_acordado).replace(/^Bs\s*/, '')}</strong>
      </div>
      ${overdueActions}
    </article>
  `;
}

export function renderInicio() {
  const date = new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return `
    <header class="page-heading">
      <p class="eyebrow">${escapeHtml(date)}</p>
      <h1>Resumen</h1>
    </header>
    <div class="summary-grid" aria-label="Resumen de encargos">
      <article class="card">
        <span class="summary-icon summary-icon--accent">${renderIcon('package')}</span>
        <strong data-summary="pending">—</strong>
        <span>Por entregar</span>
      </article>
      <article class="card">
        <span class="summary-icon summary-icon--ok">${renderIcon('banknote')}</span>
        <strong data-summary="owed">—</strong>
        <span>Te deben</span>
      </article>
    </div>
    <section class="backup-reminder card" data-backup-card aria-labelledby="backup-reminder-title">
      <span class="backup-reminder-icon">${renderIcon('shield')}</span>
      <div>
        <h2 id="backup-reminder-title" data-backup-age>Aún no hay respaldo</h2>
        <p>Guarda una copia para no perder tus datos</p>
      </div>
      <a class="secondary-button button-link" href="#/ajustes">Respaldar ahora</a>
    </section>
    <section class="onboarding-card card" data-onboarding hidden aria-labelledby="onboarding-title">
      <h2 id="onboarding-title">Primeros pasos</h2>
      <a href="#/clientes" data-onboarding-client>
        <span class="onboarding-check" data-check="client">${renderIcon('check-circle')}</span>
        <span>Crea tu primer cliente</span>${renderIcon('chevron-right')}
      </a>
      <a href="#/tipos-trabajo" data-onboarding-types>
        <span class="onboarding-check" data-check="types">${renderIcon('check-circle')}</span>
        <span>Revisa tus tipos de trabajo</span>${renderIcon('chevron-right')}
      </a>
      <a href="#/encargos/nuevo" data-onboarding-order>
        <span class="onboarding-check" data-check="order">${renderIcon('check-circle')}</span>
        <span>Registra tu primer encargo</span>${renderIcon('chevron-right')}
      </a>
    </section>
    <section aria-labelledby="upcoming-title">
      <h2 id="upcoming-title">Próximas entregas</h2>
      <p class="home-feedback" data-home-feedback role="status">Cargando entregas…</p>
      <div data-delivery-empty hidden>
        ${renderEstadoVacio({
          icon: 'package',
          title: 'Sin entregas pendientes',
          description: 'Cuando registres un encargo, aparecerá aquí con su color de urgencia.',
          buttonLabel: 'Registrar encargo',
          href: '#/encargos/nuevo',
        })}
      </div>
      <div class="delivery-list" data-delivery-list></div>
    </section>
  `;
}

export function mountInicio(root) {
  const pendingSummary = root.querySelector('[data-summary="pending"]');
  const owedSummary = root.querySelector('[data-summary="owed"]');
  const backupAge = root.querySelector('[data-backup-age]');
  const backupCard = root.querySelector('[data-backup-card]');
  const onboarding = root.querySelector('[data-onboarding]');
  const deliveryEmpty = root.querySelector('[data-delivery-empty]');
  const feedback = root.querySelector('[data-home-feedback]');
  const list = root.querySelector('[data-delivery-list]');
  let currencySymbol = 'Bs';

  function updateOnboarding(data) {
    const typesReviewed = localStorage.getItem('ledger-types-reviewed') === 'true';
    const complete = data.clientsCount > 0 && data.ordersCount > 0 && typesReviewed;
    onboarding.hidden = complete;
    onboarding.querySelector('[data-check="client"]').classList.toggle('is-complete', data.clientsCount > 0);
    onboarding.querySelector('[data-check="types"]').classList.toggle('is-complete', typesReviewed);
    onboarding.querySelector('[data-check="order"]').classList.toggle('is-complete', data.ordersCount > 0);
  }

  async function loadDashboard() {
    feedback.hidden = false;
    feedback.textContent = 'Cargando entregas…';
    try {
      const data = await getDashboardData();
      currencySymbol = data.currencySymbol;
      const deliveries = sortUpcomingDeliveries(data.lines);
      pendingSummary.textContent = String(data.pendingCount);
      owedSummary.textContent = `${currencySymbol} ${formatSuggestedPrice(data.amountOwed).replace(/^Bs\s*/, '')}`;
      backupAge.textContent = formatBackupAge(data.lastBackupDate).replace(/\.$/, '');
      const backupDays = data.lastBackupDate
        ? Math.floor((Date.now() - Date.parse(data.lastBackupDate)) / 86_400_000)
        : null;
      backupCard.classList.toggle('backup-reminder--warning', backupDays !== null && backupDays > 7);
      updateOnboarding(data);
      list.innerHTML = deliveries.map((line) => renderDelivery(line, currencySymbol)).join('');
      feedback.hidden = true;
      deliveryEmpty.hidden = deliveries.length > 0;
    } catch (error) {
      console.error('No se pudo cargar el resumen de Inicio.', error);
      feedback.hidden = false;
      feedback.textContent = 'No se pudo cargar Inicio. Inténtalo de nuevo.';
      feedback.setAttribute('role', 'alert');
    }
  }

  root.addEventListener('click', async (event) => {
    if (event.target.closest('[data-onboarding-types]')) {
      localStorage.setItem('ledger-types-reviewed', 'true');
    }
    const button = event.target.closest('button[data-delivery-action]');
    if (!button) return;
    const { deliveryAction, id } = button.dataset;
    try {
      if (deliveryAction === 'priority') {
        await updateLinePriority(id, button.dataset.priority === 'true');
      } else if (deliveryAction === 'cancel') {
        if (!window.confirm('¿Cancelar esta línea de trabajo?')) return;
        await updateLineStatus(id, 'cancelado');
      } else if (deliveryAction === 'reschedule') {
        const dateInput = button.closest('[data-line-id]').querySelector('[data-reschedule-date]');
        await updateLineDeliveryDate(id, dateInput.value);
      } else {
        return;
      }
      await loadDashboard();
    } catch (error) {
      console.error('No se pudo actualizar la entrega.', error);
      feedback.hidden = false;
      feedback.textContent = error.message || 'No se pudo actualizar la entrega.';
      feedback.setAttribute('role', 'alert');
    }
  });

  loadDashboard();
}
