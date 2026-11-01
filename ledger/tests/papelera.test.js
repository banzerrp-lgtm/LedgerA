import { afterEach, describe, expect, it, vi } from 'vitest';
import { db, TABLE_NAMES } from '../src/db/db.js';
import { getTrashRecords } from '../src/db/papelera.js';

afterEach(() => {
  vi.restoreAllMocks();
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
});
