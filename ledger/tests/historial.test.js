import { describe, expect, it } from 'vitest';
import {
  completionDate,
  filterCompletedHistory,
  safeLocationUrl,
  summarizePortfolio,
} from '../src/logic/historial.js';

const history = [
  {
    id: 'linea-1',
    cliente_nombre: 'Ana Pérez',
    cliente_id: 'cliente-1',
    tipo_id: 'tipo-doc',
    tipo_nombre: 'Documento',
    descripcion: 'Informe anual',
    pedido_notas: '',
    fecha_terminado: '2026-10-10T12:00:00.000Z',
    estado: 'entregado',
    precio_acordado: 30000,
    pagos_aplicados: 20000,
  },
  {
    id: 'linea-2',
    cliente_nombre: 'Luis',
    cliente_id: 'cliente-2',
    tipo_id: 'tipo-pres',
    tipo_nombre: 'Presentación',
    descripcion: 'Ventas Q4',
    pedido_notas: 'Urgente',
    fecha_terminado: '2026-10-20T12:00:00.000Z',
    estado: 'entregado',
    precio_acordado: 50000,
    pagos_aplicados: 50000,
  },
];

describe('historial y portafolio', () => {
  it('usa la fecha más reciente entre entrega y último pago', () => {
    expect(completionDate('2026-10-10T12:00:00.000Z', '2026-10-20')).toBe('2026-10-20');
    expect(completionDate('2026-10-20', '2026-10-10')).toBe('2026-10-20');
  });

  it('filtra historial por texto, cliente, tipo y rango de fechas', () => {
    expect(filterCompletedHistory(history, { query: 'ana' }).map(({ id }) => id))
      .toEqual(['linea-1']);
    expect(filterCompletedHistory(history, { typeId: 'tipo-pres' }).map(({ id }) => id))
      .toEqual(['linea-2']);
    expect(filterCompletedHistory(history, { from: '2026-10-15', to: '2026-10-31' }).map(({ id }) => id))
      .toEqual(['linea-2']);
    expect(filterCompletedHistory(history, { query: 'urgente' }).map(({ id }) => id))
      .toEqual(['linea-2']);
  });

  it('resume cantidades, total y pagado por tipo durante el periodo indicado', () => {
    const summary = summarizePortfolio(history, {
      from: '2026-10-01',
      to: '2026-10-15',
    });

    expect(summary).toEqual([{
      tipo_id: 'tipo-doc',
      tipo_nombre: 'Documento',
      cantidad: 1,
      total: 30000,
      pagado: 20000,
    }]);
  });

  it('solo permite abrir ubicaciones con URL HTTP o HTTPS', () => {
    expect(safeLocationUrl('https://drive.google.com/file/123')).toBe('https://drive.google.com/file/123');
    expect(safeLocationUrl('javascript:alert(1)')).toBeNull();
    expect(safeLocationUrl('C:\\\\trabajos\\\\archivo.docx')).toBeNull();
  });
});
