import {
  db,
  getRecords,
  permanentlyDeleteRecord,
  restoreRecord,
  softDeleteRecord,
  TABLE_NAMES,
} from './db.js';
import { countTrashItems, getTrashUsage, orderTrashDeletion } from '../logic/papelera.js';

const TABLE_LABELS = {
  clientes: 'Clientes',
  tipos_trabajo: 'Tipos de trabajo',
  pedidos: 'Pedidos',
  lineas: 'Trabajos',
  pagos: 'Pagos',
  ubicaciones: 'Ubicaciones',
  cambios: 'Cambios',
  ajustes: 'Ajustes',
};

function recordLabel(tableName, record) {
  if (record.nombre) return record.nombre;
  if (tableName === 'pedidos') return `Pedido del ${record.fecha_pedido ?? 'sin fecha'}`;
  if (tableName === 'lineas') return record.descripcion || `Trabajo con entrega ${record.fecha_entrega ?? 'sin fecha'}`;
  if (tableName === 'pagos') return `${record.tipo === 'devolucion' ? 'Devolución' : 'Cobro'} de ${record.monto} centavos`;
  if (tableName === 'ajustes') return `Ajuste: ${record.clave}`;
  if (tableName === 'ubicaciones') return `Ubicación (${record.tipo ?? 'otro'})`;
  if (tableName === 'cambios') return record.descripcion || 'Cambio de trabajo';
  return TABLE_LABELS[tableName];
}

async function deleteLineAndChildren(lineId, requireTrash = true) {
  const [payments, locations, changes] = await Promise.all([
    getRecords('pagos', { includeDeleted: true }),
    getRecords('ubicaciones', { includeDeleted: true }),
    getRecords('cambios', { includeDeleted: true }),
  ]);
  for (const payment of payments.filter((item) => item.linea_id === lineId)) {
    await db.table('pagos').delete(payment.id);
  }
  for (const location of locations.filter((item) => item.linea_id === lineId)) {
    await db.table('ubicaciones').delete(location.id);
  }
  for (const change of changes.filter((item) => item.linea_id === lineId)) {
    await db.table('cambios').delete(change.id);
  }
  if (requireTrash) await permanentlyDeleteRecord('lineas', lineId);
  else await db.table('lineas').delete(lineId);
}

async function deleteOrderAndChildren(orderId, requireTrash = true) {
  const [lines, payments] = await Promise.all([
    getRecords('lineas', { includeDeleted: true }),
    getRecords('pagos', { includeDeleted: true }),
  ]);
  for (const payment of payments.filter((item) => item.pedido_id === orderId)) {
    await db.table('pagos').delete(payment.id);
  }
  for (const line of lines.filter((item) => item.pedido_id === orderId)) {
    await deleteLineAndChildren(line.id, false);
  }
  if (requireTrash) await permanentlyDeleteRecord('pedidos', orderId);
  else await db.table('pedidos').delete(orderId);
}

async function deleteClientAndChildren(clientId) {
  const orders = await getRecords('pedidos', { includeDeleted: true });
  for (const order of orders.filter((item) => item.cliente_id === clientId)) {
    await deleteOrderAndChildren(order.id, false);
  }
  await permanentlyDeleteRecord('clientes', clientId);
}

async function getTrashSnapshot() {
  const entries = await Promise.all(TABLE_NAMES.map(async (table) => [
    table,
    await db.table(table).toArray(),
  ]));
  return Object.fromEntries(entries);
}

function trashGroupsFromSnapshot(snapshot) {
  const usage = getTrashUsage(snapshot);
  return TABLE_NAMES.map((table) => ({
    table,
    label: TABLE_LABELS[table],
    items: snapshot[table]
      .filter((record) => record.eliminado)
      .map((record) => {
        const usageInfo = usage[table]?.get(record.id);
        const jobsInUse = typeof usageInfo === 'number' ? usageInfo : usageInfo?.jobs;
        return {
          ...record,
          label: recordLabel(table, record),
          tableLabel: TABLE_LABELS[table],
          usageNote: usageInfo === undefined
            ? ''
            : jobsInUse
              ? `En uso por ${jobsInUse} trabajos`
              : 'En uso por subtipos activos',
          inUse: usageInfo !== undefined,
        };
      }),
  })).filter(({ items }) => items.length);
}

export async function getTrashRecords() {
  return trashGroupsFromSnapshot(await getTrashSnapshot());
}

export async function getTrashClearSummary() {
  const snapshot = await getTrashSnapshot();
  const deletionOrder = orderTrashDeletion(snapshot);
  return {
    ...countTrashItems(deletionOrder),
    deletionOrder,
  };
}

export async function emptyTrash() {
  return db.transaction(
    'rw',
    ...TABLE_NAMES.map((table) => db.table(table)),
    async () => {
      const snapshot = await getTrashSnapshot();
      const deletionOrder = orderTrashDeletion(snapshot);
      const counts = countTrashItems(deletionOrder);
      for (const table of [...new Set(deletionOrder.map((record) => record.table))]) {
        const ids = deletionOrder
          .filter((record) => record.table === table)
          .map((record) => record.id);
        await db.table(table).bulkDelete(ids);
      }
      return counts.total;
    },
  );
}

