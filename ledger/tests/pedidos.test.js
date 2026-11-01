import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/db/db.js';
import { createOrderWithLines, updateLineDeliveryDate, updateLineStatus } from '../src/db/pedidos.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pedidos y líneas', () => {
  it('valida el pedido antes de iniciar una transacción', async () => {
    const transaction = vi.spyOn(db, 'transaction');
    await expect(createOrderWithLines({
      cliente_id: 'cliente-1',
      modalidad_pago: 'contra_entrega',
      adelanto_acordado: 0,
    }, [])).rejects.toThrow('Agrega al menos una línea');

    expect(transaction).not.toHaveBeenCalled();
  });

  it('identifica la línea cuyo tipo de trabajo todavía no está seleccionado', async () => {
    const transaction = vi.spyOn(db, 'transaction');
    await expect(createOrderWithLines({
      cliente_id: 'cliente-1',
      fecha_pedido: '2026-11-01',
      fecha_entrega_general: null,
      modalidad_pago: 'contra_entrega',
      adelanto_acordado: 0,
      notas: '',
    }, [{
      tipo_id: null,
      descripcion: '',
      precio_acordado: 15000,
      nota_descuento: '',
      fecha_entrega: '2026-11-02',
      hora_entrega: null,
    }])).rejects.toThrow('Elige el tipo de la línea 1');

    expect(transaction).not.toHaveBeenCalled();
  });

  it('cambia el estado de una sola línea y registra su fecha de término', async () => {
    const table = db.table('lineas');
    const line = {
      id: 'linea-1',
      estado: 'pendiente',
      creado: '2026-11-01T00:00:00.000Z',
      modificado: '2026-11-01T00:00:00.000Z',
      eliminado: false,
      fecha_eliminado: null,
    };
    vi.spyOn(table, 'get').mockResolvedValue(line);
    const put = vi.spyOn(table, 'put').mockResolvedValue(line.id);

    const updated = await updateLineStatus(line.id, 'entregado');

    expect(updated.estado).toBe('entregado');
    expect(updated.fecha_terminado).toBeTruthy();
    expect(put).toHaveBeenCalledWith(updated);
  });

  it('cambia la fecha y conserva la fecha de entrega original', async () => {
    const table = db.table('lineas');
    const line = {
      id: 'linea-2',
      fecha_entrega: '2026-11-02',
      fecha_entrega_original: '2026-11-02',
      creado: '2026-11-01T00:00:00.000Z',
      modificado: '2026-11-01T00:00:00.000Z',
      eliminado: false,
      fecha_eliminado: null,
    };
    vi.spyOn(table, 'get').mockResolvedValue(line);
    const put = vi.spyOn(table, 'put').mockResolvedValue(line.id);

    const updated = await updateLineDeliveryDate(line.id, '2026-11-05');

    expect(updated.fecha_entrega).toBe('2026-11-05');
    expect(updated.fecha_entrega_original).toBe('2026-11-02');
    expect(put).toHaveBeenCalledWith(updated);
  });

  it('rechaza fechas inexistentes', async () => {
    await expect(updateLineDeliveryDate('linea-1', '2026-02-30'))
      .rejects.toThrow('la fecha no es válida');
  });
});
