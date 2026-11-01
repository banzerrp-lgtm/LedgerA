import { createRecord, db, getRecord, getRecords, updateRecord } from './db.js';
import { getLineHistoryRecords } from './historial.js';
import { calculateBalances, calculateLineRefundAmount } from '../logic/saldos.js';
import { safeLocationUrl } from '../logic/historial.js';
import { isSelectableWorkType } from '../logic/tipos-trabajo.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function validateDate(value, label) {
  if (!DATE_PATTERN.test(value)) throw new Error(`${label}: usa el formato AAAA-MM-DD.`);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    throw new Error(`${label}: la fecha no es válida.`);
  }
}

function validateOrder(order, lines) {
  if (!order.cliente_id) throw new Error('Elige un cliente para el pedido.');
  if (!Array.isArray(lines) || !lines.length) throw new Error('Agrega al menos una línea.');
  if (!['adelanto', 'completo_inicio', 'contra_entrega'].includes(order.modalidad_pago)) {
    throw new Error('Elige una modalidad de pago válida.');
  }
  if (!Number.isSafeInteger(order.adelanto_acordado) || order.adelanto_acordado < 0) {
    throw new Error('El adelanto debe ser un monto válido en centavos.');
  }
  if (order.fecha_entrega_general) {
    validateDate(order.fecha_entrega_general, 'La fecha general');
  }
  lines.forEach((line, index) => {
    if (!line.tipo_id) throw new Error(`Elige el tipo de la línea ${index + 1}.`);
    if (!Number.isSafeInteger(line.precio_acordado) || line.precio_acordado < 0) {
      throw new Error(`El precio de la línea ${index + 1} debe ser válido.`);
    }
    if (!line.fecha_entrega) throw new Error(`Agrega la fecha de entrega de la línea ${index + 1}.`);
    validateDate(line.fecha_entrega, `La fecha de la línea ${index + 1}`);
    if (line.hora_entrega && !TIME_PATTERN.test(line.hora_entrega)) {
      throw new Error(`La hora de la línea ${index + 1} no es válida.`);
    }
  });
}

export async function createOrderWithLines(order, lines) {
  validateOrder(order, lines);
  return db.transaction(
    'rw',
    db.table('pedidos'),
    db.table('lineas'),
    db.table('clientes'),
    db.table('tipos_trabajo'),
    async () => {
      const client = await getRecord('clientes', order.cliente_id);
      if (!client) throw new Error('El cliente elegido no existe o está en la papelera.');

      const types = await getRecords('tipos_trabajo');
      for (const [index, line] of lines.entries()) {
        if (!isSelectableWorkType(types, line.tipo_id)) {
          throw new Error(`El tipo de la línea ${index + 1} ya no está disponible o requiere un subnivel.`);
        }
      }

      const savedOrder = await createRecord('pedidos', {
        ...order,
        fecha_entrega_general: order.fecha_entrega_general || null,
      });
      const savedLines = [];
      for (const line of lines) {
        savedLines.push(await createRecord('lineas', {
          ...line,
          pedido_id: savedOrder.id,
          fecha_entrega_original: line.fecha_entrega,
          hora_entrega: line.hora_entrega || null,
          estado: 'pendiente',
          fecha_terminado: null,
          prioridad: false,
        }));
      }
      return { pedido: savedOrder, lineas: savedLines };
    },
  );
}

export async function getOrderSummaries() {
  const [orders, clients, lines] = await Promise.all([
    getRecords('pedidos'),
    getRecords('clientes'),
    getRecords('lineas'),
  ]);
  return orders.map((pedido) => ({
    ...pedido,
    cliente: clients.find((client) => client.id === pedido.cliente_id),
    lineas: lines.filter((line) => line.pedido_id === pedido.id),
  })).sort((left, right) => right.fecha_pedido.localeCompare(left.fecha_pedido));
}

