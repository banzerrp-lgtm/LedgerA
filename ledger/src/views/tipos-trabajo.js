import {
  activateWorkType,
  deactivateWorkType,
  getMaxWorkTypeLevels,
  saveWorkTypeFromForm,
} from '../db/tipos-trabajo.js';
import { getRecords, softDeleteRecord } from '../db/db.js';
import { countTypeJobs } from '../db/papelera.js';
import { buildTypeTree, formatSuggestedPrice } from '../logic/tipos-trabajo.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function priceInputValue(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) return '';
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export function renderTiposTrabajo() {
  return `
    <section aria-labelledby="work-types-title">
      <div class="type-catalog-toolbar">
        <div>
          <h2 id="work-types-title">Tipos de trabajo</h2>
          <p class="muted" id="work-type-limit">Cargando límite de niveles…</p>
        </div>
        <button class="primary-button" type="button" data-type-action="new-root">+ Agregar tipo</button>
      </div>
      <form class="panel work-type-form" id="work-type-form" hidden>
        <h3 id="work-type-form-title">Nuevo tipo</h3>
        <label>
          Nombre
          <input name="nombre" type="text" maxlength="120" required />
        </label>
        <label>
          Precio sugerido (Bs, opcional)
          <input name="precio_sugerido" type="text" inputmode="decimal"
            placeholder="Ej.: 150,00" />
        </label>
        <p class="type-feedback" id="work-type-form-feedback" role="status" hidden></p>
        <div class="client-form-actions">
          <button class="primary-button" type="submit">Guardar tipo</button>
          <button class="secondary-button" type="button" data-type-action="cancel">Cancelar</button>
        </div>
      </form>
      <p class="type-feedback" id="work-type-feedback" role="status">Cargando tipos de trabajo…</p>
      <div id="work-type-tree"></div>
    </section>
  `;
}

