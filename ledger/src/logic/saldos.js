function isActive(record) {
  return !record.eliminado;
}

function paymentNet(payments) {
  return payments.filter(isActive).reduce(
    (sum, payment) => sum + (payment.tipo === 'devolucion' ? -payment.monto : payment.monto),
    0,
  );
}

function compareLines(left, right) {
  return String(left.fecha_entrega ?? '').localeCompare(String(right.fecha_entrega ?? ''))
    || String(left.creado ?? '').localeCompare(String(right.creado ?? ''))
    || String(left.id ?? '').localeCompare(String(right.id ?? ''));
}

function orderLinesForAllocation(lines) {
  return lines
    .filter((line) => isActive(line) && line.estado !== 'cancelado')
    .slice()
    .sort((left, right) => {
      const deliveryOrder = Number(right.estado === 'entregado') - Number(left.estado === 'entregado');
      return deliveryOrder || compareLines(left, right);
    });
}

function comparePayments(left, right) {
  return String(left.fecha ?? '').localeCompare(String(right.fecha ?? ''))
    || String(left.creado ?? '').localeCompare(String(right.creado ?? ''));
}

export function aplicarPagos(lineas, pagos) {
  const activeLines = lineas.filter(isActive);
  const eligibleLines = orderLinesForAllocation(activeLines);
  const appliedByLine = new Map(eligibleLines.map((line) => [line.id, 0]));
  const extraByLine = new Map(eligibleLines.map((line) => [line.id, 0]));
  const lastPaymentByLine = new Map();
  let generalExtra = 0;
  const sortedPayments = pagos.filter(isActive).slice().sort(comparePayments);

  function applyToLine(line, payment, amount) {
    const current = appliedByLine.get(line.id) ?? 0;
    const changed = Math.min(amount, Math.max(0, line.precio_acordado - current));
    if (!changed) return amount;
    appliedByLine.set(line.id, current + changed);
    lastPaymentByLine.set(line.id, payment.fecha ?? '');
    return amount - changed;
  }

  function refundLine(line, payment, amount) {
    const extra = extraByLine.get(line.id) ?? 0;
    const refundedExtra = Math.min(amount, extra);
    extraByLine.set(line.id, extra - refundedExtra);
    const remaining = amount - refundedExtra;
    const current = appliedByLine.get(line.id) ?? 0;
    const refundedApplied = Math.min(remaining, current);
    if (refundedApplied) {
      appliedByLine.set(line.id, current - refundedApplied);
      lastPaymentByLine.set(line.id, payment.fecha ?? '');
    }
    return remaining - refundedApplied;
  }

  for (const payment of sortedPayments) {
    if (!Number.isSafeInteger(payment.monto) || payment.monto <= 0) continue;
    const isRefund = payment.tipo === 'devolucion';
    let remaining = payment.monto;
    if (payment.linea_id) {
      const line = eligibleLines.find(({ id }) => id === payment.linea_id);
      if (!line) continue;
      if (isRefund) {
        refundLine(line, payment, remaining);
      } else {
        remaining = applyToLine(line, payment, remaining);
        lastPaymentByLine.set(line.id, payment.fecha ?? '');
        extraByLine.set(line.id, (extraByLine.get(line.id) ?? 0) + remaining);
      }
      continue;
    }

    if (isRefund) {
      const refundedGeneralExtra = Math.min(remaining, generalExtra);
      generalExtra -= refundedGeneralExtra;
      remaining -= refundedGeneralExtra;
      for (const line of eligibleLines) {
        if (!remaining) break;
        const extra = extraByLine.get(line.id) ?? 0;
        const refundedExtra = Math.min(remaining, extra);
        extraByLine.set(line.id, extra - refundedExtra);
        remaining -= refundedExtra;
      }
      for (const line of eligibleLines) {
        if (!remaining) break;
        remaining = refundLine(line, payment, remaining);
      }
    } else {
      for (const line of eligibleLines) {
        if (!remaining) break;
        remaining = applyToLine(line, payment, remaining);
      }
      generalExtra += remaining;
    }
  }

  return activeLines.map((line) => {
    const pagos_aplicados = appliedByLine.get(line.id) ?? 0;
    const state = estadoLinea(line, pagos_aplicados);
    return {
      ...line,
      pagos_aplicados,
      ...state,
      fecha_ultimo_pago: lastPaymentByLine.get(line.id) ?? null,
    };
  });
}

export function estadoLinea(linea, aplicado) {
  const precio = Number.isSafeInteger(linea.precio_acordado) ? linea.precio_acordado : 0;
  const montoAplicado = Number.isSafeInteger(aplicado) ? aplicado : 0;
  const pagada = precio > 0 && montoAplicado >= precio
    && isActive(linea)
    && linea.estado !== 'cancelado';
  return {
    aplicado: montoAplicado,
    saldo: Math.max(0, precio - montoAplicado),
    pagada,
    terminada: linea.estado === 'entregado' && pagada,
  };
}

export function esTerminada(linea, aplicado) {
  const precio = Number.isSafeInteger(linea.precio_acordado) ? linea.precio_acordado : 0;
  return linea.estado === 'entregado'
    && isActive(linea)
    && precio > 0
    && Number.isSafeInteger(aplicado)
    && aplicado >= precio;
}

export function pedidoActivo(lineas, pagos) {
  const balances = new Map(
    aplicarPagos(lineas, pagos).map((linea) => [linea.id, linea.pagos_aplicados]),
  );
  return lineas.some((linea) =>
    isActive(linea)
    && linea.estado !== 'cancelado'
    && !esTerminada(linea, balances.get(linea.id) ?? 0),
  );
}

function calculateTotals(lines, payments) {
  const activeLines = lines.filter((line) => isActive(line));
  const totalVigente = activeLines
    .filter((line) => line.estado !== 'cancelado')
    .reduce((sum, line) => sum + line.precio_acordado, 0);
  const totalEntregado = activeLines
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

export function daysSinceDelivery(deliveredAt, today = new Date()) {
  const deliveryDate = dateOnly(deliveredAt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) return 0;
  const [year, month, day] = deliveryDate.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day);
  const end = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((end - start) / 86_400_000));
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

export function calculateBalances({ clients = [], orders = [], lines = [], payments = [] }) {
  const activeOrders = orders.filter(isActive);
  const activeClients = clients.filter(isActive);
  const orderBalances = activeOrders.map((order) => {
    const orderLines = lines.filter((line) => line.pedido_id === order.id && isActive(line));
    const orderPayments = payments.filter((payment) => payment.pedido_id === order.id && isActive(payment));
    const lineBalances = aplicarPagos(orderLines, orderPayments);
    return {
      ...order,
      ...calculateTotals(orderLines, orderPayments),
      lineas: lineBalances,
    };
  });
  const clientBalances = activeClients.map((client) => {
    const clientOrders = orderBalances.filter((order) => order.cliente_id === client.id);
    const totals = clientOrders.reduce((sum, order) => ({
      total_vigente: sum.total_vigente + order.total_vigente,
      total_entregado: sum.total_entregado + order.total_entregado,
      cobros_netos: sum.cobros_netos + order.cobros_netos,
    }), { total_vigente: 0, total_entregado: 0, cobros_netos: 0 });
    const deliveredLines = clientOrders.flatMap((order) =>
      order.lineas
        .filter((line) => line.estado === 'entregado')
        .map((line) => ({ ...line, pedido_id: order.id })),
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
  return aplicarPagos(lines, payments)
    .find((line) => line.id === lineId)?.pagos_aplicados ?? 0;
}
