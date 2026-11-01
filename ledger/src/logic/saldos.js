function paymentNet(payments) {
  return payments.reduce(
    (sum, payment) => sum + (payment.tipo === 'devolucion' ? -payment.monto : payment.monto),
    0,
  );
}

function calculateTotals(lines, payments) {
  const totalVigente = lines
    .filter((line) => line.estado !== 'cancelado')
    .reduce((sum, line) => sum + line.precio_acordado, 0);
  const totalEntregado = lines
    .filter((line) => line.estado === 'entregado')
    .reduce((sum, line) => sum + line.precio_acordado, 0);
  const cobrosNetos = paymentNet(payments);
  return {
    total_vigente: totalVigente,
    total_entregado: totalEntregado,
    cobros_netos: cobrosNetos,
    por_cobrar: totalVigente - cobrosNetos,
    deuda_exigible: Math.max(0, totalEntregado - cobrosNetos),
    saldo_a_favor: Math.max(0, cobrosNetos - totalVigente),
  };
}

function allocatePaymentsToLines(lines, payments) {
  const delivered = lines
    .filter((line) => line.estado === 'entregado')
    .slice()
    .sort((left, right) =>
      left.fecha_entrega.localeCompare(right.fecha_entrega)
      || left.id.localeCompare(right.id),
    );
  const directPayments = new Map();
  let unassignedNet = 0;

  for (const payment of payments) {
    const net = payment.tipo === 'devolucion' ? -payment.monto : payment.monto;
    if (payment.linea_id) {
      directPayments.set(
        payment.linea_id,
        (directPayments.get(payment.linea_id) ?? 0) + net,
      );
    } else {
      unassignedNet += net;
    }
  }

  const balances = delivered.map((line) => ({
    ...line,
    pagos_aplicados: directPayments.get(line.id) ?? 0,
    saldo: Math.max(0, line.precio_acordado - (directPayments.get(line.id) ?? 0)),
  }));
  if (unassignedNet < 0 && balances.length) {
    balances[0].saldo -= unassignedNet;
    unassignedNet = 0;
  }
  for (const line of balances) {
    if (unassignedNet <= 0) break;
    const applied = Math.min(line.saldo, unassignedNet);
    line.saldo -= applied;
    line.pagos_aplicados += applied;
    unassignedNet -= applied;
  }
  return balances;
}

function dateOnly(value) {
  if (typeof value !== 'string') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysSinceDelivery(deliveredAt, today = new Date()) {
  const deliveryDate = dateOnly(deliveredAt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) return 0;
  const [year, month, day] = deliveryDate.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day);
  const end = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function calculateBalances({ clients = [], orders = [], lines = [], payments = [] }) {
  const orderBalances = orders.map((order) => {
    const orderLines = lines.filter((line) => line.pedido_id === order.id);
    const orderPayments = payments.filter((payment) => payment.pedido_id === order.id);
    return {
      ...order,
      ...calculateTotals(orderLines, orderPayments),
      lineas: allocatePaymentsToLines(orderLines, orderPayments),
    };
  });
  const clientBalances = clients.map((client) => {
    const clientOrders = orderBalances.filter((order) => order.cliente_id === client.id);
    const totals = clientOrders.reduce((sum, order) => ({
      total_vigente: sum.total_vigente + order.total_vigente,
      total_entregado: sum.total_entregado + order.total_entregado,
      cobros_netos: sum.cobros_netos + order.cobros_netos,
    }), { total_vigente: 0, total_entregado: 0, cobros_netos: 0 });
    const deliveredLines = clientOrders.flatMap((order) =>
      order.lineas.map((line) => ({ ...line, pedido_id: order.id })),
    );
    return {
      ...client,
      ...totals,
      por_cobrar: totals.total_vigente - totals.cobros_netos,
      deuda_exigible: Math.max(0, totals.total_entregado - totals.cobros_netos),
      saldo_a_favor: Math.max(0, totals.cobros_netos - totals.total_vigente),
      pedidos: clientOrders,
      trabajos: deliveredLines,
    };
  });

  return { pedidos: orderBalances, clientes: clientBalances };
}

export function calculateLineRefundAmount(lines, payments, lineId) {
  const activeLines = lines
    .filter((line) => line.estado !== 'cancelado')
    .slice()
    .sort((left, right) =>
      left.fecha_entrega.localeCompare(right.fecha_entrega)
      || left.id.localeCompare(right.id),
    );
  const directByLine = new Map();
  let orderPaymentNet = 0;
  for (const payment of payments) {
    const net = payment.tipo === 'devolucion' ? -payment.monto : payment.monto;
    if (payment.linea_id) {
      directByLine.set(payment.linea_id, (directByLine.get(payment.linea_id) ?? 0) + net);
    } else {
      orderPaymentNet += net;
    }
  }

  const targetDirect = Math.max(0, directByLine.get(lineId) ?? 0);
  let remaining = Math.max(0, orderPaymentNet);
  let targetShared = 0;
  for (const line of activeLines) {
    const direct = Math.max(0, directByLine.get(line.id) ?? 0);
    const available = Math.max(0, line.precio_acordado - direct);
    const applied = Math.min(available, remaining);
    if (line.id === lineId) targetShared = applied;
    remaining -= applied;
  }
  return targetDirect + targetShared;
}