export function mountTiposTrabajo(root) {
  const treeContainer = root.querySelector('#work-type-tree');
  const feedback = root.querySelector('#work-type-feedback');
  const limitLabel = root.querySelector('#work-type-limit');
  const form = root.querySelector('#work-type-form');
  const formTitle = root.querySelector('#work-type-form-title');
  const formFeedback = root.querySelector('#work-type-form-feedback');
  let types = [];
  let maxLevels = 4;
  let editingId = null;

  function renderNode(node, level) {
    const active = Boolean(node.activo);
    const price = node.precio_sugerido == null
      ? 'Sin precio sugerido'
      : formatSuggestedPrice(node.precio_sugerido);
    const addChildButton = active && level < maxLevels
      ? `<button class="secondary-button" type="button" data-type-action="add-child" data-id="${escapeHtml(node.id)}">+ Agregar subnivel</button>`
      : '';
    const toggleButton = active
      ? `<button class="secondary-button" type="button" data-type-action="deactivate" data-id="${escapeHtml(node.id)}">Desactivar</button>`
      : `<button class="secondary-button" type="button" data-type-action="activate" data-id="${escapeHtml(node.id)}">Activar</button>`;
    const deleteButton = node.children.length === 0
      ? `<button class="danger-button" type="button" data-type-action="delete" data-id="${escapeHtml(node.id)}">Enviar a papelera</button>`
      : '';

    return `
      <li class="work-type-node">
        <div class="work-type-card ${active ? '' : 'work-type-card--inactive'}">
          <div class="work-type-info">
            <strong>${escapeHtml(node.nombre)}</strong>
            <span class="muted">${escapeHtml(price)} · ${active ? 'Activo' : 'Inactivo'}</span>
          </div>
          <div class="work-type-actions">
            ${addChildButton}
            <button class="secondary-button" type="button" data-type-action="edit"
              data-id="${escapeHtml(node.id)}">Editar</button>
            ${toggleButton}
            ${deleteButton}
          </div>
        </div>
        ${node.children.length
          ? `<ol class="work-type-children">${node.children.map((child) => renderNode(child, level + 1)).join('')}</ol>`
          : ''}
      </li>
    `;
  }

  function renderTree() {
    const tree = buildTypeTree(types);
    treeContainer.innerHTML = tree.length
      ? `<ol class="work-type-tree">${tree.map((node) => renderNode(node, 1)).join('')}</ol>`
      : '<div class="panel empty-state"><p>No hay tipos de trabajo. Agrega el primero.</p></div>';
    feedback.hidden = true;
  }

  async function loadTypes() {
    feedback.hidden = false;
    feedback.textContent = 'Cargando tipos de trabajo…';
    try {
      [types, maxLevels] = await Promise.all([
        getRecords('tipos_trabajo'),
        getMaxWorkTypeLevels(),
      ]);
      limitLabel.textContent = `Máximo: ${maxLevels} ${maxLevels === 1 ? 'nivel' : 'niveles'}. Puedes cambiarlo en Ajustes.`;
      renderTree();
    } catch (error) {
      console.error('No se pudieron cargar los tipos de trabajo.', error);
      feedback.textContent = 'No se pudieron cargar los tipos de trabajo. Inténtalo de nuevo.';
      feedback.setAttribute('role', 'alert');
    }
  }

  function showForm({ type = null, parentId = null } = {}) {
    editingId = type?.id ?? null;
    form.reset();
    form.elements.nombre.value = type?.nombre ?? '';
    form.elements.precio_sugerido.value = priceInputValue(type?.precio_sugerido);
    form.dataset.parentId = parentId ?? '';
    formTitle.textContent = type ? 'Editar tipo de trabajo' : 'Nuevo tipo de trabajo';
    formFeedback.hidden = true;
    form.hidden = false;
    form.elements.nombre.focus();
  }

  function hideForm() {
    form.hidden = true;
    editingId = null;
    form.dataset.parentId = '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formFeedback.hidden = true;
    try {
      await saveWorkTypeFromForm({
        id: editingId,
        nombre: form.elements.nombre.value,
        precio_sugerido: form.elements.precio_sugerido.value,
        padre_id: editingId ? undefined : (form.dataset.parentId || null),
      }, maxLevels);
      hideForm();
      await loadTypes();
    } catch (error) {
      formFeedback.hidden = false;
      formFeedback.textContent = error.message || 'No se pudo guardar el tipo. Inténtalo de nuevo.';
      formFeedback.setAttribute('role', 'alert');
    }
  });

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-type-action]');
    if (!button) return;

    const { typeAction, id } = button.dataset;
    if (typeAction === 'new-root') {
      showForm();
      return;
    }
    if (typeAction === 'cancel') {
      hideForm();
      return;
    }
    if (typeAction === 'add-child') {
      const parent = types.find((type) => type.id === id);
      if (parent) showForm({ parentId: parent.id });
      return;
    }
    if (typeAction === 'edit') {
      const type = types.find((candidate) => candidate.id === id);
      if (type) showForm({ type });
      return;
    }
    try {
      if (typeAction === 'deactivate') {
        const type = types.find((candidate) => candidate.id === id);
        const descendants = types.filter((candidate) => candidate.padre_id === id).length;
        const detail = descendants
          ? ` También se desactivarán sus subniveles.`
          : '';
        if (!window.confirm(`¿Desactivar ${type?.nombre ?? 'este tipo'}?${detail}`)) return;
        await deactivateWorkType(id);
      } else if (typeAction === 'activate') {
        await activateWorkType(id);
      } else if (typeAction === 'delete') {
        const type = types.find((candidate) => candidate.id === id);
        const affectedJobs = await countTypeJobs(id);
        const warning = affectedJobs
          ? ` Esto afecta a ${affectedJobs} ${affectedJobs === 1 ? 'trabajo' : 'trabajos'}; las etiquetas se conservarán en el historial.`
          : '';
        if (!window.confirm(`¿Enviar a la papelera ${type?.nombre ?? 'este tipo'}?${warning}`)) return;
        await softDeleteRecord('tipos_trabajo', id);
      } else {
        return;
      }
      await loadTypes();
    } catch (error) {
      console.error('No se pudo actualizar el estado del tipo de trabajo.', error);
      feedback.hidden = false;
      feedback.textContent = error.message || 'No se pudo actualizar el tipo. Inténtalo de nuevo.';
      feedback.setAttribute('role', 'alert');
    }
  });

  loadTypes();
}
