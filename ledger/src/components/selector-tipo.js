import { getRecords } from '../db/db.js';
import { getMaxWorkTypeLevels, saveWorkTypeFromForm } from '../db/tipos-trabajo.js';
import {
  canAddTypeAtLevel,
  getActiveTypeChildren,
  getTypeDepth,
  isSelectableWorkType,
} from '../logic/tipos-trabajo.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function renderSelectorTipo({ name = 'tipo_id', label = 'Tipo de trabajo' } = {}) {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
  return `
    <div class="type-selector" data-type-selector>
      <p class="type-selector-label">${escapeHtml(label)}</p>
      <div class="type-selector-levels" data-type-levels></div>
      <input type="hidden" name="${escapeHtml(safeName)}" data-selected-type />
      <p class="type-feedback" data-type-feedback role="status"></p>
      <button class="secondary-button" type="button" data-type-action="new">
        + Crear tipo nuevo
      </button>
      <div class="panel work-type-form type-selector-form" data-type-form hidden>
        <h3>Crear tipo de trabajo</h3>
        <label>
          Nombre
          <input name="nombre" type="text" maxlength="120" required disabled />
        </label>
        <label>
          Precio sugerido (Bs, opcional)
          <input name="precio_sugerido" type="text" inputmode="decimal" placeholder="Ej.: 150,00" />
        </label>
        <p class="type-feedback" data-form-feedback role="status" hidden></p>
        <div class="client-form-actions">
          <button class="primary-button" type="button" data-type-action="save-new">Guardar y elegir</button>
          <button class="secondary-button" type="button" data-type-action="cancel-new">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

export function mountSelectorTipo(root, { onSelect = () => {}, initialTypeId = null } = {}) {
  const levels = root.querySelector('[data-type-levels]');
  const hiddenInput = root.querySelector('[data-selected-type]');
  const feedback = root.querySelector('[data-type-feedback]');
  const form = root.querySelector('[data-type-form]');
  const formFeedback = root.querySelector('[data-form-feedback]');
  let types = [];
  let maxLevels = 4;
  let selectedPath = [];

  function selectedParentForNewType() {
    const selected = types.find((type) => type.id === selectedPath.at(-1));
    if (!selected) return null;
    return getActiveTypeChildren(types, selected.id).length
      ? selected.id
      : selected.padre_id;
  }

  function renderLevels() {
    let markup = '';
    let parentId = null;
    let stillFollowingPath = true;

    for (let level = 0; level <= types.length; level += 1) {
      const options = getActiveTypeChildren(types, parentId);
      if (!options.length) break;
      const selectedId = stillFollowingPath ? selectedPath[level] : undefined;
      markup += `
        <label>
          Nivel ${level + 1}
          <select class="type-level-select" data-level="${level}">
            <option value="">Elige un tipo…</option>
            ${options.map((type) => `
              <option value="${escapeHtml(type.id)}" ${type.id === selectedId ? 'selected' : ''}>
                ${escapeHtml(type.nombre)}
              </option>
            `).join('')}
          </select>
        </label>
      `;
      if (!selectedId) break;
      const selected = options.find((type) => type.id === selectedId);
      if (!selected) {
        stillFollowingPath = false;
        break;
      }
      parentId = selected.id;
    }

    levels.innerHTML = markup;
    const selectedType = types.find((type) => type.id === selectedPath.at(-1));
    if (selectedType && isSelectableWorkType(types, selectedType.id)) {
      hiddenInput.value = selectedType.id;
    } else {
      hiddenInput.value = '';
    }
  }

  async function loadTypes() {
    [types, maxLevels] = await Promise.all([
      getRecords('tipos_trabajo'),
      getMaxWorkTypeLevels(),
    ]);
    types = types.filter((type) => type.activo);
    if (initialTypeId && !selectedPath.length) {
      const selected = types.find((type) => type.id === initialTypeId);
      if (selected) {
        const ancestors = [];
        const visited = new Set();
        let current = selected;
        while (current) {
          if (visited.has(current.id)) throw new Error('La jerarquía de tipos contiene un ciclo.');
          visited.add(current.id);
          ancestors.unshift(current.id);
          current = current.padre_id === null
            ? null
            : types.find((type) => type.id === current.padre_id);
        }
        selectedPath = ancestors;
        feedback.textContent = isSelectableWorkType(types, selected.id)
          ? `Tipo seleccionado: ${selected.nombre}.`
          : `Elige un subnivel de ${selected.nombre}.`;
      }
    }
    renderLevels();
  }

  root.addEventListener('change', (event) => {
    const select = event.target.closest('select[data-level]');
    if (!select) return;
    const level = Number(select.dataset.level);
    selectedPath = selectedPath.slice(0, level);
    if (select.value) selectedPath.push(select.value);
    renderLevels();

    const selected = types.find((type) => type.id === selectedPath.at(-1));
    if (!selected) {
      feedback.textContent = '';
      onSelect(null);
    } else if (isSelectableWorkType(types, selected.id)) {
      feedback.textContent = `Tipo seleccionado: ${selected.nombre}.`;
      onSelect(selected);
    } else {
      feedback.textContent = `Elige un subnivel de ${selected.nombre}.`;
      onSelect(null);
    }
  });

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-type-action]');
    if (!button) return;
    if (button.dataset.typeAction === 'cancel-new') {
      form.hidden = true;
      form.querySelector('[name="nombre"]').disabled = true;
      return;
    }
    if (button.dataset.typeAction === 'save-new') {
      const nameInput = form.querySelector('[name="nombre"]');
      const priceInput = form.querySelector('[name="precio_sugerido"]');
      if (!nameInput.reportValidity()) return;
      formFeedback.hidden = true;
      const parentId = form.dataset.parentId || null;
      try {
        const created = await saveWorkTypeFromForm({
          nombre: nameInput.value,
          precio_sugerido: priceInput.value,
          padre_id: parentId,
        }, maxLevels);
        await loadTypes();
        const path = [];
        let current = created;
        while (current) {
          path.unshift(current.id);
          current = current.padre_id === null
            ? null
            : types.find((type) => type.id === current.padre_id);
        }
        selectedPath = path;
        renderLevels();
        feedback.textContent = `Tipo seleccionado: ${created.nombre}.`;
        form.hidden = true;
        nameInput.disabled = true;
        onSelect(created);
      } catch (error) {
        formFeedback.hidden = false;
        formFeedback.textContent = error.message || 'No se pudo crear el tipo. Inténtalo de nuevo.';
        formFeedback.setAttribute('role', 'alert');
      }
      return;
    }
    if (button.dataset.typeAction !== 'new') return;

    const parentId = selectedParentForNewType();
    if (!canAddTypeAtLevel(types, parentId, maxLevels)) {
      feedback.textContent = `No puedes agregar otro nivel. El máximo configurado es ${maxLevels}.`;
      return;
    }
    form.querySelector('[name="nombre"]').value = '';
    form.querySelector('[name="precio_sugerido"]').value = '';
    form.dataset.parentId = parentId ?? '';
    formFeedback.hidden = true;
    form.querySelector('[name="nombre"]').disabled = false;
    form.hidden = false;
    form.querySelector('[name="nombre"]').focus();
  });

  loadTypes().catch((error) => {
    console.error('No se pudo cargar el selector de tipos de trabajo.', error);
    feedback.textContent = 'No se pudieron cargar los tipos de trabajo.';
    feedback.setAttribute('role', 'alert');
  });

  return {
    getSelectedTypeId: () => {
      const selections = [...levels.querySelectorAll('select[data-level]')];
      return [...selections].reverse().find((select) => select.value)?.value ?? null;
    },
    getTypes: () => types,
    getSelectedDepth: () => {
      const typeId = hiddenInput.value;
      return typeId ? getTypeDepth(types, types.find((type) => type.id === typeId)?.padre_id) + 1 : 0;
    },
  };
}
