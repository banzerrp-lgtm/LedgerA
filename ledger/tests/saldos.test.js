import { describe, expect, it } from 'vitest';
import {
  calculateBalances,
  calculateLineRefundAmount,
  daysSinceDelivery,
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
