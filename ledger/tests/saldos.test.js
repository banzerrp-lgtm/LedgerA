import { describe, expect, it } from 'vitest';
import {
  aplicarPagos,
  calculateBalances,
  calculateLineRefundAmount,
  daysSinceDelivery,
  esTerminada,
  estadoLinea,
  pedidoActivo,
} from '../src/logic/saldos.js';

const client = { id: 'cliente-1', nombre: 'Ana' };

function calculate({ orders = [{ id: 'pedido-1', cliente_id: client.id }], lines = [], payments = [] }) {
  return calculateBalances({ clients: [client], orders, lines, payments });
}

function line(id, price, state = 'entregado', deliveryDate = '2026-10-01', orderId = 'pedido-1') {
  return {
    id,
    pedido_id: orderId,
    precio_acordado: price,
    estado: state,
    fecha_entrega: deliveryDate,
    fecha_terminado: `${deliveryDate}T12:00:00.000Z`,
  };
}

function payment(id, amount, type = 'cobro', orderId = 'pedido-1', lineId = null) {
  return {
    id,
    pedido_id: orderId,
    monto: amount,
    tipo: type,
    linea_id: lineId,
  };
}

describe('cálculo de saldos', () => {
  it('marca como terminada una línea entregada y pagada', () => {
    const [result] = aplicarPagos(
      [line('linea-1', 4000)],
      [payment('pago-1', 4000, 'cobro', 'pedido-1', 'linea-1')],
    );

    expect(esTerminada(result, result.pagos_aplicados)).toBe(true);
    expect(estadoLinea(result, result.pagos_aplicados)).toMatchObject({
      pagada: true,
      terminada: true,
      saldo: 0,
    });
  });

  it('marca como pagada pero no terminada una línea no entregada', () => {
    const [result] = aplicarPagos(
      [line('linea-1', 4000, 'pendiente')],
      [payment('pago-1', 4000, 'cobro', 'pedido-1', 'linea-1')],
    );

    expect(estadoLinea(result, result.pagos_aplicados)).toMatchObject({
      pagada: true,
      terminada: false,
      saldo: 0,
    });
  });

  it('aplica un pago con línea únicamente a esa línea', () => {
    const balances = aplicarPagos(
      [line('linea-1', 4000), line('linea-2', 6000)],
      [payment('pago-1', 4000, 'cobro', 'pedido-1', 'linea-1')],
    );

    expect(balances.map(({ pagos_aplicados }) => pagos_aplicados)).toEqual([4000, 0]);
  });

  it('reparte un pago general por fecha entre las líneas pendientes', () => {
    const balances = aplicarPagos(
      [
        line('linea-tarde', 6000, 'pendiente', '2026-10-03'),
        line('linea-temprano', 4000, 'pendiente', '2026-10-01'),
      ],
      [payment('pago-1', 4000)],
    );
    const balancesByLine = new Map(balances.map((item) => [item.id, item.pagos_aplicados]));

    expect(balancesByLine.get('linea-temprano')).toBe(4000);
    expect(balancesByLine.get('linea-tarde')).toBe(0);
  });

  it('prioriza entregadas antes de líneas pendientes y desempata por creación', () => {
    const balances = aplicarPagos(
      [
        { ...line('pendiente', 4000, 'pendiente', '2026-10-01'), creado: '2026-01-01' },
        { ...line('entregada', 4000, 'entregado', '2026-10-03'), creado: '2026-01-03' },
      ],
      [payment('pago-1', 4000)],
    );

    expect(balances.find(({ id }) => id === 'entregada').pagada).toBe(true);
    expect(balances.find(({ id }) => id === 'pendiente').pagada).toBe(false);
    const tied = aplicarPagos(
      [
        { ...line('creada-despues', 4000, 'pendiente', '2026-10-01'), creado: '2026-01-02' },
        { ...line('creada-antes', 4000, 'pendiente', '2026-10-01'), creado: '2026-01-01' },
      ],
      [payment('pago-2', 4000)],
    );
    expect(tied.find(({ id }) => id === 'creada-antes').pagada).toBe(true);
  });

  it('conserva el excedente como saldo a favor sin aplicar más que el precio', () => {
    const result = calculate({
      lines: [line('linea-1', 4000, 'pendiente')],
      payments: [payment('pago-1', 5000)],
    }).pedidos[0];

    expect(result.lineas[0].pagos_aplicados).toBe(4000);
    expect(result.saldo_a_favor).toBe(1000);
  });

  it('una devolución general usa primero el excedente antes de reducir el trabajo', () => {
    const [result] = aplicarPagos(
      [line('linea-1', 4000, 'pendiente')],
      [
        payment('pago-1', 5000),
        payment('devolucion-1', 500, 'devolucion'),
      ],
    );

    expect(result.pagos_aplicados).toBe(4000);
    expect(result.pagada).toBe(true);
  });

  it('una devolución reduce lo aplicado y puede quitar el estado pagado', () => {
    const [result] = aplicarPagos(
      [line('linea-1', 4000, 'pendiente')],
      [
        payment('pago-1', 4000, 'cobro', 'pedido-1', 'linea-1'),
        payment('devolucion-1', 500, 'devolucion', 'pedido-1', 'linea-1'),
      ],
    );

    expect(result.pagos_aplicados).toBe(3500);
    expect(estadoLinea(result, result.pagos_aplicados).pagada).toBe(false);
  });

  it('excluye las líneas canceladas de pendientes, pagos aplicados y terminadas', () => {
    const [result] = aplicarPagos(
      [line('linea-1', 4000, 'cancelado')],
      [payment('pago-1', 4000, 'cobro', 'pedido-1', 'linea-1')],
    );

    expect(result.pagos_aplicados).toBe(0);
    expect(esTerminada(result, result.pagos_aplicados)).toBe(false);
    expect(pedidoActivo([result], [])).toBe(false);
  });

  it('ignora pagos eliminados al calcular lo aplicado', () => {
    const [result] = aplicarPagos(
      [line('linea-1', 4000, 'pendiente')],
      [{ ...payment('pago-1', 4000, 'cobro', 'pedido-1', 'linea-1'), eliminado: true }],
    );

    expect(result.pagos_aplicados).toBe(0);
    expect(estadoLinea(result, result.pagos_aplicados).pagada).toBe(false);
  });

  it('mantiene activo un pedido con una línea terminada y otra pendiente', () => {
    const lines = [
      line('linea-1', 4000, 'entregado'),
      line('linea-2', 6000, 'pendiente'),
    ];
    const payments = [payment('pago-1', 4000, 'cobro', 'pedido-1', 'linea-1')];

    expect(pedidoActivo(lines, payments)).toBe(true);
  });

  it('saca de Encargos un pedido con todas sus líneas terminadas', () => {
    const lines = [
      line('linea-1', 4000, 'entregado'),
      line('linea-2', 6000, 'entregado'),
    ];
    const payments = [
      payment('pago-1', 4000, 'cobro', 'pedido-1', 'linea-1'),
      payment('pago-2', 6000, 'cobro', 'pedido-1', 'linea-2'),
    ];

    expect(pedidoActivo(lines, payments)).toBe(false);
  });

  it('calcula el saldo exigible cuando todavía no hay pagos', () => {
    const result = calculate({ lines: [line('linea-1', 30000)] });

    expect(result.pedidos[0]).toMatchObject({
      total_vigente: 30000,
      total_entregado: 30000,
      cobros_netos: 0,
      por_cobrar: 30000,
      deuda_exigible: 30000,
      saldo_a_favor: 0,
    });
  });

  it('calcula un pago parcial', () => {
    const result = calculate({
      lines: [line('linea-1', 30000)],
      payments: [payment('pago-1', 10000)],
    });

    expect(result.pedidos[0]).toMatchObject({
      por_cobrar: 20000,
      deuda_exigible: 20000,
      saldo_a_favor: 0,
    });
  });

  it('muestra saldo a favor cuando los cobros superan el total vigente', () => {
    const result = calculate({
      lines: [line('linea-1', 10000)],
      payments: [payment('pago-1', 15000)],
    });

    expect(result.pedidos[0]).toMatchObject({
      por_cobrar: -5000,
      deuda_exigible: 0,
      saldo_a_favor: 5000,
    });
  });

  it('excluye las líneas canceladas del total vigente y entregado', () => {
    const result = calculate({
      lines: [
        line('linea-1', 10000),
        line('linea-2', 20000, 'cancelado'),
      ],
      payments: [payment('pago-1', 3000)],
    });

    expect(result.pedidos[0]).toMatchObject({
      total_vigente: 10000,
      total_entregado: 10000,
      por_cobrar: 7000,
      deuda_exigible: 7000,
    });
  });

  it('al cancelar conserva el adelanto como saldo a favor si no se devuelve', () => {
    const result = calculate({
      lines: [line('linea-1', 10000, 'cancelado')],
      payments: [payment('pago-1', 10000)],
    });

    expect(result.pedidos[0]).toMatchObject({
      total_vigente: 0,
      total_entregado: 0,
      cobros_netos: 10000,
      por_cobrar: -10000,
      deuda_exigible: 0,
      saldo_a_favor: 10000,
    });
  });

  it('al cancelar y devolver el adelanto no suma ingreso ni genera saldo a favor', () => {
    const result = calculate({
      lines: [line('linea-1', 10000, 'cancelado')],
      payments: [
        payment('pago-1', 10000),
        payment('devolucion-1', 10000, 'devolucion'),
      ],
    });

    expect(result.pedidos[0]).toMatchObject({
      total_vigente: 0,
      total_entregado: 0,
      cobros_netos: 0,
      por_cobrar: 0,
      deuda_exigible: 0,
      saldo_a_favor: 0,
    });
  });

  it('resta las devoluciones de los cobros netos y aumenta el saldo del trabajo', () => {
    const result = calculate({
      lines: [line('linea-1', 10000)],
      payments: [
        payment('pago-1', 7000),
        payment('pago-2', 2000, 'devolucion'),
      ],
    });

    expect(result.pedidos[0]).toMatchObject({
      cobros_netos: 5000,
      deuda_exigible: 5000,
    });
    expect(result.pedidos[0].lineas[0].saldo).toBe(5000);
  });

  it('reparte pagos sin línea entre trabajos entregados por fecha', () => {
    const result = calculate({
      lines: [
        line('linea-tarde', 10000, 'entregado', '2026-10-03'),
        line('linea-temprano', 10000, 'entregado', '2026-10-01'),
      ],
      payments: [payment('pago-1', 15000)],
    });
    const balancesByLine = new Map(
      result.pedidos[0].lineas.map((entry) => [entry.id, entry.saldo]),
    );

    expect(balancesByLine.get('linea-temprano')).toBe(0);
    expect(balancesByLine.get('linea-tarde')).toBe(5000);
  });

  it('suma pedidos del mismo cliente para calcular su deuda y saldo a favor', () => {
    const result = calculate({
      orders: [
        { id: 'pedido-1', cliente_id: client.id },
        { id: 'pedido-2', cliente_id: client.id },
      ],
      lines: [
        line('linea-1', 10000, 'entregado', '2026-10-01', 'pedido-1'),
        line('linea-2', 20000, 'pendiente', '2026-10-03', 'pedido-2'),
      ],
      payments: [payment('pago-1', 3000, 'cobro', 'pedido-1')],
    });

    expect(result.clientes[0]).toMatchObject({
      total_vigente: 30000,
      total_entregado: 10000,
      cobros_netos: 3000,
      por_cobrar: 27000,
      deuda_exigible: 7000,
      saldo_a_favor: 0,
    });
  });

  it('calcula días desde la entrega usando fechas locales', () => {
    expect(daysSinceDelivery('2026-10-29T23:30:00.000Z', new Date(2026, 9, 31))).toBe(2);
    expect(daysSinceDelivery('fecha-inválida', new Date(2026, 9, 31))).toBe(0);
  });

  it('calcula el adelanto que se puede devolver al cancelar un trabajo', () => {
    const lines = [
      line('linea-1', 10000, 'pendiente', '2026-10-01'),
      line('linea-2', 20000, 'pendiente', '2026-10-02'),
    ];
    const payments = [payment('pago-1', 15000)];

    expect(calculateLineRefundAmount(lines, payments, 'linea-1')).toBe(10000);
    expect(calculateLineRefundAmount(lines, payments, 'linea-2')).toBe(5000);
  });

  it('considera primero los pagos asociados directamente al trabajo', () => {
    const lines = [
      line('linea-1', 10000, 'pendiente', '2026-10-01'),
      line('linea-2', 20000, 'pendiente', '2026-10-02'),
    ];
    const payments = [
      payment('pago-1', 6000, 'cobro', 'pedido-1', 'linea-2'),
      payment('pago-2', 5000),
    ];

    expect(calculateLineRefundAmount(lines, payments, 'linea-2')).toBe(6000);
    expect(calculateLineRefundAmount(lines, payments, 'linea-1')).toBe(5000);
  });
});
