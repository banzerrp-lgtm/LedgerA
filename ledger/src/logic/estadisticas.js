import { calculateBalances } from './saldos.js';

const DAY_MS = 86_400_000;

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null;
  return date;
}

function shiftDateKey(value, days) {
  const date = parseDateKey(value);
  if (!date) throw new Error('La fecha del periodo no es válida.');
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function getPeriodRange(period, now = new Date()) {
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from;
  let to;
  if (period === 'semana') {
    const weekday = (current.getDay() + 6) % 7;
    current.setDate(current.getDate() - weekday);
    from = toDateKey(current);
    to = shiftDateKey(from, 6);
  } else if (period === 'mes') {
    from = toDateKey(new Date(current.getFullYear(), current.getMonth(), 1));
    to = toDateKey(new Date(current.getFullYear(), current.getMonth() + 1, 0));
  } else if (period === 'año') {
    from = toDateKey(new Date(current.getFullYear(), 0, 1));
    to = toDateKey(new Date(current.getFullYear(), 11, 31));
  } else {
    throw new Error('El periodo de estadísticas no es válido.');
  }
  let previousFrom;
  let previousTo;
  if (period === 'semana') {
    previousTo = shiftDateKey(from, -1);
    previousFrom = shiftDateKey(previousTo, -6);
  } else if (period === 'mes') {
    const firstOfCurrentMonth = parseDateKey(from);
    previousFrom = toDateKey(new Date(firstOfCurrentMonth.getFullYear(), firstOfCurrentMonth.getMonth() - 1, 1));
    previousTo = shiftDateKey(from, -1);
  } else {
    const year = Number(from.slice(0, 4)) - 1;
    previousFrom = `${year}-01-01`;
    previousTo = `${year}-12-31`;
  }
  return { from, to, previousFrom, previousTo };
}

function paymentValue(payment) {
  if (!Number.isSafeInteger(payment.monto) || payment.monto <= 0) return 0;
  if (payment.tipo === 'cobro') return payment.monto;
  if (payment.tipo === 'devolucion') return -payment.monto;
  return 0;
}

function allocateAmount(amount, lines) {
  const eligible = lines.filter((line) => line.estado !== 'cancelado' && line.precio_acordado > 0);
  const total = eligible.reduce((sum, line) => sum + BigInt(line.precio_acordado), 0n);
  if (!eligible.length || !total) return [];
  const absoluteAmount = BigInt(Math.abs(amount));
  const sign = amount < 0 ? -1 : 1;
  const parts = eligible.map((line) => {
    const numerator = absoluteAmount * BigInt(line.precio_acordado);
    return {
      line,
      amount: Number(numerator / total),
      remainder: numerator % total,
    };
  });
  parts.sort((left, right) =>
    (left.remainder === right.remainder ? 0 : left.remainder > right.remainder ? -1 : 1)
      || left.line.id.localeCompare(right.line.id),
  );
  const baseTotal = parts.reduce((sum, part) => sum + part.amount, 0);
  for (let remaining = Math.abs(amount) - baseTotal, index = 0; remaining; remaining -= 1, index += 1) {
    parts[index % parts.length].amount += 1;
  }
  return parts.filter((part) => part.amount).map(({ line, amount: value }) => ({
    line,
    amount: value * sign,
  }));
}

function addToMap(map, key, amount) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function getChartBuckets(period, range) {
  const keys = [];
  if (period === 'año') {
    const year = Number(range.from.slice(0, 4));
    for (let month = 0; month < 12; month += 1) {
      keys.push(`${year}-${String(month + 1).padStart(2, '0')}`);
    }
  } else {
    const from = parseDateKey(range.from);
    const count = period === 'semana' ? 7 : parseDateKey(range.to).getDate();
    for (let day = 0; day < count; day += 1) {
      const date = new Date(from);
      date.setDate(date.getDate() + day);
      keys.push(toDateKey(date));
    }
  }
  return keys;
}

function periodLabel(key, period) {
  const date = period === 'año' ? new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1) : parseDateKey(key);
  return period === 'año'
    ? new Intl.DateTimeFormat('es', { month: 'short' }).format(date)
    : `${date.getDate()}`;
}

