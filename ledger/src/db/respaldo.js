import { db, TABLE_NAMES } from './db.js';
import {
  BACKUP_TABLE_LABELS,
  createBackupDocument,
  validateAndMigrateBackup,
} from '../logic/respaldo.js';

const APP_VERSION = import.meta.env?.VITE_APP_VERSION ?? '1.0.0';

async function setLastBackup(transaction, value) {
  const table = transaction.table('ajustes');
  const existing = await table.where('clave').equals('ultimo_respaldo').first();
  const record = {
    ...(existing ?? {
      id: crypto.randomUUID(),
      creado: value,
    }),
    clave: 'ultimo_respaldo',
    valor: value,
    modificado: value,
    eliminado: false,
    fecha_eliminado: null,
  };
  await table.put(record);
}

export async function exportBackupDocument() {
  const exportedAt = new Date().toISOString();
  const tables = await db.transaction(
    'rw',
    ...TABLE_NAMES.map((table) => db.table(table)),
    async (transaction) => {
      await setLastBackup(transaction, exportedAt);
      return Object.fromEntries(await Promise.all(
        TABLE_NAMES.map(async (table) => [
          table,
          await transaction.table(table).toArray(),
        ]),
      ));
    },
  );
  return createBackupDocument(tables, { appVersion: APP_VERSION, exportedAt });
}

export async function importBackupDocument(value) {
  const backup = validateAndMigrateBackup(value);
  await db.transaction(
    'rw',
    ...TABLE_NAMES.map((table) => db.table(table)),
    async (transaction) => {
      for (const tableName of TABLE_NAMES) await transaction.table(tableName).clear();
      for (const tableName of TABLE_NAMES) {
        const rows = backup.tablas[tableName];
        if (rows.length) await transaction.table(tableName).bulkAdd(rows);
      }
      await setLastBackup(transaction, backup.exportado);
    },
  );
  return backup;
}

export async function exportExcelWorkbook() {
  const tables = await db.transaction(
    'r',
    ...TABLE_NAMES.map((table) => db.table(table)),
    (transaction) => Promise.all(TABLE_NAMES.map(async (table) => [
      table,
      await transaction.table(table).toArray(),
    ])),
  );
  return createExcelWorkbook(Object.fromEntries(tables));
}

export async function createExcelWorkbook(tables) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  for (const tableName of TABLE_NAMES) {
    const records = tables[tableName] ?? [];
    const rows = records.map((record) => Object.fromEntries(
      Object.entries(record).map(([field, value]) => [
        field === 'id' ? 'ID' : field.replace(/_/g, ' '),
        value === null || value === undefined
          ? ''
          : typeof value === 'object'
            ? JSON.stringify(value)
            : value,
      ]),
    ));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, BACKUP_TABLE_LABELS[tableName]);
  }
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

export function downloadBackupFile(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ledger-respaldo-${backup.exportado.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadExcelFile(workbook, date = new Date()) {
  const file = new Blob([workbook], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ledger-datos-${date.toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
