import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  createBackupDocument,
  formatBackupAge,
  validateAndMigrateBackup,
} from '../src/logic/respaldo.js';
import { createExcelWorkbook } from '../src/db/respaldo.js';

const record = (id, fields = {}) => ({
  id,
  creado: '2026-01-01T10:00:00.000Z',
  modificado: '2026-01-01T10:00:00.000Z',
  eliminado: false,
  fecha_eliminado: null,
  ...fields,
});

describe('respaldo', () => {
  it('crea un JSON versionado con todas las tablas, incluidos registros de papelera', () => {
    const tables = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []]));
    tables.clientes = [record('cliente-1', { nombre: 'Ana', eliminado: true })];

    const backup = createBackupDocument(tables, {
      appVersion: '1.0.0',
      exportedAt: '2026-01-02T10:00:00.000Z',
    });

    expect(backup).toMatchObject({
      schema_version: BACKUP_SCHEMA_VERSION,
      app_version: '1.0.0',
      exportado: '2026-01-02T10:00:00.000Z',
      tablas: { clientes: [record('cliente-1', { nombre: 'Ana', eliminado: true })] },
    });
    expect(Object.keys(backup.tablas)).toEqual(BACKUP_TABLES);
  });

  it('migra el formato anterior y completa tablas y campos comunes', () => {
    const migrated = validateAndMigrateBackup({
      schema_version: 1,
      app_version: '0.9.0',
      exportado: '2026-01-02T10:00:00.000Z',
      tablas: {
        clientes: [{ id: 'cliente-1', nombre: 'Ana' }],
      },
    });

    expect(migrated.schema_version).toBe(BACKUP_SCHEMA_VERSION);
    expect(migrated.tablas.clientes[0]).toMatchObject({
      id: 'cliente-1',
      nombre: 'Ana',
      creado: '2026-01-02T10:00:00.000Z',
      modificado: '2026-01-02T10:00:00.000Z',
      eliminado: false,
      fecha_eliminado: null,
    });
    expect(Object.keys(migrated.tablas)).toEqual(BACKUP_TABLES);
  });

  it('rechaza documentos y registros inválidos antes de importar', () => {
    expect(() => validateAndMigrateBackup({ schema_version: 99 }))
      .toThrow('versión más reciente');
    expect(() => validateAndMigrateBackup({
      schema_version: 2,
      app_version: '1.0.0',
      exportado: '2026-01-02T10:00:00.000Z',
      tablas: { clientes: [record('cliente-1'), record('cliente-1')] },
    })).toThrow('registros repetidos');
    expect(() => validateAndMigrateBackup({
      schema_version: 2,
      app_version: '1.0.0',
      exportado: '2026-01-02T10:00:00.000Z',
      tablas: { clientes: 'no es una lista' },
    })).toThrow('debe ser una lista');
  });

  it('genera un Excel con una hoja legible por tabla y encabezados', async () => {
    const bytes = await createExcelWorkbook({
      clientes: [record('cliente-1', { nombre: 'Ana', telefono: '123' })],
    });
    const workbook = XLSX.read(bytes, { type: 'array' });

    expect(workbook.SheetNames).toEqual([
      'Clientes',
      'Tipos de trabajo',
      'Pedidos',
      'Trabajos',
      'Pagos',
      'Ubicaciones',
      'Cambios',
      'Ajustes',
    ]);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.Clientes)).toEqual([
      expect.objectContaining({ ID: 'cliente-1', nombre: 'Ana', telefono: '123' }),
    ]);
  });

  it('muestra la antigüedad del último respaldo en días', () => {
    expect(formatBackupAge(null)).toBe('Aún no hay respaldo.');
    expect(formatBackupAge('2026-01-09T12:00:00', new Date(2026, 0, 10, 12)))
      .toBe('Último respaldo: ayer.');
    expect(formatBackupAge('2026-01-07T12:00:00', new Date(2026, 0, 10, 12)))
      .toBe('Último respaldo: hace 3 días.');
  });
});
