import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRecord,
  ensureInitialWorkTypes,
  getRecord,
  getRecords,
  permanentlyDeleteRecord,
  restoreRecord,
  softDeleteRecord,
  updateRecord,
  db,
} from '../src/db/db.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('operaciones de base de datos', () => {
  it('crea registros con los campos comunes y una UUID', async () => {
    const table = db.table('clientes');
    const add = vi.spyOn(table, 'add').mockResolvedValue('id');

    const record = await createRecord('clientes', { nombre: 'Ana' });

    expect(record.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(record).toMatchObject({
      nombre: 'Ana',
      eliminado: false,
      fecha_eliminado: null,
    });
    expect(record.creado).toBe(record.modificado);
    expect(add).toHaveBeenCalledWith(record);
  });

  it('omite eliminados de la lectura normal', async () => {
    const table = db.table('clientes');
    const query = { toArray: vi.fn().mockResolvedValue([{ id: '1' }]) };
    const filter = vi.spyOn(table, 'filter').mockReturnValue(query);

    await getRecords('clientes');

    expect(filter).toHaveBeenCalledWith(expect.any(Function));
  });

  it('lee registros activos sin usar booleanos como claves de IndexedDB', async () => {
    await db.open();
    try {
      await db.table('clientes').bulkAdd([
        { id: 'activo', nombre: 'Ana', eliminado: false },
        { id: 'eliminado', nombre: 'Luis', eliminado: true },
      ]);

      await expect(getRecords('clientes')).resolves.toMatchObject([
        { id: 'activo', nombre: 'Ana', eliminado: false },
      ]);
    } finally {
      await db.delete();
    }
  });

  it('crea los tipos de trabajo iniciales solo cuando la tabla está vacía', async () => {
    const table = db.table('tipos_trabajo');
    vi.spyOn(table, 'count').mockResolvedValue(0);
    const bulkAdd = vi.spyOn(table, 'bulkAdd').mockResolvedValue(['1', '2', '3']);

    const types = await ensureInitialWorkTypes();

    expect(types.map(({ nombre }) => nombre)).toEqual([
      'Documento',
      'Presentación',
      'Otro',
    ]);
    expect(types.every(({ padre_id, activo }) => padre_id === null && activo)).toBe(true);
    expect(bulkAdd).toHaveBeenCalledWith(types);
  });

  it('actualiza datos sin permitir sobrescribir campos comunes', async () => {
    const table = db.table('clientes');
    const original = {
      id: 'cliente-1',
      nombre: 'Ana',
      creado: '2026-01-01T00:00:00.000Z',
      modificado: '2026-01-01T00:00:00.000Z',
      eliminado: false,
      fecha_eliminado: null,
    };
    vi.spyOn(table, 'get').mockResolvedValue(original);
    const put = vi.spyOn(table, 'put').mockResolvedValue('cliente-1');

    const updated = await updateRecord('clientes', original.id, {
      nombre: 'Ana María',
      id: 'otro-id',
      eliminado: true,
    });

    expect(updated.nombre).toBe('Ana María');
    expect(updated.id).toBe(original.id);
    expect(updated.eliminado).toBe(false);
    expect(updated.modificado).not.toBe(original.modificado);
    expect(put).toHaveBeenCalledWith(updated);
  });

  it('envía a papelera y restaura un registro', async () => {
    const table = db.table('clientes');
    let record = {
      id: 'cliente-1',
      nombre: 'Ana',
      creado: '2026-01-01T00:00:00.000Z',
      modificado: '2026-01-01T00:00:00.000Z',
      eliminado: false,
      fecha_eliminado: null,
    };
    vi.spyOn(table, 'get').mockImplementation(async () => record);
    vi.spyOn(table, 'put').mockImplementation(async (updated) => {
      record = updated;
      return updated.id;
    });

    const deleted = await softDeleteRecord('clientes', record.id);
    expect(deleted.eliminado).toBe(true);
    expect(deleted.fecha_eliminado).toBeTruthy();

    expect(await getRecord('clientes', record.id)).toBeUndefined();
    expect(await getRecord('clientes', record.id, { includeDeleted: true })).toEqual(deleted);

    const restored = await restoreRecord('clientes', record.id);
    expect(restored.eliminado).toBe(false);
    expect(restored.fecha_eliminado).toBeNull();
  });

  it('solo permite borrar definitivamente registros que están en la papelera', async () => {
    const table = db.table('clientes');
    const deletedRecord = { id: 'cliente-1', eliminado: true };
    const get = vi.spyOn(table, 'get')
      .mockResolvedValueOnce(deletedRecord)
      .mockResolvedValue({ ...deletedRecord, eliminado: false });
    const deleteRecord = vi.spyOn(table, 'delete').mockResolvedValue(undefined);

    await permanentlyDeleteRecord('clientes', deletedRecord.id);
    expect(deleteRecord).toHaveBeenCalledWith(deletedRecord.id);

    expect(get).toHaveBeenCalledTimes(1);
    await expect(permanentlyDeleteRecord('clientes', deletedRecord.id))
      .rejects.toThrow('Solo se pueden borrar definitivamente');
  });

  it('rechaza nombres de tabla desconocidos', async () => {
    await expect(getRecords('tabla_inventada')).rejects.toThrow('Tabla no válida');
  });
});
