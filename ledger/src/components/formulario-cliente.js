function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function renderFormularioCliente(cliente = {}, { idPrefix = 'client' } = {}) {
  const formId = `${idPrefix}-form`;
  return `
    <form class="panel client-form" id="${escapeHtml(formId)}" hidden>
      <h2 id="${escapeHtml(idPrefix)}-form-title">Nuevo cliente</h2>
      <label>
        Nombre
        <input name="nombre" type="text" autocomplete="name" maxlength="120" required
          value="${escapeHtml(cliente.nombre)}" />
      </label>
      <div class="client-phone-fields">
        <label>
          Código
          <input name="codigo_pais" type="tel" inputmode="tel" autocomplete="tel-country-code"
            pattern="\\+?[0-9]{1,4}" maxlength="5" required value="${escapeHtml(cliente.codigo_pais || '+591')}" />
        </label>
        <label>
          Teléfono
          <input name="telefono" type="tel" inputmode="tel" autocomplete="tel-national"
            pattern="[0-9 ()+.-]{5,24}" maxlength="24" required
            value="${escapeHtml(cliente.telefono)}" />
        </label>
      </div>
      <label>
        Notas (opcional)
        <textarea name="notas" maxlength="1000">${escapeHtml(cliente.notas)}</textarea>
      </label>
      <p class="client-feedback" id="${escapeHtml(idPrefix)}-duplicate-warning" role="status" hidden></p>
      <div class="client-form-actions">
        <button class="primary-button" type="submit">Guardar cliente</button>
        <button class="secondary-button" type="button" data-action="cancel-form">Cancelar</button>
      </div>
    </form>
  `;
}

export function obtenerDatosCliente(form) {
  const formData = new FormData(form);
  const codigoPaisDigits = String(formData.get('codigo_pais') || '').replace(/\D/g, '');
  const telefonoDigits = String(formData.get('telefono') || '').replace(/\D/g, '');

  return {
    nombre: String(formData.get('nombre') || '').trim(),
    codigo_pais: codigoPaisDigits ? `+${codigoPaisDigits}` : '',
    telefono: telefonoDigits,
    notas: String(formData.get('notas') || '').trim(),
  };
}
