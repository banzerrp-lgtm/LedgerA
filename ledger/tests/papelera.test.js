import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, TABLE_NAMES } from '../src/db/db.js';
import {
  emptyTrash,
  getTrashRecords,
} from '../src/db/papelera.js';
import { countTrashItems, orderTrashDeletion } from '../src/logic/papelera.js';
import { mountPapelera, renderPapelera } from '../src/views/papelera.js';

beforeEach(async () => {
  await db.open();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});

describe('papelera', () => {
  it('agrupa por tipo y omite registros que siguen activos', async () => {
    for (const tableName of TABLE_NAMES) {
      vi.spyOn(db.table(tableName), 'toArray').mockResolvedValue(
        tableName === 'clientes'
          ? [
            { id: 'cliente-1', nombre: 'Ana', eliminado: true },
            { id: 'cliente-2', nombre: 'Luis', eliminado: false },
          ]
          : [],
      );
    }

    const groups = await getTrashRecords();

    expect(groups).toEqual([
      {
        table: 'clientes',
        label: 'Clientes',
        items: [expect.objectContaining({
          id: 'cliente-1',
          label: 'Ana',
          tableLabel: 'Clientes',
        })],
      },
    ]);
  });

  it('renderiza Vaciar papelera deshabilitado hasta conocer el contenido', () => {
    expect(renderPapelera()).toMatch(/data-trash-empty disabled/);
  });

  it('mantiene Vaciar papelera deshabilitado cuando la papelera está vacía', async () => {
    const nodes = {
      feedback: { textContent: '', hidden: false, setAttribute: vi.fn() },
      groups: { innerHTML: '' },
      emptyButton: { disabled: false },
      dialog: {},
      dialogMessage: { textContent: '' },
      confirmWord: { hidden: false },
      confirmInput: { value: '', addEventListener: vi.fn() },
      confirmButton: { disabled: false },
      form: { addEventListener: vi.fn() },
    };
    const selectors = {
      '#trash-feedback': nodes.feedback,
      '#trash-groups': nodes.groups,
      '[data-trash-empty]': nodes.emptyButton,
      '#trash-confirm-dialog': nodes.dialog,
      '#trash-confirm-message': nodes.dialogMessage,
      '#trash-confirm-word': nodes.confirmWord,
      '#trash-confirm-input': nodes.confirmInput,
      '[data-trash-confirm]': nodes.confirmButton,
      '#trash-confirm-form': nodes.form,
    };
    const root = {
      addEventListener: vi.fn(),
      querySelector: (selector) => selectors[selector],
    };

    mountPapelera(root);

    await vi.waitFor(() => expect(nodes.emptyButton.disabled).toBe(true));
    expect(nodes.feedback.textContent).toBe('La papelera está vacía');
  });

  it('cuenta elementos por tipo', () => {
    expect(countTrashItems([
      { table: 'pedidos', id: 'pedido-1' },
      { table: 'pedidos', id: 'pedido-2' },
      { table: 'pagos', id: 'pago-1' },
    ])).toEqual({
      total: 3,
      counts: { pedidos: 2, pagos: 1 },
    });
  });

  it('ordena y elimina un pedido marcado junto con todas sus dependencias', async () => {
    await db.table('pedidos').put({ id: 'pedido', eliminado: true });
    await db.table('lineas').put({ id: 'linea', pedido_id: 'pedido', eliminado: false });
    await db.table('pagos').bulkAdd([
      { id: 'pago-directo', pedido_id: 'pedido', linea_id: 'linea', eliminado: false },
      { id: 'pago-general', pedido_id: 'pedido', linea_id: null, eliminado: false },
    ]);
    await db.table('ubicaciones').put({ id: 'ubicacion', linea_id: 'linea', eliminado: false });
    await db.table('cambios').put({ id: 'cambio', linea_id: 'linea', eliminado: false });

    const snapshot = Object.fromEntries(await Promise.all(TABLE_NAMES.map(async (table) => [
      table,
      await db.table(table).toArray(),
    ])));
    expect(orderTrashDeletion(snapshot).map(({ table }) => table))
      .toEqual(['ubicaciones', 'cambios', 'pagos', 'pagos', 'lineas', 'pedidos']);

    expect(await emptyTrash()).toBe(6);
    for (const table of ['pedidos', 'lineas', 'pagos', 'ubicaciones', 'cambios']) {
      expect(await db.table(table).count()).toBe(0);
    }
  });

  it('conserva un cliente eliminado que todavía tiene trabajos activos', async () => {
    await db.table('clientes').put({ id: 'cliente', eliminado: true, nombre: 'Ana' });
    await db.table('pedidos').put({
      id: 'pedido',
      cliente_id: 'cliente',
      eliminado: false,
    });
    await db.table('lineas').put({
      id: 'linea',
      pedido_id: 'pedido',
      eliminado: false,
      estado: 'pendiente',
    });

    const groups = await getTrashRecords();
    expect(groups[0].items[0]).toMatchObject({
      id: 'cliente',
      inUse: true,
      usageNote: 'En uso por 1 trabajos',
    });
    expect(await emptyTrash()).toBe(0);
    expect(await db.table('clientes').get('cliente')).toBeDefined();
    expect(await db.table('lineas').get('linea')).toBeDefined();
  });

  it('conserva tipos eliminados que tienen subtipos activos sin mostrar cero trabajos', async () => {
    await db.table('tipos_trabajo').bulkAdd([
      { id: 'tipo-padre', nombre: 'Padre', eliminado: true },
      { id: 'tipo-hijo', nombre: 'Hijo', padre_id: 'tipo-padre', eliminado: false },
    ]);

    const groups = await getTrashRecords();
    expect(groups[0].items[0]).toMatchObject({
      id: 'tipo-padre',
      inUse: true,
      usageNote: 'En uso por subtipos activos',
    });
    expect(await emptyTrash()).toBe(0);
    expect(await db.table('tipos_trabajo').get('tipo-padre')).toBeDefined();
  });

  it('revierte todo si falla el borrado dentro de la transacción', async () => {
    await db.table('pedidos').put({ id: 'pedido', eliminado: true });
    await db.table('lineas').put({ id: 'linea', pedido_id: 'pedido', eliminado: false });
    const table = db.table('pedidos');
    const bulkDelete = table.bulkDelete.bind(table);
    vi.spyOn(table, 'bulkDelete').mockImplementation(async (ids) => {
      await bulkDelete(ids);
      throw new Error('Fallo de prueba');
    });

    await expect(emptyTrash()).rejects.toThrow('Fallo de prueba');
    expect(await db.table('pedidos').get('pedido')).toBeDefined();
    expect(await db.table('lineas').get('linea')).toBeDefined();
  });

  it('nunca borra registros que siguen activos', async () => {
    await db.table('clientes').put({ id: 'cliente-activo', eliminado: false });
    await db.table('pedidos').put({ id: 'pedido-activo', eliminado: false });
    await db.table('lineas').put({ id: 'linea-activa', pedido_id: 'pedido-activo', eliminado: false });
    await db.table('pagos').put({ id: 'pago-activo', pedido_id: 'pedido-activo', eliminado: false });

    expect(await emptyTrash()).toBe(0);
    expect(await db.table('clientes').get('cliente-activo')).toBeDefined();
    expect(await db.table('pedidos').get('pedido-activo')).toBeDefined();
    expect(await db.table('lineas').get('linea-activa')).toBeDefined();
    expect(await db.table('pagos').get('pago-activo')).toBeDefined();
  });
});