export async function restoreTrashRecord(tableName, id) {
  if (!TABLE_NAMES.includes(tableName)) throw new TypeError(`Tabla no válida: ${tableName}`);
  return restoreRecord(tableName, id);
}

export async function permanentlyDeleteTrashRecord(tableName, id) {
  if (!TABLE_NAMES.includes(tableName)) throw new TypeError(`Tabla no válida: ${tableName}`);
  if (tableName === 'clientes') {
    const snapshot = await getTrashSnapshot();
    const jobsInUse = getTrashUsage(snapshot).clientes.get(id);
    if (jobsInUse !== undefined) {
      throw new Error(`En uso por ${jobsInUse} trabajos. No se puede borrar definitivamente.`);
    }
    return db.transaction('rw', ...TABLE_NAMES.map((table) => db.table(table)), () =>
      deleteClientAndChildren(id));
  }
  if (tableName === 'pedidos') {
    return db.transaction('rw', ...TABLE_NAMES.map((table) => db.table(table)), () =>
      deleteOrderAndChildren(id));
  }
  if (tableName === 'lineas') {
    return db.transaction('rw', ...TABLE_NAMES.map((table) => db.table(table)), () =>
      deleteLineAndChildren(id));
  }
  if (tableName === 'tipos_trabajo') {
    const [types, lines] = await Promise.all([
      getRecords('tipos_trabajo', { includeDeleted: true }),
      getRecords('lineas', { includeDeleted: true }),
    ]);
    if (types.some((type) => type.padre_id === id)) {
      throw new Error('Borra primero los subniveles de este tipo de trabajo.');
    }
    if (lines.some((line) => line.tipo_id === id)) {
      throw new Error('Este tipo está asociado a trabajos. Se conserva para mantener su historial.');
    }
  }
  return permanentlyDeleteRecord(tableName, id);
}

export async function getTrashImpact(tableName, id) {
  if (tableName === 'clientes') {
    const orders = await getRecords('pedidos', { includeDeleted: true });
    const lines = await getRecords('lineas', { includeDeleted: true });
    const orderIds = new Set(orders.filter((order) => order.cliente_id === id).map((order) => order.id));
    const count = lines.filter((line) => orderIds.has(line.pedido_id)).length;
    const ordersCount = orderIds.size;
    const details = [];
    if (count) details.push(`${count} ${count === 1 ? 'trabajo' : 'trabajos'}`);
    if (ordersCount) details.push(`${ordersCount} ${ordersCount === 1 ? 'pedido' : 'pedidos'}`);
    return details.length
      ? ` También se borrarán definitivamente ${details.join(' y ')} asociados.`
      : '';
  }
  if (tableName === 'pedidos') {
    const lines = await getRecords('lineas', { includeDeleted: true });
    const count = lines.filter((line) => line.pedido_id === id).length;
    return count ? ` También se borrarán definitivamente ${count} ${count === 1 ? 'trabajo' : 'trabajos'} y sus pagos asociados.` : '';
  }
  if (tableName === 'lineas') {
    const payments = await getRecords('pagos', { includeDeleted: true });
    const count = payments.filter((payment) => payment.linea_id === id).length;
    return count ? ` También se borrarán definitivamente ${count} ${count === 1 ? 'pago' : 'pagos'} asociados.` : '';
  }
  return '';
}

export async function countClientJobs(clientId) {
  const [orders, lines] = await Promise.all([
    getRecords('pedidos', { includeDeleted: true }),
    getRecords('lineas', { includeDeleted: true }),
  ]);
  const orderIds = new Set(orders.filter((order) => order.cliente_id === clientId).map((order) => order.id));
  return lines.filter((line) => orderIds.has(line.pedido_id)).length;
}

export async function countTypeJobs(typeId) {
  const [types, lines] = await Promise.all([
    getRecords('tipos_trabajo'),
    getRecords('lineas', { includeDeleted: true }),
  ]);
  const ids = new Set([typeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const type of types) {
      if (ids.has(type.padre_id) && !ids.has(type.id)) {
        ids.add(type.id);
        changed = true;
      }
    }
  }
  return lines.filter((line) => ids.has(line.tipo_id)).length;
}

export async function softDeleteLineAndPayments(lineId) {
  return db.transaction('rw', db.table('lineas'), db.table('pagos'), async () => {
    const line = await db.table('lineas').get(lineId);
    if (!line || line.eliminado) throw new Error('El trabajo no existe o ya está en la papelera.');
    const payments = await getRecords('pagos');
    const now = new Date().toISOString();
    for (const payment of payments.filter((item) => item.linea_id === lineId)) {
      await db.table('pagos').put({
        ...payment,
        eliminado: true,
        fecha_eliminado: now,
        modificado: now,
      });
    }
    await db.table('lineas').put({
      ...line,
      eliminado: true,
      fecha_eliminado: now,
      modificado: now,
    });
  });
}

export async function softDeleteOrder(orderId) {
  return softDeleteRecord('pedidos', orderId);
}