export async function getDashboardData() {
  const [orders, clients, lines, types, payments, settings] = await Promise.all([
    getRecords('pedidos'),
    getRecords('clientes'),
    getRecords('lineas'),
    getRecords('tipos_trabajo', { includeDeleted: true }),
    getRecords('pagos'),
    getRecords('ajustes'),
  ]);
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const typeById = new Map(types.map((type) => [type.id, type]));
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const activeOrders = new Set(orders.map((order) => order.id));
  const visibleLines = lines
    .filter((line) => activeOrders.has(line.pedido_id))
    .map((line) => ({
      ...line,
      tipo: typeById.get(line.tipo_id),
      cliente: clientById.get(orderById.get(line.pedido_id)?.cliente_id),
    }));
  const amountOwed = calculateBalances({ clients, orders, lines, payments })
    .pedidos.reduce((sum, order) => sum + Math.max(0, order.por_cobrar), 0);

  return {
    lines: visibleLines,
    clientsCount: clients.length,
    ordersCount: orders.length,
    pendingCount: visibleLines.filter((line) =>
      ['pendiente', 'en_proceso'].includes(line.estado),
    ).length,
    amountOwed,
    currencySymbol: settings.find((setting) => setting.clave === 'moneda_simbolo')?.valor ?? 'Bs',
    lastBackupDate: settings.find((setting) => setting.clave === 'ultimo_respaldo')?.valor ?? null,
  };
}

export async function getOrderDetail(orderId) {
  const [pedido, clients, lines, payments] = await Promise.all([
    getRecord('pedidos', orderId),
    getRecords('clientes'),
    getRecords('lineas'),
    getRecords('pagos'),
  ]);
  if (!pedido) return null;
  const [types, settings] = await Promise.all([
    getRecords('tipos_trabajo', { includeDeleted: true }),
    getRecords('ajustes'),
  ]);
  const orderLines = lines
    .filter((line) => line.pedido_id === pedido.id)
    .map((line) => ({
      ...line,
      tipo: types.find((type) => type.id === line.tipo_id),
    }));
  const orderPayments = payments
    .filter((payment) => payment.pedido_id === pedido.id)
    .sort((left, right) => right.fecha.localeCompare(left.fecha));
  const balances = calculateBalances({
    clients,
    orders: [pedido],
    lines: orderLines,
    payments: orderPayments,
  }).pedidos[0];
  const lineHistory = await getLineHistoryRecords(orderLines.map((line) => line.id));
  return {
    pedido,
    cliente: clients.find((client) => client.id === pedido.cliente_id),
    lineas: orderLines.map((line) => ({
      ...line,
      saldo: balances.lineas.find((entry) => entry.id === line.id)?.saldo ?? 0,
      ubicaciones: lineHistory.ubicaciones
        .filter((location) => location.linea_id === line.id)
        .map((location) => ({
          ...location,
          url: safeLocationUrl(location.enlace_o_ruta),
        })),
      cambios: lineHistory.cambios.filter((change) => change.linea_id === line.id),
    })),
    pagos: orderPayments.map((payment) => ({
      ...payment,
      linea: orderLines.find((line) => line.id === payment.linea_id),
    })),
    total: balances.total_vigente,
    pagado: balances.cobros_netos,
    saldo: balances.por_cobrar,
    deudaExigible: balances.deuda_exigible,
    saldoFavor: balances.saldo_a_favor,
    simboloMoneda: settings.find((setting) => setting.clave === 'moneda_simbolo')?.valor ?? 'Bs',
  };
}

export async function getCustomerBalanceSummaries() {
  const [clients, orders, lines, payments, settings] = await Promise.all([
    getRecords('clientes'),
    getRecords('pedidos'),
    getRecords('lineas'),
    getRecords('pagos'),
    getRecords('ajustes'),
  ]);
  return {
    clientes: calculateBalances({ clients, orders, lines, payments }).clientes,
    simboloMoneda: settings.find((setting) => setting.clave === 'moneda_simbolo')?.valor ?? 'Bs',
  };
}

