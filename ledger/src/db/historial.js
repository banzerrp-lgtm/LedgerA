import { createRecord, getRecord, getRecords } from './db.js';
import { calculateBalances } from '../logic/saldos.js';
import { parseSuggestedPrice } from '../logic/tipos-trabajo.js';

export async function getCompletedHistory() {
  const [clients, orders, lines, payments, types, settings] = await Promise.all([
    getRecords('clientes'),
    getRecords('pedidos'),
    getRecords('lineas'),
    getRecords('pagos'),
    getRecords('tipos_trabajo', { includeDeleted: true }),
    getRecords('ajustes'),
  ]);
  const balances = calculateBalances({ clients, orders, lines, payments });
  const lineBalances = new Map(
    balances.pedidos.flatMap((order) => order.lineas.map((line) => [line.id, line])),
  );
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const typesById = new Map(types.map((type) => [type.id, type]));
  const history = lines
    .filter((line) => ['entregado', 'cancelado'].includes(line.estado))
    .map((line) => {
      const order = ordersById.get(line.pedido_id);
      const client = order ? clientsById.get(order.cliente_id) : undefined;
      const type = typesById.get(line.tipo_id);
      const balance = lineBalances.get(line.id);
      return {
        ...line,
        cliente_id: client?.id,
        cliente_nombre: client?.nombre ?? 'Cliente no disponible',
        tipo_nombre: type?.nombre ?? 'Tipo no disponible',
        pedido_notas: order?.notas ?? '',
        fecha_terminado: line.fecha_terminado ?? line.modificado,
        pagos_aplicados: balance?.pagos_aplicados ?? 0,
        saldo: balance?.saldo ?? 0,
      };
    });
  return {
    history,
    simboloMoneda: settings.find((setting) => setting.clave === 'moneda_simbolo')?.valor ?? 'Bs',
  };
}

export async function getCustomerProfile(clientId) {
  const [client, orders, lines, payments, types, settings] = await Promise.all([
    getRecord('clientes', clientId),
    getRecords('pedidos'),
    getRecords('lineas'),
    getRecords('pagos'),
    getRecords('tipos_trabajo', { includeDeleted: true }),
    getRecords('ajustes'),
  ]);
  if (!client) return null;
  const customerOrders = orders.filter((order) => order.cliente_id === client.id);
  const orderIds = new Set(customerOrders.map((order) => order.id));
  const customerLines = lines.filter((line) => orderIds.has(line.pedido_id));
  const customerPayments = payments.filter((payment) => orderIds.has(payment.pedido_id));
  const balance = calculateBalances({
    clients: [client],
    orders: customerOrders,
    lines: customerLines,
    payments: customerPayments,
  }).clientes[0];
  const typesById = new Map(types.map((type) => [type.id, type]));
  const ordersById = new Map(customerOrders.map((order) => [order.id, order]));
  return {
    cliente: client,
    ...balance,
    trabajos: customerLines
      .map((line) => ({
        ...line,
        tipo: typesById.get(line.tipo_id),
        pedido: ordersById.get(line.pedido_id),
      }))
      .sort((left, right) => right.fecha_entrega.localeCompare(left.fecha_entrega)),
    pedidos: customerOrders.sort((left, right) => right.fecha_pedido.localeCompare(left.fecha_pedido)),
    simboloMoneda: settings.find((setting) => setting.clave === 'moneda_simbolo')?.valor ?? 'Bs',
  };
}

export async function saveLineLocation({ linea_id, tipo, enlace_o_ruta, nota = '' }) {
  if (!linea_id || !await getRecord('lineas', linea_id)) throw new Error('El trabajo no existe.');
  if (!['drive', 'pc', 'usb', 'correo', 'otro'].includes(tipo)) {
    throw new Error('El tipo de ubicación no es válido.');
  }
  const value = String(enlace_o_ruta ?? '').trim();
  if (!value) throw new Error('Escribe un enlace o una ruta de referencia.');
  return createRecord('ubicaciones', {
    linea_id,
    tipo,
    enlace_o_ruta: value,
    nota: String(nota).trim(),
  });
}

export async function saveLineChange({ linea_id, fecha, descripcion, costo_extra }) {
  if (!linea_id || !await getRecord('lineas', linea_id)) throw new Error('El trabajo no existe.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('La fecha del cambio no es válida.');
  const [year, month, day] = fecha.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsedDate.getTime())
    || parsedDate.getFullYear() !== year
    || parsedDate.getMonth() !== month - 1
    || parsedDate.getDate() !== day
  ) {
    throw new Error('La fecha del cambio no es válida.');
  }
  const cleanDescription = String(descripcion ?? '').trim();
  if (!cleanDescription) throw new Error('Describe el cambio realizado.');
  const extraCost = parseSuggestedPrice(costo_extra);
  return createRecord('cambios', {
    linea_id,
    fecha,
    descripcion: cleanDescription,
    costo_extra: extraCost ?? 0,
  });
}

export async function getLineHistoryRecords(lineIds) {
  const [locations, changes] = await Promise.all([
    getRecords('ubicaciones'),
    getRecords('cambios'),
  ]);
  const ids = new Set(lineIds);
  return {
    ubicaciones: locations.filter((item) => ids.has(item.linea_id)),
    cambios: changes.filter((item) => ids.has(item.linea_id)),
  };
}
