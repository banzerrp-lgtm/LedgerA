import { getMaxWorkTypeLevels, saveMaxWorkTypeLevels } from '../db/tipos-trabajo.js';
import {
  downloadBackupFile,
  downloadExcelFile,
  exportBackupDocument,
  exportExcelWorkbook,
  importBackupDocument,
} from '../db/respaldo.js';
import { validateAndMigrateBackup } from '../logic/respaldo.js';

export function renderAjustes() {
  const theme = document.documentElement.dataset.theme;
  const preference = theme === 'dark' ? 'oscuro' : theme === 'light' ? 'claro' : 'auto';

  return `
    <section class="panel">
      <h2>Apariencia</h2>
      <div class="settings-field">
        <span class="settings-label">Tema</span>
        <div class="theme-segmented" role="group" aria-label="Tema de Ledger">
          ${[
            ['auto', 'Automático'],
            ['claro', 'Claro'],
            ['oscuro', 'Oscuro'],
          ].map(([value, label]) => `
            <button type="button" data-theme-choice="${value}"
              aria-pressed="${preference === value}">${label}</button>
          `).join('')}
        </div>
      </div>
    </section>
    <section class="panel">
      <h2>Tipos de trabajo</h2>
      <div class="settings-field">
        <label for="max-work-type-levels">Máximo de niveles</label>
        <select id="max-work-type-levels" name="max_niveles" disabled>
          <option value="1">1 nivel</option>
          <option value="2">2 niveles</option>
          <option value="3">3 niveles</option>
          <option value="4" selected>4 niveles</option>
        </select>
        <p class="settings-feedback" id="max-work-type-feedback" role="status"></p>
      </div>
    </section>
    <section class="panel">
      <h2>Respaldo y exportación</h2>
      <p>Guarda una copia de tus datos o consulta tus tablas en Excel. Los archivos permanecen en tu dispositivo.</p>
      <div class="backup-actions">
        <button class="primary-button" type="button" data-backup-action="export-json">
          Descargar respaldo JSON
        </button>
        <button class="secondary-button" type="button" data-backup-action="import-json">
          Importar respaldo JSON
        </button>
        <button class="secondary-button" type="button" data-backup-action="export-excel">
          Exportar a Excel
        </button>
        <input type="file" accept="application/json,.json" data-backup-file hidden />
      </div>
      <p class="settings-feedback" data-backup-feedback role="status" aria-live="polite"></p>
    </section>
  `;
}

export function mountAjustes(root) {
  const select = root.querySelector('#max-work-type-levels');
  const feedback = root.querySelector('#max-work-type-feedback');
  const backupFeedback = root.querySelector('[data-backup-feedback]');
  const backupFile = root.querySelector('[data-backup-file]');

  getMaxWorkTypeLevels()
    .then((maxLevels) => {
      select.value = String(maxLevels);
      select.disabled = false;
    })
    .catch((error) => {
      console.error('No se pudo leer el máximo de niveles.', error);
      feedback.textContent = 'No se pudo cargar el ajuste. Inténtalo de nuevo.';
      feedback.setAttribute('role', 'alert');
    });

  select.addEventListener('change', async () => {
    select.disabled = true;
    feedback.textContent = 'Guardando…';
    try {
      await saveMaxWorkTypeLevels(Number(select.value));
      feedback.textContent = 'Máximo de niveles guardado.';
      feedback.setAttribute('role', 'status');
    } catch (error) {
      console.error('No se pudo guardar el máximo de niveles.', error);
      feedback.textContent = 'No se pudo guardar el ajuste. Inténtalo de nuevo.';
      feedback.setAttribute('role', 'alert');
    } finally {
      select.disabled = false;
    }
  });

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-backup-action]');
    if (!button) return;

    if (button.dataset.backupAction === 'import-json') {
      backupFile.click();
      return;
    }

    const controls = root.querySelectorAll('[data-backup-action]');
    controls.forEach((control) => { control.disabled = true; });
    backupFeedback.textContent = 'Preparando archivo…';
    backupFeedback.setAttribute('role', 'status');
    try {
      if (button.dataset.backupAction === 'export-json') {
        const backup = await exportBackupDocument();
        downloadBackupFile(backup);
        backupFeedback.textContent = 'Respaldo JSON descargado.';
      } else if (button.dataset.backupAction === 'export-excel') {
        const workbook = await exportExcelWorkbook();
        downloadExcelFile(workbook);
        backupFeedback.textContent = 'Archivo Excel descargado.';
      }
    } catch (error) {
      console.error('No se pudo exportar el respaldo.', error);
      backupFeedback.textContent = error.message || 'No se pudo exportar el archivo.';
      backupFeedback.setAttribute('role', 'alert');
    } finally {
      controls.forEach((control) => { control.disabled = false; });
    }
  });

  backupFile.addEventListener('change', async () => {
    const file = backupFile.files[0];
    if (!file) return;
    backupFile.disabled = true;
    backupFeedback.textContent = 'Validando respaldo…';
    backupFeedback.setAttribute('role', 'status');
    try {
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error('El archivo no contiene un JSON válido.');
      }
      const backup = validateAndMigrateBackup(parsed);
      if (!window.confirm(
        'Importar este archivo reemplazará todos los datos guardados en este celular. ¿Deseas continuar?',
      )) {
        backupFeedback.textContent = 'Importación cancelada; no se modificaron datos.';
        return;
      }
      await importBackupDocument(backup);
      backupFeedback.textContent = 'Respaldo importado correctamente.';
    } catch (error) {
      console.error('No se pudo importar el respaldo.', error);
      backupFeedback.textContent = error.message || 'No se pudo importar el respaldo.';
      backupFeedback.setAttribute('role', 'alert');
    } finally {
      backupFile.value = '';
      backupFile.disabled = false;
    }
  });
}
