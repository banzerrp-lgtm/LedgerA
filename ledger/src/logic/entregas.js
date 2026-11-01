const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseLocalDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new Error('La fecha de entrega debe tener el formato AAAA-MM-DD.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    throw new Error('La fecha de entrega no es válida.');
  }
  return { year, month, day };
}

function localDayNumber({ year, month, day }) {
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function localDateParts(date) {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

export function getDeliveryDayDifference(dateString, now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('La fecha de referencia no es válida.');
  }
  return localDayNumber(parseLocalDate(dateString)) - localDayNumber(localDateParts(now));
}

export function classifyDelivery(line, now = new Date()) {
  const daysUntil = getDeliveryDayDifference(line.fecha_entrega, now);
  const hasTime = Boolean(line.hora_entrega);
  if (hasTime && !TIME_PATTERN.test(line.hora_entrega)) {
    throw new Error('La hora de entrega no es válida.');
  }

  const currentTime = now.getHours() * 60 + now.getMinutes();
  const deliveryTime = hasTime
    ? Number(line.hora_entrega.slice(0, 2)) * 60 + Number(line.hora_entrega.slice(3, 5))
    : null;
  const overdue = daysUntil < 0 || (daysUntil === 0 && hasTime && deliveryTime < currentTime);

  let color;
  let label;
  if (daysUntil <= 1) {
    color = 'rojo';
    label = overdue
      ? 'VENCIDO'
      : daysUntil === 0
        ? 'Hoy'
        : 'Mañana';
  } else if (daysUntil === 2) {
    color = 'amarillo';
    label = 'Pasado mañana';
  } else {
    color = 'verde';
    label = `En ${daysUntil} días`;
  }

  return { color, label, overdue, daysUntil };
}

export function sortUpcomingDeliveries(lines, now = new Date()) {
  const dueLines = lines
    .filter((line) => ['pendiente', 'en_proceso'].includes(line.estado))
    .map((line) => ({ ...line, entrega: classifyDelivery(line, now) }));

  return dueLines.sort((left, right) => {
    const leftGroup = left.prioridad && left.entrega.overdue
      ? 0
      : left.entrega.overdue
        ? 1
        : 2;
    const rightGroup = right.prioridad && right.entrega.overdue
      ? 0
      : right.entrega.overdue
        ? 1
        : 2;
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    if (left.entrega.daysUntil !== right.entrega.daysUntil) {
      return left.entrega.daysUntil - right.entrega.daysUntil;
    }

    const leftHasTime = Boolean(left.hora_entrega);
    const rightHasTime = Boolean(right.hora_entrega);
    if (leftHasTime !== rightHasTime) return leftHasTime ? -1 : 1;
    if (leftHasTime && left.hora_entrega !== right.hora_entrega) {
      return left.hora_entrega.localeCompare(right.hora_entrega);
    }
    return String(left.id).localeCompare(String(right.id));
  });
}
