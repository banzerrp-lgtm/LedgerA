import {
  emptyTrash,
  getTrashClearSummary,
  getTrashImpact,
  getTrashRecords,
  permanentlyDeleteTrashRecord,
  restoreTrashRecord,
} from '../db/papelera.js';
import { renderIcon } from '../components/icons.js';

const TABLE_NAMES = {
  clientes: ['cliente', 'clientes'],
  tipos_trabajo: ['tipo de trabajo', 'tipos de trabajo'],
  pedidos: ['pedido', 'pedidos'],
  lineas: ['trabajo', 'trabajos'],
  pagos: ['pago', 'pagos'],
  ubicaciones: ['ubicación', 'ubicaciones'],
  cambios: ['cambio', 'cambios'],
  ajustes: ['ajuste', 'ajustes'],
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

function formatDeletionSummary(summary) {
  const categoryOrder = [
    'pedidos',
    'pagos',
    'clientes',
    'tipos_trabajo',
    'lineas',
    'ubicaciones',
    'cambios',
    'ajustes',
  ];
  const counts = categoryOrder
    .filter((table) => summary.counts[table] > 0)
    .map((table) => {
      const count = summary.counts[table];
      const [singular, plural] = TABLE_NAMES[table];
      return `${count} ${count === 1 ? singular : plural}`;
    });
  const countText = `${summary.total} ${summary.total === 1 ? 'elemento' : 'elementos'}`;
  return `Se borrarán para siempre ${countText}${counts.length ? `: ${counts.join(', ')}` : ''}. No se puede deshacer.`;
}

export function renderPapelera() {
  return `
    <section>
      <a class="back-link" href="#/mas">‹ Más</a>
      <div class="trash-heading">
        <h2>Papelera</h2>
        <button class="danger-button trash-empty-button" type="button" data-trash-empty disabled>
          ${renderIcon('trash')}<span>Vaciar papelera</span>
        </button>
      </div>
      <p class="trash-feedback" id="trash-feedback" role="status">Cargando papelera…</p>
      <p class="trash-notice" id="trash-notice" role="status" hidden></p>
      <div class="trash-groups" id="trash-groups"></div>
      <dialog class="trash-confirm-dialog" id="trash-confirm-dialog" aria-labelledby="trash-dialog-title">
        <form id="trash-confirm-form">
          <h2 id="trash-dialog-title">Vaciar papelera</h2>
          <p id="trash-confirm-message"></p>
          <label class="trash-confirm-word" id="trash-confirm-word" hidden>
            Escribe BORRAR para continuar
            <input id="trash-confirm-input" type="text" autocomplete="off" />
          </label>
          <div class="trash-confirm-actions">
            <button class="secondary-button" type="button" data-trash-cancel autofocus>Cancelar</button>
            <button class="danger-button" type="submit" data-trash-confirm disabled>Vaciar</button>
          </div>
        </form>
      </dialog>
    </section>
  `;
}

export function mountPapelera(root) {
  const feedback = root.querySelector('#trash-feedback');
  const groups = root.querySelector('#trash-groups');
  const emptyButton = root.querySelector('[data-trash-empty]');
  const dialog = root.querySelector('#trash-confirm-dialog');
  const dialogMessage = root.querySelector('#trash-confirm-message');
  const confirmWord = root.querySelector('#trash-confirm-word');
  const confirmInput = root.querySelector('#trash-confirm-input');
  const confirmButton = root.querySelector('[data-trash-confirm]');
  let clearCount = 0;
  let noticeTimer;

  async function render() {
    try {
      const [deletedGroups, summary] = await Promise.all([
        getTrashRecords(),
        getTrashClearSummary(),
      ]);
      emptyButton.disabled = summary.total === 0;
      if (!deletedGroups.length) {
        feedback.textContent = 'La papelera está vacía';
        feedback.hidden = false;
        groups.innerHTML = '';
        return;
      }
      feedback.hidden = true;
      groups.innerHTML = deletedGroups.map((group) => `
        <section class="panel trash-group">
          <h3>${escapeHtml(group.label)}</h3>
          ${group.items.map((item) => `
            <article class="trash-item">
              <div>
                <strong>${escapeHtml(item.label)}</strong>
                <p class="muted">Enviado a la papelera: ${escapeHtml(
                  item.fecha_eliminado ? new Date(item.fecha_eliminado).toLocaleDateString() : 'fecha no disponible',
                )}</p>
                ${item.usageNote ? `<p class="trash-in-use">${escapeHtml(item.usageNote)}</p>` : ''}
              </div>
              <div class="trash-actions">
                <button class="secondary-button" type="button" data-trash-restore="${escapeHtml(item.id)}"
                  data-trash-table="${escapeHtml(group.table)}">Restaurar</button>
                <button class="danger-button" type="button" data-trash-delete="${escapeHtml(item.id)}"
                  data-trash-table="${escapeHtml(group.table)}" ${item.inUse ? 'disabled' : ''}>Borrar definitivamente</button>
              </div>
            </article>
          `).join('')}
        </section>
      `).join('');
    } catch (error) {
      console.error('No se pudo cargar la papelera.', error);
      feedback.textContent = 'No se pudo cargar la papelera. Inténtalo de nuevo.';
      feedback.hidden = false;
      feedback.setAttribute('role', 'alert');
    }
  }

  root.addEventListener('click', async (event) => {
    const restoreButton = event.target.closest('[data-trash-restore]');
    const deleteButton = event.target.closest('[data-trash-delete]');
    const emptyTrashButton = event.target.closest('[data-trash-empty]');
    const cancelClear = event.target.closest('[data-trash-cancel]');
    if (cancelClear) {
      dialog.close();
      return;
    }
    if (emptyTrashButton) {
      try {
        const summary = await getTrashClearSummary();
        clearCount = summary.total;
        if (!clearCount) {
          await render();
          return;
        }
        dialogMessage.textContent = formatDeletionSummary(summary);
        const needsWord = clearCount > 20;
        confirmWord.hidden = !needsWord;
        confirmInput.value = '';
        confirmButton.disabled = needsWord;
        dialog.showModal();
      } catch (error) {
        console.error('No se pudo preparar el vaciado de la papelera.', error);
        feedback.textContent = error.message || 'No se pudo preparar el vaciado de la papelera.';
        feedback.hidden = false;
        feedback.setAttribute('role', 'alert');
      }
      return;
    }
    if (restoreButton) {
      try {
        await restoreTrashRecord(restoreButton.dataset.trashTable, restoreButton.dataset.trashRestore);
        await render();
      } catch (error) {
        console.error('No se pudo restaurar el elemento.', error);
        feedback.textContent = error.message || 'No se pudo restaurar el elemento.';
        feedback.hidden = false;
        feedback.setAttribute('role', 'alert');
      }
      return;
    }
    if (!deleteButton) return;
    try {
      const impact = await getTrashImpact(deleteButton.dataset.trashTable, deleteButton.dataset.trashDelete);
      const label = deleteButton.closest('.trash-item').querySelector('strong').textContent;
      if (!window.confirm(
        `¿Borrar definitivamente "${label}"? No se podrá deshacer.${impact}`,
      )) return;
      await permanentlyDeleteTrashRecord(deleteButton.dataset.trashTable, deleteButton.dataset.trashDelete);
      await render();
    } catch (error) {
      console.error('No se pudo borrar definitivamente el elemento.', error);
      feedback.textContent = error.message || 'No se pudo borrar definitivamente el elemento.';
      feedback.hidden = false;
      feedback.setAttribute('role', 'alert');
    }
  });

  confirmInput.addEventListener('input', () => {
    confirmButton.disabled = clearCount > 20 && confirmInput.value !== 'BORRAR';
  });

  root.querySelector('#trash-confirm-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (clearCount > 20 && confirmInput.value !== 'BORRAR') return;
    confirmButton.disabled = true;
    try {
      const deletedCount = await emptyTrash();
      dialog.close();
      await render();
      const notice = root.querySelector('#trash-notice');
      notice.textContent = `Papelera vaciada (${deletedCount} elementos)`;
      notice.hidden = false;
      window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => {
        notice.hidden = true;
      }, 5000);
    } catch (error) {
      console.error('No se pudo vaciar la papelera.', error);
      confirmButton.disabled = false;
      feedback.textContent = error.message || 'No se pudo vaciar la papelera. No se borró ningún elemento.';
      feedback.hidden = false;
      feedback.setAttribute('role', 'alert');
    }
  });

  render();
}
