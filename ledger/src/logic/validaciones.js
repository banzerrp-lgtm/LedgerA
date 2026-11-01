import { parseSuggestedPrice } from './tipos-trabajo.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function addError(errors, linea, campo, mensaje) {
  errors.push({ linea, campo, mensaje });
}

export function validarPedido({ pedido = {}, lineas = [], tiposTrabajo = [] } = {}) {
  const errors = [];
  if (!pedido.cliente_id) {
    addError(errors, null, 'cliente_id', 'Elige un cliente');
  }
  if (!Array.isArray(lineas) || !lineas.length) {
    addError(errors, null, 'lineas', 'Agrega al menos una línea');
    return errors;
  }
  if (!['adelanto', 'completo_inicio', 'contra_entrega'].includes(pedido.modalidad_pago)) {
    addError(errors, null, 'modalidad_pago', 'Elige una modalidad de pago válida');
  }

  try {
    const advance = parseSuggestedPrice(pedido.adelanto);
    if (advance !== null && advance < 0) {
      addError(errors, null, 'adelanto', 'El adelanto debe ser un monto válido en centavos');
    }
  } catch (error) {
    addError(errors, null, 'adelanto', error.message);
  }

  if (pedido.fecha_entrega_general && !isValidDate(pedido.fecha_entrega_general)) {
    addError(errors, null, 'fecha_entrega_general', 'La fecha general: la fecha no es válida');
  }

  lineas.forEach((line, index) => {
    const lineNumber = index + 1;
    const selectedType = tiposTrabajo.find((type) =>
      type.id === line.tipo_id && type.activo && !type.eliminado,
    );
    if (!selectedType) {
      addError(errors, lineNumber, 'tipo_id', `Línea ${lineNumber}: elige el tipo de trabajo`);
    } else if (tiposTrabajo.some((type) =>
      type.padre_id === selectedType.id && type.activo && !type.eliminado,
    )) {
      addError(errors, lineNumber, 'tipo_id', `Línea ${lineNumber}: elige el siguiente nivel`);
    }

    if (!String(line.titulo ?? '').trim()) {
      addError(errors, lineNumber, 'titulo', `Línea ${lineNumber}: escribe el título del trabajo`);
    }

    try {
      const price = parseSuggestedPrice(line.precio);
      if (price === null) {
        addError(errors, lineNumber, 'precio', `Línea ${lineNumber}: escribe el precio del trabajo`);
      }
    } catch (error) {
      addError(errors, lineNumber, 'precio', `Línea ${lineNumber}: ${error.message}`);
    }

    if (!line.fecha_entrega) {
      addError(errors, lineNumber, 'fecha_entrega', `Línea ${lineNumber}: agrega la fecha de entrega`);
    } else if (!isValidDate(line.fecha_entrega)) {
      addError(errors, lineNumber, 'fecha_entrega', `La fecha de la línea ${lineNumber}: la fecha no es válida`);
    }

    if (line.hora_entrega && !TIME_PATTERN.test(line.hora_entrega)) {
      addError(errors, lineNumber, 'hora_entrega', `Línea ${lineNumber}: la hora no es válida`);
    }
  });

  return errors;
}
