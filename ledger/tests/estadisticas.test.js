import { describe, expect, it } from 'vitest';
import {
  calculateStatistics,
  getPeriodRange,
} from '../src/logic/estadisticas.js';

const client = { id: 'cliente-1', nombre: 'Ana' };
const order = { id: 'pedido-1', cliente_id: client.id };
const line = (id, price, typeId, state = 'entregado') => ({
  id,
  pedido_id: order.id,
  precio_acordado: price,
  tipo_id: typeId,
  estado: state,
  fecha_entrega: '2026-03-05',
});
const payment = (id, amount, type, date, lineId = null) => ({
  id,
  pedido_id: order.id,
  monto: amount,
  tipo: type,
  fecha: date,
  linea_id: lineId,
});

describe('rangos y totales de estadísticas', () => {
  it('usa semanas de lunes a domingo y compara con la semana anterior', () => {
    expect(getPeriodRange('semana', new Date(2026, 2, 4))).toEqual({
      from: '2026-03-02',
      to: '2026-03-08',
      previousFrom: '2026-02-23',
      previousTo: '2026-03-01',
    });
  });

  it('compara meses calendario completos incluso cuando duran distinto', () => {
    expect(getPeriodRange('mes', new Date(2026, 2, 31))).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
      previousFrom: '2026-02-01',
      previousTo: '2026-02-28',
    });
  });

  it('compara años calendario y contempla años bisiestos', () => {
    expect(getPeriodRange('año', new Date(2024, 5, 15))).toEqual({
      from: '2024-01-01',
      to: '2024-12-31',
      previousFrom: '2023-01-01',
      previousTo: '2023-12-31',
    });
  });

  it('suma cobros y resta devoluciones por fecha de pago para la semana y el periodo anterior', () => {
    const data = {
      clients: [client],
      orders: [order],
      lines: [line('linea-1', 5000, 'tipo-1')],
      payments: [
        payment('cobro-actual', 3000, 'cobro', '2026-03-03'),
        payment('devolucion-actual', 500, 'devolucion', '2026-03-04'),
        payment('cobro-anterior', 1000, 'cobro', '2026-02-24'),
        payment('pago-fuera', 800, 'cobro', '2026-03-09'),
      ],
      types: [{ id: 'tipo-1', nombre: 'Documento' }],
    };

    const result = calculateStatistics(data, 'semana', new Date(2026, 2, 4));

    expect(result).toMatchObject({
      total: 2500,
      previousTotal: 1000,
      difference: 1500,
      receivable: 700,
      chartLabels: ['2', '3', '4', '5', '6', '7', '8'],
      chartValues: [0, 3000, -500, 0, 0, 0, 0],
      typeBreakdown: [{ id: 'tipo-1', nombre: 'Documento', total: 2500 }],
      topClients: [{ id: 'cliente-1', nombre: 'Ana', total: 2500 }],
    });
  });

  it('distribuye pagos de pedido por precio conservando cada centavo y prioriza líneas explícitas', () => {
    const data = {
      clients: [client],
      orders: [order],
      lines: [
        line('linea-a', 100, 'tipo-a'),
        line('linea-b', 200, 'tipo-b'),
      ],
      payments: [
        payment('pago-compartido', 101, 'cobro', '2026-03-05'),
        payment('pago-directo', 11, 'cobro', '2026-03-05', 'linea-b'),
      ],
      types: [
        { id: 'tipo-a', nombre: 'A' },
        { id: 'tipo-b', nombre: 'B' },
      ],
    };

    const result = calculateStatistics(data, 'mes', new Date(2026, 2, 5));

    expect(result.total).toBe(112);
    expect(result.typeBreakdown).toEqual([
      { id: 'tipo-b', nombre: 'B', total: 78 },
      { id: 'tipo-a', nombre: 'A', total: 34 },
    ]);
  });

  it('muestra doce barras mensuales al elegir el año', () => {
    const result = calculateStatistics({ clients: [], orders: [], lines: [], payments: [] }, 'año', new Date(2026, 5, 1));

    expect(result.chartLabels).toHaveLength(12);
    expect(result.chartValues).toHaveLength(12);
    expect(result.chartValues.every((value) => value === 0)).toBe(true);
  });

  it('rechaza periodos que no estén admitidos', () => {
    expect(() => getPeriodRange('día', new Date())).toThrow('no es válido');
  });
});
