import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRecord, db } from '../src/db/db.js';
import {
  createOrderWithLines,
  getOrderDetail,
  getOrderSummaries,
  updateLineStatus,
} from '../src/db/pedidos.js';
import { getCompletedHistory } from '../src/db/historial.js';

beforeEach(async () => {
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('guardado de pedidos en IndexedDB', () => {
  it('guarda el pedido y sus líneas usando registros activos', async () => {
    const client = await createRecord('clientes', {
      nombre: 'Ana',
      codigo_pais: '+591',
      telefono: '70000000',
    });
    const type = await createRecord('tipos_trabajo', {
      nombre: 'Documento',
      padre_id: null,
      activo: true,
      precio_sugerido: null,
    });

    const created = await createOrderWithLines({
      cliente_id: client.id,
      fecha_pedido: '2026-11-01',
      fecha_entrega_general: null,
      modalidad_pago: 'contra_entrega',
      adelanto_acordado: 0,
      notas: '',
    }, [{
      tipo_id: type.id,
      descripcion: '',
      precio_acordado: 15000,
      nota_descuento: '',
      fecha_entrega: '2026-11-02',
      hora_entrega: null,
    }]);

    expect(await db.table('pedidos').get(created.pedido.id)).toMatchObject({
      cliente_id: client.id,
      eliminado: false,
    });
    expect(await db.table('lineas').get(created.lineas[0].id)).toMatchObject({
      pedido_id: created.pedido.id,
      tipo_id: type.id,
      eliminado: false,
    });
  });

  it('muestra en Encargos solo pedidos con líneas aún no terminadas', async () => {
    const client = await createRecord('clientes', {
      nombre: 'Ana',
      codigo_pais: '+591',
      telefono: '70000000',
    });
    const type = await createRecord('tipos_trabajo', {
      nombre: 'Documento',
      padre_id: null,
      activo: true,
      precio_sugerido: null,
    });
    const created = await createOrderWithLines({
      cliente_id: client.id,
      fecha_pedido: '2026-11-01',
      fecha_entrega_general: null,
      modalidad_pago: 'contra_entrega',
      adelanto_acordado: 0,
      notas: '',
    }, [
      {
        tipo_id: type.id,
        descripcion: 'Primero',
        precio_acordado: 4000,
        nota_descuento: '',
        fecha_entrega: '2026-11-02',
        hora_entrega: null,
      },
      {
        tipo_id: type.id,
        descripcion: 'Segundo',
        precio_acordado: 6000,
        nota_descuento: '',
        fecha_entrega: '2026-11-03',
        hora_entrega: null,
      },
    ]);

    await createRecord('pagos', {
      pedido_id: created.pedido.id,
      linea_id: created.lineas[0].id,
      monto: 4000,
      tipo: 'cobro',
      metodo: 'efectivo',
      fecha: new Date().toISOString().slice(0, 10),
      nota: '',
    });
    await updateLineStatus(created.lineas[0].id, 'entregado');
    expect(await getOrderSummaries()).toHaveLength(1);
    expect((await getOrderDetail(created.pedido.id)).lineas[0].terminada).toBe(true);

    await createRecord('pagos', {
      pedido_id: created.pedido.id,
      linea_id: created.lineas[1].id,
      monto: 6000,
      tipo: 'cobro',
      metodo: 'efectivo',
      fecha: new Date().toISOString().slice(0, 10),
      nota: '',
    });
    await updateLineStatus(created.lineas[1].id, 'entregado');

    expect(await getOrderSummaries()).toHaveLength(0);
    expect((await getCompletedHistory()).history).toHaveLength(2);
  });
});
