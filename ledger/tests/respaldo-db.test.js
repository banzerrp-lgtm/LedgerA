import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db.js';
import {
  exportBackupDocument,
  importBackupDocument,
} from '../src/db/respaldo.js';
import { createBackupDocument } from '../src/logic/respaldo.js';

afterEach(async () => {
  await db.delete();
});

beforeEach(async () => {
  await db.open();
});

describe('servicio de respaldo IndexedDB', () => {
  it('exporta también registros de papelera y guarda la fecha del respaldo', async () => {
    await db.table('clientes').add({
      id: 'cliente-papelera',
      nombre: 'Ana',
      creado: '2026-01-01T10:00:00.000Z',
      modificado: '2026-01-01T10:00:00.000Z',
      eliminado: true,
      fecha_eliminado: '2026-01-02T10:00:00.000Z',
    });

    const backup = await exportBackupDocument();
    const backupSetting = backup.tablas.ajustes.find(
      ({ clave }) => clave === 'ultimo_respaldo',
    );

    expect(backup.tablas.clientes).toHaveLength(1);
    expect(backup.tablas.clientes[0].eliminado).toBe(true);
    expect(backupSetting.valor).toBe(backup.exportado);
  });

  it('reemplaza las tablas en una transacción e incluye los datos importados', async () => {
    await db.table('clientes').add({
      id: 'cliente-local',
      nombre: 'Datos locales',
      creado: '2026-01-01T10:00:00.000Z',
      modificado: '2026-01-01T10:00:00.000Z',
      eliminado: false,
      fecha_eliminado: null,
    });
    const backup = createBackupDocument({
      clientes: [{
        id: 'cliente-respaldo',
        nombre: 'Datos respaldados',
        creado: '2026-01-02T10:00:00.000Z',
        modificado: '2026-01-02T10:00:00.000Z',
        eliminado: false,
        fecha_eliminado: null,
      }],
    });

    await importBackupDocument(backup);

    expect(await db.table('clientes').toArray()).toMatchObject([
      { id: 'cliente-respaldo', nombre: 'Datos respaldados' },
    ]);
    expect(await db.table('ajustes').where('clave').equals('ultimo_respaldo').first())
      .toMatchObject({
        clave: 'ultimo_respaldo',
        valor: backup.exportado,
        eliminado: false,
      });
  });

  it('no modifica los datos existentes cuando el archivo no es válido', async () => {
    await db.table('clientes').add({
      id: 'cliente-local',
      nombre: 'Datos locales',
      creado: '2026-01-01T10:00:00.000Z',
      modificado: '2026-01-01T10:00:00.000Z',
      eliminado: false,
      fecha_eliminado: null,
    });

    await expect(importBackupDocument({ schema_version: 99 })).rejects.toThrow();

    expect(await db.table('clientes').toArray()).toMatchObject([
      { id: 'cliente-local', nombre: 'Datos locales' },
    ]);
  });
});
