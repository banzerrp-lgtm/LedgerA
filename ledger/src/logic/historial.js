function dateValue(value) {
  if (typeof value !== 'string') return '';
  return value.slice(0, 10);
}

export function completionDate(deliveryDate, lastPaymentDate) {
  return [dateValue(deliveryDate), dateValue(lastPaymentDate)]
    .filter(Boolean)
    .sort()
    .pop() ?? '';
}

export function filterCompletedHistory(history, {
  query = '',
  clientId = '',
  typeId = '',
  from = '',
  to = '',
} = {}) {
  const search = query.trim().toLocaleLowerCase('es');
  return history.filter((entry) => {
    const completedDate = dateValue(entry.fecha_terminado);
    if (clientId && entry.cliente_id !== clientId) return false;
    if (typeId && entry.tipo_id !== typeId) return false;
    if (from && completedDate < from) return false;
    if (to && completedDate > to) return false;
    if (!search) return true;
    return [
      entry.cliente_nombre,
      entry.descripcion,
      entry.tipo_nombre,
      entry.pedido_notas,
    ].some((value) => String(value ?? '').toLocaleLowerCase('es').includes(search));
  }).sort((left, right) =>
    dateValue(right.fecha_terminado).localeCompare(dateValue(left.fecha_terminado))
    || String(left.cliente_nombre ?? '').localeCompare(String(right.cliente_nombre ?? ''), 'es'),
  );
}

export function summarizePortfolio(history, { from = '', to = '' } = {}) {
  const filtered = history.filter((entry) => {
    const date = dateValue(entry.fecha_terminado);
    return (!from || date >= from) && (!to || date <= to);
  });
  const byType = new Map();
  for (const entry of filtered) {
    const key = entry.tipo_id ?? 'sin-tipo';
    const summary = byType.get(key) ?? {
      tipo_id: key,
      tipo_nombre: entry.tipo_nombre || 'Tipo no disponible',
      cantidad: 0,
      total: 0,
      pagado: 0,
    };
    summary.cantidad += 1;
    summary.total += entry.precio_acordado;
    summary.pagado += entry.pagos_aplicados;
    byType.set(key, summary);
  }
  return [...byType.values()].sort((left, right) =>
    right.cantidad - left.cantidad
    || left.tipo_nombre.localeCompare(right.tipo_nombre, 'es'),
  );
}

export function safeLocationUrl(value) {
  const candidate = String(value ?? '').trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
