import {
  getTrashImpact,
  getTrashRecords,
  permanentlyDeleteTrashRecord,
  restoreTrashRecord,
} from '../db/papelera.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function renderPapelera() {
  return `
    <section>
      <a class="back-link" href="#/mas">‹ Más</a>
      <h2>Papelera</h2>
      <p class="trash-feedback" id="trash-feedback" role="status">Cargando papelera…</p>
      <div class="trash-groups" id="trash-groups"></div>
    </section>
  `;
}

export function mountPapelera(root) {
  const feedback = root.querySelector('#trash-feedback');
  const groups = root.querySelector('#trash-groups');

  async function render() {
    try {
      const deletedGroups = await getTrashRecords();
      if (!deletedGroups.length) {
        feedback.textContent = 'La papelera está vacía.';
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
              </div>
              <div class="trash-actions">
                <button class="secondary-button" type="button" data-trash-restore="${escapeHtml(item.id)}"
                  data-trash-table="${escapeHtml(group.table)}">Restaurar</button>
                <button class="danger-button" type="button" data-trash-delete="${escapeHtml(item.id)}"
                  data-trash-table="${escapeHtml(group.table)}">Borrar definitivamente</button>
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

  render();
}
