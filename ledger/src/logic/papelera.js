const TABLE_ORDER = [
  'ubicaciones',
  'cambios',
  'pagos',
  'lineas',
  'pedidos',
  'ajustes',
  'tipos_trabajo',
  'clientes',
];

function recordsIn(recordsByTable, table) {
  return recordsByTable[table] ?? [];
}

function descendantsOf(typeId, types) {
  const descendants = new Set([typeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const type of types) {
      if (descendants.has(type.padre_id) && !descendants.has(type.id)) {
        descendants.add(type.id);
        changed = true;
      }
    }
  }
  return descendants;
}

function typeDepth(type, types) {
  const byId = new Map(types.map((item) => [item.id, item]));
  let depth = 0;
  let parentId = type.padre_id;
  const visited = new Set([type.id]);
  while (parentId && byId.has(parentId) && !visited.has(parentId)) {
    visited.add(parentId);
    depth += 1;
    parentId = byId.get(parentId).padre_id;
  }
  return depth;
}

export function orderTrashDeletion(recordsByTable) {
  const orders = recordsIn(recordsByTable, 'pedidos');
  const lines = recordsIn(recordsByTable, 'lineas');
  const clients = recordsIn(recordsByTable, 'clientes');
  const types = recordsIn(recordsByTable, 'tipos_trabajo');
  const trashedOrderIds = new Set(orders.filter((item) => item.eliminado).map(({ id }) => id));
  const trashedLineIds = new Set(
    lines
      .filter((line) => line.eliminado || trashedOrderIds.has(line.pedido_id))
      .map(({ id }) => id),
  );
  const survivingLines = lines.filter((line) =>
    !line.eliminado && !trashedOrderIds.has(line.pedido_id),
  );
  const blockedClients = new Set();
  for (const client of clients.filter((item) => item.eliminado)) {
    const clientOrderIds = new Set(
      orders.filter((order) => order.cliente_id === client.id && !trashedOrderIds.has(order.id))
        .map(({ id }) => id),
    );
    if (survivingLines.some((line) => clientOrderIds.has(line.pedido_id))) {
      blockedClients.add(client.id);
    }
  }

  const blockedTypes = new Set();
  const activeTypeIds = new Set(types.filter((type) => !type.eliminado).map(({ id }) => id));
  for (const type of types.filter((item) => item.eliminado)) {
    const subtree = descendantsOf(type.id, types);
    const hasSurvivingTypeChild = types.some((child) =>
      child.id !== type.id && subtree.has(child.id) && activeTypeIds.has(child.id),
    );
    const hasSurvivingWork = survivingLines.some((line) => subtree.has(line.tipo_id));
    if (hasSurvivingTypeChild || hasSurvivingWork) blockedTypes.add(type.id);
  }

  const recordsToDelete = {
    clientes: clients.filter((item) => item.eliminado && !blockedClients.has(item.id)),
    tipos_trabajo: types.filter((item) => item.eliminado && !blockedTypes.has(item.id)),
    pedidos: orders.filter((item) => item.eliminado),
    lineas: lines.filter((line) => trashedLineIds.has(line.id)),
    pagos: recordsIn(recordsByTable, 'pagos').filter((payment) =>
      payment.eliminado
      || trashedOrderIds.has(payment.pedido_id)
      || trashedLineIds.has(payment.linea_id),
    ),
    ubicaciones: recordsIn(recordsByTable, 'ubicaciones').filter((location) =>
      location.eliminado || trashedLineIds.has(location.linea_id),
    ),
    cambios: recordsIn(recordsByTable, 'cambios').filter((change) =>
      change.eliminado || trashedLineIds.has(change.linea_id),
    ),
    ajustes: recordsIn(recordsByTable, 'ajustes').filter((setting) => setting.eliminado),
  };
  const typeOrder = recordsToDelete.tipos_trabajo
    .slice()
    .sort((left, right) =>
      typeDepth(right, types) - typeDepth(left, types)
      || String(left.creado ?? '').localeCompare(String(right.creado ?? '')),
    );
  recordsToDelete.tipos_trabajo = typeOrder;

  return TABLE_ORDER.flatMap((table) =>
    recordsToDelete[table].map((record) => ({ table, id: record.id })),
  );
}

export function countTrashItems(records) {
  const counts = {};
  for (const record of records) {
    counts[record.table] = (counts[record.table] ?? 0) + 1;
  }
  return {
    total: records.length,
    counts,
  };
}

export function getTrashUsage(recordsByTable) {
  const deletionOrder = orderTrashDeletion(recordsByTable);
  const scheduledIds = new Map();
  for (const record of deletionOrder) {
    const tableIds = scheduledIds.get(record.table) ?? new Set();
    tableIds.add(record.id);
    scheduledIds.set(record.table, tableIds);
  }
  const orders = recordsIn(recordsByTable, 'pedidos');
  const lines = recordsIn(recordsByTable, 'lineas');
  const types = recordsIn(recordsByTable, 'tipos_trabajo');
  const remainingLines = lines.filter((line) =>
    !scheduledIds.get('lineas')?.has(line.id),
  );
  const usage = { clientes: new Map(), tipos_trabajo: new Map() };

  for (const client of recordsIn(recordsByTable, 'clientes').filter((item) => item.eliminado)) {
    const clientOrderIds = new Set(
      orders.filter((order) =>
        order.cliente_id === client.id && !scheduledIds.get('pedidos')?.has(order.id),
      ).map(({ id }) => id),
    );
    const jobs = remainingLines.filter((line) => clientOrderIds.has(line.pedido_id)).length;
    if (jobs) usage.clientes.set(client.id, jobs);
  }

  for (const type of types.filter((item) => item.eliminado)) {
    const subtree = descendantsOf(type.id, types);
    const jobs = remainingLines.filter((line) => subtree.has(line.tipo_id)).length;
    const hasSurvivingTypeChild = types.some((child) =>
      child.id !== type.id && subtree.has(child.id) && !child.eliminado,
    );
    if (jobs || hasSurvivingTypeChild) {
      usage.tipos_trabajo.set(type.id, { jobs, hasSurvivingTypeChild });
    }
  }
  return usage;
}