export async function getDebtorSummaries() {
  const [clients, orders, lines, payments, types, settings] = await Promise.all([
    getRecords('clientes'),
    getRecords('pedidos'),
    getRecords('lineas'),
    getRecords('pagos'),
    getRecords('tipos_trabajo', { includeDeleted: true }),
    getRecords('ajustes'),
  ]);
  const balances = calculateBalances({ clients, orders, lines, payments });
  const orderById = new Map(balances.pedidos.map((order) => [order.id, order]));
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const typeById = new Map(types.map((type) => [type.id, type]));
  return {
    clientes: balances.clientes
      .filter((client) => client.deuda_exigible > 0 || client.saldo_a_favor > 0)
      .map((client) => ({
        ...client,
        trabajos: client.trabajos.map((line) => ({
          ...line,
          tipo: typeById.get(line.tipo_id),
          cliente: clientById.get(client.id),
          fecha_terminado: line.fecha_terminado,
          pedido: orderById.get(line.pedido_id),
        })),
      }))
      .sort((left, right) =>
        right.deuda_exigible - left.deuda_exigible
        || left.nombre.localeCompare(right.nombre, 'es'),
      ),
    simboloMoneda: settings.find((setting) => setting.clave === 'moneda_simbolo')?.valor ?? 'Bs',
  };
}

export async function updateLineStatus(lineId, estado) {
  if (!['pendiente', 'en_proceso', 'entregado'].includes(estado)) {
    throw new Error('El estado elegido no es válido.');
  }
  const line = await getRecord('lineas', lineId);
  if (!line) throw new Error('La línea no existe.');
  return updateRecord('lineas', lineId, {
    estado,
    fecha_terminado: estado === 'entregado' ? new Date().toISOString() : null,
  });
}

export async function getLineCancellationRefund(lineId) {
  const line = await getRecord('lineas', lineId);
  if (!line) throw new Error('El trabajo no existe.');
  const [lines, payments] = await Promise.all([
    getRecords('lineas'),
    getRecords('pagos'),
  ]);
  return calculateLineRefundAmount(
    lines.filter((item) => item.pedido_id === line.pedido_id),
    payments.filter((item) => item.pedido_id === line.pedido_id),
    lineId,
  );
}

export async function cancelOrderLine(lineId, { refundAdvance = false } = {}) {
  return db.transaction('rw', db.table('lineas'), db.table('pagos'), async () => {
    const line = await getRecord('lineas', lineId);
    if (!line) throw new Error('El trabajo no existe o está en la papelera.');
    if (line.estado === 'cancelado') throw new Error('El trabajo ya está cancelado.');
    const [lines, payments] = await Promise.all([
      getRecords('lineas'),
      getRecords('pagos'),
    ]);
    const orderLines = lines.filter((item) => item.pedido_id === line.pedido_id);
    const orderPayments = payments.filter((item) => item.pedido_id === line.pedido_id);
    const refundAmount = calculateLineRefundAmount(orderLines, orderPayments, lineId);
    if (refundAdvance && refundAmount > 0) {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const associatedPayment = orderPayments
        .filter((payment) => payment.linea_id === lineId)
        .sort((left, right) => right.fecha.localeCompare(left.fecha))[0]
        ?? orderPayments
          .filter((payment) => !payment.linea_id)
          .sort((left, right) => right.fecha.localeCompare(left.fecha))[0];
      await createRecord('pagos', {
        pedido_id: line.pedido_id,
        linea_id: lineId,
        monto: refundAmount,
        tipo: 'devolucion',
        metodo: associatedPayment?.metodo ?? 'otro',
        fecha: today,
        nota: 'Devolución al cancelar el trabajo.',
      });
    }
    return updateRecord('lineas', lineId, {
      estado: 'cancelado',
      fecha_terminado: null,
    });
  });
}

export async function updateLineDeliveryDate(lineId, fecha_entrega) {
  validateDate(fecha_entrega, 'La fecha de entrega');
  const line = await getRecord('lineas', lineId);
  if (!line) throw new Error('La línea no existe.');
  return updateRecord('lineas', lineId, { fecha_entrega });
}

export async function updateLinePriority(lineId, prioridad) {
  if (typeof prioridad !== 'boolean') throw new TypeError('La prioridad debe ser verdadera o falsa.');
  const line = await getRecord('lineas', lineId);
  if (!line) throw new Error('La línea no existe.');
  return updateRecord('lineas', lineId, { prioridad });
}