export function calculateStatistics(data, period = 'mes', now = new Date()) {
  const range = getPeriodRange(period, now);
  const orders = data.orders ?? [];
  const lines = data.lines ?? [];
  const payments = data.payments ?? [];
  const clients = data.clients ?? [];
  const types = data.types ?? [];
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const linesByOrder = new Map();
  const linesById = new Map(lines.map((line) => [line.id, line]));
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const typesById = new Map(types.map((type) => [type.id, type]));
  for (const line of lines) {
    const grouped = linesByOrder.get(line.pedido_id) ?? [];
    grouped.push(line);
    linesByOrder.set(line.pedido_id, grouped);
  }

  const periodNet = new Map();
  const typeTotals = new Map();
  const clientTotals = new Map();
  let total = 0;
  let previousTotal = 0;

  for (const payment of payments) {
    const date = typeof payment.fecha === 'string' ? payment.fecha.slice(0, 10) : '';
    const value = paymentValue(payment);
    if (!value || !parseDateKey(date)) continue;
    const order = ordersById.get(payment.pedido_id);
    if (!order) continue;
    const isCurrent = date >= range.from && date <= range.to;
    const isPrevious = date >= range.previousFrom && date <= range.previousTo;
    if (!isCurrent && !isPrevious) continue;

    if (isCurrent) {
      total += value;
      addToMap(periodNet, period === 'año' ? date.slice(0, 7) : date, value);
    } else {
      previousTotal += value;
    }

    const signedAllocations = [];
    const linkedLine = payment.linea_id ? linesById.get(payment.linea_id) : null;
    if (linkedLine && linkedLine.pedido_id === payment.pedido_id) {
      signedAllocations.push({ line: linkedLine, amount: value });
    } else {
      signedAllocations.push(...allocateAmount(value, linesByOrder.get(payment.pedido_id) ?? []));
    }
    if (!signedAllocations.length) signedAllocations.push({ line: null, amount: value });

    if (isCurrent) {
      for (const allocation of signedAllocations) {
        const typeId = allocation.line?.tipo_id ?? 'sin-tipo';
        const typeName = typesById.get(typeId)?.nombre ?? 'Sin tipo';
        const summary = typeTotals.get(typeId) ?? { id: typeId, nombre: typeName, total: 0 };
        summary.total += allocation.amount;
        typeTotals.set(typeId, summary);
      }
      if (order) {
        const clientId = order.cliente_id;
        const summary = clientTotals.get(clientId) ?? {
          id: clientId,
          nombre: clientsById.get(clientId)?.nombre ?? 'Cliente no disponible',
          total: 0,
        };
        summary.total += value;
        clientTotals.set(clientId, summary);
      }
    }
  }

  const balances = calculateBalances({ clients, orders, lines, payments });
  const receivable = balances.pedidos.reduce(
    (sum, order) => sum + Math.max(0, order.por_cobrar),
    0,
  );
  const chartKeys = getChartBuckets(period, range);
  const chartValues = chartKeys.map((key) => periodNet.get(key) ?? 0);
  const typeBreakdown = [...typeTotals.values()]
    .filter((entry) => entry.total !== 0)
    .sort((left, right) => right.total - left.total || left.nombre.localeCompare(right.nombre, 'es'));
  const topClients = [...clientTotals.values()]
    .filter((entry) => entry.total > 0)
    .sort((left, right) => right.total - left.total || left.nombre.localeCompare(right.nombre, 'es'))
    .slice(0, 5);

  return {
    period,
    range,
    total,
    previousTotal,
    difference: total - previousTotal,
    changePercent: previousTotal === 0 ? null : ((total - previousTotal) / Math.abs(previousTotal)) * 100,
    receivable,
    chartLabels: chartKeys.map((key) => periodLabel(key, period)),
    chartValues,
    typeBreakdown,
    topClients,
  };
}
